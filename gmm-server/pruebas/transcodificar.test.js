"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { GestorTranscodificacion, construirArgumentos, rutaCache } = require("../src/transcodificar");

/* Simula ffmpeg: en vez de convertir de verdad, escribe unos bytes en el archivo de destino
   (el último argumento) para que rename() y archivoListo() tengan algo real que comprobar. */
function ejecutorFalsoQueEscribe(contenido) {
  return function (rutaFFmpeg, argumentos) {
    const destino = argumentos[argumentos.length - 1];
    const proceso = new EventEmitter();
    proceso.stderr = new EventEmitter();
    process.nextTick(async function () {
      await fs.writeFile(destino, contenido || "video-transcodificado");
      proceso.emit("close", 0);
    });
    return proceso;
  };
}

function ejecutorFalsoQueFalla(mensaje) {
  return function () {
    const proceso = new EventEmitter();
    proceso.stderr = new EventEmitter();
    process.nextTick(function () {
      proceso.stderr.emit("data", mensaje || "fallo simulado");
      proceso.emit("close", 1);
    });
    return proceso;
  };
}

async function entornoTemporal(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "gmm-transcodificar-"));
  t.after(async function () { await fs.rm(base, { recursive: true, force: true }); });
  return {
    rutaFFmpeg: "ffmpeg",
    rutaCacheTranscodificacion: path.join(base, "transcodificado")
  };
}

test("construirArgumentos: remux solo copia streams, transcodificar recodifica", function () {
  const pelicula = { ruta: "/pelicula.mkv", compatibilidad: "remux" };
  assert.deepEqual(
    construirArgumentos(pelicula, "/destino.mp4"),
    ["-y", "-i", "/pelicula.mkv", "-c", "copy", "-movflags", "+faststart", "/destino.mp4"]
  );

  const argumentos = construirArgumentos({ ruta: "/pelicula.mkv", compatibilidad: "transcodificar" }, "/destino.mp4");
  assert.ok(argumentos.includes("libx264"));
  assert.ok(argumentos.includes("aac"));
});

test("solicitar(): transcodifica y deja el archivo listo en caché", async function (t) {
  const configuracion = await entornoTemporal(t);
  const gestor = new GestorTranscodificacion(configuracion, {
    registro: { error: function () {} },
    ejecutar: ejecutorFalsoQueEscribe()
  });
  const pelicula = { id: "abc123", ruta: "/x/pelicula.mkv", nombreArchivo: "pelicula.mkv", compatibilidad: "remux" };

  assert.equal(await gestor.archivoListo(pelicula), false);
  const trabajo = gestor.solicitar(pelicula);
  assert.ok(["en_cola", "preparando"].includes(trabajo.estado));

  while (trabajo.estado !== "listo" && trabajo.estado !== "error") {
    await new Promise(function (resolver) { setTimeout(resolver, 5); });
  }
  assert.equal(trabajo.estado, "listo");
  assert.equal(await gestor.archivoListo(pelicula), true);

  const contenido = await fs.readFile(rutaCache(configuracion, pelicula), "utf8");
  assert.equal(contenido, "video-transcodificado");
});

test("solicitar(): pedirlo dos veces no lanza una segunda conversión", async function (t) {
  const configuracion = await entornoTemporal(t);
  let llamadas = 0;
  const ejecutarQueCuenta = function (rutaFFmpeg, argumentos) {
    llamadas += 1;
    return ejecutorFalsoQueEscribe()(rutaFFmpeg, argumentos);
  };
  const gestor = new GestorTranscodificacion(configuracion, {
    registro: { error: function () {} },
    ejecutar: ejecutarQueCuenta
  });
  const pelicula = { id: "dup1", ruta: "/x/pelicula.mkv", nombreArchivo: "pelicula.mkv", compatibilidad: "remux" };

  const primero = gestor.solicitar(pelicula);
  const segundo = gestor.solicitar(pelicula);
  assert.equal(primero, segundo);

  while (primero.estado !== "listo" && primero.estado !== "error") {
    await new Promise(function (resolver) { setTimeout(resolver, 5); });
  }
  assert.equal(llamadas, 1);
});

test("solicitar(): si ffmpeg falla, el trabajo queda en error y no deja un archivo a medias", async function (t) {
  const configuracion = await entornoTemporal(t);
  const gestor = new GestorTranscodificacion(configuracion, {
    registro: { error: function () {} },
    ejecutar: ejecutorFalsoQueFalla("códec no soportado")
  });
  const pelicula = { id: "malo1", ruta: "/x/pelicula.mkv", nombreArchivo: "pelicula.mkv", compatibilidad: "transcodificar" };

  const trabajo = gestor.solicitar(pelicula);
  while (trabajo.estado !== "listo" && trabajo.estado !== "error") {
    await new Promise(function (resolver) { setTimeout(resolver, 5); });
  }
  assert.equal(trabajo.estado, "error");
  assert.match(trabajo.error, /código 1/);
  assert.equal(await gestor.archivoListo(pelicula), false);

  const restos = await fs.readdir(path.dirname(rutaCache(configuracion, pelicula))).catch(function () { return []; });
  assert.equal(restos.filter(function (nombre) { return nombre.includes(".parcial-"); }).length, 0);
});
