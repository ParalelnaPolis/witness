"use strict";

const puppeteer = require("puppeteer");
const fs = require("fs");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const axios = require("axios").default;
const yargs = require("yargs");

const argv = yargs
  .option("page", {
    alias: "p",
    description: "URL address of page to verify",
    type: "string",
  })
  .option("email", {
    alias: "e",
    description: "email of party asking for verification of page content",
    type: "string",
  })
  .option("witness", {
    alias: "w",
    description: "Name of the witness running the code",
    type: "string",
  })
  .option("organisation", {
    alias: "",
    description: "Organisation providing verification",
    type: "string",
  })
  .help()
  .alias("help", "h").argv;

const today = new Date();
(async function main() {
  const browser = await puppeteer.launch();
  const [page] = await browser.pages();
  try {
    const respIP = await axios.get("https://api.ipify.org?format=json");
    const ip = respIP.data.ip;

    await page.goto(`${argv.page}`, { waitUntil: "networkidle0" });
    await autoScroll(page);
    await page.waitFor(3000);

    const cdp = await page.target().createCDPSession();
    const { data } = await cdp.send("Page.captureSnapshot", { format: "mhtml" });
    fs.writeFileSync("page.mhtml", data);

    const fileContent = fs.readFileSync("page.mhtml");
    const hash = crypto.createHash("sha256").update(fileContent).digest("hex");

    // Create a document pdf
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream("potvrdenie.pdf"));
    doc.font("freefont-ttf/sfd/FreeMono.ttf").fontSize(16).text("Čestné prehlásenie", 100, 100).fontSize(10).text(
      `
Na základe žiadosti zo stránky https://paralelnapolis.sk/witness-overenie-obsahu-na-internete/ bol vytvorený náhľad stránky
${argv.page}
pre žiadateľa: ${argv.email}
prostredníctvom open-source programu https://github.com/ParalelnaPolis/witness

Stránka obsahuje obsah, ktorý by bol zobrazený na štandardnom prehliadači Chrome prostredníctvom strojového zobrazenia stránky bez zásahu strán u koncového užívateľa.
IP adresa užívateľa: ${ip.data}
Uvedené prehlásenie môže byť použité ako nestranný dôkaz tretej strany, ktorá nemá záujem na výsledku dokazovania.
Poučenie pre súd, podľa § 100 ods. 1 zákona č. 160/2015 Z. z. civilný sporový poriadok, “Súd dbá, aby strany a ostatné predvolávané osoby boli procesnými úkonmi súdu čo najmenej zaťažované, najmä dbá, aby boli predvolávané na čas, kedy pravdepodobne bude ich účasť na procesnom úkone potrebná.” Nakoľko nie je v možnostiach združenia a jeho členov zúčastňovať sa pojednávaní v každej veci, v ktorej bol takýto dôkaz vytvorený, odporúča združenie predvolanie súdneho znalca. Dotazy orgánov verejnej moci radi zodpovieme dištančným spôsobom prostredníctvom adresy PARALELNÁ POLIS, Lermontovova 3, 81105 Bratislava, Slovenská republika alebo elektronicky na info@paralelnapolis.sk

Osoba, ktorá overila dokument prehlasuje na svoju česť, že dáta, ktoré boli z dotazovanej adresy boli v nezmenenej podobe prostredníctvom programu Puppeteer konvertované do formátu mhtml (uloženie webovej stránky), ktorý verne zachycuje obsah webovej stránky, aký by videl samotný koncový užívateľ. Hash sha256 súboru page.mhtml je ${hash}.

Dátum a čas: ${today.toLocaleString()}

${argv.organisation}

Overenie obsahu webovej stránky vykonal: ${argv.witness} - Dokument je podpísaný kvalifikovaným elektronickým podpisom alebo zaručeným elektronickým podpisom`
    );
    doc.end();
  } catch (err) {
    console.error(err);
  }
  await browser.close();
})();

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
