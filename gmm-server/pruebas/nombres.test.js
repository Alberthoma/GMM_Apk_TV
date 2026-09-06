"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analizarNombreArchivo, analizarTipoVideo, esArchivoDeVideo } = require("../src/nombres");

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

test("reconoce temporada y episodio por nombre y carpeta", function () {
  assert.deepEqual(analizarTipoVideo("Foundation.S02E03.1080p.mkv", "Foundation\\Temporada 2\\Foundation.S02E03.1080p.mkv", "Series"), {
    tipoMedia: "tv", serieTitulo: "Foundation", temporada: 2, episodio: 3
  });
});

test("conserva como película un archivo sin marcadores de serie", function () {
  assert.equal(analizarTipoVideo("Dune Part Two (2024).mkv", "Dune Part Two (2024).mkv", "Peliculas").tipoMedia, "movie");
});
