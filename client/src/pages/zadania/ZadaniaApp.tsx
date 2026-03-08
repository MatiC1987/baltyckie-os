import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route, Redirect } from "wouter";
import ZadaniaLogin from "./ZadaniaLogin";
import ZadaniaMain from "./ZadaniaMain";

type ZadaniaUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  employeeId: number | null;
  taskUserId?: string;
};

const ZadaniaAuthContext = createContext<{
  user: ZadaniaUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}>({ user: null, token: null, login: async () => {}, logout: () => {} });

export function useZadaniaAuth() {
  return useContext(ZadaniaAuthContext);
}

export function zadaniaFetch(method: string, url: string, data?: any) {
  const token = localStorage.getItem('zadania_token');
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (data) opts.body = JSON.stringify(data);
  return fetch(url, opts);
}

export default function ZadaniaApp() {
  const [user, setUser] = useState<ZadaniaUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('zadania_token');
    if (saved) {
      fetch('/api/task-panel/auth/user', {
        headers: { Authorization: `Bearer ${saved}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(u => {
          if (u) { setUser(u); setToken(saved); }
          else localStorage.removeItem('zadania_token');
        })
        .catch(() => localStorage.removeItem('zadania_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/task-panel/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Błąd logowania');
    }
    const data = await res.json();
    localStorage.setItem('zadania_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    const t = localStorage.getItem('zadania_token');
    if (t) {
      fetch('/api/task-panel/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
    localStorage.removeItem('zadania_token');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ZadaniaAuthContext.Provider value={{ user, token, login, logout }}>
      <div className="min-h-screen bg-background text-foreground">
        {!user ? (
          <ZadaniaLogin />
        ) : (
          <ZadaniaMain />
        )}
      </div>
    </ZadaniaAuthContext.Provider>
  );
}
