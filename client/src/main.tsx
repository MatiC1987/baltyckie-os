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

createRoot(document.getElementById("root")!).render(<App />);
