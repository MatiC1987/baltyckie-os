import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route, Redirect } from "wouter";
import { getCachedData, setCachedData } from "@/lib/offline-queue";
import RecepcjaLogin from "./RecepcjaLogin";
import RecepcjaLayout from "./RecepcjaLayout";
import RecepcjaDashboard from "./RecepcjaDashboard";
import RecepcjaSaldo from "./RecepcjaSaldo";
import RecepcjaUmowy from "./RecepcjaUmowy";
import RecepcjaRozliczenia from "./RecepcjaRozliczenia";
import RecepcjaTerminarz from "./RecepcjaTerminarz";
import RecepcjaRezerwacje from "./RecepcjaRezerwacje";
import RecepcjaPrzeglady from "./RecepcjaPrzeglady";
import RecepcjaDokumenty from "./RecepcjaDokumenty";
import RecepcjaRCP from "./RecepcjaRCP";
import RecepcjaLiczniki from "./RecepcjaLiczniki";
import RecepcjaProtokoly from "./RecepcjaProtokoly";
import RecepcjaNowiNajemcy from "./RecepcjaNowiNajemcy";
import RecepcjaKontakty from "./RecepcjaKontakty";
import RecepcjaHistoriaUmow from "./RecepcjaHistoriaUmow";
import RecepcjaRaportDzienny from "./RecepcjaRaportDzienny";
import RecepcjaUsterki from "./RecepcjaUsterki";
import RecepcjaZadania from "./RecepcjaZadania";
import RecepcjaInstrukcja from "./RecepcjaInstrukcja";

type RecepcjaUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string | null;
};

const RecepcjaAuthContext = createContext<{
  user: RecepcjaUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}>({ user: null, token: null, login: async () => {}, logout: () => {} });

export function useRecepcjaAuth() {
  return useContext(RecepcjaAuthContext);
}

const CACHEABLE_URLS = [
  '/api/recepcja/dashboard',
  '/api/recepcja/payment-trend',
  '/api/recepcja/accounting-notes',
  '/api/recepcja/rcp/employees',
  '/api/recepcja/notifications/unread-count',
  '/api/recepcja/tasks',
];

export async function recepcjaFetch(method: string, url: string, data?: any): Promise<Response> {
  const token = localStorage.getItem('recepcja_token');
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (data) opts.body = JSON.stringify(data);

  const isCacheable = method === 'GET' && CACHEABLE_URLS.some(u => url.startsWith(u));

  try {
    const response = await fetch(url, opts);
    if (isCacheable && response.ok) {
      const clone = response.clone();
      clone.json().then(json => {
        setCachedData(url, json, 5 * 60 * 1000).catch(() => {});
      }).catch(() => {});
    }
    return response;
  } catch (err) {
    if (isCacheable) {
      const cached = await getCachedData(url);
      if (cached !== null) {
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-From-Cache': '1' },
        });
      }
    }
    throw err;
  }
}

export default function RecepcjaApp() {
  const [user, setUser] = useState<RecepcjaUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('recepcja_token');
    if (saved) {
      fetch('/api/recepcja/auth/user', {
        headers: { Authorization: `Bearer ${saved}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(u => {
          if (u) { setUser(u); setToken(saved); }
          else localStorage.removeItem('recepcja_token');
        })
        .catch(() => localStorage.removeItem('recepcja_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/recepcja/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Błąd logowania');
    }
    const data = await res.json();
    localStorage.setItem('recepcja_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    const t = localStorage.getItem('recepcja_token');
    if (t) {
      fetch('/api/recepcja/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
    localStorage.removeItem('recepcja_token');
    setUser(null);
    setToken(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <RecepcjaAuthContext.Provider value={{ user, token, login, logout }}>
      {!user ? (
        <RecepcjaLogin />
      ) : (
        <RecepcjaLayout>
          <Switch>
            <Route path="/recepcja" component={RecepcjaDashboard} />
            <Route path="/recepcja/dashboard" component={RecepcjaDashboard} />
            <Route path="/recepcja/saldo" component={RecepcjaSaldo} />
            <Route path="/recepcja/podnajem/umowy" component={RecepcjaUmowy} />
            <Route path="/recepcja/podnajem/rozliczenia" component={RecepcjaRozliczenia} />
            <Route path="/recepcja/podnajem/nowy-najemca" component={RecepcjaNowiNajemcy} />
            <Route path="/recepcja/podnajem/historia" component={RecepcjaHistoriaUmow} />
            <Route path="/recepcja/liczniki" component={RecepcjaLiczniki} />
            <Route path="/recepcja/protokoly" component={RecepcjaProtokoly} />
            <Route path="/recepcja/dokumenty" component={RecepcjaDokumenty} />
            <Route path="/recepcja/przeglady" component={RecepcjaPrzeglady} />
            <Route path="/recepcja/rcp" component={RecepcjaRCP} />
            <Route path="/recepcja/terminarz" component={RecepcjaTerminarz} />
            <Route path="/recepcja/rezerwacje" component={RecepcjaRezerwacje} />
            <Route path="/recepcja/kontakty" component={RecepcjaKontakty} />
            <Route path="/recepcja/raport-dzienny" component={RecepcjaRaportDzienny} />
            <Route path="/recepcja/usterki" component={RecepcjaUsterki} />
            <Route path="/recepcja/zadania" component={RecepcjaZadania} />
            <Route path="/recepcja/instrukcja" component={RecepcjaInstrukcja} />
            <Route>{() => <Redirect to="/recepcja" />}</Route>
          </Switch>
        </RecepcjaLayout>
      )}
    </RecepcjaAuthContext.Provider>
  );
}