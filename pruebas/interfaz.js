/* ══════════════════════════════════════════════════════════════════════
   interfaz.js — recorre la app real en Chromium y comprueba que funciona

   Ejecutar:  node pruebas/interfaz.js
   Requiere:  npm install playwright-core   (dentro de pruebas/)

   Es la ÚNICA parte del proyecto con dependencia externa, y es opcional:
   la aplicación en sí no necesita npm ni nada instalado. Si falta
   playwright-core, este script lo dice y sale sin marcar fallo.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require("fs");
const path = require("path");
const { RAIZ, INDICE, crearMarcador } = require("./cargar");

let chromium;
try {
  chromium = require("playwright-core").chromium;
} catch (e) {
  console.log("\n  playwright-core no está instalado.");
  console.log("  Para ejecutar estas comprobaciones:\n");
  console.log("      cd pruebas");
  console.log("      npm install playwright-core\n");
  console.log("  Las pruebas de lógica (node pruebas/logica.js) no lo necesitan.");
  process.exit(0);
}

/** Busca un Chromium ya descargado en la caché de Playwright. */
function buscarChromium() {
  const base = path.join(process.env.LOCALAPPDATA || process.env.HOME || "", "ms-playwright");
  if (!fs.existsSync(base)) return null;
  const candidatos = fs.readdirSync(base)
    .filter((n) => n.startsWith("chromium-"))
    .sort()
    .reverse();
  for (const c of candidatos) {
    for (const rel of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe",
                       "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      const ruta = path.join(base, c, rel);
      if (fs.existsSync(ruta)) return ruta;
    }
  }
  return null;
}

const EXE = buscarChromium();
if (!EXE) {
  console.log("\n  No se encontró ningún Chromium descargado.");
  console.log("  Instálalo con:  npx playwright install chromium\n");
  process.exit(0);
}

const PAGINA = "file:///" + INDICE.replace(/\\/g, "/").replace(/ /g, "%20").replace(/\$/g, "%24");
const CAPTURAS = path.join(RAIZ, "pruebas", "capturas");

