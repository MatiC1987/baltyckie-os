CREATE INDEX IF NOT EXISTS "customers_last_name_idx" ON "customers" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_total_stays_idx" ON "customers" USING btree ("total_stays");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_total_revenue_idx" ON "customers" USING btree ("total_revenue");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_last_stay_date_idx" ON "customers" USING btree ("last_stay_date");
