import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { authStorage } from "./storage";
import { db } from "../../db";
import { sql } from "drizzle-orm";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

async function ensureAuthStateTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_state (
      state_key TEXT PRIMARY KEY,
      session_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    DELETE FROM auth_state WHERE created_at < NOW() - INTERVAL '10 minutes'
  `);
}

async function saveAuthState(stateKey: string, data: any) {
  await db.execute(sql`
    INSERT INTO auth_state (state_key, session_data)
    VALUES (${stateKey}, ${JSON.stringify(data)})
    ON CONFLICT (state_key) DO UPDATE SET session_data = ${JSON.stringify(data)}, created_at = NOW()
  `);
}

async function loadAuthState(stateKey: string): Promise<any | null> {
  const result = await db.execute(sql`
    SELECT session_data FROM auth_state WHERE state_key = ${stateKey}
  `);
  if (result.rows && result.rows.length > 0) {
    await db.execute(sql`DELETE FROM auth_state WHERE state_key = ${stateKey}`);
    const data = result.rows[0].session_data;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
  return null;
}

async function saveAuthToken(token: string, userData: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    )
  `);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.execute(sql`
    INSERT INTO auth_tokens (token, user_data, expires_at)
    VALUES (${token}, ${JSON.stringify(userData)}, ${expiresAt.toISOString()})
    ON CONFLICT (token) DO UPDATE SET user_data = ${JSON.stringify(userData)}, expires_at = ${expiresAt.toISOString()}
  `);
}

async function loadAuthToken(token: string): Promise<any | null> {
  try {
    const result = await db.execute(sql`
      SELECT user_data FROM auth_tokens WHERE token = ${token} AND expires_at > NOW()
    `);
    if (result.rows && result.rows.length > 0) {
      const data = result.rows[0].user_data;
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
  } catch (e) {
  }
  return null;
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      maxAge: sessionTtl,
    } as any,
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  await ensureAuthStateTable();

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.use(async (req: any, res, next) => {
    const authToken = req.headers['x-auth-token'] as string;
    if (authToken && !req.isAuthenticated()) {
      const userData = await loadAuthToken(authToken);
      if (userData) {
        req.user = userData;
        req.login(userData, { session: false }, () => {});
      }
    }
    next();
  });

  app.get("/api/login", (req, res, next) => {
    const originalRedirect = res.redirect.bind(res);
    (res as any).redirect = function(statusOrUrl: any, url?: string) {
      const redirectUrl = typeof statusOrUrl === 'string' ? statusOrUrl : url!;
      const status = typeof statusOrUrl === 'number' ? statusOrUrl : 302;

      try {
        const parsedUrl = new URL(redirectUrl);
        const state = parsedUrl.searchParams.get('state');
        const hostname = req.hostname;
        const sessionKey = hostname;

        if (state && (req.session as any)[sessionKey]) {
          saveAuthState(state, (req.session as any)[sessionKey]).catch(err => {
            console.error("[AUTH] Failed to save auth state:", err);
          }).then(() => {
            originalRedirect(status, redirectUrl);
          });
          return;
        }
      } catch (e) {
      }

      originalRedirect(status, redirectUrl);
    };

    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", async (req: any, res, next) => {
    const state = req.query.state as string;
    const hostname = req.hostname;
    const sessionKey = hostname;

    if (state && !(req.session as any)[sessionKey]?.code_verifier) {
      const savedState = await loadAuthState(state);
      if (savedState) {
        (req.session as any)[sessionKey] = savedState;
      }
    }

    const originalRedirect = res.redirect.bind(res);
    (res as any).redirect = function(statusOrUrl: any, url?: string) {
      const redirectUrl = typeof statusOrUrl === 'string' ? statusOrUrl : url!;
      const status = typeof statusOrUrl === 'number' ? statusOrUrl : 302;

      if (req.user && redirectUrl === "/") {
        const token = crypto.randomBytes(32).toString('hex');
        saveAuthToken(token, req.user).then(() => {
          originalRedirect(status, `/?auth_token=${token}`);
        }).catch(() => {
          originalRedirect(status, redirectUrl);
        });
        return;
      }

      originalRedirect(status, redirectUrl);
    };

    ensureStrategy(hostname);
    passport.authenticate(`replitauth:${hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    const authToken = req.headers['x-auth-token'] as string;
    if (authToken) {
      db.execute(sql`DELETE FROM auth_tokens WHERE token = ${authToken}`).catch(() => {});
    }
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

async function tryTokenAuth(req: any): Promise<boolean> {
  const authToken = req.headers['x-auth-token'] as string;
  if (authToken) {
    const userData = await loadAuthToken(authToken);
    if (userData) {
      req.user = userData;
      return true;
    }
  }
  return false;
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!user) {
    if (await tryTokenAuth(req)) return next();
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!req.isAuthenticated() || !user.expires_at) {
    if (await tryTokenAuth(req)) return next();
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    if (await tryTokenAuth(req)) return next();
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    if (await tryTokenAuth(req)) return next();
    return res.status(401).json({ message: "Unauthorized" });
  }
};
