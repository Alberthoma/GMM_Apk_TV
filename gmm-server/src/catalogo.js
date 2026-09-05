"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { analizarNombreArchivo, esArchivoDeVideo } = require("./nombres");
const { evaluarCompatibilidad, sondearArchivo } = require("./compatibilidad");

const fsPromesas = fs.promises;
const VERSION_CATALOGO = 1;

function catalogoVacio() {
  return {
    version: VERSION_CATALOGO,
    actualizadoEn: null,
    raices: [],
    peliculas: []
  };
}

function identificadorArchivo(nombreCarpeta, rutaRelativa) {
  return crypto.createHash("sha256")
    .update(String(nombreCarpeta).toLocaleLowerCase("es"))
    .update("\0")
    .update(String(rutaRelativa).replace(/\\/g, "/").toLocaleLowerCase("es"))
    .digest("hex")
    .slice(0, 24);
}

async function leerCatalogo(rutaCatalogo) {
  let texto;
  try {
    texto = await fsPromesas.readFile(rutaCatalogo, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return catalogoVacio();
    throw error;
  }

  let catalogo;
  try {
    catalogo = JSON.parse(texto);
  } catch (error) {
    throw new Error(`El catálogo local está dañado y no se sobrescribirá: ${error.message}`);
  }
  if (!catalogo || catalogo.version !== VERSION_CATALOGO || !Array.isArray(catalogo.peliculas)) {
    throw new Error("El catálogo local tiene una versión o estructura no compatible.");
  }
  if (!Array.isArray(catalogo.raices)) catalogo.raices = [];
  return catalogo;
}

async function guardarCatalogo(rutaCatalogo, catalogo) {
  const carpeta = path.dirname(rutaCatalogo);
  const temporal = `${rutaCatalogo}.nuevo-${process.pid}-${Date.now()}`;
  await fsPromesas.mkdir(carpeta, { recursive: true });
  await fsPromesas.writeFile(temporal, JSON.stringify(catalogo, null, 2) + "\n", "utf8");
  try {
    await fsPromesas.rename(temporal, rutaCatalogo);
  } catch (error) {
    if (process.platform !== "win32" || !["EEXIST", "EPERM"].includes(error.code)) throw error;
    await fsPromesas.rm(rutaCatalogo, { force: true });
    await fsPromesas.rename(temporal, rutaCatalogo);
  }
}

async function recorrerCarpeta(raiz, rutaActual, configuracion, encontrados, avisos) {
  let entradas;
  try {
    entradas = await fsPromesas.readdir(rutaActual, { withFileTypes: true });
  } catch (error) {
    avisos.push({ tipo: "carpeta-no-legible", mensaje: "No se pudo leer una subcarpeta." });
    return;
  }

  const ignoradas = new Set(configuracion.carpetasIgnoradas.map(function (nombre) {
    return nombre.toLocaleLowerCase("es");
  }));

  for (const entrada of entradas) {
    if (entrada.isSymbolicLink()) continue;
    if (entrada.name.startsWith(".")) continue;
    if (ignorada(entrada.name, ignoradas)) continue;
    const rutaCompleta = path.join(rutaActual, entrada.name);

    if (entrada.isDirectory()) {
      await recorrerCarpeta(raiz, rutaCompleta, configuracion, encontrados, avisos);
      continue;
    }
    if (!entrada.isFile() || !esArchivoDeVideo(entrada.name, configuracion.extensiones)) continue;

    try {
      const estadisticas = await fsPromesas.stat(rutaCompleta);
      const relativa = path.relative(raiz.ruta, rutaCompleta);
      const nombre = analizarNombreArchivo(entrada.name);
      encontrados.push({
        id: identificadorArchivo(raiz.nombre, relativa),
        carpeta: raiz.nombre,
        ruta: rutaCompleta,
        rutaRelativa: relativa,
        nombreArchivo: entrada.name,
        tituloDetectado: nombre.tituloDetectado,
        anioDetectado: nombre.anioDetectado,
        extension: nombre.extension,
        tamanoBytes: estadisticas.size,
        modificadoEn: estadisticas.mtime.toISOString(),
        disponible: true
      });
    } catch (error) {
      avisos.push({ tipo: "archivo-no-legible", mensaje: "No se pudo inspeccionar un archivo de vídeo." });
    }
  }
}

function ignorada(nombre, conjunto) {
  return conjunto.has(String(nombre).toLocaleLowerCase("es"));
}

function conservarDatosEnriquecidos(nuevo, anterior, ahora) {
  const resultado = Object.assign({}, anterior || {}, nuevo);
  const estable = Boolean(anterior &&
    anterior.tamanoBytes === nuevo.tamanoBytes &&
    anterior.modificadoEn === nuevo.modificadoEn);
  resultado.disponible = estable;
  resultado.estadoArchivo = estable ? "disponible" : "copiandose";
  resultado.descubiertoEn = anterior && anterior.descubiertoEn ? anterior.descubiertoEn : ahora;
  resultado.actualizadoEn = ahora;
  return resultado;
}

function catalogoPublico(catalogo) {
  return {
    version: catalogo.version,
    actualizadoEn: catalogo.actualizadoEn,
    resumen: {
      total: catalogo.peliculas.length,
      disponibles: catalogo.peliculas.filter(function (pelicula) { return pelicula.disponible; }).length,
      copiandose: catalogo.peliculas.filter(function (pelicula) {
        return pelicula.estadoArchivo === "copiandose";
      }).length,
      carpetas: catalogo.raices.length
    },
    carpetas: catalogo.raices.map(function (raiz) {
      return {
        nombre: raiz.nombre,
        disponible: raiz.disponible,
        peliculas: raiz.peliculas,
        revisadaEn: raiz.revisadaEn,
        mensaje: raiz.disponible ? "Disponible" : "No se pudo acceder a esta carpeta"
      };
    }),
    peliculas: catalogo.peliculas.map(function (pelicula) {
      return {
        id: pelicula.id,
        carpeta: pelicula.carpeta,
        nombreArchivo: pelicula.nombreArchivo,
        tituloDetectado: pelicula.tituloDetectado,
        anioDetectado: pelicula.anioDetectado,
        extension: pelicula.extension,
        tamanoBytes: pelicula.tamanoBytes,
        modificadoEn: pelicula.modificadoEn,
        disponible: pelicula.disponible,
        estadoArchivo: pelicula.estadoArchivo || (pelicula.disponible ? "disponible" : "no_disponible"),
        tmdb: pelicula.tmdb || null,
        /* null = no se pudo analizar con ffprobe (no instalado, o aún no escaneado con esta
           versión); "compatible" = se sirve tal cual; "remux"/"transcodificar" = necesita
           GMM.servidor -> transcodificar.js antes de reproducirse en el navegador. */
        compatibilidad: pelicula.compatibilidad || null
      };
    })
  };
}

class GestorCatalogo {
  constructor(configuracion, opciones) {
    this.configuracion = configuracion;
    this.catalogo = catalogoVacio();
    this.escaneoEnCurso = null;
    /* Inyectable para las pruebas: por defecto llama a ffprobe de verdad. Si el binario no
       existe, sondearArchivo resuelve null y el archivo se cataloga sin compatibilidad
       conocida (ver conservarCompatibilidad más abajo). */
    this.sondear = (opciones && opciones.sondear) || function (ruta) {
      return sondearArchivo(configuracion.rutaFFprobe, ruta);
    };
  }

  async iniciar() {
    this.catalogo = await leerCatalogo(this.configuracion.rutaCatalogo);
    return this.catalogo;
  }

  obtenerPublico() {
    return catalogoPublico(this.catalogo);
  }

  /* Devuelve solo al servidor la ubicación de un archivo que ya formaba parte
     del catálogo. Esta información nunca sale por la API JSON: la usa api.js
     exclusivamente para abrir un stream temporal protegido. */
  obtenerArchivo(id) {
    const pelicula = this.catalogo.peliculas.find(function (entrada) {
      return entrada.id === id;
    });
    if (!pelicula || !pelicula.disponible || pelicula.estadoArchivo !== "disponible") return null;
    return pelicula;
  }

  /* Reutiliza la compatibilidad ya conocida si el archivo no cambió desde el último escaneo
     (mismo criterio de "estable" que conservarDatosEnriquecidos); si es nuevo o cambió, vuelve
     a sondearlo. Sondear cuesta una llamada a ffprobe por archivo, así que solo se paga una vez
     por archivo estable. Muta "nueva" en vez de devolver, porque conservarDatosEnriquecidos ya
     espera un objeto plano con todos los campos del archivo.

     Si la vez anterior quedó en null (típicamente porque ffmpeg no estaba instalado todavía),
     "estable" no basta para reutilizarlo: se vuelve a sondear en cada escaneo hasta obtener un
     valor real, para que instalar ffmpeg más tarde lo resuelva solo, sin tener que tocar los
     archivos para forzar un re-análisis. */
  async _probarCompatibilidad(nueva, anterior) {
    const estable = Boolean(anterior &&
      anterior.tamanoBytes === nueva.tamanoBytes &&
      anterior.modificadoEn === nueva.modificadoEn);
    if (estable && anterior.compatibilidad) {
      nueva.compatibilidad = anterior.compatibilidad;
      nueva.codecVideo = anterior.codecVideo || null;
      nueva.codecAudio = anterior.codecAudio || null;
      return;
    }
    const sondeo = await this.sondear(nueva.ruta);
    if (!sondeo) {
      nueva.compatibilidad = null;
      return;
    }
    nueva.codecVideo = sondeo.codecVideo || null;
    nueva.codecAudio = sondeo.codecAudio || null;
    nueva.compatibilidad = evaluarCompatibilidad({
      extension: nueva.extension,
      codecVideo: sondeo.codecVideo,
      codecAudio: sondeo.codecAudio
    });
  }

  async escanear() {
    if (this.escaneoEnCurso) return this.escaneoEnCurso;
    this.escaneoEnCurso = this._escanear().finally(() => {
      this.escaneoEnCurso = null;
    });
    return this.escaneoEnCurso;
  }

  async escanearConfirmando(esperaMs) {
    let catalogo = await this.escanear();
    const espera = esperaMs === undefined ? 2000 : Number(esperaMs);
    if (catalogo.resumen.copiandose > 0 && espera >= 0) {
      if (espera > 0) await new Promise(function (resolver) { setTimeout(resolver, espera); });
      catalogo = await this.escanear();
    }
    return catalogo;
  }

  async _escanear() {
    const ahora = new Date().toISOString();
    const anteriores = new Map(this.catalogo.peliculas.map(function (pelicula) {
      return [pelicula.id, pelicula];
    }));
    const peliculas = [];
    const raices = [];
    const avisos = [];

    for (const raiz of this.configuracion.carpetas) {
      let disponible = true;
      try {
        await fsPromesas.access(raiz.ruta, fs.constants.R_OK);
      } catch (error) {
        disponible = false;
      }

      if (disponible) {
        const encontradas = [];
        await recorrerCarpeta(raiz, raiz.ruta, this.configuracion, encontradas, avisos);
        for (const nueva of encontradas) {
          const anterior = anteriores.get(nueva.id);
          await this._probarCompatibilidad(nueva, anterior);
          peliculas.push(conservarDatosEnriquecidos(nueva, anterior, ahora));
        }
        raices.push({
          nombre: raiz.nombre,
          ruta: raiz.ruta,
          disponible: true,
          peliculas: encontradas.length,
          revisadaEn: ahora
        });
      } else {
        const conservadas = this.catalogo.peliculas
          .filter(function (pelicula) { return pelicula.carpeta === raiz.nombre; })
          .map(function (pelicula) {
            return Object.assign({}, pelicula, {
              disponible: false,
              estadoArchivo: "no_disponible",
              actualizadoEn: ahora
            });
          });
        peliculas.push(...conservadas);
        raices.push({
          nombre: raiz.nombre,
          ruta: raiz.ruta,
          disponible: false,
          peliculas: conservadas.length,
          revisadaEn: ahora
        });
        avisos.push({ tipo: "raiz-no-disponible", carpeta: raiz.nombre, mensaje: "No se pudo acceder a la carpeta." });
      }
    }

    peliculas.sort(function (a, b) {
      return a.tituloDetectado.localeCompare(b.tituloDetectado, "es", { sensitivity: "base" });
    });
    this.catalogo = {
      version: VERSION_CATALOGO,
      actualizadoEn: ahora,
      raices,
      peliculas,
      avisos
    };
    await guardarCatalogo(this.configuracion.rutaCatalogo, this.catalogo);
    return this.obtenerPublico();
  }
}

module.exports = {
  GestorCatalogo,
  VERSION_CATALOGO,
  catalogoPublico,
  catalogoVacio,
  guardarCatalogo,
  identificadorArchivo,
  leerCatalogo
};
