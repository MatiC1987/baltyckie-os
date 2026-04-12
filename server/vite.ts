import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

interface AppMeta {
  manifest: string;
  appleIcon: string;
  themeColor: string;
  title: string;
  splashIcon: string;
}

function getAppMeta(url: string): AppMeta {
  const pathname = url.split('?')[0];

  if (pathname.startsWith('/rcp')) {
    return {
      manifest: '/manifest-rcp.json',
      appleIcon: '/apple-touch-icon-rcp.png',
      themeColor: '#4f46e5',
      title: 'RCP — Bałtyckie',
      splashIcon: '/icon-rcp-512.png',
    };
  }

  if (pathname.startsWith('/recepcja')) {
    return {
      manifest: '/manifest-recepcja.json',
      appleIcon: '/apple-touch-icon-recepcja.png',
      themeColor: '#0f766e',
      title: 'Recepcja — Bałtyckie',
      splashIcon: '/icon-recepcja-512.png',
    };
  }

  return {
    manifest: '/manifest.json',
    appleIcon: '/apple-touch-icon-finanse.png',
    themeColor: '#1a1a2e',
    title: 'Bałtyckie Finanse',
    splashIcon: '/icon-finanse-512.png',
  };
}

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const meta = getAppMeta(url);

      // Inject per-app manifest
      template = template.replace(
        `<link rel="manifest" href="/manifest.json" />`,
        `<link rel="manifest" href="${meta.manifest}" />`,
      );

      // Inject per-app apple-touch-icon
      template = template.replace(
        `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
        `<link rel="apple-touch-icon" href="${meta.appleIcon}" />`,
      );

      // Inject per-app theme-color
      template = template.replace(
        `<meta name="theme-color" content="#1a1a2e" />`,
        `<meta name="theme-color" content="${meta.themeColor}" />`,
      );

      // Inject per-app apple-mobile-web-app-title
      template = template.replace(
        `<meta name="apple-mobile-web-app-title" content="Bałtyckie Finanse" />`,
        `<meta name="apple-mobile-web-app-title" content="${meta.title}" />`,
      );

      // Inject per-app splash screen icon
      template = template.replace(
        `<img src="/icon-512.png"`,
        `<img src="${meta.splashIcon}"`,
      );

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
