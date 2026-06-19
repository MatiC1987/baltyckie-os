---
name: executeSql vs DATABASE_URL
description: executeSql (dev/prod) łączy się z Replit-managed PostgreSQL, NIE z Neon. Aplikacja używa Neon przez DATABASE_URL.
---

## Reguła

`executeSql({ environment: "development" })` i `executeSql({ environment: "production" })` łączą się z **Replit-managed PostgreSQL** — zupełnie inną bazą niż ta, której używa aplikacja.

Aplikacja (zarówno dev jak i prod serwer) używa **Neon** przez `DATABASE_URL` (env var).

**Why:** W tej aplikacji baza Replit-managed PostgreSQL istnieje (integracja `javascript_database`), ale app używa Neon przez DATABASE_URL. Replit executeSql uderza w Replit-managed, nie w Neon. Przez to wszelkie SQL zmiany przez executeSql NIE wpływają na dane widoczne w aplikacji.

## Jak naprawić dane w produkcyjnym Neon

Jedyna pewna droga:
1. Dodaj tymczasowy endpoint do `server/routes.ts` zabezpieczony nagłówkiem `x-bootstrap-key: BaltFinBootstrap2026!`
2. Zdeploy aplikację
3. Wywołaj endpoint przez curl: `curl -X POST https://e-baltyckie.pl/api/admin/<endpoint> -H "x-bootstrap-key: BaltFinBootstrap2026!"`
4. Endpoint używa pool/db z `server/db.ts` → łączy się z Neon przez DATABASE_URL → dane aplikacji poprawione

Startup migrations w `server/index.ts` też działają (używają tego samego pool), ale logi mogą się nie pojawić w deployment log feed jeśli uruchamiają się po health check.
