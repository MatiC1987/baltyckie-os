import express, { type Express, type Request } from "express";
import fs from "fs";
import path from "path";

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

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (req: Request, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let template = fs.readFileSync(indexPath, "utf-8");

    const meta = getAppMeta(req.originalUrl);

    template = template.replace(
      `<link rel="manifest" href="/manifest.json" />`,
      `<link rel="manifest" href="${meta.manifest}" />`,
    );

    template = template.replace(
      `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
      `<link rel="apple-touch-icon" href="${meta.appleIcon}" />`,
    );

    template = template.replace(
      `<meta name="theme-color" content="#1a1a2e" />`,
      `<meta name="theme-color" content="${meta.themeColor}" />`,
    );

    template = template.replace(
      `<meta name="apple-mobile-web-app-title" content="Bałtyckie Finanse" />`,
      `<meta name="apple-mobile-web-app-title" content="${meta.title}" />`,
    );

    template = template.replace(
      `<img src="/icon-512.png"`,
      `<img src="${meta.splashIcon}"`,
    );

    res.status(200).set({ "Content-Type": "text/html" }).end(template);
  });
}
