"use strict";

/* Convierte a un archivo cacheado los vídeos que el navegador no puede reproducir tal cual
   (ver src/compatibilidad.js). Una sola conversión a la vez: transcodificar gasta la CPU
   entera del PC, y encadenar varias a la vez lo dejaría inservible para otra cosa. El
   resultado se cachea en disco por id, así que una película solo se convierte una vez. */

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const fsPromesas = fs.promises;

function rutaCache(configuracion, pelicula) {
  return path.join(configuracion.rutaCacheTranscodificacion, `${pelicula.id}.mp4`);
}

function construirArgumentos(pelicula, destino) {
  const base = ["-y", "-i", pelicula.ruta];
  if (pelicula.compatibilidad === "remux") {
    return base.concat(["-c", "copy", "-movflags", "+faststart", destino]);
  }
  return base.concat([
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    destino
  ]);
}

/* Impura a propósito: lanza el proceso ffmpeg real. Las pruebas inyectan un ejecutor falso
   (opciones.ejecutar) para no depender de tener ffmpeg instalado. */
function ejecutarFFmpeg(rutaFFmpeg, argumentos, ejecutorPersonalizado) {
  const ejecutor = ejecutorPersonalizado || spawn;
  return new Promise(function (resolve, reject) {
    let proceso;
    try {
      proceso = ejecutor(rutaFFmpeg, argumentos);
    } catch (error) {
      reject(error);
      return;
    }
    let errorSalida = "";
    proceso.stderr.on("data", function (fragmento) { errorSalida += fragmento; });
    proceso.on("error", function (error) { reject(error); });
    proceso.on("close", function (codigo) {
      if (codigo === 0) resolve();
      else reject(new Error(`ffmpeg terminó con el código ${codigo}: ${errorSalida.slice(-500).trim()}`));
    });
  });
}

class GestorTranscodificacion {
  constructor(configuracion, opciones) {
    this.configuracion = configuracion;
    this.registro = (opciones && opciones.registro) || console;
    this.ejecutar = (opciones && opciones.ejecutar) || null;
    this.trabajos = new Map();
    this.cola = Promise.resolve();
  }

  estadoDe(id) {
    const trabajo = this.trabajos.get(id);
    return trabajo ? trabajo.estado : null;
  }

  async archivoListo(pelicula) {
    try {
      const estadisticas = await fsPromesas.stat(rutaCache(this.configuracion, pelicula));
      return estadisticas.isFile() && estadisticas.size > 0;
    } catch (error) {
      return false;
    }
  }

  /* Idempotente: si ya hay un trabajo para este id (en cola, en marcha o terminado), lo
     devuelve tal cual en vez de duplicar la conversión. */
  solicitar(pelicula) {
    const existente = this.trabajos.get(pelicula.id);
    if (existente) return existente;

    const trabajo = { estado: "en_cola", error: null };
    this.trabajos.set(pelicula.id, trabajo);
    const siguiente = this.cola.then(function () {
      return undefined;
    });
    this.cola = siguiente
      .then(() => this._transcodificar(pelicula, trabajo))
      .catch(function () {});
    return trabajo;
  }

  async _transcodificar(pelicula, trabajo) {
    trabajo.estado = "preparando";
    const destino = rutaCache(this.configuracion, pelicula);
    /* El nombre temporal DEBE terminar en ".mp4": ffmpeg elige el contenedor de salida por la
       extensión del archivo de destino, y algo como "…mp4.parcial-1234" no es una extensión que
       reconozca ("use a standard extension for the filename or specify the format manually").
       Comprobado con ffmpeg real: fallaba el 100% de las conversiones, tanto remux como
       transcodificar, con ese error exacto. */
    const temporal = destino.replace(/\.mp4$/, `.parcial-${process.pid}.mp4`);
    try {
      await fsPromesas.mkdir(path.dirname(destino), { recursive: true });
      await ejecutarFFmpeg(this.configuracion.rutaFFmpeg, construirArgumentos(pelicula, temporal), this.ejecutar);
      await fsPromesas.rename(temporal, destino);
      trabajo.estado = "listo";
    } catch (error) {
      trabajo.estado = "error";
      trabajo.error = error.message;
      await fsPromesas.rm(temporal, { force: true });
      this.registro.error(`No se pudo transcodificar "${pelicula.nombreArchivo}":`, error.message);
    }
  }
}

module.exports = {
  GestorTranscodificacion,
  construirArgumentos,
  ejecutarFFmpeg,
  rutaCache
};
