import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const RP_NAME = "Baltyckie Finanse";

function getRpId(req: any): string {
  const host = req.hostname || "localhost";
  return host;
}

function getOrigin(req: any): string {
  const proto = req.protocol || "https";
  const host = req.get("host") || req.hostname;
  return `${proto}://${host}`;
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
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
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

async function deleteAuthToken(token: string) {
  try {
    await db.execute(sql`DELETE FROM auth_tokens WHERE token = ${token}`);
  } catch (e) {}
}

function buildUserPayload(user: any) {
  return {
    claims: { sub: user.id },
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
  };
}

export function getSession() {
  const sessionTtl = 30 * 24 * 60 * 60 * 1000;
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
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      maxAge: sessionTtl,
    } as any,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.use(async (req: any, res, next) => {
    const authToken = req.headers['x-auth-token'] as string;
    if (authToken && !req.user) {
      const userData = await loadAuthToken(authToken);
      if (userData) {
        req.user = userData;
      }
    }
    next();
  });

  app.post("/api/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email i hasło są wymagane" });
      }

      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Nieprawidłowy email lub hasło" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Nieprawidłowy email lub hasło" });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const payload = buildUserPayload(user);
      await saveAuthToken(token, payload);

      req.user = payload;

      const credentials = await authStorage.getWebauthnCredentials(user.id);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
        hasWebauthn: credentials.length > 0,
      });
    } catch (err: any) {
      console.error("[AUTH] Login error:", err);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  app.get("/api/auth/user", async (req: any, res) => {
    try {
      const authToken = req.headers['x-auth-token'] as string;
      if (!authToken) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userData = await loadAuthToken(authToken);
      if (!userData) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = userData.claims?.sub || userData.id;
      const freshUser = await authStorage.getUser(userId);
      if (!freshUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      res.json({
        id: freshUser.id,
        email: freshUser.email,
        firstName: freshUser.firstName,
        lastName: freshUser.lastName,
        profileImageUrl: freshUser.profileImageUrl,
        createdAt: freshUser.createdAt,
        updatedAt: freshUser.updatedAt,
      });
    } catch (err) {
      console.error("[AUTH] User fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/logout", async (req: any, res) => {
    const authToken = req.headers['x-auth-token'] as string || req.body?.token;
    if (authToken) {
      await deleteAuthToken(authToken);
    }
    req.user = null;
    res.json({ ok: true });
  });

  app.get("/api/webauthn/has-credentials", async (req: any, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.json({ has: false });

      const user = await authStorage.getUserByEmail(email);
      if (!user) return res.json({ has: false });

      const credentials = await authStorage.getWebauthnCredentials(user.id);
      res.json({ has: credentials.length > 0 });
    } catch (err) {
      res.json({ has: false });
    }
  });

  app.post("/api/webauthn/register/options", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const existingCredentials = await authStorage.getWebauthnCredentials(userId);

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: getRpId(req),
        userName: user.email || userId,
        userDisplayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || userId,
        attestationType: "none",
        excludeCredentials: existingCredentials.map(c => ({
          id: c.credentialId,
          transports: (c.transports || []) as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      (req.session as any).webauthnChallenge = options.challenge;
      (req.session as any).webauthnUserId = userId;

      res.json(options);
    } catch (err: any) {
      console.error("[WEBAUTHN] Register options error:", err);
      res.status(500).json({ message: "Błąd generowania opcji rejestracji" });
    }
  });

  app.post("/api/webauthn/register/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.session as any).webauthnUserId;
      const challenge = (req.session as any).webauthnChallenge;

      if (!userId || !challenge) {
        return res.status(400).json({ message: "Brak sesji rejestracji" });
      }

      const verification = await verifyRegistrationResponse({
        response: req.body.credential,
        expectedChallenge: challenge,
        expectedOrigin: getOrigin(req),
        expectedRPID: getRpId(req),
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ message: "Weryfikacja nie powiodła się" });
      }

      const { credential } = verification.registrationInfo;

      await authStorage.saveWebauthnCredential({
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: req.body.credential?.response?.transports || [],
        deviceName: req.body.deviceName || "Urządzenie",
      });

      delete (req.session as any).webauthnChallenge;
      delete (req.session as any).webauthnUserId;

      res.json({ verified: true });
    } catch (err: any) {
      console.error("[WEBAUTHN] Register verify error:", err);
      res.status(500).json({ message: "Błąd weryfikacji rejestracji" });
    }
  });

  app.post("/api/webauthn/login/options", async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email jest wymagany" });

      const user = await authStorage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

      const credentials = await authStorage.getWebauthnCredentials(user.id);
      if (credentials.length === 0) {
        return res.status(400).json({ message: "Brak zarejestrowanych urządzeń" });
      }

      const options = await generateAuthenticationOptions({
        rpID: getRpId(req),
        allowCredentials: credentials.map(c => ({
          id: c.credentialId,
          transports: (c.transports || []) as AuthenticatorTransportFuture[],
        })),
        userVerification: "preferred",
      });

      (req.session as any).webauthnChallenge = options.challenge;
      (req.session as any).webauthnLoginEmail = email;

      res.json(options);
    } catch (err: any) {
      console.error("[WEBAUTHN] Login options error:", err);
      res.status(500).json({ message: "Błąd generowania opcji logowania" });
    }
  });

  app.post("/api/webauthn/login/verify", async (req: any, res) => {
    try {
      const challenge = (req.session as any).webauthnChallenge;
      const email = (req.session as any).webauthnLoginEmail;

      if (!challenge || !email) {
        return res.status(400).json({ message: "Brak sesji logowania" });
      }

      const user = await authStorage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const credentials = await authStorage.getWebauthnCredentials(user.id);
      const credentialId = req.body.credential?.id;
      const matchingCred = credentials.find(c => c.credentialId === credentialId);

      if (!matchingCred) {
        return res.status(400).json({ message: "Nieznane urządzenie" });
      }

      const verification = await verifyAuthenticationResponse({
        response: req.body.credential,
        expectedChallenge: challenge,
        expectedOrigin: getOrigin(req),
        expectedRPID: getRpId(req),
        credential: {
          id: matchingCred.credentialId,
          publicKey: Buffer.from(matchingCred.publicKey, "base64url"),
          counter: matchingCred.counter,
          transports: (matchingCred.transports || []) as AuthenticatorTransportFuture[],
        },
      });

      if (!verification.verified) {
        return res.status(400).json({ message: "Weryfikacja biometryczna nie powiodła się" });
      }

      await authStorage.updateWebauthnCounter(matchingCred.credentialId, verification.authenticationInfo.newCounter);

      delete (req.session as any).webauthnChallenge;
      delete (req.session as any).webauthnLoginEmail;

      const token = crypto.randomBytes(32).toString('hex');
      const payload = buildUserPayload(user);
      await saveAuthToken(token, payload);

      req.user = payload;

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
      });
    } catch (err: any) {
      console.error("[WEBAUTHN] Login verify error:", err);
      res.status(500).json({ message: "Błąd weryfikacji biometrycznej" });
    }
  });

  app.get("/api/webauthn/credentials", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const credentials = await authStorage.getWebauthnCredentials(userId);
      res.json(credentials.map(c => ({
        id: c.id,
        deviceName: c.deviceName,
        createdAt: c.createdAt,
      })));
    } catch (err) {
      res.status(500).json({ message: "Błąd pobierania urządzeń" });
    }
  });

  app.delete("/api/webauthn/credentials/:id", isAuthenticated, async (req: any, res) => {
    try {
      const credId = parseInt(req.params.id);
      await authStorage.deleteWebauthnCredential(credId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Błąd usuwania urządzenia" });
    }
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
  if (req.user) {
    return next();
  }

  if (await tryTokenAuth(req)) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
};
