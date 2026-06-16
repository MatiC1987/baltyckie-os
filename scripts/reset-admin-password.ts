import bcrypt from "bcryptjs";
import { db } from "../server/db";
import { users } from "../shared/models/auth";
import { eq, sql } from "drizzle-orm";

const TARGET_EMAIL = "mateusz.cieslak@baltyckie.pl";
const NEW_PASSWORD = "Baltyckie2026!";

async function resetAdminPassword() {
  console.log(`Resetowanie hasła dla użytkownika: ${TARGET_EMAIL}`);

  const [existingUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${TARGET_EMAIL})`);

  if (!existingUser) {
    console.error(`BŁĄD: Użytkownik ${TARGET_EMAIL} nie istnieje w bazie danych.`);
    process.exit(1);
  }

  console.log(`Znaleziono użytkownika: ${existingUser.email} (id: ${existingUser.id})`);

  const saltRounds = 12;
  const newHash = await bcrypt.hash(NEW_PASSWORD, saltRounds);

  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, existingUser.id));

  console.log("✓ Hasło zostało zaktualizowane pomyślnie.");
  console.log(`  Email: ${TARGET_EMAIL}`);
  console.log(`  Nowe hasło: ${NEW_PASSWORD}`);
  console.log("\nMożesz teraz zalogować się nowymi danymi.");

  process.exit(0);
}

resetAdminPassword().catch((err) => {
  console.error("Błąd podczas resetowania hasła:", err);
  process.exit(1);
});
