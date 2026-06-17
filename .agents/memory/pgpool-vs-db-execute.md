---
name: pgPool vs db.execute dla parametryzowanego SQL
description: Jak poprawnie wykonywać parametryzowane zapytania SQL w routes.ts
---

## Zasada

Dla zapytań z parametrami (`$1, $2, ...`) zawsze używaj `pgPool.query(queryText, paramsArray)`.

Nigdy nie używaj `db.execute(sql.raw(queryText, paramsArray))` — `sql.raw` przyjmuje **jeden** argument (string), drugi argument jest ignorowany. Parametry `$1, $2` zostają wysłane do PostgreSQL bez podstawienia i query failuje.

## Jak stosować

```typescript
// CORRECT — parametry są faktycznie podstawiane
const { rows } = await pgPool.query(
  `SELECT * FROM foo WHERE id = $1 AND date = $2`,
  [id, date]
);

// WRONG — params ignorowane, $1 nie ma wartości → PG error
const result = await db.execute(sql.raw(`SELECT * WHERE id = $1`, [id]));
```

Import: `import { db, pool as pgPool } from "./db";` (statyczny import na górze routes.ts).

**Why:** Odkryte podczas budowy modułu Cennik (#154) — 49 wywołań wymagało naprawy skryptem Python (automatyczne parsowanie zagnieżdżonych nawiasów).

**How to apply:** Przy każdym nowym bloku routes używającym raw SQL z parametrami — sprawdź czy używa `pgPool.query`, nie `db.execute(sql.raw(...))`.