(async () => {
  const m = crearMarcador();
  if (!fs.existsSync(CAPTURAS)) fs.mkdirSync(CAPTURAS, { recursive: true });

  const navegador = await chromium.launch({ executablePath: EXE });
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const pagina = await contexto.newPage();

  /* Estas comprobaciones esperan el catálogo de demo, que es estable.
     Si existe PRIVADO/clave-local.js, la app arrancaría en vivo y los
     números cambiarían cada día; la bandera le dice que no cargue. */
  await pagina.addInitScript(() => { window.__GMM_FORZAR_DEMO = true; });

  const errores = [];
  pagina.on("pageerror", (e) => errores.push("pageerror: " + e.message));
  pagina.on("console", (c) => {
    if (c.type() !== "error") return;
    /* Que falte PRIVADO/clave-local.js es lo normal en un clon del
       repositorio: la app cae a modo demo y no se rompe nada. */
    if (/clave-local\.js/.test(c.text())) return;
    /* El SDK de Firebase se carga desde gstatic.com (V GMM 0029, única
       dependencia externa del proyecto): en un entorno sin salida a internet
       esos <script src> fallan y GMM.cuenta.disponible() queda en false sin
       romper el resto de la app — no es una regresión, es el mismo tipo de
       excepcion que ya existe para image.tmdb.org bloqueado. */
    if (/gstatic\.com/.test(c.text())) return;
    errores.push("console: " + c.text());
  });

  await pagina.goto(PAGINA);
  await pagina.waitForTimeout(600);

  /* Desde V GMM 0044 el campo de búsqueda (#entrada/#sugerencias) vive en la
     barra fija bajo el header, no dentro de ningún modal: siempre a la vista,
     también sobre los resultados. El icono de filtro (#btnFiltros) abre
     #capaFormulario, ahora un panel de filtros (idioma/plataforma/país/
     género/año/calificación y el modo actor/trama) — y como es un modal de
     verdad, con su velo por encima de todo, #entrada queda inalcanzable
     mientras está abierto: hay que cerrarlo antes de escribir. */
  async function abrirFiltros() {
    if (await pagina.locator("#capaFormulario:not(.oculto)").count() > 0) return;
    await pagina.click("#btnFiltros");
    await pagina.waitForTimeout(250);
  }
  async function cerrarFiltros() {
    if (await pagina.locator("#capaFormulario:not(.oculto)").count() === 0) return;
    await pagina.click("#capaFormulario .modal-cerrar");
    await pagina.waitForTimeout(250);
  }
  /* Sin botón «Buscar» a mano (vive en el panel de filtros, cerrado). Desde
     V GMM 0047, con la cuadrícula de sugerencias a la vista, Enter ya NO
     salta a la primera coincidencia (a propósito: el usuario pidió que las
     opciones se queden ahí para elegir con el ratón) — así que se elige la
     primera tarjeta, el mismo camino que usaría alguien real. */
  async function buscarTitulo(txt) {
    await cerrarFiltros();
    await pagina.fill("#entrada", txt);
    await pagina.waitForSelector("#sugerencias .tarjeta-img", { timeout: 5000 });
    await pagina.click("#sugerencias .tarjeta-img >> nth=0");
    await pagina.waitForTimeout(400);
  }

  /* ---------------------------------------------------------------- */
  m.titulo("Arranque");
  m.afirmar("sin errores de JavaScript", errores.length === 0, errores.join(" | "));
  m.afirmar("la marca se pinta", (await pagina.textContent(".marca-texto")).includes("givemymovies"));
  m.afirmar("arranca en modo demo (punto naranja)",
    (await pagina.getAttribute("#pastillaModo", "title")) === "Modo demo");
  m.afirmar("el selector de idioma tiene 13 opciones",
    (await pagina.locator("#selIdioma option").count()) === 13);
  m.afirmar("el selector de país tiene 6 grupos",
    (await pagina.locator("#selPais optgroup").count()) === 6);
  m.afirmar("el selector de plataformas se rellenó",
    (await pagina.locator("#selPlataforma option").count()) > 5);
  m.afirmar("idioma por defecto: español", (await pagina.inputValue("#selIdioma")) === "es");
  m.afirmar("se ve la pantalla de bienvenida",
    (await pagina.textContent("#resultados")).includes("Empieza por buscar"));
  m.afirmar("el pie muestra la versión",
    /^V GMM \d{4}$/.test((await pagina.textContent("#version-app")).trim()),
    await pagina.textContent("#version-app"));

  /* ---------------------------------------------------------------- */
  /* El inicio es lo primero que se ve: conviene tener su foto a mano. */
  await pagina.waitForTimeout(1200);   // que baje el carrusel
  await pagina.screenshot({ path: path.join(CAPTURAS, "00-inicio.png"), fullPage: true });
  m.afirmar("la barra de búsqueda fija y su icono de filtro están a la vista (V GMM 0044)",
    (await pagina.locator("#barraBusqueda").isVisible()) && (await pagina.locator("#btnFiltros").isVisible()));

  /* ---------------------------------------------------------------- */
  m.titulo("Barra de búsqueda fija al hacer scroll (V GMM 0044)");
  await pagina.evaluate(() => window.scrollTo(0, 600));
  await pagina.waitForTimeout(200);
  const posBarra = await pagina.evaluate(() => document.getElementById("barraBusqueda").getBoundingClientRect().top);
  m.afirmar("sigue arriba, junto al header, tras hacer scroll", posBarra >= 0 && posBarra < 140, "top: " + posBarra);
  await pagina.evaluate(() => window.scrollTo(0, 0));
  await pagina.waitForTimeout(150);

  /* ---------------------------------------------------------------- */
  m.titulo("El panel de filtros (V GMM 0044)");
  m.afirmar("el panel nace cerrado",
    (await pagina.getAttribute("#capaFormulario", "class")).includes("oculto"));
  m.afirmar("el modo actor/trama nace oculto", !(await pagina.locator("#panelBuscar").isVisible()));
  m.afirmar("descubrir por género nace oculto", !(await pagina.locator("#descubrir").isVisible()));
  m.afirmar("los filtros comunes nacen ocultos", !(await pagina.locator("#filtros").isVisible()));
  m.afirmar("el desplegable de orden no está en el inicio",
    !(await pagina.locator("#ordenMenu").isVisible()));

  await abrirFiltros();
  m.afirmar("el icono de filtro abre el panel con todo junto",
    !(await pagina.getAttribute("#capaFormulario", "class")).includes("oculto") &&
    (await pagina.locator("#panelBuscar").isVisible()) &&
    (await pagina.locator("#descubrir").isVisible()) &&
    (await pagina.locator("#filtros").isVisible()));
  m.afirmar("el título del panel nombra el tipo que se busca",
    (await pagina.textContent("#tituloFormulario")).includes("película"));
  m.afirmar("el pie lleva el botón Buscar centrado",
    (await pagina.locator("#capaFormulario .modal-pie.centrado #btnBuscar").count()) === 1);
  await pagina.screenshot({ path: path.join(CAPTURAS, "08-modal-buscar.png"), fullPage: true });

  await cerrarFiltros();
  m.afirmar("la X cierra el panel",
    (await pagina.getAttribute("#capaFormulario", "class")).includes("oculto"));

  /* ---------------------------------------------------------------- */
  m.titulo("Autocompletado");
  await pagina.fill("#entrada", "inter");
  await pagina.waitForTimeout(700);
  m.afirmar("sugiere al escribir", (await pagina.locator("#sugerencias .tarjeta").count()) >= 1);
  m.afirmar("la sugerencia es Interestelar",
    (await pagina.locator("#sugerencias .tarjeta-tit").first().textContent()).includes("Interestelar"));
  /* V GMM 0047: en modo título, la sugerencia es la MISMA tarjeta que
     cualquier otra cuadrícula — con nota y favorita/pendiente —, no una
     tarjeta aparte con menos funciones. */
  m.afirmar("la sugerencia lleva la nota de TMDB",
    (await pagina.locator("#sugerencias .tarjeta-nota").count()) >= 1);
  m.afirmar("la sugerencia tiene botones de favorita y pendiente",
    (await pagina.locator("#sugerencias .marca-boton.fav").count()) >= 1 &&
    (await pagina.locator("#sugerencias .marca-boton.pen").count()) >= 1);
  await pagina.screenshot({ path: path.join(CAPTURAS, "13-sugerencias.png"), fullPage: true });

  /* Pedido explícito del usuario (V GMM 0047): con la cuadrícula a la vista,
     Enter YA NO salta a la primera coincidencia — las opciones se quedan
     ahí para elegir con el ratón. Antes de esta versión, esto habría
     navegado directo a la ficha de Interestelar. */
  await pagina.press("#entrada", "Enter");
  await pagina.waitForTimeout(300);
  m.afirmar("Enter con la cuadrícula a la vista NO navega: las sugerencias se quedan",
    (await pagina.locator("#sugerencias .tarjeta").count()) >= 1 &&
    (await pagina.locator(".ficha-titulo").count()) === 0);

  /* Bug real reportado por el usuario probando la app publicada (V GMM 0048):
     "cuando toco el botón para reproducir se sale de la búsqueda, incluso si
     toco otra parte de la pantalla". Causa: #entrada tenía un cierre por
     "perder el foco" (blur) heredado de cuando las sugerencias eran un
     cuadro desplegable pequeño — con la cuadrícula a pantalla completa,
     CUALQUIER clic dentro de ella (favorita, reproducir…) le quita el foco
     al campo y disparaba ese cierre por su cuenta, delante del clic que se
     estaba dando. Se quitó el cierre por blur; el cierre por "clic fuera"
     (que sí distingue dentro/fuera de #sugerencias) sigue intacto. */
  await pagina.click("#sugerencias .marca-boton.fav >> nth=0");
  await pagina.waitForTimeout(250);
  m.afirmar("marcar favorita desde una sugerencia NO cierra la cuadrícula",
    (await pagina.locator("#sugerencias .tarjeta").count()) >= 1 &&
    (await pagina.locator("#sugerencias .marca-boton.fav.puesto").count()) === 1);
  m.afirmar("y sí que la marca (el contador sube)",
    (await pagina.textContent("#contadorListas")).trim() === "1");
  /* Se deja como estaba, que la sección "Listas" más abajo cuenta desde 0. */
  await pagina.click("#sugerencias .marca-boton.fav >> nth=0");
  await pagina.waitForTimeout(250);
  m.afirmar("y quitarla tampoco cierra la cuadrícula",
    (await pagina.locator("#sugerencias .tarjeta").count()) >= 1 &&
    (await pagina.textContent("#contadorListas")).trim() === "0");

  /* ---------------------------------------------------------------- */
  m.titulo("Buscar Interestelar en español");
  await pagina.click("#sugerencias .tarjeta-img >> nth=0");
  await pagina.waitForSelector(".ficha-titulo", { timeout: 5000 });

  m.afirmar("título correcto", (await pagina.textContent(".ficha-titulo")).trim() === "Interestelar");
  const resumen = (await pagina.textContent(".resumen-txt")).replace(/\s+/g, " ").trim();
  m.nota("frase: " + resumen);
  m.afirmar("la frase menciona el idioma", resumen.includes("en español"));
  m.afirmar("aparece el aviso de estimación", (await pagina.locator(".nota-idioma").count()) === 1);
  m.afirmar("pinta 6 países", (await pagina.locator(".pais").count()) === 6);
  m.afirmar("hay botón para ver los ocultos", (await pagina.locator("#btnMostrarTodos").count()) === 1);
  m.afirmar("hay sellos de confianza", (await pagina.locator(".sello").count()) === 6);

  await pagina.waitForTimeout(2500);   // margen para que bajen las imágenes
  const poster = await pagina.evaluate(() => {
    const img = document.querySelector(".ficha-poster img");
    return img ? { hay: true, ancho: img.naturalWidth } : { hay: false };
  });
  m.afirmar("la carátula se descarga de verdad", poster.hay && poster.ancho > 0, JSON.stringify(poster));
  await pagina.screenshot({ path: path.join(CAPTURAS, "01-pelicula.png"), fullPage: true });

  /* ---------------------------------------------------------------- */
  m.titulo("Ver todos los países");
  await pagina.click("#btnMostrarTodos");
  await pagina.waitForTimeout(300);
  m.afirmar("ahora se ven los 10", (await pagina.locator(".pais").count()) === 10);
  await pagina.click("#btnSoloIdioma");
  await pagina.waitForTimeout(300);
  m.afirmar("vuelve a 6", (await pagina.locator(".pais").count()) === 6);

  /* ---------------------------------------------------------------- */
  /* Desde V GMM 0044 el icono de filtro vive fuera de #buscador, así que
     sigue alcanzable sobre un resultado: cambiar idioma ahora refina la
     ficha QUE YA ESTÁ EN PANTALLA, sin volver antes al inicio (los
     manejadores de #selIdioma ya llamaban a repintarVista(); lo nuevo es que
     el panel se puede abrir desde aquí). Antes de esta versión no había
     forma de llegar al filtro sin pulsar ← primero. */
  m.titulo("Cambiar idioma sin salir de la ficha (V GMM 0044)");
  await abrirFiltros();
  await pagina.selectOption("#selIdioma", "ja");
  await cerrarFiltros();
  await pagina.waitForTimeout(300);
  m.afirmar("la MISMA ficha se refina a Japón sin volver al inicio ni repetir la búsqueda",
    (await pagina.textContent(".ficha-titulo")).trim() === "Interestelar" &&
    (await pagina.locator(".pais").count()) === 1 &&
    (await pagina.textContent(".pais-nombre")).includes("Japón"));
  await abrirFiltros();
  await pagina.selectOption("#selIdioma", "es");
  await cerrarFiltros();
  await pagina.waitForTimeout(300);

  /* ---------------------------------------------------------------- */
  m.titulo("Filtrar por plataforma (se elige en el panel de filtros)");
  await abrirFiltros();
  await pagina.selectOption("#selPlataforma", "Netflix");
  await buscarTitulo("Interestelar");
  await pagina.waitForSelector(".ficha-titulo", { timeout: 5000 });
  m.afirmar("con Netflix se reduce a 3 países", (await pagina.locator(".pais").count()) === 3);
  m.afirmar("la frase refleja el filtro", (await pagina.textContent(".resumen-txt")).includes("Netflix"));
  await abrirFiltros();
  await pagina.selectOption("#selPlataforma", "");

  /* ---------------------------------------------------------------- */
  m.titulo("Idioma japonés: Japón SÍ debe salir");
  await pagina.selectOption("#selIdioma", "ja");
  await buscarTitulo("Interestelar");
  await pagina.waitForSelector(".ficha-titulo", { timeout: 5000 });
  m.afirmar("solo queda Japón", (await pagina.locator(".pais").count()) === 1);
  m.afirmar("y es Japón", (await pagina.textContent(".pais-nombre")).includes("Japón"));

  m.titulo("Idioma árabe: ningún mercado lo sirve");
  await abrirFiltros();
  await pagina.selectOption("#selIdioma", "ar");
  await buscarTitulo("Interestelar");
  m.afirmar("avisa de que no hay nada en ese idioma",
    (await pagina.textContent("#resultados")).includes("ninguno cuyo catálogo se sirva en árabe"));
  m.afirmar("ofrece la salida de emergencia", (await pagina.locator("#btnMostrarTodos").count()) === 1);
  await pagina.screenshot({ path: path.join(CAPTURAS, "02-sin-idioma.png"), fullPage: true });
  await abrirFiltros();
  await pagina.selectOption("#selIdioma", "es");
  await cerrarFiltros();

  /* ---------------------------------------------------------------- */
  m.titulo("Listas");
  m.afirmar("contador a 0", (await pagina.textContent("#contadorListas")).trim() === "0");
  await buscarTitulo("Interestelar");
  await pagina.waitForSelector(".ficha-acciones .boton-lista.fav", { timeout: 5000 });
  m.afirmar("pinta 6 países en español", (await pagina.locator(".pais").count()) === 6);
  await pagina.click(".ficha-acciones .boton-lista.fav");
  await pagina.waitForTimeout(250);
  m.afirmar("contador a 1", (await pagina.textContent("#contadorListas")).trim() === "1");
  m.afirmar("el botón cambia de texto",
    (await pagina.textContent(".ficha-acciones .boton-lista.fav")).includes("En favoritas"));
  await pagina.click(".ficha-acciones .boton-lista.pen");
  await pagina.waitForTimeout(250);
  m.afirmar("contador a 2", (await pagina.textContent("#contadorListas")).trim() === "2");

  await pagina.click("#btnListas");
  await pagina.waitForTimeout(400);
  const textoListas = await pagina.textContent("#resultados");
  m.afirmar("la vista muestra pendientes", textoListas.includes("Pendientes de ver"));
  m.afirmar("la vista muestra favoritas", textoListas.includes("Favoritas"));
  /* Acotado a #resultados a propósito: desde la 0017 el carrusel del inicio
     pinta sus sugerencias con la misma clase .tarjeta y sigue en el DOM
     (solo oculto) en las demás vistas, así que sin acotar contaría de más. */
  m.afirmar("hay 2 tarjetas", (await pagina.locator("#resultados .tarjeta").count()) === 2);

  m.titulo("¿Dónde puedo verlas ahora?");
  await pagina.click("#btnDondeVerPendientes");
  await pagina.waitForTimeout(900);
  m.nota(await pagina.textContent("#textoProgreso"));
  m.afirmar("informa del resultado", (await pagina.textContent("#textoProgreso")).includes("Listo"));
  m.afirmar("etiqueta las plataformas", (await pagina.locator(".mini-plataforma").count()) > 0);
  await pagina.screenshot({ path: path.join(CAPTURAS, "03-listas.png"), fullPage: true });

  /* ---------------------------------------------------------------- */
  m.titulo("Persistencia tras recargar");
  await pagina.reload();
  await pagina.waitForTimeout(600);
  m.afirmar("el contador sobrevive", (await pagina.textContent("#contadorListas")).trim() === "2");
  m.afirmar("el idioma elegido sobrevive", (await pagina.inputValue("#selIdioma")) === "es");
  m.afirmar("el panel de filtros vuelve cerrado tras recargar",
    (await pagina.getAttribute("#capaFormulario", "class")).includes("oculto"));

  /* ---------------------------------------------------------------- */
  m.titulo("Modo actor");
  await abrirFiltros();
  await pagina.selectOption("#selBusquedaPor", "actor");
  await cerrarFiltros();
  await pagina.fill("#entrada", "Penélope");
  await pagina.waitForTimeout(700);
  await pagina.keyboard.press("Escape");
  await pagina.waitForTimeout(150);
  m.afirmar("Escape cierra las sugerencias", (await pagina.locator(".sugerencia").count()) === 0);
  await pagina.press("#entrada", "Enter");
  await pagina.waitForSelector(".persona-nombre", { timeout: 5000 });
  m.afirmar("ficha de la actriz", (await pagina.textContent(".persona-nombre")).includes("Penélope"));
  m.afirmar("hay filmografía", (await pagina.locator("#rejillaFilmografia .tarjeta").count()) >= 1);
  await pagina.click("#btnDondeVerTodas");
  await pagina.waitForTimeout(900);
  m.afirmar("consulta la disponibilidad de sus pelis",
    (await pagina.textContent("#textoProgreso")).includes("Listo"));
  await pagina.screenshot({ path: path.join(CAPTURAS, "04-actor.png"), fullPage: true });

  /* ---------------------------------------------------------------- */
  m.titulo("Modal de detalle");
  await pagina.click("#rejillaFilmografia .tarjeta-img >> nth=0");
  await pagina.waitForTimeout(800);
  m.afirmar("el modal se abre",
    !(await pagina.locator("#capaDetalle").getAttribute("class")).includes("oculto"));
  m.afirmar("el modal trae países", (await pagina.locator("#capaDetalle .pais").count()) > 0);
  await pagina.keyboard.press("Escape");
  await pagina.waitForTimeout(300);
  m.afirmar("Escape lo cierra",
    (await pagina.locator("#capaDetalle").getAttribute("class")).includes("oculto"));

  /* ---------------------------------------------------------------- */
  m.titulo("Modo trama");
  await abrirFiltros();
  await pagina.selectOption("#selBusquedaPor", "trama");
  await cerrarFiltros();
  await pagina.fill("#entrada", "viajes en el tiempo");
  await pagina.press("#entrada", "Enter");
  await pagina.waitForTimeout(800);
  m.afirmar("devuelve una cuadrícula", (await pagina.locator(".rejilla .tarjeta").count()) === 2);

  /* ---------------------------------------------------------------- */
  m.titulo("Interruptor Película / Serie");
  await abrirFiltros();
  await pagina.selectOption("#selBusquedaPor", "titulo");
  /* El interruptor vive en la barra, detrás del velo del panel: hay que
     cerrarlo para llegar a él. Es deliberado que siga ahí y no dentro. */
  await cerrarFiltros();
  await pagina.click('#tipoSwitch [data-tipo="tv"]');
  await pagina.waitForTimeout(250);
  m.afirmar("el buscador marca tipo serie",
    (await pagina.getAttribute("#buscador", "data-tipo")) === "tv");
  m.afirmar("Series queda como opción activa",
    (await pagina.getAttribute('#tipoSwitch [data-tipo="tv"]', "class")).includes("activa"));
  m.afirmar("el ejemplo del campo cambia a series",
    (await pagina.getAttribute("#entrada", "placeholder")).includes("Breaking Bad"));

  await abrirFiltros();
  m.afirmar("el título del panel pasa a decir «serie»",
    (await pagina.textContent("#tituloFormulario")).includes("serie"));
  await cerrarFiltros();
  await pagina.fill("#entrada", "casa");
  await pagina.press("#entrada", "Enter");
  await pagina.waitForSelector(".ficha-titulo", { timeout: 5000 });
  m.afirmar("encuentra la serie por título",
    (await pagina.textContent(".ficha-titulo")).includes("La casa de papel"));

  await abrirFiltros();
  m.afirmar("buscar-por, descubrir y filtros comunes se ven todos juntos",
    (await pagina.locator("#panelBuscar").isVisible()) &&
    (await pagina.locator("#descubrir").isVisible()) &&
    (await pagina.locator("#filtros").isVisible()));
  await pagina.screenshot({ path: path.join(CAPTURAS, "09-modal-descubrir.png"), fullPage: true });
  m.afirmar("el desplegable de género ofrece las cuatro colecciones (V GMM 0024)",
    (await pagina.locator('#selGenero optgroup[label="Colecciones"] option').count()) === 4);
  await pagina.selectOption("#selGenero", "18");
  await pagina.click("#btnBuscar");
  await pagina.waitForTimeout(500);
  m.afirmar("descubre series de drama", (await pagina.locator(".rejilla .tarjeta").count()) >= 3);
  m.afirmar("las tarjetas de Descubrir llevan la nota de TMDB (V GMM 0024)",
    (await pagina.locator("#resultados .tarjeta-nota").count()) >= 3);
  await pagina.screenshot({ path: path.join(CAPTURAS, "06-series.png"), fullPage: true });

  /* ---------------------------------------------------------------- */
  m.titulo("Orden e intervalo de años en Descubrir");
  await abrirFiltros();
  m.afirmar("el intervalo tiene dos extremos",
    (await pagina.locator("#selAnoDesde").count()) === 1 &&
    (await pagina.locator("#selAnoHasta").count()) === 1);
  /* Acotado a #orden: desde la 0022 los interruptores están en dos sitios —el
     formulario y el desplegable de la barra—, y sin acotar se contarían dobles. */
  m.afirmar("los tres interruptores de orden arrancan apagados",
    (await pagina.locator("#orden .orden-op.activa").count()) === 0);

  await pagina.click("#ordenReciente");
  await pagina.waitForTimeout(200);
  m.afirmar("«Más recientes» se enciende",
    (await pagina.getAttribute("#ordenReciente", "class")).includes("activa"));

  await pagina.click("#ordenAntigua");
  await pagina.waitForTimeout(200);
  m.afirmar("«Más antiguas» apaga a «Más recientes»: se excluyen",
    (await pagina.getAttribute("#ordenAntigua", "class")).includes("activa") &&
    !(await pagina.getAttribute("#ordenReciente", "class")).includes("activa"));

  await pagina.click("#ordenNota");
  await pagina.waitForTimeout(200);
  m.afirmar("«Mayor puntuación» se suma en vez de sustituir",
    (await pagina.locator("#orden .orden-op.activa").count()) === 2);

  await pagina.click("#ordenAntigua");
  await pagina.waitForTimeout(200);
  m.afirmar("volver a pulsar el que está activo lo apaga",
    (await pagina.locator("#orden .orden-op.activa").count()) === 1);
  await pagina.screenshot({ path: path.join(CAPTURAS, "07-descubrir-orden.png"), fullPage: true });

  /* Con año y nota a la vez la lista se arma año por año, y el paginador pasa
     a decir en qué año estás, porque el total global no existe. */
  await pagina.click("#ordenReciente");
  await pagina.waitForTimeout(200);
  await pagina.click("#btnBuscar");
  await pagina.waitForTimeout(900);
  const infoAnio = (await pagina.textContent(".paginador-info")).trim();
  m.afirmar("el paginador nombra el año en curso", /^\d{4} · página \d+ de \d+$/.test(infoAnio), infoAnio);
  m.afirmar("el subtítulo explica cómo está ordenado",
    (await pagina.textContent(".seccion-tit small")).includes("año a año"));

  await pagina.click('.paginador [data-ir-pagina="2"] >> nth=0');
  await pagina.waitForTimeout(900);
  const infoAnio2 = (await pagina.textContent(".paginador-info")).trim();
  m.afirmar("Siguiente salta al año anterior que tenga resultados",
    /^\d{4} · página/.test(infoAnio2) && Number(infoAnio2.slice(0, 4)) < Number(infoAnio.slice(0, 4)),
    infoAnio + " → " + infoAnio2);

  await abrirFiltros();
  await pagina.selectOption("#selAnoDesde", "2021");
  await pagina.waitForTimeout(500);
  await pagina.selectOption("#selAnoHasta", "2015");
  await pagina.waitForTimeout(700);
  m.afirmar("un intervalo del revés se endereza solo",
    (await pagina.inputValue("#selAnoDesde")) === "2015" &&
    (await pagina.inputValue("#selAnoHasta")) === "2021");

  await pagina.click("#btnBuscar");
  await pagina.waitForSelector(".seccion-tit", { timeout: 5000 });
  await pagina.waitForTimeout(400);
  m.afirmar("el título dice el intervalo",
    (await pagina.textContent(".seccion-tit")).includes("de 2015 a 2021"));

  /* Se dejan los interruptores como estaban, que lo que sigue no los espera. */
  await abrirFiltros();
  await pagina.click("#ordenReciente");
  await pagina.click("#ordenNota");
  await pagina.selectOption("#selAnoDesde", "");
  await pagina.selectOption("#selAnoHasta", "");
  await pagina.waitForTimeout(400);
  m.afirmar("se puede volver al orden por popularidad",
    (await pagina.locator("#orden .orden-op.activa").count()) === 0);

  /* ---------------------------------------------------------------- */
  m.titulo("Paginador de Descubrir");
  /* En demo hay una sola página, así que inyectamos una respuesta con varias
     para comprobar los controles y el paso de página, sin depender de red. */
  await abrirFiltros();
  await pagina.evaluate(() => {
    const base = GMM.demo.SERIES, items = [];
    for (let i = 0; i < 20; i++) items.push(Object.assign({}, base[i % base.length], { id: 900000 + i }));
    GMM.tmdb.descubrir = (tipo, opciones, p) => Promise.resolve({ items, pagina: p || 1, total: 7 });
  });
  await pagina.click("#btnBuscar");
  await pagina.waitForTimeout(300);
  m.afirmar("aparece el paginador", (await pagina.locator(".paginador").count()) >= 1);
  m.afirmar("muestra «Página 1 de 7»", (await pagina.textContent(".paginador-info")).includes("1 de 7"));
  await pagina.click('.paginador [data-ir-pagina="2"] >> nth=0');
  await pagina.waitForTimeout(300);
  m.afirmar("Siguiente avanza a la página 2", (await pagina.textContent(".paginador-info")).includes("2 de 7"));

  /* ---------------------------------------------------------------- */
  /* Cinco carruseles a la vez, uno por categoría. El modal que elegía cuál se
     veía ya no existe: con los cinco delante no elegía nada. */
  m.titulo("Cinco carruseles, uno por categoría (V GMM 0023)");
  await cerrarFiltros();
  if (await pagina.locator("#barraVolver:not(.oculto)").count() > 0) {
    await pagina.click("#btnVolver");
    await pagina.waitForTimeout(900);
  }
  m.afirmar("hay cinco bloques de carrusel",
    (await pagina.locator("#descubrimiento .carrusel-bloque").count()) === 5);
  m.afirmar("cada bloque tiene su propia pista",
    (await pagina.locator("#descubrimiento .carrusel").count()) === 5);
  const clavesPista = await pagina.evaluate(() =>
    Array.from(document.querySelectorAll("#descubrimiento .carrusel")).map((c) => c.id));
  m.afirmar("las pistas llevan el id de su categoría",
    clavesPista.join(",") === "carrusel-tendencia,carrusel-siempre,carrusel-tarde,carrusel-clasicos,carrusel-favoritas",
    clavesPista.join(","));
  m.afirmar("los cinco títulos vienen del config",
    (await pagina.evaluate(() =>
      Array.from(document.querySelectorAll(".carrusel-tit")).map((t) => t.textContent).join("|"))) ===
      "Tendencia|Las 20 de siempre|Nunca es tarde|Clásicos|Lo que prefieres");
  m.afirmar("«Ver más» solo en las tres con intervalo de años",
    (await pagina.locator("#descubrimiento [data-vermas]").count()) === 3);
  m.afirmar("ya no existe el botón «Dame sugerencias»",
    (await pagina.locator("#btnSugerencias").count()) === 0);
  m.afirmar("ni su modal", (await pagina.locator("#capaSugerencias").count()) === 0);
  /* La insignia de nota es de TMDB, no de IMDb: es la misma que ordena la lista. */
  m.afirmar("las tarjetas del carrusel llevan la nota de TMDB",
    (await pagina.locator("#carrusel-tendencia .tarjeta-nota").count()) > 0);
  m.afirmar("no queda la insignia de IMDb",
    (await pagina.locator("#descubrimiento .tarjeta-imdb").count()) === 0);
  m.afirmar("la nota se lee como un número con un decimal",
    /^★ \d+\.\d$/.test((await pagina.textContent("#carrusel-tendencia .tarjeta-nota")).trim()),
    await pagina.textContent("#carrusel-tendencia .tarjeta-nota"));
  await pagina.screenshot({ path: path.join(CAPTURAS, "11-carruseles.png"), fullPage: true });

  /* El tope son 20 por carrusel, y el catálogo de ejemplo solo tiene ocho: hay
     que inyectar una respuesta de treinta para ver si corta.

     Va en una pestaña aparte porque los carruseles se cachean por "tipo:clave"
     y a estas alturas de la sesión ya están todos cacheados: en la pestaña de
     siempre el doble no llegaría a pedirse. El stub se instala desde un
     addInitScript en DOMContentLoaded, que corre ANTES que GMM.app.iniciar
     —se registra primero— y con GMM ya definido. */
  const paginaTope = await contexto.newPage();
  await paginaTope.addInitScript(() => {
    window.__GMM_FORZAR_DEMO = true;
    document.addEventListener("DOMContentLoaded", () => {
      const base = GMM.demo.PELICULAS, items = [];
      for (let i = 0; i < 30; i++) items.push(Object.assign({}, base[i % base.length], { id: 900000 + i }));
      GMM.tmdb.tendencia = () => Promise.resolve(items);
    });
  });
  await paginaTope.goto(PAGINA);
  await paginaTope.waitForTimeout(900);
  const cuantas = await paginaTope.locator("#carrusel-tendencia .tarjeta").count();
  m.afirmar("cada carrusel corta en 20 títulos", cuantas === 20, String(cuantas));
  await paginaTope.close();

  /* ---------------------------------------------------------------- */
  /* "Ver más" pagina de corrido: 20 por página y «Página X de N». Antes decía
     «2000 · 10 mejores» porque encendía año + nota a la vez, y esa combinación
     obliga al recorrido año por año. */
  m.titulo("«Ver más» pagina de corrido, no por años");
  await pagina.evaluate(() => {
    const base = GMM.demo.PELICULAS, items = [];
    for (let i = 0; i < 20; i++) items.push(Object.assign({}, base[i % base.length], { id: 800000 + i }));
    GMM.tmdb.descubrir = (tipo, opciones, p) => Promise.resolve({ items, pagina: p || 1, total: 30 });
  });
  await pagina.click('[data-vermas="siempre"]');
  await pagina.waitForTimeout(700);
  const infoVerMas = (await pagina.textContent(".paginador-info")).trim();
  m.afirmar("el paginador dice «Página 1 de 30»", infoVerMas === "Página 1 de 30", infoVerMas);
  m.afirmar("no queda rastro de la etiqueta por año", !/^\d{4} ·/.test(infoVerMas), infoVerMas);
  m.afirmar("muestra 20 carátulas", (await pagina.locator(".rejilla .tarjeta").count()) === 20);
  await pagina.click('.paginador [data-ir-pagina="2"] >> nth=0');
  await pagina.waitForTimeout(500);
  m.afirmar("Siguiente va a la página 2 de 30",
    (await pagina.textContent(".paginador-info")).trim() === "Página 2 de 30");

  /* El desplegable de orden, junto a la flecha y en su misma fila. */
  m.titulo("Desplegable de orden junto a la flecha ←");
  m.afirmar("acompaña a la flecha", await pagina.locator("#ordenMenu").isVisible());
  m.afirmar("comparte fila con la flecha", await pagina.evaluate(() => {
    const f = document.querySelector("#btnVolver").getBoundingClientRect();
    const o = document.querySelector("#ordenMenu").getBoundingClientRect();
    return Math.abs((f.top + f.height / 2) - (o.top + o.height / 2)) < 12;
  }));
  m.afirmar("el panel arranca cerrado", !(await pagina.locator("#ordenPanel").isVisible()));
  await pagina.click("#btnOrdenMenu");
  await pagina.waitForTimeout(250);
  m.afirmar("se abre con los tres interruptores",
    (await pagina.locator("#ordenPanel .orden-op").count()) === 3);
  await pagina.screenshot({ path: path.join(CAPTURAS, "12-orden-menu.png"), fullPage: true });
  /* Las dos copias de los interruptores han de decir lo mismo. */
  await pagina.click('#ordenPanel [data-orden="nota"]');
  await pagina.waitForTimeout(600);
  m.afirmar("encender uno aquí también lo enciende en el formulario",
    (await pagina.getAttribute("#ordenNota", "class")).includes("activa"));
  m.afirmar("y reordena sin volver atrás",
    (await pagina.locator(".rejilla .tarjeta").count()) === 20);
  await pagina.click('#ordenPanel [data-orden="nota"]');   // se deja como estaba
  await pagina.waitForTimeout(500);

  /* ---------------------------------------------------------------- */
  m.titulo("Móvil, 375 px");
  await pagina.setViewportSize({ width: 375, height: 780 });
  if (await pagina.locator("#barraVolver:not(.oculto)").count() > 0) {
    await pagina.click("#btnVolver");
    await pagina.waitForTimeout(200);
  }
  await cerrarFiltros();
  await pagina.click('#tipoSwitch [data-tipo="movie"]');
  await abrirFiltros();
  await pagina.selectOption("#selBusquedaPor", "titulo");
  await buscarTitulo("Coco");
  await pagina.waitForSelector(".ficha-titulo", { timeout: 5000 });
  await pagina.waitForTimeout(900);
  m.afirmar("las sugerencias no reaparecen tras buscar",
    (await pagina.locator("#sugerencias .tarjeta, #sugerencias .sugerencia").count()) === 0);
  m.afirmar("en resultados aparece la flecha de volver",
    !(await pagina.locator("#barraVolver").getAttribute("class")).includes("oculto"));
  const desborde = await pagina.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  m.afirmar("sin desbordamiento horizontal", desborde <= 0, "sobran " + desborde + " px");
  await pagina.screenshot({ path: path.join(CAPTURAS, "05-movil.png"), fullPage: true });

  /* El panel de filtros es lo que más se estrecha: hay que verlo también aquí,
     con sus campos en una sola columna y sin comerse la pantalla entera. */
  await abrirFiltros();
  await pagina.waitForTimeout(300);
  const desbordeDescubrir = await pagina.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  m.afirmar("Descubrir tampoco desborda en el móvil", desbordeDescubrir <= 0,
    "sobran " + desbordeDescubrir + " px");
  /* No debe ocupar el 100%: el velo tiene que verse alrededor. */
  const holgura = await pagina.evaluate(() => {
    const caja = document.querySelector("#capaFormulario .modal").getBoundingClientRect();
    return { izq: Math.round(caja.left), alto: Math.round(caja.height), pantalla: window.innerHeight };
  });
  m.afirmar("el modal deja margen a los lados en el móvil", holgura.izq >= 8, JSON.stringify(holgura));
  m.afirmar("y no ocupa toda la altura de la pantalla",
    holgura.alto < holgura.pantalla, JSON.stringify(holgura));
  await pagina.screenshot({ path: path.join(CAPTURAS, "10-descubrir-movil.png"), fullPage: true });

  /* ---------------------------------------------------------------- */
  m.titulo("Ficha técnica: reparto y dirección llevan a la filmografía (V GMM 0025)");
  /* En demo las fichas no traen credits, así que se inyecta una ficha de prueba
     y se stubea la red de abrirPersona: se comprueba el marcado clicable y que
     al pulsar se pinta la vista de persona. */
  const persona = await pagina.evaluate(async () => {
    const peli = {
      tipo: "movie",
      credits: {
        cast: [{ id: 501, name: "Actriz Uno", character: "Heroína", profile_path: "/a.jpg" }],
        crew: [{ id: 601, name: "Director Uno", job: "Director", department: "Directing" }]
      }
    };
    const html = GMM.ui.fichaTecnicaHtml(peli);
    const marcado = { cast: html.includes('data-persona="501"'), dir: html.includes('data-persona="601"') };
    GMM.tmdb.persona = () => Promise.resolve({ name: "Persona Probada", profile_path: null, biography: "" });
    GMM.tmdb.filmografia = () => Promise.resolve({ interpreta: [{ id: 9, tipo: "movie", title: "T", vote_average: 7 }], dirige: [] });
    document.getElementById("resultados").innerHTML = html;
    document.querySelector('#resultados [data-persona="501"]').click();
    await new Promise((r) => setTimeout(r, 300));
    const n = document.querySelector(".persona-nombre");
    return { marcado, abrio: n ? n.textContent : null };
  });
  m.afirmar("el reparto y la dirección son botones a su persona",
    persona.marcado.cast === true && persona.marcado.dir === true, JSON.stringify(persona.marcado));
  m.afirmar("pulsar un actor abre su filmografía (vista de persona)",
    persona.abrio === "Persona Probada", JSON.stringify(persona.abrio));

  /* ---------------------------------------------------------------- */
  m.titulo("Mi copia y Mis compras (V GMM 0026, Nivel 1)");
  const bib = await pagina.evaluate(async () => {
    const peli = { id: 999001, tipo: "movie", title: "Prueba Copia", poster_path: null };
    document.getElementById("resultados").innerHTML = GMM.ui.miCopiaHtml(peli);
    document.querySelector("#resultados .mi-copia-input").value = "https://drive.google.com/file/d/TEST123abcd/view";
    document.querySelector("#resultados [data-copia-guardar]").click();
    await new Promise((r) => setTimeout(r, 60));
    return {
      reproducir: !!document.querySelector('#resultados .mi-copia-acciones a[href="https://drive.google.com/file/d/TEST123abcd/view"]'),
      descargar: !!document.querySelector('#resultados .mi-copia-acciones a[href*="uc?export=download&id=TEST123abcd"]'),
      enModelo: GMM.biblioteca.tiene(999001, "movie"),
      contador: document.getElementById("contadorBiblioteca").textContent
    };
  });
  m.afirmar("guardar la copia muestra ▶ Reproducir y ⬇ Descargar (Drive)",
    bib.reproducir && bib.descargar, JSON.stringify(bib));
  m.afirmar("la copia queda guardada y el contador de Mis compras sube",
    bib.enModelo === true && bib.contador === "1", JSON.stringify(bib));

  /* La barra vive tras el velo si el modal del formulario quedó abierto; se
     cierra para poder pulsar «Mis compras» (como haría el usuario). */
  await pagina.evaluate(() => { const c = document.getElementById("capaFormulario"); if (c) c.classList.add("oculto"); });
  /* «Mis compras» está oculto en la barra desde V GMM 0030 (a petición del
     usuario, no aportaba lo suficiente para tener sitio ahí). display:none
     no tiene caja que pinchar ni con { force: true }, así que se le quita
     el .oculto un instante para seguir probando que la vista sigue intacta
     detrás del botón — solo deja de tener entrada visible en la barra. */
  await pagina.evaluate(() => document.getElementById("btnBiblioteca").classList.remove("oculto"));
  await pagina.click("#btnBiblioteca");
  await pagina.waitForTimeout(200);
  m.afirmar("«Mis compras» lista la copia con su botón de reproducir",
    (await pagina.locator("#resultados .tarjeta").count()) >= 1 &&
    (await pagina.locator('#resultados .tarjeta-copia a[href="https://drive.google.com/file/d/TEST123abcd/view"]').count()) === 1);

  /* ---------------------------------------------------------------- */
  m.titulo("Buscar en mi Drive dentro de «Mi copia» (V GMM 0027, Nivel 2, stub)");
  const drive = await pagina.evaluate(async () => {
    /* Sin Client ID real no se puede hacer OAuth; se stubea Drive conectado y
       una búsqueda que devuelve un archivo, para probar el cableado de la UI. */
    GMM.drive.conectado = () => true;
    GMM.drive.buscar = () => Promise.resolve([{ id: "FILE9", name: "Prueba (2020).mkv", mimeType: "video/x-matroska" }]);
    const peli = { id: 999002, tipo: "movie", title: "Prueba", poster_path: null };
    document.getElementById("resultados").innerHTML = GMM.ui.miCopiaHtml(peli);
    const hayBoton = !!document.querySelector('#resultados [data-drive-buscar]');
    document.querySelector('#resultados [data-drive-buscar]').click();
    await new Promise((r) => setTimeout(r, 80));
    const hayResultado = !!document.querySelector('#resultados [data-drive-ver="FILE9"]');
    const hayDescarga = !!document.querySelector('#resultados .drive-acc a[href*="uc?export=download&id=FILE9"]');
    document.querySelector('#resultados [data-drive-ver="FILE9"]').click();
    const reproAbierto = !document.getElementById("capaReproductor").classList.contains("oculto");
    const iframeSrc = (document.querySelector("#cuerpoReproductor iframe") || {}).src || "";
    document.querySelector('#resultados [data-drive-guardar="FILE9"]').click();
    const ent = GMM.biblioteca.entrada(999002, "movie");
    /* Cerrar el visor para no dejar el iframe pidiendo a Drive. */
    document.getElementById("capaReproductor").classList.add("oculto");
    document.getElementById("cuerpoReproductor").innerHTML = "";
    return { hayBoton, hayResultado, hayDescarga, reproAbierto, iframeSrc, guardado: !!ent, enlace: ent ? ent.enlace : "" };
  });
  m.afirmar("con Drive conectado aparece «🔎 Buscar en mi Drive»", drive.hayBoton === true, JSON.stringify(drive));
  m.afirmar("la búsqueda pinta el archivo encontrado, con ⬇ Descargar directo", drive.hayResultado === true && drive.hayDescarga === true, JSON.stringify(drive));
  m.afirmar("Reproducir abre el visor de Drive embebido (iframe /preview)",
    drive.reproAbierto === true && drive.iframeSrc.indexOf("/file/d/FILE9/preview") !== -1, JSON.stringify(drive));
  m.afirmar("Guardar deja el hallazgo como Mi copia (enlace de Drive)",
    drive.guardado === true && drive.enlace.indexOf("/file/d/FILE9/view") !== -1, JSON.stringify(drive));

  /* ---------------------------------------------------------------- */
  m.titulo("Cuenta: modal de acceso (login/registro/recuperar, V GMM 0029, stub)");

  await pagina.click("#btnCuenta");
  await pagina.waitForTimeout(150);
  m.afirmar("abre en la vista «entrar»",
    (await pagina.locator("#capaCuenta:not(.oculto)").count()) === 1 &&
    (await pagina.locator("#vistaEntrar:not(.oculto)").count()) === 1);

  await pagina.click("#irARegistro");
  await pagina.waitForTimeout(100);
  m.afirmar("«Crear una cuenta» cambia de vista sin cerrar el modal",
    (await pagina.locator("#capaCuenta:not(.oculto)").count()) === 1 &&
    (await pagina.locator("#vistaRegistro:not(.oculto)").count()) === 1 &&
    (await pagina.locator("#vistaEntrar.oculto").count()) === 1);

  await pagina.click("#irAEntrarDesdeRegistro");
  await pagina.click("#irARecuperar");
  await pagina.waitForTimeout(100);
  m.afirmar("«¿Olvidaste tu contraseña?» abre la vista de recuperar",
    (await pagina.locator("#vistaRecuperar:not(.oculto)").count()) === 1);

  await pagina.click("#capaCuenta .modal-cerrar");
  await pagina.waitForTimeout(150);
  m.afirmar("la X cierra el modal", (await pagina.locator("#capaCuenta.oculto").count()) === 1);

  await pagina.click("#btnCuenta");
  await pagina.waitForTimeout(150);
  await pagina.keyboard.press("Escape");
  await pagina.waitForTimeout(150);
  m.afirmar("Escape también lo cierra", (await pagina.locator("#capaCuenta.oculto").count()) === 1);

  const cuenta = await pagina.evaluate(async () => {
    /* Firebase real no se puede probar en CI: se stubea GMM.cuenta con una
       sesión ya iniciada, igual que se stubea GMM.drive más arriba. */
    GMM.cuenta.conectado = () => true;
    GMM.cuenta.sesion = () => ({ uid: "u1", email: "prueba@ejemplo.com" });
    GMM.ui.refrescarCabecera();
    const textoBoton = document.getElementById("textoCuenta").textContent;
    document.getElementById("btnCuenta").click();
    await new Promise((r) => setTimeout(r, 80));
    const vistaPerfil = !document.getElementById("vistaPerfil").classList.contains("oculto");
    const correo = document.getElementById("perfilCorreo").textContent;
    document.getElementById("capaCuenta").classList.add("oculto");
    return { textoBoton, vistaPerfil, correo };
  });
  m.afirmar("con sesión, el botón muestra el correo (antes del @)",
    cuenta.textoBoton === "prueba", JSON.stringify(cuenta));
  m.afirmar("con sesión, el modal abre directo en «perfil» con el correo",
    cuenta.vistaPerfil === true && cuenta.correo === "prueba@ejemplo.com", JSON.stringify(cuenta));

  /* ---------------------------------------------------------------- */
  /* Insignia "Te la tengo" en las sugerencias (V GMM 0044). GMM.servidor no
     se puede probar contra un servidor real en CI, así que se stubea
     conectado()/catalogo() en una pestaña aparte, ANTES de que arranque
     GMM.app.iniciar() (mismo patrón que el stub de los carruseles, más
     arriba): así el arranque real hace su carga en segundo plano del
     catálogo contra el stub, y construye el índice de verdad. */
  m.titulo('Insignia "Te la tengo" en las sugerencias (V GMM 0044; iconos accionables desde la 0047)');
  const paginaServidor = await contexto.newPage();
  await paginaServidor.addInitScript(() => {
    window.__GMM_FORZAR_DEMO = true;
    document.addEventListener("DOMContentLoaded", () => {
      GMM.servidor.conectado = () => true;
      GMM.servidor.catalogo = () => Promise.resolve({
        peliculas: [{
          id: "srv1", tituloDetectado: "Interestelar", anioDetectado: 2014,
          disponible: true, estadoArchivo: "disponible"
        }],
        resumen: { total: 1, disponibles: 1, copiandose: 0 }
      });
    });
  });
  await paginaServidor.goto(PAGINA);
  await paginaServidor.waitForTimeout(900);   // catálogo cargado en segundo plano

  await paginaServidor.fill("#entrada", "inter");
  await paginaServidor.waitForTimeout(700);
  m.afirmar("la sugerencia que coincide con el catálogo muestra reproducir y descargar",
    (await paginaServidor.locator("#sugerencias .icono-poster.reproducir").count()) === 1 &&
    (await paginaServidor.locator("#sugerencias .icono-poster.descargar").count()) === 1);

  await paginaServidor.fill("#entrada", "matrix");
  await paginaServidor.waitForTimeout(700);
  m.afirmar("una que no está en el catálogo no muestra ningún icono",
    (await paginaServidor.locator("#sugerencias .tarjeta").count()) >= 1 &&
    (await paginaServidor.locator("#sugerencias .icono-poster").count()) === 0);
  await paginaServidor.close();

  /* ---------------------------------------------------------------- */
  m.titulo("Errores acumulados en toda la sesión");
  m.afirmar("ninguno", errores.length === 0, errores.slice(0, 4).join(" | "));

  await navegador.close();
  m.nota("capturas en pruebas/capturas/");
  process.exit(m.resumir() ? 1 : 0);
})().catch((e) => { console.error("REVENTÓ:", e); process.exit(1); });
