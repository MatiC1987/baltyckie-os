ALTER TABLE employees ADD COLUMN IF NOT EXISTS hide_from_rcp boolean NOT NULL DEFAULT false;
UPDATE employees SET hide_from_rcp = true WHERE first_name = 'Mateusz' AND last_name = 'Cieślak';
