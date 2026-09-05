/* ══════════════════════════════════════════════════════════════════════
   generar.js — convierte icono.svg en los PNG que exige el manifiesto

   Ejecutar:  node iconos/generar.js
   Requiere:  playwright-core (el mismo que usan las pruebas)

   Solo hay que volver a ejecutarlo si se cambia icono.svg. Los PNG
   resultantes se versionan, para que publicar no dependa de tener
   Playwright instalado.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require("fs");
const path = require("path");

let chromium;
try {
  chromium = require(path.join(__dirname, "..", "pruebas", "node_modules", "playwright-core")).chromium;
} catch (e) {
  console.log("\n  Falta playwright-core.  cd pruebas && npm install playwright-core\n");
  process.exit(1);
}

function buscarChromium() {
  const base = path.join(process.env.LOCALAPPDATA || process.env.HOME || "", "ms-playwright");
  if (!fs.existsSync(base)) return null;
  for (const c of fs.readdirSync(base).filter((n) => n.startsWith("chromium-")).sort().reverse()) {
    for (const rel of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe",
                       "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      const r = path.join(base, c, rel);
      if (fs.existsSync(r)) return r;
    }
  }
  return null;
}

const SVG = fs.readFileSync(path.join(__dirname, "icono.svg"), "utf8");

/* Android recorta los iconos «maskable» a un círculo. El contenido debe
   caber en el 80% central, así que el normal se escala al 76% sobre un
   fondo del mismo degradado que ocupa todo el lienzo. */
function paginaMaskable() {
  return `<html><body style="margin:0">
    <div style="width:512px;height:512px;position:relative;overflow:hidden;
                background:linear-gradient(135deg,#2ee6a8,#4aa8ff 52%,#ff8a3d)">
      <svg viewBox="0 0 512 512" width="512" height="512"
           style="position:absolute;inset:0;transform:scale(0.76)">
        <path d="M203 148 L378 256 L203 364 Z" fill="#06131c" stroke="#06131c"
              stroke-width="34" stroke-linejoin="round"/>
      </svg>
    </div></body></html>`;
}

function paginaNormal() {
  return `<html><body style="margin:0;background:transparent">${SVG}</body></html>`;
}

(async () => {
  const exe = buscarChromium();
  if (!exe) { console.log("\n  No hay Chromium descargado.  npx playwright install chromium\n"); process.exit(1); }

  const navegador = await chromium.launch({ executablePath: exe });

  const trabajos = [
    { archivo: "icono-192.png",          tam: 192, html: paginaNormal() },
    { archivo: "icono-512.png",          tam: 512, html: paginaNormal() },
    { archivo: "icono-maskable-512.png", tam: 512, html: paginaMaskable() },
    { archivo: "apple-touch-icon.png",   tam: 180, html: paginaMaskable() }  // iOS no redondea: mejor sin margen
  ];

  for (const t of trabajos) {
    const pagina = await navegador.newPage({
      viewport: { width: t.tam, height: t.tam },
      deviceScaleFactor: 1
    });
    /* El SVG viene a 512; lo escalamos al tamaño pedido. */
    await pagina.setContent(t.html.replace(/width="512" height="512"(?![^>]*position)/,
      `width="${t.tam}" height="${t.tam}"`));
    if (t.tam !== 512) {
      await pagina.addStyleTag({ content:
        `body>div{transform:scale(${t.tam / 512});transform-origin:top left}` });
    }
    await pagina.screenshot({
      path: path.join(__dirname, t.archivo),
      omitBackground: true,
      clip: { x: 0, y: 0, width: t.tam, height: t.tam }
    });
    await pagina.close();
    const kb = (fs.statSync(path.join(__dirname, t.archivo)).size / 1024).toFixed(1);
    console.log("  " + t.archivo + "  " + t.tam + "x" + t.tam + "  " + kb + " KB");
  }

  await navegador.close();
  console.log("\n  Iconos generados.");
})().catch((e) => { console.error("Error: " + e.message); process.exit(1); });
