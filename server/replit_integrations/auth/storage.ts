import { users, webauthnCredentials, type User, type UpsertUser, type WebauthnCredential, type InsertWebauthnCredential } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getWebauthnCredentials(userId: string): Promise<WebauthnCredential[]>;
  getWebauthnCredentialById(credentialId: string): Promise<WebauthnCredential | undefined>;
  saveWebauthnCredential(credential: InsertWebauthnCredential): Promise<WebauthnCredential>;
  updateWebauthnCounter(credentialId: string, counter: number): Promise<void>;
  deleteWebauthnCredential(id: number): Promise<void>;
  deleteAllWebauthnCredentials(userId: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (err: any) {
      if (err?.message?.includes("users_email_unique") || err?.code === "23505") {
        if (userData.email) {
          await db.update(users).set({ email: null }).where(eq(users.email, userData.email));
        }
        const [user] = await db
          .insert(users)
          .values(userData)
          .onConflictDoUpdate({
            target: users.id,
            set: {
              ...userData,
              updatedAt: new Date(),
            },
          })
          .returning();
        return user;
      }
      throw err;
    }
  }

  async getWebauthnCredentials(userId: string): Promise<WebauthnCredential[]> {
    return db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  }

  async getWebauthnCredentialById(credentialId: string): Promise<WebauthnCredential | undefined> {
    const [cred] = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.credentialId, credentialId));
    return cred;
  }

  async saveWebauthnCredential(credential: InsertWebauthnCredential): Promise<WebauthnCredential> {
    const [saved] = await db.insert(webauthnCredentials).values(credential).returning();
    return saved;
  }

  async updateWebauthnCounter(credentialId: string, counter: number): Promise<void> {
    await db.update(webauthnCredentials).set({ counter }).where(eq(webauthnCredentials.credentialId, credentialId));
  }

  async deleteWebauthnCredential(id: number): Promise<void> {
    await db.delete(webauthnCredentials).where(eq(webauthnCredentials.id, id));
  }

  async deleteAllWebauthnCredentials(userId: string): Promise<void> {
    await db.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  }
}

export const authStorage = new AuthStorage();
