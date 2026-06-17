import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migratePricingTables() {
  console.log("Creating pricing tables...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_prices (
      id SERIAL PRIMARY KEY,
      apartment_id INTEGER NOT NULL REFERENCES apartments(id),
      date DATE NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      base_price DECIMAL(10,2),
      price_per_person_1 DECIMAL(10,2),
      price_per_person_2 DECIMAL(10,2),
      price_per_person_3 DECIMAL(10,2),
      price_per_person_4 DECIMAL(10,2),
      price_per_person_5 DECIMAL(10,2),
      price_per_person_6 DECIMAL(10,2),
      price_per_person_7 DECIMAL(10,2),
      price_per_person_8 DECIMAL(10,2),
      child_price_1 DECIMAL(10,2),
      child_price_2 DECIMAL(10,2),
      child_price_3 DECIMAL(10,2),
      currency TEXT DEFAULT 'PLN',
      source TEXT DEFAULT 'manual',
      min_stay INTEGER DEFAULT 1,
      max_stay INTEGER,
      is_blocked BOOLEAN DEFAULT false,
      closed_to_arrival BOOLEAN DEFAULT false,
      closed_to_departure BOOLEAN DEFAULT false,
      is_auto_price BOOLEAN DEFAULT false,
      rule_id INTEGER,
      hotres_type_id INTEGER,
      hotres_rate_id INTEGER,
      note TEXT,
      created_by TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(apartment_id, date)
    )
  `);
  console.log("✓ daily_prices");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pricing_rules (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      season_type TEXT,
      date_from DATE,
      date_to DATE,
      day_of_week INTEGER[],
      modifier DECIMAL(10,2) NOT NULL,
      modifier_type TEXT DEFAULT 'percentage',
      priority INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true,
      auto_apply BOOLEAN DEFAULT false,
      min_stay_rule INTEGER,
      max_stay_rule INTEGER,
      apartment_ids INTEGER[],
      location_filter TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ pricing_rules");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS price_change_history (
      id SERIAL PRIMARY KEY,
      apartment_id INTEGER NOT NULL REFERENCES apartments(id),
      date DATE NOT NULL,
      old_price DECIMAL(10,2),
      new_price DECIMAL(10,2) NOT NULL,
      changed_by TEXT,
      reason TEXT,
      source TEXT DEFAULT 'manual',
      rule_id INTEGER,
      batch_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ price_change_history");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pricing_alerts (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      apartment_id INTEGER REFERENCES apartments(id),
      date DATE,
      value DECIMAL(10,2),
      threshold DECIMAL(10,2),
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ pricing_alerts");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS holidays (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'holiday',
      is_recurring BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ holidays");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS price_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      config JSONB NOT NULL DEFAULT '{}',
      is_preset BOOLEAN DEFAULT false,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ price_templates");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS apartment_pricing_config (
      id SERIAL PRIMARY KEY,
      apartment_id INTEGER NOT NULL REFERENCES apartments(id) UNIQUE,
      derived_from_apartment_id INTEGER,
      derived_multiplier DECIMAL(5,3),
      derived_offset DECIMAL(10,2),
      template_id INTEGER,
      lead_time_rules JSONB DEFAULT '[]',
      orphan_day_threshold INTEGER DEFAULT 2,
      orphan_day_discount DECIMAL(5,2),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ apartment_pricing_config");

  // Add note column to daily_prices if missing
  await db.execute(sql`
    ALTER TABLE daily_prices ADD COLUMN IF NOT EXISTS note TEXT
  `);

  console.log("\n✅ All pricing tables created/verified!");
}

migratePricingTables().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
