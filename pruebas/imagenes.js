/* ══════════════════════════════════════════════════════════════════════
   imagenes.js — comprueba que cada imagen del catálogo demo es LA SUYA

   Ejecutar:  node pruebas/imagenes.js      (necesita conexión a internet)
   Sin dependencias: solo Node.

   Por qué existe: un HTTP 200 en image.tmdb.org NO prueba que la imagen
   sea de esa película. Ya pasó dos veces en este proyecto —el id 1417 no
   era 'Volver' sino 'El laberinto del fauno', y el 1281 no era Penélope
   Cruz sino Freddie Highmore—. La comprobación fiable es leer og:title y
   og:image de la ficha pública, que siempre pertenecen a esa ficha.

   Ojo: TMDB sirve una carátula distinta según el idioma, así que hay que
   pedir la página con el MISMO locale que usa la app (es-ES).
   ══════════════════════════════════════════════════════════════════════ */

const { cargarGmm, crearMarcador } = require("./cargar");
const GMM = cargarGmm();
const m = crearMarcador();

const CABECERAS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36"
};

function meta(html, propiedad) {
  const encontrado = html.match(new RegExp('<meta property="' + propiedad + '" content="([^"]*)"'));
  return encontrado ? encontrado[1] : "";
}

async function fichaOficial(tipo, id) {
  const r = await fetch("https://www.themoviedb.org/" + tipo + "/" + id + "?language=es-ES",
                        { headers: CABECERAS });
  const html = await r.text();
  const imagen = meta(html, "og:image").match(/(\/[A-Za-z0-9]{20,}\.jpg)/);
  return { titulo: meta(html, "og:title"), ruta: imagen ? imagen[1] : null };
}

async function descarga(ruta, tamano) {
  if (!ruta) return false;
  const r = await fetch("https://image.tmdb.org/t/p/" + tamano + ruta, { method: "HEAD" });
  return r.status === 200;
}

(async () => {
  m.titulo("¿La carátula pertenece a esa película?");
  for (const p of GMM.demo.PELICULAS) {
    const oficial = await fichaOficial("movie", p.id);
    m.afirmar(p.title + "  (ficha " + p.id + " = «" + oficial.titulo + "»)",
      oficial.ruta === p.poster_path,
      "tengo " + p.poster_path + " / oficial " + oficial.ruta);
  }

  m.titulo("¿La carátula pertenece a esa serie?");
  for (const s of GMM.demo.SERIES) {
    const oficial = await fichaOficial("tv", s.id);
    m.afirmar(s.name + "  (ficha " + s.id + " = «" + oficial.titulo + "»)",
      oficial.ruta === s.poster_path,
      "tengo " + s.poster_path + " / oficial " + oficial.ruta);
  }

  m.titulo("¿La foto pertenece a esa persona?");
  for (const per of GMM.demo.PERSONAS) {
    const oficial = await fichaOficial("person", per.id);
    m.afirmar(per.name + "  (ficha " + per.id + " = «" + oficial.titulo + "»)",
      oficial.ruta === per.profile_path,
      "tengo " + per.profile_path + " / oficial " + oficial.ruta);
  }

  m.titulo("¿Descargan todas las imágenes?");
  let rotas = 0;
  for (const p of GMM.demo.PELICULAS) {
    if (!(await descarga(p.poster_path, "w342"))) { rotas++; m.nota("404 carátula " + p.title); }
    if (!(await descarga(p.backdrop_path, "w1280"))) { rotas++; m.nota("404 fondo " + p.title); }
  }
  for (const s of GMM.demo.SERIES) {
    if (!(await descarga(s.poster_path, "w342"))) { rotas++; m.nota("404 carátula " + s.name); }
    if (s.backdrop_path && !(await descarga(s.backdrop_path, "w1280"))) { rotas++; m.nota("404 fondo " + s.name); }
  }
  for (const per of GMM.demo.PERSONAS) {
    if (!(await descarga(per.profile_path, "w342"))) { rotas++; m.nota("404 foto " + per.name); }
  }
  m.afirmar("ninguna imagen rota", rotas === 0, rotas + " rotas");

  process.exit(m.resumir() ? 1 : 0);
})().catch((e) => { console.error("REVENTÓ:", e); process.exit(1); });
