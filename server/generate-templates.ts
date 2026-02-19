import {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType,
  HeadingLevel, BorderStyle, TableRow, TableCell, Table, WidthType,
  ShadingType, TabStopPosition, TabStopType
} from "docx";
import fs from "fs";
import path from "path";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { db } from "./db";
import { documentTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

const logoPath = path.join(process.cwd(), "attached_assets/base_logo_white_background_1771500821040.png");
const logoBuffer = fs.readFileSync(logoPath);

function createTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({ text, bold: true, size: 28, font: "Calibri" }),
    ],
  });
}

function createHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [
      new TextRun({ text, bold: true, size: 22, font: "Calibri" }),
    ],
  });
}

function createParagraph(text: string, indent?: number): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    indent: indent ? { left: indent } : undefined,
    children: [
      new TextRun({ text, size: 20, font: "Calibri" }),
    ],
  });
}

function createBoldParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text, bold: true, size: 20, font: "Calibri" }),
    ],
  });
}

function createPlaceholder(label: string): TextRun {
  return new TextRun({
    text: `[${label}]`,
    bold: true,
    size: 20,
    font: "Calibri",
    color: "0000FF",
    highlight: "yellow",
  });
}

function mixed(parts: Array<{ text: string; bold?: boolean; placeholder?: boolean }>): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: parts.map(p => {
      if (p.placeholder) {
        return createPlaceholder(p.text);
      }
      return new TextRun({ text: p.text, bold: p.bold, size: 20, font: "Calibri" });
    }),
  });
}

function createLogo(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [
      new ImageRun({
        data: logoBuffer,
        transformation: { width: 200, height: 150 },
        type: "png",
      }),
    ],
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
}

function signatureLine(): Paragraph {
  return new Paragraph({
    spacing: { before: 600, after: 100 },
    children: [
      new TextRun({ text: "________________________                                          ________________________", size: 20, font: "Calibri" }),
    ],
  });
}

function signatureLabels(): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: "         Wynajmujący                                                                   Najemca", size: 18, font: "Calibri", italics: true }),
    ],
  });
}

