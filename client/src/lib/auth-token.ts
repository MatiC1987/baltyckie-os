const AUTH_TOKEN_KEY = "bf_auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function checkUrlForToken(): boolean {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("auth_token");
  if (token) {
    setAuthToken(token);
    url.searchParams.delete("auth_token");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    return true;
  }
  return false;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { "x-auth-token": token };
  }
  return {};
}
