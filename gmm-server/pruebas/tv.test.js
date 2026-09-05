"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { decidirEstrategiaTv } = require("../src/api");

const capacidades = {
  videoCodecs: ["h264", "hevc"],
  audioCodecs: ["aac", "ac3"],
  contenedores: [".mkv", ".mp4"]
};

test("TV usa Direct Play para un MKV cuyos codecs soporta el dispositivo", function () {
  assert.equal(decidirEstrategiaTv({ extension: ".mkv", codecVideo: "hevc", codecAudio: "ac3" }, capacidades), "direct_play");
});

test("TV elige remux solo cuando el contenedor no es compatible", function () {
  assert.equal(decidirEstrategiaTv({ extension: ".avi", codecVideo: "h264", codecAudio: "aac" }, capacidades), "remux");
});

test("TV transcodifica cuando falta un codec", function () {
  assert.equal(decidirEstrategiaTv({ extension: ".mkv", codecVideo: "hevc", codecAudio: "dts" }, capacidades), "transcode");
});

test("TV prefiere el original si ffprobe aún no conoce los codecs", function () {
  assert.equal(decidirEstrategiaTv({ extension: ".mkv", codecVideo: null, codecAudio: null }, capacidades), "direct_play");
});
