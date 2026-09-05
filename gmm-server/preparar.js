"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const carpetaPrivada = path.join(__dirname, "PRIVADO");
const rutaDestino = path.join(carpetaPrivada, "configuracion.json");
const rutaPlantilla = path.join(__dirname, "configuracion.ejemplo.json");

if (fs.existsSync(rutaDestino)) {
  console.error("La configuración privada ya existe y no se sobrescribirá:");
  console.error(rutaDestino);
  process.exitCode = 1;
} else {
  const configuracion = JSON.parse(fs.readFileSync(rutaPlantilla, "utf8"));
  configuracion.claveAdministracion = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(carpetaPrivada, { recursive: true });
  fs.writeFileSync(rutaDestino, JSON.stringify(configuracion, null, 2) + "\n", {
    encoding: "utf8",
    flag: "wx"
  });
  console.log("Configuración privada creada:");
  console.log(rutaDestino);
  console.log("Edita la ruta de Peliculas antes de iniciar el servidor.");
}
