"use strict";

/* Decide si un vídeo se puede reproducir tal cual en el <video> del navegador, si basta con
   cambiar el contenedor (remux, rápido y sin pérdida) o si hace falta recodificar de verdad
   (lento, gasta CPU). evaluarCompatibilidad es pura y no toca disco ni procesos: la usan tanto
   el escáner (con datos reales de ffprobe) como las pruebas (con datos inventados). */

const { spawn } = require("node:child_process");

const CONTENEDORES_REPRODUCIBLES = [".mp4", ".m4v", ".webm"];
const CODECS_VIDEO_COMPATIBLES = ["h264", "vp8", "vp9", "av1"];
const CODECS_AUDIO_COMPATIBLES = ["aac", "mp3", "opus", "vorbis"];

function evaluarCompatibilidad(datos) {
  const extension = String((datos && datos.extension) || "").toLowerCase();
  const codecVideo = String((datos && datos.codecVideo) || "").toLowerCase();
  const codecAudio = String((datos && datos.codecAudio) || "").toLowerCase();

  const videoCompatible = CODECS_VIDEO_COMPATIBLES.includes(codecVideo);
  const audioCompatible = CODECS_AUDIO_COMPATIBLES.includes(codecAudio);
  if (!videoCompatible || !audioCompatible) return "transcodificar";
  return CONTENEDORES_REPRODUCIBLES.includes(extension) ? "compatible" : "remux";
}

/* Impura a propósito: llama a ffprobe como proceso aparte. Nunca lanza — si el binario no
   existe o el archivo no se puede analizar, resuelve null y el catálogo se queda tal como
   estaba antes de este añadido (sin insignia de compatibilidad, archivo servido tal cual). */
function sondearArchivo(rutaFFprobe, rutaArchivo, ejecutorPersonalizado) {
  const ejecutor = ejecutorPersonalizado || spawn;
  return new Promise(function (resolve) {
    let proceso;
    try {
      proceso = ejecutor(rutaFFprobe, [
        "-v", "error",
        "-print_format", "json",
        "-show_streams",
        rutaArchivo
      ]);
    } catch (error) {
      resolve(null);
      return;
    }

    let salida = "";
    let resuelto = false;
    function terminar(resultado) {
      if (resuelto) return;
      resuelto = true;
      resolve(resultado);
    }

    proceso.stdout.on("data", function (fragmento) { salida += fragmento; });
    proceso.on("error", function () { terminar(null); });
    proceso.on("close", function (codigo) {
      if (codigo !== 0) { terminar(null); return; }
      try {
        const datos = JSON.parse(salida);
        const streams = Array.isArray(datos.streams) ? datos.streams : [];
        const video = streams.find(function (s) { return s.codec_type === "video"; });
        const audio = streams.find(function (s) { return s.codec_type === "audio"; });
        terminar({
          codecVideo: video ? video.codec_name : null,
          codecAudio: audio ? audio.codec_name : null
        });
      } catch (error) {
        terminar(null);
      }
    });
  });
}

module.exports = {
  CODECS_AUDIO_COMPATIBLES,
  CODECS_VIDEO_COMPATIBLES,
  CONTENEDORES_REPRODUCIBLES,
  evaluarCompatibilidad,
  sondearArchivo
};