function generatePhysicalPersonTemplate(): Document {
  return new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1000, right: 1200, bottom: 1000, left: 1200 } },
      },
      children: [
        createLogo(),
        createTitle("UMOWA NAJMU MIESZKANIA"),
        emptyLine(),
        mixed([
          { text: "Zawarta w dniu " },
          { text: "DATA_ZAWARCIA", placeholder: true },
          { text: " pomiędzy:" },
        ]),
        emptyLine(),
        mixed([
          { text: "1. " },
          { text: "IMIĘ_I_NAZWISKO_NAJEMCY", placeholder: true },
          { text: ", zamieszkałym/ą " },
          { text: "ADRES_NAJEMCY", placeholder: true },
          { text: "," },
        ]),
        mixed([
          { text: "   PESEL: " },
          { text: "PESEL", placeholder: true },
          { text: ", legitymującym/ą się dowodem osobistym " },
          { text: "NR_DOWODU", placeholder: true },
          { text: "," },
        ]),
        createParagraph("   zwanym/ą w dalszej części Umowy Najemcą,"),
        emptyLine(),
        createParagraph("a"),
        emptyLine(),
        mixed([
          { text: "2. " },
          { text: "NAZWA_FIRMY_WYNAJMUJĄCEGO", placeholder: true },
          { text: ", z siedzibą w " },
          { text: "ADRES_FIRMY", placeholder: true },
          { text: "," },
        ]),
        mixed([
          { text: "   NIP: " },
          { text: "NIP_WYNAJMUJĄCEGO", placeholder: true },
          { text: ", reprezentowaną przez " },
          { text: "IMIĘ_NAZWISKO_REPREZENTANTA", placeholder: true },
          { text: "," },
        ]),
        createParagraph("   zwaną w dalszej części umowy Wynajmującym."),
        emptyLine(),
        createParagraph("O następującej treści:"),
        emptyLine(),

        createHeading("§ 1 Przedmiot najmu"),
        mixed([
          { text: "1. Wynajmujący oświadcza, że przysługuje mu prawo używania lokalu mieszkalnego numer " },
          { text: "NUMER_LOKALU", placeholder: true },
          { text: ", położonego w " },
          { text: "MIEJSCOWOŚĆ", placeholder: true },
          { text: ", przy ul. " },
          { text: "ADRES_LOKALU", placeholder: true },
          { text: ", zwanego dalej Przedmiotem najmu, oraz że jest uprawniony do oddania Przedmiotu najmu w podnajem." },
        ]),
        createParagraph("2. Wynajmujący zapewnia, że Przedmiot najmu jest wolny od obciążeń na rzecz osób trzecich, oraz że w stosunku do Przedmiotu najmu nie toczy się żadne postępowanie sądowe lub administracyjne."),
        createParagraph("3. Wynajmujący oświadcza, że Przedmiot najmu jest w bardzo dobrym stanie technicznym i sanitarnym, co Najemca potwierdza."),
        createParagraph("4. Odpowiedzialność Najemców za zobowiązania wynikające z niniejszej umowy jest solidarna, dotyczy to w szczególności zapłaty czynszu, kaucji, kar umownych, dokonania napraw i pokrycia strat."),

        createHeading("§ 2 Wyposażenie"),
        createParagraph("1. Wynajmujący oddaje Najemcy Przedmiot najmu, określony w § 1, kompletnie umeblowany i wyposażony."),

        createHeading("§ 3 Przeznaczenie"),
        createParagraph("1. Przedmiot najmu będzie wykorzystywany wyłącznie na cele mieszkalne."),
        createParagraph("2. Najemca nie ma prawa dokonać podnajmu Przedmiotu najmu, określonego w § 1 niniejszej umowy."),

        createHeading("§ 4 Zwrot lokalu"),
        createParagraph("1. Po zakończeniu stosunku najmu Najemca jest zobowiązany przekazać Przedmiot najmu w stanie niepogorszonym, z uwzględnieniem normalnego zużycia, oraz do rozliczenia stosownie do protokołu zdawczo-odbiorczego, stanowiącego wykaz mebli i urządzeń przekazanych w najem wg załącznika nr 1 do niniejszej umowy."),

        createHeading("§ 5 Zmiany w lokalu"),
        createParagraph("1. Bez uprzedniej zgody Wynajmującego Najemca nie ma prawa zmieniać przeznaczenia Przedmiotu najmu ani wprowadzać zmian, które naruszyłyby konstrukcję budynku i ścian oraz zabudowy."),

        createHeading("§ 6 Okres obowiązywania"),
        mixed([
          { text: "1. Umowę niniejszą zawiera się na czas określony od dnia " },
          { text: "DATA_OD", placeholder: true },
          { text: " do dnia " },
          { text: "DATA_DO", placeholder: true },
          { text: " dla Przedmiotu najmu znajdującego się przy ul. " },
          { text: "ADRES_LOKALU", placeholder: true },
          { text: "." },
        ]),
        mixed([
          { text: "2. Strony mogą przedłużyć okres obowiązywania umowy za obopólnym porozumieniem, w formie aneksu do umowy. Wynajmujący zastrzega sobie prawo rozwiązania umowy ze skutkiem natychmiastowym w przypadku zaległości w wpłacie czynszu w pełni ustalonej wysokości, która przekroczy " },
          { text: "LICZBA_DNI_ZALEGŁOŚCI", placeholder: true },
          { text: " dni. Najemca oświadcza, że opuści Przedmiot najmu najpóźniej w ciągu 7 dni od otrzymania wypowiedzenia najmu." },
        ]),

        createHeading("§ 7 Czynsz i opłaty"),
        mixed([
          { text: "1. Najemca zapłaci Wynajmującemu miesięczny czynsz za wynajem Przedmiotu najmu w wysokości " },
          { text: "KWOTA_CZYNSZU", placeholder: true },
          { text: " zł." },
        ]),
        mixed([
          { text: "2. W okresie od " },
          { text: "DATA_PROPORCJONALNIE_OD", placeholder: true },
          { text: " do " },
          { text: "DATA_PROPORCJONALNIE_DO", placeholder: true },
          { text: " opłaty zostaną naliczone proporcjonalnie do okresu wynajmu." },
        ]),
        createParagraph("3. Opłaty będą dokonywane zgodnie z harmonogramem opłat:"),
        mixed([
          { text: "   a. " },
          { text: "SZCZEGÓŁY_HARMONOGRAMU", placeholder: true },
        ]),
        createParagraph("4. Najemca jest zobowiązany do regulowania opłat związanych z kosztami dostawy i zużycia energii elektrycznej oraz zimnej i ciepłej wody. Opłaty te uiszcza na rzecz Wynajmującego na podstawie zużycia wg stanu liczników, po otrzymaniu od Wynajmującego noty księgowej."),
        mixed([
          { text: "5. Płatności wskazane w § 7 pkt. 1-4 nastąpią do " },
          { text: "DZIEŃ_PŁATNOŚCI", placeholder: true },
          { text: " miesiąca na rachunek bankowy: " },
          { text: "NUMER_KONTA", placeholder: true },
          { text: "." },
        ]),

        createHeading("§ 8 Koszty dodatkowe"),
        createParagraph("1. Najemca nie będzie ponosił kosztów związanych z opłatami za fundusz remontowy, opłatami za przejazd do posesji, ani innych kosztów wynikających z napraw obciążających Wynajmującego."),
        createParagraph("2. Wynajmujący ubezpiecza zarówno Przedmiot najmu, jak i przedmioty ruchome pozostawione w Przedmiocie najmu od zdarzeń losowych."),

        createHeading("§ 9 Szkody"),
        createParagraph("1. W przypadku szkody w majątku ruchomym Najemcy powstałej w wyniku włamania, zalania, kradzieży, pożaru, szkody i ich skutki usuwa Najemca we własnym zakresie lub dochodzi odszkodowania od instytucji, z którą zawarł dobrowolną umowę ubezpieczenia mienia."),

        createHeading("§ 10 Kaucja"),
        mixed([
          { text: "1. Najemca wpłaci kaucję w wysokości " },
          { text: "KWOTA_KAUCJI", placeholder: true },
          { text: " zł, stanowiącą zabezpieczenie roszczeń Wynajmującego." },
        ]),
        createParagraph("2. Kaucja podlega zwrotowi w ciągu 14 dni od daty zakończenia umowy, po potrąceniu ewentualnych należności wynikających z rozliczenia końcowego."),

        createHeading("§ 11 Postanowienia końcowe"),
        createParagraph("1. Wszelkie zmiany i uzupełnienia niniejszej umowy wymagają formy pisemnej pod rygorem nieważności."),
        createParagraph("2. W sprawach nieuregulowanych niniejszą umową mają zastosowanie przepisy Kodeksu cywilnego."),
        createParagraph("3. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron."),

        emptyLine(),
        emptyLine(),
        signatureLine(),
        signatureLabels(),
      ],
    }],
  });
}

