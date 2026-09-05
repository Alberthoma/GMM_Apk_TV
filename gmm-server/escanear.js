"use strict";

const { cargarConfiguracion } = require("./src/configuracion");
const { GestorCatalogo } = require("./src/catalogo");

async function escanearUnaVez() {
  const configuracion = cargarConfiguracion(process.argv[2]);
  const gestor = new GestorCatalogo(configuracion);
  await gestor.iniciar();
  const catalogo = await gestor.escanearConfirmando();

  console.log(`GMM Server revisó ${catalogo.resumen.carpetas} carpeta(s).`);
  console.log(`Películas detectadas: ${catalogo.resumen.total}.`);
  console.log(`Películas disponibles: ${catalogo.resumen.disponibles}.`);
  console.log(`Archivos todavía copiándose: ${catalogo.resumen.copiandose}.`);
  catalogo.carpetas.forEach(function (carpeta) {
    console.log(`- ${carpeta.nombre}: ${carpeta.mensaje} · ${carpeta.peliculas} película(s).`);
  });
}

escanearUnaVez().catch(function (error) {
  console.error("No se pudo revisar la biblioteca:");
  console.error(error.message);
  process.exitCode = 1;
});
