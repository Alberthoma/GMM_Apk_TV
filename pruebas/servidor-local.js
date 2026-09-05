/* Servidor local para probar la PWA antes de publicar.
   Ejecutar: node pruebas/servidor-local.js
  Solo escucha en este PC y no sirve las carpetas privadas ni obsoleto. */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const PUERTO = Number(process.env.GMM_PUERTO_PRUEBA || 8080);
const BLOQUEADOS = new Set([".git", "PRIVADO", "gmm-server", "obsoleto"]);
const TIPOS = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function resolverRuta(url) {
  const relativa = decodeURIComponent((url || "/").split("?")[0]);
  const solicitada = relativa === "/" ? "/index.html" : relativa;
  const segmentos = solicitada.split("/").filter(Boolean);
  if (segmentos.some((segmento) => BLOQUEADOS.has(segmento))) return null;
  const completa = path.resolve(RAIZ, "." + solicitada);
  return completa.startsWith(RAIZ + path.sep) ? completa : null;
}

const servidor = http.createServer((peticion, respuesta) => {
  const archivo = resolverRuta(peticion.url);
  if (!archivo) {
    respuesta.writeHead(403); respuesta.end("No disponible en el servidor de prueba."); return;
  }
  fs.stat(archivo, (error, estado) => {
    if (error || !estado.isFile()) {
      respuesta.writeHead(404); respuesta.end("No encontrado."); return;
    }
    respuesta.writeHead(200, {
      "Content-Type": TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(archivo).pipe(respuesta);
  });
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log("Prueba local: http://127.0.0.1:" + PUERTO + "/");
});

process.on("SIGINT", () => servidor.close(() => process.exit(0)));
