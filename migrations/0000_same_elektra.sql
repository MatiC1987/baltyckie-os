CREATE TABLE "account_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"date" date NOT NULL,
	"balance" numeric(10, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "accounting_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"report_id" integer NOT NULL,
	"note_number" text NOT NULL,
	"object_path" text NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'NOWA' NOT NULL,
	"apartment_name" text,
	"tenant_name" text,
	"media_types" text,
	"note_month" integer,
	"note_year" integer,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'BANK',
	"category" text DEFAULT 'KONTA_BANKOWE',
	"balance_source" text DEFAULT 'manual'
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_name" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"entity_name" text,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_pricing_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer NOT NULL,
	"auto_mode" boolean DEFAULT false,
	"max_change_percent" numeric(5, 2) DEFAULT '10',
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"days_ahead" integer DEFAULT 90,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer NOT NULL,
	"date" date NOT NULL,
	"current_price" numeric(10, 2) NOT NULL,
	"recommended_price" numeric(10, 2) NOT NULL,
	"confidence" numeric(3, 2),
	"reasoning" text,
	"factors" text,
	"status" text DEFAULT 'pending',
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "apartments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hotres_name" text,
	"location" text,
	"address" text,
	"owner_name" text,
	"owner_id" integer,
	"active" boolean DEFAULT true,
	"photo_url" text,
	"lease_start_date" date,
	"lease_end_date" date,
	"cleaning_fee" numeric(10, 2) DEFAULT '0',
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"hotres_type_id" integer,
	"hotres_rate_id" integer
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "app_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"permissions" text[] DEFAULT '{}',
	"active" boolean DEFAULT true,
	"profile_image_url" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "app_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "apt_cost_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"entry_id" varchar(100) NOT NULL,
	"category" varchar(200) NOT NULL,
	"month" integer NOT NULL,
	"prognoza" numeric(12, 2) DEFAULT '0',
	"realized" numeric(12, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "apt_cost_settings" (
	"entry_id" varchar(100) PRIMARY KEY NOT NULL,
	"categories" jsonb,
	"colors" jsonb,
	"entry_color" varchar(50),
	"sort_order" jsonb
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer NOT NULL,
	"contract_id" integer,
	"file_name" text NOT NULL,
	"object_path" text NOT NULL,
	"file_type" text,
	"category" text DEFAULT 'UMOWA',
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"file_name" text NOT NULL,
	"import_date" timestamp DEFAULT now(),
	"start_date" date,
	"end_date" date,
	"transaction_count" integer DEFAULT 0,
	"status" text DEFAULT 'ZAIMPORTOWANY' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"statement_id" integer NOT NULL,
	"account_id" integer,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balance" numeric(12, 2),
	"counterparty" text,
	"category" text,
	"ai_category" text,
	"matched" boolean DEFAULT false,
	"matched_expense_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blockades" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "checkout_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"settlement_date" date NOT NULL,
	"deposit_amount" numeric(12, 2) DEFAULT '0',
	"deposit_returned" numeric(12, 2) DEFAULT '0',
	"deposit_deductions" numeric(12, 2) DEFAULT '0',
	"outstanding_rent" numeric(12, 2) DEFAULT '0',
	"media_cost" numeric(12, 2) DEFAULT '0',
	"damage_cost" numeric(12, 2) DEFAULT '0',
	"other_costs" numeric(12, 2) DEFAULT '0',
	"final_balance" numeric(12, 2) DEFAULT '0',
	"notes" text,
	"damage_description" text,
	"status" text DEFAULT 'SZKIC' NOT NULL,
	"items" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text,
	"nip" text,
	"regon" text,
	"street" text,
	"postal_code" text,
	"city" text,
	"bank_account" text,
	"bank_name" text,
	"representative_name" text,
	"representative_role" text,
	"phone" text,
	"email" text,
	"logo_url" text,
	"logo_dark_url" text,
	"website_url" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitor_properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"location" text,
	"category" text DEFAULT 'standard',
	"notes" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitor_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_id" integer NOT NULL,
	"date" date NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"room_type" text,
	"source" text DEFAULT 'manual',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"apartment_id" integer,
	"category" text,
	"forecast" numeric(12, 2) DEFAULT '0',
	"actual" numeric(12, 2) DEFAULT '0',
	"source_type" text DEFAULT 'manual',
	"source_contract_id" integer,
	"location_name" text
);
--> statement-breakpoint
CREATE TABLE "cost_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"object_storage_path" text NOT NULL,
	"invoice_date" date NOT NULL,
	"invoice_month" integer NOT NULL,
	"invoice_year" integer NOT NULL,
	"comment" text,
	"status" text DEFAULT 'NOWA' NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"linked_expense_id" integer,
	"ocr_vendor" text,
	"ocr_amount" text,
	"ocr_invoice_number" text,
	"ocr_processed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "cost_schedule_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_id" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"forecast_amount" numeric(12, 2),
	"status" text DEFAULT 'NIEOPLACONE' NOT NULL,
	"paid_date" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "cost_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"active" boolean DEFAULT true,
	"link_category_id" text,
	"link_item_index" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"company_name" text,
	"nip" text,
	"street" text,
	"city" text,
	"postal_code" text,
	"country" text DEFAULT 'Polska',
	"segment" text,
	"notes" text,
	"total_stays" integer DEFAULT 0,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"last_stay_date" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer NOT NULL,
	"date" date NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"base_price" numeric(10, 2),
	"price_per_person_1" numeric(10, 2),
	"price_per_person_2" numeric(10, 2),
	"price_per_person_3" numeric(10, 2),
	"price_per_person_4" numeric(10, 2),
	"price_per_person_5" numeric(10, 2),
	"price_per_person_6" numeric(10, 2),
	"price_per_person_7" numeric(10, 2),
	"price_per_person_8" numeric(10, 2),
	"child_price_1" numeric(10, 2),
	"child_price_2" numeric(10, 2),
	"child_price_3" numeric(10, 2),
	"currency" text DEFAULT 'PLN',
	"source" text DEFAULT 'manual',
	"min_stay" integer DEFAULT 1,
	"max_stay" integer,
	"is_blocked" boolean DEFAULT false,
	"closed_to_arrival" boolean DEFAULT false,
	"closed_to_departure" boolean DEFAULT false,
	"is_auto_price" boolean DEFAULT false,
	"rule_id" integer,
	"hotres_type_id" integer,
	"hotres_rate_id" integer,
	"created_by" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_widget_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"widgets" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category_id" integer,
	"file_name" text NOT NULL,
	"object_path" text NOT NULL,
	"description" text,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"salary" numeric(12, 2),
	"hourly_rate" numeric(10, 2),
	"position" text,
	"work_hours" text,
	"trial_period" boolean DEFAULT false,
	"trial_end_date" date,
	"signed_date" date,
	"file_url" text,
	"status" text DEFAULT 'AKTYWNA' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_trainings" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"provider" text,
	"completed_date" date NOT NULL,
	"expiry_date" date,
	"certificate_number" text,
	"certificate_file_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"email" text,
	"pesel" text,
	"birth_date" date,
	"cooperation_type" text NOT NULL,
	"contract_type" text,
	"contract_start" date,
	"contract_end" date,
	"position" text NOT NULL,
	"hourly_rate" numeric(10, 2),
	"comment" text,
	"status" text DEFAULT 'AKTYWNY' NOT NULL,
	"photo_url" text,
	"pin" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"apartment_id" integer,
	"description" text,
	"type" text NOT NULL,
	"vat_amount" numeric(10, 2),
	"is_forecast" boolean DEFAULT false,
	"vendor" text,
	"invoice_issued" boolean DEFAULT false,
	"invoice_number" text,
	"recurrence_type" text,
	"recurrence_end_date" date,
	"parent_expense_id" integer
);
--> statement-breakpoint
CREATE TABLE "gocardless_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"institution_name" text NOT NULL,
	"requisition_id" text NOT NULL,
	"account_id" text,
	"local_account_id" integer,
	"iban" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "handover_protocol_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"protocol_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"condition" text,
	"comments" text,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "handover_protocol_meters" (
	"id" serial PRIMARY KEY NOT NULL,
	"protocol_id" integer NOT NULL,
	"meter_type" text NOT NULL,
	"meter_number" text,
	"reading" numeric(12, 3),
	"unit" text
);
--> statement-breakpoint
CREATE TABLE "handover_protocol_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"protocol_id" integer NOT NULL,
	"room_name" text NOT NULL,
	"walls_condition" text,
	"floor_condition" text,
	"windows_condition" text,
	"doors_condition" text,
	"comments" text,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "handover_protocols" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"protocol_type" text NOT NULL,
	"protocol_date" date NOT NULL,
	"protocol_time" text,
	"tenant_name" text NOT NULL,
	"tenant_pesel" text,
	"tenant_id_number" text,
	"apartment_name" text NOT NULL,
	"apartment_address" text,
	"notes" text,
	"status" text DEFAULT 'SZKIC' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'holiday',
	"is_recurring" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "import_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_type" text NOT NULL,
	"imported_at" timestamp DEFAULT now(),
	"records_imported" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_skipped" integer DEFAULT 0,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "installment_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_id" integer NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"principal_amount" numeric(12, 2),
	"interest_amount" numeric(12, 2),
	"status" text DEFAULT 'NIEOPLACONE' NOT NULL,
	"paid_date" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "installment_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"installment_amount" numeric(12, 2) NOT NULL,
	"number_of_installments" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"interest_rate" numeric(5, 2),
	"notes" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"document_type" text DEFAULT 'FAKTURA_VAT',
	"currency" text DEFAULT 'PLN',
	"issue_date" date NOT NULL,
	"sale_date" date,
	"due_date" date NOT NULL,
	"issue_place" text,
	"seller_name" text NOT NULL,
	"seller_nip" text,
	"seller_address" text,
	"seller_city" text,
	"seller_postal_code" text,
	"seller_country" text,
	"seller_bank_account" text,
	"seller_bank_account2" text,
	"buyer_name" text NOT NULL,
	"buyer_nip" text,
	"buyer_address" text,
	"buyer_city" text,
	"buyer_postal_code" text,
	"buyer_country" text,
	"buyer_email" text,
	"items" text NOT NULL,
	"net_amount" numeric(12, 2) NOT NULL,
	"vat_rate" text DEFAULT '23%',
	"vat_amount" numeric(12, 2),
	"gross_amount" numeric(12, 2) NOT NULL,
	"payment_status" text DEFAULT 'NIEOPLACONA',
	"payment_method" text,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"status" text DEFAULT 'WYSTAWIONA' NOT NULL,
	"source_type" text,
	"source_id" integer,
	"correction_of_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'NORMALNY' NOT NULL,
	"status" text DEFAULT 'OTWARTE' NOT NULL,
	"category" text DEFAULT 'ogólne' NOT NULL,
	"reported_by" text NOT NULL,
	"assigned_to" text,
	"photo_urls" text[],
	"cost" numeric(12, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer,
	"start_date" date NOT NULL,
	"end_date" date,
	"rent_amount" numeric(10, 2) NOT NULL,
	"community_fee" numeric(10, 2) DEFAULT '0',
	"tenant_name" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer NOT NULL,
	"comment" text,
	"status" text DEFAULT 'OCZEKUJACY' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_case_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"legal_case_id" integer NOT NULL,
	"event_date" date NOT NULL,
	"event_type" text,
	"title" text NOT NULL,
	"description" text,
	"outcome" text,
	"document_urls" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_number" text,
	"title" text NOT NULL,
	"description" text,
	"case_type" text,
	"status" text DEFAULT 'NOWA',
	"priority" text DEFAULT 'NORMALNY',
	"role" text,
	"court_name" text,
	"judge" text,
	"opposing_party" text,
	"opposing_party_contact" text,
	"lawyer_name" text,
	"lawyer_contact" text,
	"apartment_id" integer,
	"tenant_name" text,
	"claim_amount" numeric(12, 2),
	"settled_amount" numeric(12, 2),
	"legal_costs" numeric(12, 2),
	"filing_date" date,
	"next_hearing_date" date,
	"deadline_date" date,
	"closed_date" date,
	"notes" text,
	"tags" text[],
	"document_urls" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"debtor" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'AKTYWNA' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "local_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"impact" text DEFAULT 'medium',
	"color" text DEFAULT '#3b82f6',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"time_entry_id" integer,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(8, 2),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"location_id" integer,
	"distance_from_zone" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"photo_url" text,
	"sort_order" integer DEFAULT 0,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"gps_radius" integer DEFAULT 200,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_settlement_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"electricity_consumption" numeric(12, 3),
	"electricity_cost" numeric(12, 2),
	"electricity_fixed_charges" numeric(12, 2),
	"electricity_vat_rate" numeric(5, 2),
	"electricity_netto" numeric(12, 2),
	"electricity_brutto" numeric(12, 2),
	"cold_water_consumption" numeric(12, 3),
	"cold_water_cost" numeric(12, 2),
	"hot_water_consumption" numeric(12, 3),
	"hot_water_cost" numeric(12, 2),
	"total_cost" numeric(12, 2),
	"payment_status" text DEFAULT 'NIEOPLACONE' NOT NULL,
	"paid_date" date,
	"payment_method" text,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medical_exams" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"exam_name" text NOT NULL,
	"exam_date" date NOT NULL,
	"valid_until" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meter_readings_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer,
	"meter_type" text NOT NULL,
	"reading_date" date NOT NULL,
	"reading_value" numeric(12, 3) NOT NULL,
	"submitted_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"is_read" boolean DEFAULT false,
	"due_date" date,
	"target_panel" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "op_cost_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"cat_id" varchar(100) NOT NULL,
	"item_idx" integer NOT NULL,
	"month" integer NOT NULL,
	"prognoza" numeric(12, 2) DEFAULT '0',
	"realized" numeric(12, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "operational_cost_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"category_id" text NOT NULL,
	"item_index" integer NOT NULL,
	"forecast" numeric(12, 2) DEFAULT '0',
	"actual" numeric(12, 2) DEFAULT '0',
	"archived" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "owner_contract_apartments" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"apartment_id" integer NOT NULL,
	"rent_amount" numeric(12, 2),
	"additional_fees_amount" numeric(12, 2)
);
--> statement-breakpoint
CREATE TABLE "owner_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer,
	"apartment_id" integer,
	"monthly_rent" numeric(12, 2),
	"additional_fees" numeric(12, 2),
	"start_date" date,
	"end_date" date,
	"contract_type" text DEFAULT 'UMOWA',
	"parent_contract_id" integer,
	"pdf_path" text,
	"extracted_data" text,
	"status" text DEFAULT 'AKTYWNA',
	"notes" text,
	"payment_frequency" text DEFAULT 'MIESIECZNIE',
	"payment_day" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "owner_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_type" text DEFAULT 'osoba_fizyczna',
	"nip" text,
	"phone" text,
	"email" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"total_hours" numeric(8, 2) DEFAULT '0',
	"overtime_hours" numeric(8, 2) DEFAULT '0',
	"hourly_rate" numeric(10, 2),
	"base_pay" numeric(12, 2) DEFAULT '0',
	"overtime_pay" numeric(12, 2) DEFAULT '0',
	"bonus" numeric(12, 2) DEFAULT '0',
	"deductions" numeric(12, 2) DEFAULT '0',
	"gross_pay" numeric(12, 2) DEFAULT '0',
	"net_pay" numeric(12, 2) DEFAULT '0',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"status" text DEFAULT 'OTWARTY' NOT NULL,
	"total_gross" numeric(12, 2) DEFAULT '0',
	"total_net" numeric(12, 2) DEFAULT '0',
	"generated_at" timestamp,
	"approved_at" timestamp,
	"approved_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_change_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer NOT NULL,
	"date" date NOT NULL,
	"old_price" numeric(10, 2),
	"new_price" numeric(10, 2) NOT NULL,
	"changed_by" text,
	"reason" text,
	"source" text DEFAULT 'manual',
	"rule_id" integer,
	"batch_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb NOT NULL,
	"is_preset" boolean DEFAULT false,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'warning',
	"title" text NOT NULL,
	"message" text NOT NULL,
	"apartment_id" integer,
	"date" date,
	"value" numeric(10, 2),
	"threshold" numeric(10, 2),
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"season_type" text,
	"date_from" date,
	"date_to" date,
	"day_of_week" integer[],
	"modifier" numeric(10, 2) NOT NULL,
	"modifier_type" text DEFAULT 'percentage',
	"priority" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"auto_apply" boolean DEFAULT false,
	"min_stay_rule" integer,
	"max_stay_rule" integer,
	"apartment_ids" integer[],
	"location_filter" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_type" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "recepcja_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recepcja_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"role" text DEFAULT 'kierownik_recepcji',
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "recepcja_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"reservation_number" text NOT NULL,
	"apartment_id" integer,
	"apartment_ids" integer[],
	"add_date" date,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"guest_name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"prepayment" numeric(10, 2) DEFAULT '0',
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"surcharge" numeric(10, 2) DEFAULT '0',
	"status" text NOT NULL,
	"notes" text,
	"source" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "revenue_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"location_name" text,
	"apartment_id" integer,
	"forecast" numeric(12, 2) DEFAULT '0',
	"actual" numeric(12, 2) DEFAULT '0',
	"rental_type" text,
	"climate_fee_forecast" numeric(10, 2) DEFAULT '0',
	"climate_fee_actual" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "saldo_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"person_name" text
);
--> statement-breakpoint
CREATE TABLE "saldo_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"operation_name" text NOT NULL,
	"reservation_number" text,
	"guest_name" text,
	"type" text,
	"payment_method" text,
	"kasa_fiskalna" text,
	"faktura" text,
	"cash_amount" numeric(12, 2),
	"saldo" numeric(12, 2),
	"auth_code" text,
	"card_amount" numeric(12, 2),
	"notes" text,
	"entry_kind" text,
	"category" text,
	"person_name" text,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "saldo_initial_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_name" text NOT NULL,
	"initial_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	CONSTRAINT "saldo_initial_balances_person_name_unique" UNIQUE("person_name")
);
--> statement-breakpoint
CREATE TABLE "service_contract_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"category" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"object_path" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_contract_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category_id" integer,
	"contract_type" text,
	"sign_date" date,
	"duration" text,
	"end_date" date,
	"service_address" text,
	"monthly_price" numeric(10, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sublease_apartment_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"old_apartment_id" integer NOT NULL,
	"new_apartment_id" integer NOT NULL,
	"change_date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sublease_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"category" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"object_path" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sublease_change_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer,
	"changed_by" text,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sublease_electricity_charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"charge_name" text NOT NULL,
	"charge_type" text NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"valid_from" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sublease_meter_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"meter_type" text NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"valid_from" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sublease_meter_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"meter_type" text NOT NULL,
	"year_month" text,
	"reading_date" date,
	"reading" numeric(12, 3),
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sublease_meter_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"meter_type" text NOT NULL,
	"unit_price" numeric(12, 4),
	"initial_reading" numeric(12, 3),
	"initial_date" date
);
--> statement-breakpoint
CREATE TABLE "sublease_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sublease_id" integer NOT NULL,
	"apartment_id" integer,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'do_oplacenia' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subleases" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_type" text DEFAULT 'osoba_fizyczna' NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"nip" text,
	"street" text,
	"postal_code" text,
	"city" text,
	"pesel_or_passport" text,
	"id_number" text,
	"phone" text,
	"email" text,
	"invoice_email" text,
	"vat_rate" text DEFAULT '23%',
	"apartment_id" integer,
	"apartment_ids" integer[],
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"payment_day" integer,
	"rent_amount" numeric(12, 2),
	"additional_fees" numeric(12, 2),
	"media_by_meters" boolean DEFAULT false,
	"has_deposit" boolean DEFAULT false,
	"deposit_amount" numeric(12, 2),
	"deposit_return_date" date,
	"status" text DEFAULT 'AKTYWNA' NOT NULL,
	"comment" text,
	"prepared_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technical_inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"apartment_id" integer,
	"inspection_type" text NOT NULL,
	"last_date" date,
	"next_date" date NOT NULL,
	"status" text DEFAULT 'ZAPLANOWANY' NOT NULL,
	"notes" text,
	"cost" numeric(12, 2),
	"contractor" text,
	"contractor_phone" text,
	"recurrence_months" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_data_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"submitted_by" integer,
	"tenant_name" text NOT NULL,
	"tenant_pesel" text,
	"tenant_nip" text,
	"tenant_email" text,
	"tenant_phone" text,
	"tenant_address" text,
	"apartment_id" integer,
	"move_in_date" date,
	"rent_amount" numeric(10, 2),
	"deposit_amount" numeric(10, 2),
	"notes" text,
	"status" text DEFAULT 'NOWE' NOT NULL,
	"contract_pdf_path" text,
	"signed_pdf_path" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"date" date NOT NULL,
	"clock_in" timestamp NOT NULL,
	"clock_out" timestamp,
	"break_start" timestamp,
	"break_end" timestamp,
	"break_minutes" integer DEFAULT 0,
	"clock_in_location_id" integer,
	"clock_out_location_id" integer,
	"clock_in_lat" numeric(10, 7),
	"clock_in_lng" numeric(10, 7),
	"clock_out_lat" numeric(10, 7),
	"clock_out_lng" numeric(10, 7),
	"status" text DEFAULT 'AKTYWNA' NOT NULL,
	"is_outside_zone" boolean DEFAULT false,
	"note" text,
	"admin_note" text,
	"edited_by" text,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sidebar_layout" text,
	"sidebar_collapsed" text,
	"sidebar_labels" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "variable_cost_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"name" text NOT NULL,
	"forecast" numeric(12, 2) DEFAULT '0',
	"actual" numeric(12, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "work_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"location_id" integer,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"shift_name" text,
	"shift_color" text,
	"allow_early_start" boolean DEFAULT false,
	"allow_overtime" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zip_download_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"downloaded_at" timestamp DEFAULT now(),
	"downloaded_by" text NOT NULL,
	"invoice_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text[],
	"device_name" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "webauthn_credentials_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_notes" ADD CONSTRAINT "accounting_notes_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_notes" ADD CONSTRAINT "accounting_notes_report_id_media_settlement_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."media_settlement_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_pricing_config" ADD CONSTRAINT "ai_pricing_config_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_contract_id_owner_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."owner_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_statement_id_bank_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockades" ADD CONSTRAINT "blockades_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_settlements" ADD CONSTRAINT "checkout_settlements_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_rates" ADD CONSTRAINT "competitor_rates_competitor_id_competitor_properties_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitor_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_forecasts" ADD CONSTRAINT "cost_forecasts_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_invoices" ADD CONSTRAINT "cost_invoices_linked_expense_id_expenses_id_fk" FOREIGN KEY ("linked_expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_schedule_payments" ADD CONSTRAINT "cost_schedule_payments_schedule_id_cost_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."cost_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_prices" ADD CONSTRAINT "daily_prices_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_category_id_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."document_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_trainings" ADD CONSTRAINT "employee_trainings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gocardless_connections" ADD CONSTRAINT "gocardless_connections_local_account_id_accounts_id_fk" FOREIGN KEY ("local_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_protocol_items" ADD CONSTRAINT "handover_protocol_items_protocol_id_handover_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."handover_protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_protocol_meters" ADD CONSTRAINT "handover_protocol_meters_protocol_id_handover_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."handover_protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_protocol_rooms" ADD CONSTRAINT "handover_protocol_rooms_protocol_id_handover_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."handover_protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_protocols" ADD CONSTRAINT "handover_protocols_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_payments" ADD CONSTRAINT "installment_payments_schedule_id_installment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."installment_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_case_events" ADD CONSTRAINT "legal_case_events_legal_case_id_legal_cases_id_fk" FOREIGN KEY ("legal_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_logs" ADD CONSTRAINT "location_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_logs" ADD CONSTRAINT "location_logs_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_logs" ADD CONSTRAINT "location_logs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_settlement_reports" ADD CONSTRAINT "media_settlement_reports_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_exams" ADD CONSTRAINT "medical_exams_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings_log" ADD CONSTRAINT "meter_readings_log_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings_log" ADD CONSTRAINT "meter_readings_log_submitted_by_recepcja_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."recepcja_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_contract_apartments" ADD CONSTRAINT "owner_contract_apartments_contract_id_owner_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."owner_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_contract_apartments" ADD CONSTRAINT "owner_contract_apartments_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_contracts" ADD CONSTRAINT "owner_contracts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_contracts" ADD CONSTRAINT "owner_contracts_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_payments" ADD CONSTRAINT "owner_payments_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_change_history" ADD CONSTRAINT "price_change_history_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_alerts" ADD CONSTRAINT "pricing_alerts_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepcja_audit_log" ADD CONSTRAINT "recepcja_audit_log_user_id_recepcja_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."recepcja_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_forecasts" ADD CONSTRAINT "revenue_forecasts_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_contract_attachments" ADD CONSTRAINT "service_contract_attachments_contract_id_service_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."service_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_category_id_service_contract_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_contract_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_apartment_changes" ADD CONSTRAINT "sublease_apartment_changes_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_apartment_changes" ADD CONSTRAINT "sublease_apartment_changes_old_apartment_id_apartments_id_fk" FOREIGN KEY ("old_apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_apartment_changes" ADD CONSTRAINT "sublease_apartment_changes_new_apartment_id_apartments_id_fk" FOREIGN KEY ("new_apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_attachments" ADD CONSTRAINT "sublease_attachments_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_change_history" ADD CONSTRAINT "sublease_change_history_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_electricity_charges" ADD CONSTRAINT "sublease_electricity_charges_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_meter_prices" ADD CONSTRAINT "sublease_meter_prices_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_meter_readings" ADD CONSTRAINT "sublease_meter_readings_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_meter_settings" ADD CONSTRAINT "sublease_meter_settings_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_payments" ADD CONSTRAINT "sublease_payments_sublease_id_subleases_id_fk" FOREIGN KEY ("sublease_id") REFERENCES "public"."subleases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sublease_payments" ADD CONSTRAINT "sublease_payments_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subleases" ADD CONSTRAINT "subleases_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_inspections" ADD CONSTRAINT "technical_inspections_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_data_submissions" ADD CONSTRAINT "tenant_data_submissions_submitted_by_recepcja_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."recepcja_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_data_submissions" ADD CONSTRAINT "tenant_data_submissions_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_clock_in_location_id_locations_id_fk" FOREIGN KEY ("clock_in_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_clock_out_location_id_locations_id_fk" FOREIGN KEY ("clock_out_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apt_cost_data_unique" ON "apt_cost_data" USING btree ("year","entry_id","category","month");--> statement-breakpoint
CREATE UNIQUE INDEX "op_cost_data_unique" ON "op_cost_data" USING btree ("year","cat_id","item_idx","month");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");