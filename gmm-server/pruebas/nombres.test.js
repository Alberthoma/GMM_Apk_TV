"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analizarNombreArchivo, esArchivoDeVideo } = require("../src/nombres");

test("extrae título y año de un nombre técnico", function () {
  const resultado = analizarNombreArchivo("Spider-Man.No.Way.Home.2021.1080p.BluRay.x264.mkv");
  assert.equal(resultado.tituloDetectado, "Spider-Man No Way Home");
  assert.equal(resultado.anioDetectado, 2021);
  assert.equal(resultado.extension, ".mkv");
});

test("usa el último año para no confundir un número del título", function () {
  const resultado = analizarNombreArchivo("2001 A Space Odyssey (1968).mp4");
  assert.equal(resultado.tituloDetectado, "2001 A Space Odyssey");
  assert.equal(resultado.anioDetectado, 1968);
});

test("conserva títulos en español y corta marcadores técnicos", function () {
  const resultado = analizarNombreArchivo("El laberinto del fauno WEB-DL 1080p.m4v");
  assert.equal(resultado.tituloDetectado, "El laberinto del fauno");
  assert.equal(resultado.anioDetectado, null);
});

test("retira la etiqueta Año que precede al año numérico", function () {
  const resultado = analizarNombreArchivo("Shang-Chi and the Legend of the Ten Rings Año 2021.mkv");
  assert.equal(resultado.tituloDetectado, "Shang-Chi and the Legend of the Ten Rings");
  assert.equal(resultado.anioDetectado, 2021);
});

test("reconoce extensiones sin depender de mayúsculas", function () {
  assert.equal(esArchivoDeVideo("Pelicula.MP4", [".mp4", ".mkv"]), true);
  assert.equal(esArchivoDeVideo("caratula.jpg", [".mp4", ".mkv"]), false);
});
