"use strict";

const path = require("node:path");

const MARCADORES_TECNICOS = /\b(?:2160p|1080p|720p|576p|480p|4k|uhd|hdr10\+?|hdr|dv|dolby[ ._-]?vision|bluray|blu[ ._-]?ray|brrip|bdrip|webrip|web[ ._-]?dl|hdtv|remux|x264|x265|h[ ._-]?264|h[ ._-]?265|hevc|avc|av1|10bit|8bit|aac|ac3|eac3|dts(?:[ ._-]?hd)?|truehd|atmos|dual|multi|latino|castellano|extended|proper|repack)\b/i;

function esArchivoDeVideo(nombreArchivo, extensiones) {
  const extension = path.extname(String(nombreArchivo || "")).toLocaleLowerCase("es");
  return new Set(extensiones || []).has(extension);
}

function limpiarTitulo(texto) {
  let titulo = String(texto || "")
    .replace(/[._]+/g, " ")
    .replace(/[\[\]{}]+/g, " ")
    .replace(/\s+-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const marcador = titulo.search(MARCADORES_TECNICOS);
  if (marcador > 0) titulo = titulo.slice(0, marcador).trim();
  titulo = titulo.replace(/\b(?:año|year)\s*$/i, "").trim();
  return titulo
    .replace(/[\s._-]+$/, "")
    .replace(/[([{]+$/, "")
    .trim();
}

function analizarNombreArchivo(nombreArchivo) {
  const extension = path.extname(String(nombreArchivo || "")).toLocaleLowerCase("es");
  const base = path.basename(String(nombreArchivo || ""), extension)
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const coincidencias = Array.from(base.matchAll(/(?:^|\D)((?:19|20)\d{2})(?=$|\D)/g));
  const elegida = coincidencias.length ? coincidencias[coincidencias.length - 1] : null;
  let anio = null;
  let antesDelAnio = base;

  if (elegida) {
    anio = Number(elegida[1]);
    const desplazamiento = elegida[0].indexOf(elegida[1]);
    antesDelAnio = base.slice(0, elegida.index + desplazamiento);
  }

  let titulo = limpiarTitulo(antesDelAnio);
  if (!titulo) titulo = limpiarTitulo(base);
  if (!titulo) titulo = "Sin título";

  return {
    tituloDetectado: titulo,
    anioDetectado: anio,
    extension
  };
}

module.exports = { analizarNombreArchivo, esArchivoDeVideo, limpiarTitulo };
