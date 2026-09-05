/* ══════════════════════════════════════════════════════════════════════
   pwa.js — comprueba que la app es instalable de verdad

   Ejecutar:  node pruebas/pwa.js
   Requiere:  playwright-core

   No basta con mirar los archivos: un manifiesto puede estar bien escrito
   y aun así no cumplir los requisitos de instalación. Aquí se levanta un
   servidor local (los service workers no funcionan sobre file://) y se
   comprueba el resultado en un navegador real.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { RAIZ, crearMarcador } = require("./cargar");

let chromium;
try { chromium = require("playwright-core").chromium; }
catch (e) {
  console.log("\n  playwright-core no está instalado.  cd pruebas && npm install playwright-core\n");
  process.exit(0);
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

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

/* Servidor mínimo. localhost cuenta como origen seguro, así que los
   service workers funcionan igual que sobre HTTPS. */
function levantarServidor() {
  return new Promise((resolver) => {
    const servidor = http.createServer((pet, res) => {
      let ruta = decodeURIComponent(pet.url.split("?")[0]);
      if (ruta === "/") ruta = "/index.html";
      const completa = path.join(RAIZ, ruta);
      if (!completa.startsWith(RAIZ) || !fs.existsSync(completa) || fs.statSync(completa).isDirectory()) {
        res.writeHead(404); res.end("no está"); return;
      }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(completa)] || "application/octet-stream" });
      fs.createReadStream(completa).pipe(res);
    });
    servidor.listen(0, "127.0.0.1", () => resolver({ servidor, puerto: servidor.address().port }));
  });
}

(async () => {
  const m = crearMarcador();
  const exe = buscarChromium();
  if (!exe) { console.log("\n  No hay Chromium descargado.\n"); process.exit(0); }

  const { servidor, puerto } = await levantarServidor();
  const BASE = "http://127.0.0.1:" + puerto + "/";

  const navegador = await chromium.launch({ executablePath: exe });
  const contexto = await navegador.newContext({
    viewport: { width: 390, height: 844 },     // tamaño de móvil
    isMobile: true, hasTouch: true
  });
  const pagina = await contexto.newPage();

  const errores = [];
  pagina.on("pageerror", (e) => errores.push("pageerror: " + e.message));
  pagina.on("console", (c) => {
    if (c.type() !== "error") return;
    /* Que falte PRIVADO/clave-local.js es normal en un clon del repo. */
    if (/clave-local\.js/.test(c.text())) return;
    /* Y al probar el modo sin conexión, el navegador registra el fallo de
       red que nosotros mismos provocamos. Es la prueba, no la app. */
    if (/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/.test(c.text())) return;
    errores.push("console: " + c.text());
  });

  await pagina.addInitScript(() => { window.__GMM_FORZAR_DEMO = true; });
  await pagina.goto(BASE, { waitUntil: "load" });
  await pagina.waitForTimeout(1500);

  /* ---------------------------------------------------------------- */
  m.titulo("El manifiesto llega y es válido");

  const manifiesto = await (await pagina.request.get(BASE + "manifest.json")).json();
  m.afirmar("se sirve manifest.json", !!manifiesto.name);
  m.afirmar("nombre corto para el icono", manifiesto.short_name === "givemymovies");
  m.afirmar("arranca en modo aplicación", manifiesto.display === "standalone");
  m.afirmar("rutas relativas (GitHub Pages cuelga de un subdirectorio)",
    manifiesto.start_url === "./" && manifiesto.scope === "./",
    manifiesto.start_url + " / " + manifiesto.scope);
  m.afirmar("color de fondo igual al de la app", manifiesto.background_color === "#0b0f14");
  m.afirmar("hay icono de 192", manifiesto.icons.some((i) => i.sizes === "192x192"));
  m.afirmar("hay icono de 512", manifiesto.icons.some((i) => i.sizes === "512x512"));
  m.afirmar("hay icono maskable para Android",
    manifiesto.icons.some((i) => (i.purpose || "").includes("maskable")));

  m.titulo("Los iconos existen y son PNG de verdad");
  for (const icono of manifiesto.icons) {
    const r = await pagina.request.get(BASE + icono.src);
    const buf = await r.body();
    const esPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    m.afirmar(icono.src + " (" + icono.sizes + ")", r.status() === 200 && esPng);
  }
  const apple = await pagina.request.get(BASE + "iconos/apple-touch-icon.png");
  m.afirmar("icono para iPhone", apple.status() === 200);

  /* ---------------------------------------------------------------- */
  m.titulo("El service worker se registra y toma el control");

  const registrado = await pagina.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "sin soporte";
    const r = await navigator.serviceWorker.ready;
    return r.active ? "activo" : "registrado sin activar";
  });
  m.afirmar("service worker activo", registrado === "activo", registrado);

  const cacheado = await pagina.evaluate(async () => {
    const nombres = await caches.keys();
    const app = nombres.find((n) => n.startsWith("gmm-app-"));
    if (!app) return { cache: null };
    const c = await caches.open(app);
    return { cache: app, guardados: (await c.keys()).length };
  });
  console.log("  caché: " + cacheado.cache + " con " + cacheado.guardados + " recursos");
  m.afirmar("precachea el esqueleto de la app", cacheado.guardados >= 3);

  /* ---------------------------------------------------------------- */
  m.titulo("La disponibilidad NUNCA se cachea");

  const politica = await pagina.evaluate(async () => {
    const nombres = await caches.keys();
    for (const n of nombres) {
      const c = await caches.open(n);
      for (const p of await c.keys()) {
        if (p.url.indexOf("api.themoviedb.org") !== -1) return "HAY DATOS CACHEADOS";
      }
    }
    return "limpio";
  });
  m.afirmar("ninguna respuesta de la API guardada", politica === "limpio", politica);

  /* ---------------------------------------------------------------- */
  m.titulo("Funciona sin conexión");

  await contexto.setOffline(true);
  await pagina.reload({ waitUntil: "load" });
  await pagina.waitForTimeout(1200);
  m.afirmar("la app sigue abriendo sin red",
    (await pagina.textContent(".marca-texto")).includes("givemymovies"));
  /* Desde V GMM 0044 el campo de búsqueda vive siempre en la barra fija (no
     hace falta abrir nada), y el icono de filtro abre #capaFormulario.
     Comprobarlo así vale más que mirar el DOM: si el clic abre el panel, es
     que el JS de la app también corre sin conexión. */
  m.afirmar("el buscador sigue ahí", await pagina.locator("#entrada").isVisible());
  await pagina.click("#btnFiltros");
  await pagina.waitForTimeout(250);
  m.afirmar("el panel de filtros se abre sin red",
    !(await pagina.getAttribute("#capaFormulario", "class")).includes("oculto"));
  await pagina.click("#capaFormulario .modal-cerrar");
  await pagina.waitForTimeout(200);
  await contexto.setOffline(false);

  /* ---------------------------------------------------------------- */
  m.titulo("En móvil sigue sin desbordarse");

  const desborde = await pagina.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  m.afirmar("sin desbordamiento horizontal a 390 px", desborde <= 0, "sobran " + desborde + " px");

  m.titulo("Errores en toda la sesión");
  m.afirmar("ninguno", errores.length === 0, errores.slice(0, 4).join(" | "));

  await navegador.close();
  servidor.close();
  process.exit(m.resumir() ? 1 : 0);
})().catch((e) => { console.error("REVENTÓ:", e); process.exit(1); });
