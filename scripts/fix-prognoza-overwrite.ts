import { db } from "../server/db";
import { opCostData, costSchedules } from "../shared/schema";
import { eq, and, sql, isNotNull } from "drizzle-orm";

async function main() {
  console.log("Szukam wierszy op_cost_data z prognoza=0, realized>0 oraz powiązanym harmonogramem...");

  const candidates = await db
    .select({
      id: opCostData.id,
      year: opCostData.year,
      catId: opCostData.catId,
      itemIdx: opCostData.itemIdx,
      month: opCostData.month,
      prognoza: opCostData.prognoza,
      realized: opCostData.realized,
    })
    .from(opCostData)
    .where(
      and(
        eq(opCostData.prognoza, "0"),
        sql`${opCostData.realized}::numeric > 0`
      )
    );

  console.log(`Znaleziono ${candidates.length} kandydatów (prognoza=0, realized>0).`);

  const scheduleLinks = await db
    .select({
      catId: costSchedules.linkCategoryId,
      itemIdx: costSchedules.linkItemIndex,
    })
    .from(costSchedules)
    .where(
      and(
        isNotNull(costSchedules.linkCategoryId),
        isNotNull(costSchedules.linkItemIndex)
      )
    );

  const linkedSet = new Set(
    scheduleLinks
      .filter(s => s.catId != null && s.itemIdx != null)
      .map(s => `${s.catId}__${s.itemIdx}`)
  );

  console.log(`Harmonogramów powiązanych z kategoriami: ${linkedSet.size}`);

  const toFix = candidates.filter(r => linkedSet.has(`${r.catId}__${r.itemIdx}`));

  console.log(`Wierszy do naprawy (mają harmonogram): ${toFix.length}`);

  if (toFix.length === 0) {
    console.log("Brak wierszy do naprawy.");
    process.exit(0);
  }

  for (const row of toFix) {
    await db
      .update(opCostData)
      .set({ prognoza: null })
      .where(eq(opCostData.id, row.id));
    console.log(
      `  Naprawiono: id=${row.id}, catId=${row.catId}, itemIdx=${row.itemIdx}, month=${row.month}, year=${row.year} (realized=${row.realized})`
    );
  }

  console.log(`\nGotowe. Zresetowano prognoza→null dla ${toFix.length} wierszy.`);
  console.log("Harmonogramy kosztów będą teraz znowu widoczne w tabeli Kosztów Operacyjnych.");
  process.exit(0);
}

main().catch(err => {
  console.error("Błąd:", err);
  process.exit(1);
});