function generateCompanyTemplate(): Document {
  return new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1000, right: 1200, bottom: 1000, left: 1200 } },
      },
      children: [
        createLogo(),
        createTitle("UMOWA NAJMU POD WARUNKIEM ZAWIESZAJĄCYM"),
        emptyLine(),
        mixed([
          { text: "Zawarta w dniu " },
          { text: "DATA_ZAWARCIA", placeholder: true },
          { text: " roku w " },
          { text: "MIEJSCOWOŚĆ", placeholder: true },
          { text: " pomiędzy:" },
        ]),
        emptyLine(),
        mixed([
          { text: "1. " },
          { text: "IMIĘ_NAZWISKO_WYNAJMUJĄCEGO", placeholder: true },
          { text: ", prowadzącym działalność gospodarczą pod nazwą " },
          { text: "NAZWA_FIRMY_WYNAJMUJĄCEGO", placeholder: true },
          { text: "," },
        ]),
        mixed([
          { text: "   z siedzibą w " },
          { text: "MIEJSCOWOŚĆ_WYNAJMUJĄCEGO", placeholder: true },
          { text: " (" },
          { text: "KOD_POCZTOWY_WYNAJMUJĄCEGO", placeholder: true },
          { text: ") przy ul. " },
          { text: "ULICA_WYNAJMUJĄCEGO", placeholder: true },
          { text: "," },
        ]),
        mixed([
          { text: "   NIP: " },
          { text: "NIP_WYNAJMUJĄCEGO", placeholder: true },
          { text: ', zwanym dalej \u201EWynajmuj\u0105cym\u201D,' },
        ]),
        emptyLine(),
        createParagraph("a"),
        emptyLine(),
        mixed([
          { text: "2. " },
          { text: "NAZWA_FIRMY_NAJEMCY", placeholder: true },
          { text: " z siedzibą w " },
          { text: "MIEJSCOWOŚĆ_NAJEMCY", placeholder: true },
          { text: " (" },
          { text: "KOD_POCZTOWY_NAJEMCY", placeholder: true },
          { text: ") przy ul. " },
          { text: "ULICA_NAJEMCY", placeholder: true },
          { text: "," },
        ]),
        mixed([
          { text: "   NIP: " },
          { text: "NIP_NAJEMCY", placeholder: true },
          { text: ", REGON: " },
          { text: "REGON_NAJEMCY", placeholder: true },
          { text: ', zwanym dalej \u201ENajemc\u0105\u201D.' },
        ]),
        emptyLine(),
        createParagraph('Wynajmuj\u0105cy i Najemca s\u0105 dalej \u0142\u0105cznie zwani \u201EStronami\u201D, a ka\u017Cdy z osobna \u201EStron\u0105\u201D.'),
        emptyLine(),

        createHeading("§ 1 Przedmiot najmu"),
        mixed([
          { text: "1. Wynajmujący oświadcza, że przysługuje mu tytuł prawny do lokalu mieszkalnego znajdującego się pod adresem: " },
          { text: "ADRES_LOKALU", placeholder: true },
          { text: ', zwanego dalej \u201EPrzedmiotem najmu\u201D.' },
        ]),
        createParagraph("2. Wynajmujący oddaje do użytkowania Najemcy Przedmiot najmu wraz z wyposażeniem, a Najemca zobowiązuje się do zapłaty Wynajmującemu czynszu najmu określonego w § 3 ust. 1 niniejszej umowy oraz innych opłat wskazanych w § 4 niniejszej umowy."),
        createParagraph("3. Przekazanie Przedmiotu najmu odbędzie się na podstawie pisemnego protokołu. W przypadku gdy po stronie Najemcy występuje więcej niż jedna osoba, przekazanie Przedmiotu najmu może nastąpić do każdej z nich."),
        createParagraph("4. Najemca będzie wykorzystywał Przedmiot najmu wyłącznie na cele mieszkalne. Zmiana celu najmu wymaga uprzedniej pisemnej zgody Wynajmującego, pod rygorem nieważności."),
        createParagraph("5. Najemcy będący Przedmiotem najmu zamieszkiwać mogą wyłącznie pracownicy lub współpracownicy Najemcy."),
        createParagraph("6. Wynajmujący oświadcza, że Przedmiot najmu jest wolny od wszelkich obciążeń na rzecz osób trzecich, które w jakikolwiek sposób mogłyby utrudnić lub uniemożliwić wykonywanie uprawnień Najemcy wynikających z niniejszej umowy."),
        createParagraph("7. Najemca oświadcza, że stan techniczny i sanitarny Przedmiotu najmu wraz z wyposażeniem jest mu znany i nie zgłasza do niego żadnych zastrzeżeń."),
        createParagraph("8. Najemca oświadcza, że stan i wyposażenie Przedmiotu najmu są zgodne z jego oczekiwaniami i że nie wymaga on prac dostosowujących Przedmiot najmu do jego potrzeb."),
        createParagraph("9. Strony zgodnie postanawiają, iż wyłączają uprawnienia Najemcy z tytułu rękojmi opisane w art. 664 k.c. Wyłączenie to nie dotyczy wad Przedmiotu najmu opisanych w art. 682 k.c."),
        mixed([
          { text: "10. W dniu wydania Przedmiotu najmu Wynajmujący przekaże Najemcy " },
          { text: "ILOŚĆ_KOMPLETÓW_KLUCZY", placeholder: true },
          { text: " komplet(ów) kluczy." },
        ]),
        createParagraph("11. Najemca oświadcza, iż wyraża zgodę, by Wynajmujący dysponował zapasowym kompletem kluczy, umożliwiającym mu dostanie się do Przedmiotu najmu."),

        createHeading("§ 2 Okres obowiązywania umowy"),
        mixed([
          { text: "1. Niniejsza umowa zostaje zawarta na czas określony od dnia " },
          { text: "DATA_OD", placeholder: true },
          { text: " do dnia " },
          { text: "DATA_DO", placeholder: true },
          { text: "." },
        ]),
        createParagraph("2. Dalsze korzystanie przez Najemcę z Przedmiotu najmu po upływie okresu wskazanego w ust. 1 powyżej nie będzie uważane za przedłużenie niniejszej umowy najmu (wyłączenie stosowania art. 674 Kodeksu cywilnego)."),

        createHeading("§ 3 Czynsz najmu"),
        mixed([
          { text: "1. Strony zgodnie ustalają wysokość miesięcznego czynszu najmu za używanie Przedmiotu najmu w okresie od " },
          { text: "DATA_CZYNSZ_OD", placeholder: true },
          { text: " do " },
          { text: "DATA_CZYNSZ_DO", placeholder: true },
          { text: " na kwotę " },
          { text: "KWOTA_CZYNSZU_NETTO", placeholder: true },
          { text: " zł + " },
          { text: "KWOTA_VAT", placeholder: true },
          { text: " zł VAT, płatną na podstawie faktury VAT wystawionej przez Wynajmującego." },
        ]),
        mixed([
          { text: "2. Na okres od " },
          { text: "DATA_PROPORCJONALNIE_OD", placeholder: true },
          { text: " do " },
          { text: "DATA_PROPORCJONALNIE_DO", placeholder: true },
          { text: " opłata za wynajem wynosić będzie proporcjonalnie do okresu najmu " },
          { text: "KWOTA_PROPORCJONALNA", placeholder: true },
          { text: " zł brutto." },
        ]),
        mixed([
          { text: "3. Opłata wynajmu płatna jest z góry do " },
          { text: "DZIEŃ_PŁATNOŚCI", placeholder: true },
          { text: " każdego miesiąca na rachunek Wynajmującego: " },
          { text: "NUMER_KONTA", placeholder: true },
          { text: " lub gotówką w biurze Recepcji na ul. " },
          { text: "ADRES_RECEPCJI", placeholder: true },
          { text: "." },
        ]),
        createParagraph("4. Zmiana numeru konta bankowego Wynajmującego wymaga poinformowania Najemcy na piśmie i nie stanowi zmiany niniejszej umowy."),

        createHeading("§ 4 Inne opłaty"),
        createParagraph("1. Następujące opłaty obciążające Wynajmującego zostały ujęte w kwocie Czynszu:"),
        createParagraph("   a. opłaty z tytułu zarządzania nieruchomością,", 400),
        createParagraph("   b. wydatki na nieruchomość wspólną,", 400),
        createParagraph("   c. wywóz i usuwanie śmieci i nieczystości,", 400),
        createParagraph("   d. centralne ogrzewanie,", 400),
        createParagraph("   e. odprowadzanie ścieków.", 400),
        createParagraph("2. Dla uniknięcia wątpliwości Strony ustalają, że do realizacji świadczenia z tytułu ubezpieczenia Przedmiotu najmu uprawniony jest jedynie Wynajmujący. Wynajmujący nie odpowiada za szkody wyrządzone ruchomościom należącym do Najemcy, w szczególności powstałym w wyniku pożaru, zalania, włamania i innych zdarzeń losowych."),

        createHeading("§ 5 Kaucja zabezpieczająca"),
        mixed([
          { text: "1. Najemca wpłaci kaucję w wysokości " },
          { text: "KWOTA_KAUCJI", placeholder: true },
          { text: " zł, stanowiącą zabezpieczenie roszczeń Wynajmującego z tytułu niniejszej umowy." },
        ]),
        createParagraph("2. Kaucja podlega zwrotowi w ciągu 14 dni od daty zakończenia umowy i przekazania lokalu, po potrąceniu ewentualnych należności."),

        createHeading("§ 6 Obowiązki Najemcy"),
        createParagraph("1. Najemca zobowiązuje się do utrzymania Przedmiotu najmu w należytym stanie technicznym i sanitarnym."),
        createParagraph("2. Najemca nie może bez pisemnej zgody Wynajmującego dokonywać zmian w Przedmiocie najmu, w szczególności naruszających konstrukcję budynku."),
        createParagraph("3. Najemca nie może oddać Przedmiotu najmu do użytku osobom trzecim bez pisemnej zgody Wynajmującego."),

        createHeading("§ 7 Rozwiązanie umowy"),
        createParagraph("1. Wynajmujący może rozwiązać umowę ze skutkiem natychmiastowym w przypadku:"),
        createParagraph("   a. zalegania przez Najemcę z zapłatą czynszu lub opłat dodatkowych za co najmniej dwa pełne okresy płatności,", 400),
        createParagraph("   b. używania Przedmiotu najmu niezgodnie z jego przeznaczeniem,", 400),
        createParagraph("   c. istotnego naruszenia przez Najemcę postanowień niniejszej umowy.", 400),
        createParagraph("2. Każda ze stron może wypowiedzieć umowę z zachowaniem jednomiesięcznego okresu wypowiedzenia ze skutkiem na koniec miesiąca kalendarzowego."),

        createHeading("§ 8 Zwrot lokalu"),
        createParagraph("1. Po zakończeniu umowy Najemca jest zobowiązany wydać Przedmiot najmu w stanie niepogorszonym, z uwzględnieniem normalnego zużycia, na podstawie protokołu zdawczo-odbiorczego."),

        createHeading("§ 9 Postanowienia końcowe"),
        createParagraph("1. Wszelkie zmiany i uzupełnienia niniejszej umowy wymagają formy pisemnej pod rygorem nieważności."),
        createParagraph("2. W sprawach nieuregulowanych niniejszą umową mają zastosowanie przepisy Kodeksu cywilnego."),
        createParagraph("3. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron."),

        emptyLine(),
        emptyLine(),
        signatureLine(),
        signatureLabels(),
      ],
    }],
  });
}

