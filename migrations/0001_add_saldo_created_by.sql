ALTER TABLE saldo_entries ADD COLUMN IF NOT EXISTS created_by text;

UPDATE saldo_entries SET created_by = 'Małgorzata Latasiewicz' WHERE person_name = 'Małgorzata Latasiewicz' AND created_by IS NULL;
