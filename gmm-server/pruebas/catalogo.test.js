"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { GestorCatalogo } = require("../src/catalogo");
const { EXTENSIONES_PREDETERMINADAS, CARPETAS_IGNORADAS_PREDETERMINADAS } = require("../src/configuracion");

async function entornoTemporal(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "gmm-server-"));
  const peliculas = path.join(base, "Peliculas");
  await fs.mkdir(path.join(peliculas, "Ciencia ficción"), { recursive: true });
  await fs.writeFile(path.join(peliculas, "Dune Part Two (2024).mkv"), "video-ficticio");
  await fs.writeFile(path.join(peliculas, "Ciencia ficción", "Arrival.2016.1080p.mp4"), "video-ficticio");
  await fs.writeFile(path.join(peliculas, "caratula.jpg"), "imagen-ficticia");
  t.after(async function () { await fs.rm(base, { recursive: true, force: true }); });
  return { base, peliculas };
}

function configuracion(base, peliculas) {
  return {
    carpetas: [{ nombre: "Peliculas", ruta: peliculas }],
    extensiones: EXTENSIONES_PREDETERMINADAS,
    carpetasIgnoradas: CARPETAS_IGNORADAS_PREDETERMINADAS,
    rutaCatalogo: path.join(base, "privado", "catalogo.json")
  };
}

test("confirma estabilidad antes de publicar vídeos y no revela rutas privadas", async function (t) {
  const temporal = await entornoTemporal(t);
  const gestor = new GestorCatalogo(configuracion(temporal.base, temporal.peliculas));
  await gestor.iniciar();
  const primera = await gestor.escanear();
  assert.equal(primera.resumen.total, 2);
  assert.equal(primera.resumen.disponibles, 0);
  assert.equal(primera.resumen.copiandose, 2);

  const catalogo = await gestor.escanear();

  assert.equal(catalogo.resumen.total, 2);
  assert.equal(catalogo.resumen.disponibles, 2);
  assert.equal(catalogo.resumen.copiandose, 0);
  assert.deepEqual(catalogo.peliculas.map(function (p) { return p.tituloDetectado; }), ["Arrival", "Dune Part Two"]);
  assert.equal(Object.hasOwn(catalogo.peliculas[0], "ruta"), false);
  assert.equal(JSON.stringify(catalogo).includes(temporal.peliculas), false);
});

test("mantiene identificadores y marca el disco como no disponible", async function (t) {
  const temporal = await entornoTemporal(t);
  const config = configuracion(temporal.base, temporal.peliculas);
  const gestor = new GestorCatalogo(config);
  await gestor.iniciar();
  const primero = await gestor.escanear();
  const ids = primero.peliculas.map(function (p) { return p.id; });

  const segundo = await gestor.escanear();
  assert.deepEqual(segundo.peliculas.map(function (p) { return p.id; }), ids);

  await fs.rename(temporal.peliculas, `${temporal.peliculas}-desconectada`);
  const tercero = await gestor.escanear();
  assert.equal(tercero.resumen.total, 2);
  assert.equal(tercero.resumen.disponibles, 0);
  assert.equal(tercero.carpetas[0].disponible, false);
});

test("mantiene como copiándose un archivo cuyo tamaño cambia", async function (t) {
  const temporal = await entornoTemporal(t);
  const config = configuracion(temporal.base, temporal.peliculas);
  const gestor = new GestorCatalogo(config);
  await gestor.iniciar();
  await gestor.escanear();

  const ruta = path.join(temporal.peliculas, "Dune Part Two (2024).mkv");
  await fs.appendFile(ruta, "más-contenido");
  const cambiando = await gestor.escanear();
  const dune = cambiando.peliculas.find(function (pelicula) {
    return pelicula.tituloDetectado === "Dune Part Two";
  });
  assert.equal(dune.estadoArchivo, "copiandose");
  assert.equal(dune.disponible, false);

  const estable = await gestor.escanear();
  const duneEstable = estable.peliculas.find(function (pelicula) {
    return pelicula.tituloDetectado === "Dune Part Two";
  });
  assert.equal(duneEstable.estadoArchivo, "disponible");
  assert.equal(duneEstable.disponible, true);
});

test("sondea la compatibilidad de cada archivo y la reutiliza mientras no cambie", async function (t) {
  const temporal = await entornoTemporal(t);
  let sondeos = 0;
  const gestor = new GestorCatalogo(configuracion(temporal.base, temporal.peliculas), {
    sondear: async function (ruta) {
      sondeos += 1;
      return ruta.endsWith(".mkv")
        ? { codecVideo: "hevc", codecAudio: "ac3" }
        : { codecVideo: "h264", codecAudio: "aac" };
    }
  });
  await gestor.iniciar();

  const primero = await gestor.escanear();
  const dune = primero.peliculas.find(function (p) { return p.tituloDetectado === "Dune Part Two"; });
  const arrival = primero.peliculas.find(function (p) { return p.tituloDetectado === "Arrival"; });
  assert.equal(dune.compatibilidad, "transcodificar");
  assert.equal(arrival.compatibilidad, "compatible");
  assert.equal(sondeos, 2);

  await gestor.escanear();
  assert.equal(sondeos, 2, "un archivo sin cambios no debe volver a sondearse");
});

test("si no se pudo sondear, vuelve a intentarlo en el siguiente escaneo en vez de quedarse en null para siempre", async function (t) {
  const temporal = await entornoTemporal(t);
  let sondeos = 0;
  const gestor = new GestorCatalogo(configuracion(temporal.base, temporal.peliculas), {
    sondear: async function () {
      sondeos += 1;
      return null;
    }
  });
  await gestor.iniciar();

  const primero = await gestor.escanear();
  assert.ok(primero.peliculas.every(function (p) { return p.compatibilidad === null; }));
  assert.equal(sondeos, 2);

  await gestor.escanear();
  assert.equal(sondeos, 4, "sin ffmpeg instalado, cada escaneo debe reintentar el sondeo");
});
