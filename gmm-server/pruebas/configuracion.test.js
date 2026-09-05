"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { cargarConfiguracion } = require("../src/configuracion");

async function crearBase(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "gmm-config-"));
  const peliculas = path.join(base, "Peliculas");
  await fs.mkdir(peliculas);
  t.after(async function () { await fs.rm(base, { recursive: true, force: true }); });
  return { base, peliculas, ruta: path.join(base, "configuracion.json") };
}

test("carga y normaliza una configuración privada válida", async function (t) {
  const temporal = await crearBase(t);
  await fs.writeFile(temporal.ruta, JSON.stringify({
    nombreServidor: "Mi GMM",
    host: "127.0.0.1",
    puerto: 7399,
    claveAdministracion: "clave-segura-de-prueba-12345678901234567890",
    carpetas: [{ nombre: "Peliculas", ruta: temporal.peliculas }],
    extensiones: ["MP4", ".MKV"],
    rutaCatalogo: "catalogo.json"
  }), "utf8");

  const config = cargarConfiguracion(temporal.ruta);
  assert.deepEqual(config.extensiones, [".mp4", ".mkv"]);
  assert.equal(config.carpetas[0].ruta, temporal.peliculas);
  assert.equal(config.rutaCatalogo, path.join(temporal.base, "catalogo.json"));
});

test("impide escuchar fuera del PC sin una clave resistente", async function (t) {
  const temporal = await crearBase(t);
  await fs.writeFile(temporal.ruta, JSON.stringify({
    host: "0.0.0.0",
    puerto: 7399,
    claveAdministracion: "corta",
    carpetas: []
  }), "utf8");

  assert.throws(function () { cargarConfiguracion(temporal.ruta); }, /al menos 32 caracteres/);
});

test("explica cómo preparar la configuración cuando todavía no existe", async function (t) {
  const temporal = await crearBase(t);
  const inexistente = path.join(temporal.base, "no-existe.json");
  assert.throws(function () { cargarConfiguracion(inexistente); }, /npm\.cmd run configurar/);
});