async function uploadToObjectStorage(buffer: Buffer, fileName: string): Promise<string> {
  const service = new ObjectStorageService();
  const privateDir = service.getPrivateObjectDir();
  const objectName = `templates/${fileName}`;
  const fullPath = `${privateDir}/${objectName}`;

  const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
  const bucketName = parts[0];
  const objectPath = parts.slice(1).join("/");

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    metadata: {
      contentDisposition: `attachment; filename="${fileName}"`,
    },
  });

  return `/objects/${objectName}`;
}

async function main() {
  try {
    console.log("Generating physical person template...");
    const physDoc = generatePhysicalPersonTemplate();
    const physBuffer = await Packer.toBuffer(physDoc);
    console.log(`Physical person template: ${physBuffer.length} bytes`);

    console.log("Generating company template...");
    const compDoc = generateCompanyTemplate();
    const compBuffer = await Packer.toBuffer(compDoc);
    console.log(`Company template: ${compBuffer.length} bytes`);

    console.log("Uploading to Object Storage...");
    const physPath = await uploadToObjectStorage(Buffer.from(physBuffer), "umowa_najem_osoba_fizyczna.docx");
    console.log(`Physical person uploaded: ${physPath}`);

    const compPath = await uploadToObjectStorage(Buffer.from(compBuffer), "umowa_najem_firma.docx");
    console.log(`Company uploaded: ${compPath}`);

    const existingPhys = await db.select().from(documentTemplates).where(eq(documentTemplates.name, "Umowa najmu - osoba fizyczna"));
    if (existingPhys.length > 0) {
      await db.update(documentTemplates).set({ objectPath: physPath, fileName: "umowa_najem_osoba_fizyczna.docx" }).where(eq(documentTemplates.id, existingPhys[0].id));
      console.log(`Updated existing physical person template (id: ${existingPhys[0].id})`);
    } else {
      const [inserted] = await db.insert(documentTemplates).values({
        name: "Umowa najmu - osoba fizyczna",
        categoryId: 3,
        fileName: "umowa_najem_osoba_fizyczna.docx",
        objectPath: physPath,
        description: "Szablon umowy najmu mieszkania dla osoby fizycznej z placeholderami do edycji",
      }).returning();
      console.log(`Inserted physical person template (id: ${inserted.id})`);
    }

    const existingComp = await db.select().from(documentTemplates).where(eq(documentTemplates.name, "Umowa najmu - firma"));
    if (existingComp.length > 0) {
      await db.update(documentTemplates).set({ objectPath: compPath, fileName: "umowa_najem_firma.docx" }).where(eq(documentTemplates.id, existingComp[0].id));
      console.log(`Updated existing company template (id: ${existingComp[0].id})`);
    } else {
      const [inserted] = await db.insert(documentTemplates).values({
        name: "Umowa najmu - firma",
        categoryId: 3,
        fileName: "umowa_najem_firma.docx",
        objectPath: compPath,
        description: "Szablon umowy najmu pod warunkiem zawieszającym dla firmy z placeholderami do edycji",
      }).returning();
      console.log(`Inserted company template (id: ${inserted.id})`);
    }

    console.log("Done! Both templates generated, uploaded and registered.");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
