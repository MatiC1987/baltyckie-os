import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateAiPricing() {
  console.log("Creating AI pricing tables...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id SERIAL PRIMARY KEY,
      apartment_id INTEGER NOT NULL REFERENCES apartments(id),
      date DATE NOT NULL,
      current_price DECIMAL(10,2) NOT NULL,
      recommended_price DECIMAL(10,2) NOT NULL,
      confidence DECIMAL(3,2),
      reasoning TEXT,
      factors TEXT,
      status TEXT DEFAULT 'pending',
      applied_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_pricing_config (
      id SERIAL PRIMARY KEY,
      apartment_id INTEGER NOT NULL REFERENCES apartments(id) UNIQUE,
      auto_mode BOOLEAN DEFAULT FALSE,
      max_change_percent DECIMAL(5,2) DEFAULT 10,
      min_price DECIMAL(10,2),
      max_price DECIMAL(10,2),
      days_ahead INTEGER DEFAULT 90,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("AI pricing tables created successfully.");
  process.exit(0);
}

migrateAiPricing().catch(e => { console.error(e); process.exit(1); });
