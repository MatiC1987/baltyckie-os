ALTER TABLE saldo_categories ADD COLUMN IF NOT EXISTS type text DEFAULT 'KOSZT';

UPDATE saldo_categories SET type = 'KOSZT' WHERE type IS NULL;
