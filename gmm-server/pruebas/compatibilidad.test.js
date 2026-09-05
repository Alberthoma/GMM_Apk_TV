"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { evaluarCompatibilidad, sondearArchivo } = require("../src/compatibilidad");

function procesoFalso({ salida, codigo }) {
  const proceso = new EventEmitter();
  proceso.stdout = new EventEmitter();
  process.nextTick(function () {
    if (salida !== undefined) proceso.stdout.emit("data", salida);
    proceso.emit("close", codigo === undefined ? 0 : codigo);
  });
  return proceso;
}

test("evaluarCompatibilidad: h264+aac en mp4 no necesita nada", function () {
  assert.equal(evaluarCompatibilidad({ extension: ".mp4", codecVideo: "h264", codecAudio: "aac" }), "compatible");
});

test("evaluarCompatibilidad: mismos códecs pero en mkv solo necesita remux", function () {
  assert.equal(evaluarCompatibilidad({ extension: ".mkv", codecVideo: "h264", codecAudio: "aac" }), "remux");
});

test("evaluarCompatibilidad: códec de vídeo no soportado exige transcodificar aunque el contenedor sea mp4", function () {
  assert.equal(evaluarCompatibilidad({ extension: ".mp4", codecVideo: "hevc", codecAudio: "aac" }), "transcodificar");
});

test("evaluarCompatibilidad: audio no soportado (ac3/dts) exige transcodificar", function () {
  assert.equal(evaluarCompatibilidad({ extension: ".mkv", codecVideo: "h264", codecAudio: "ac3" }), "transcodificar");
  assert.equal(evaluarCompatibilidad({ extension: ".mkv", codecVideo: "h264", codecAudio: "dts" }), "transcodificar");
});

test("evaluarCompatibilidad: sin datos de códec (no se pudo analizar el stream) exige transcodificar, nunca compatible a ciegas", function () {
  assert.equal(evaluarCompatibilidad({ extension: ".mp4", codecVideo: null, codecAudio: null }), "transcodificar");
});

test("sondearArchivo: interpreta la salida de ffprobe y separa vídeo de audio", async function (t) {
  const salida = JSON.stringify({
    streams: [
      { codec_type: "audio", codec_name: "ac3" },
      { codec_type: "video", codec_name: "hevc" }
    ]
  });
  const ejecutor = function () { return procesoFalso({ salida }); };
  const resultado = await sondearArchivo("ffprobe", "/pelicula.mkv", ejecutor);
  assert.deepEqual(resultado, { codecVideo: "hevc", codecAudio: "ac3" });
});

test("sondearArchivo: resuelve null si ffprobe no está instalado", async function (t) {
  const ejecutor = function () {
    const proceso = new EventEmitter();
    proceso.stdout = new EventEmitter();
    process.nextTick(function () { proceso.emit("error", new Error("ENOENT")); });
    return proceso;
  };
  const resultado = await sondearArchivo("ffprobe-inexistente", "/pelicula.mkv", ejecutor);
  assert.equal(resultado, null);
});

test("sondearArchivo: resuelve null si ffprobe termina con error", async function (t) {
  const ejecutor = function () { return procesoFalso({ codigo: 1 }); };
  const resultado = await sondearArchivo("ffprobe", "/pelicula.mkv", ejecutor);
  assert.equal(resultado, null);
});

test("sondearArchivo: resuelve null ante una salida que no es JSON válido", async function (t) {
  const ejecutor = function () { return procesoFalso({ salida: "esto no es json" }); };
  const resultado = await sondearArchivo("ffprobe", "/pelicula.mkv", ejecutor);
  assert.equal(resultado, null);
});
