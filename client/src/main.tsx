import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { getAuthToken } from "@/lib/auth-token";

const originalFetch = window.fetch;
window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith('/api/')) {
    const token = getAuthToken();
    if (token) {
      const headers = new Headers(init?.headers);
      if (!headers.has('x-auth-token')) {
        headers.set('x-auth-token', token);
      }
      init = { ...init, headers };
    }
  }
  return originalFetch.call(window, input, init);
};

export function setManifestForPath(path?: string) {
  const currentPath = path || window.location.pathname;
  let manifestHref = '/manifest.json';
  let themeColor = '#1a1a2e';

  if (currentPath.startsWith('/recepcja')) {
    manifestHref = '/manifest-recepcja.json';
    themeColor = '#0f766e';
  } else if (currentPath.startsWith('/zadania')) {
    manifestHref = '/manifest-zadania.json';
    themeColor = '#7c3aed';
  } else if (currentPath.startsWith('/rcp')) {
    manifestHref = '/manifest-rcp.json';
    themeColor = '#dc2626';
  }

  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    manifestLink.setAttribute('href', manifestHref);
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', themeColor);
  }
}

setManifestForPath();

createRoot(document.getElementById("root")!).render(<App />);

requestAnimationFrame(() => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    setTimeout(() => splash.remove(), 500);
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);
  });
}
