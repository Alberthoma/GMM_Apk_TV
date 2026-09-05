/* ══════════════════════════════════════════════════════════════════════
   clave.js — comprueba que tu clave de TMDB funciona de verdad

   Ejecutar:
       node pruebas/clave.js TU_CLAVE
   o bien, para que no quede en el historial del terminal:
       $env:TMDB_KEY = "tu_clave"   ;   node pruebas/clave.js

   No guarda la clave en ningún sitio ni la envía a nadie más que a TMDB.
   Sin dependencias.
   ══════════════════════════════════════════════════════════════════════ */

const clave = process.argv[2] || process.env.TMDB_KEY || "";

if (!clave) {
  console.log("\n  Falta la clave.\n");
  console.log("      node pruebas/clave.js TU_CLAVE\n");
  console.log("  O sin dejar rastro en el historial:\n");
  console.log('      $env:TMDB_KEY = "tu_clave"');
  console.log("      node pruebas/clave.js\n");
  process.exit(1);
}

const API = "https://api.themoviedb.org/3";
const oculta = clave.slice(0, 4) + "…" + clave.slice(-4);

async function pedir(ruta, extra) {
  const url = API + ruta + "?api_key=" + encodeURIComponent(clave) + (extra ? "&" + extra : "");
  const r = await fetch(url);
  if (r.status === 401) throw new Error("CLAVE_INVALIDA");
  if (!r.ok) throw new Error("HTTP_" + r.status);
  return r.json();
}

(async () => {
  console.log("\n  Comprobando la clave " + oculta + " …\n");

  /* 1 · ¿La acepta TMDB? */
  try {
    await pedir("/configuration");
    console.log("  ok   TMDB acepta la clave");
  } catch (e) {
    if (e.message === "CLAVE_INVALIDA") {
      console.log("  FALLA  TMDB la rechaza (401).\n");
      console.log("  Revisa que sea la «API Key (v3 auth)», una cadena de 32 caracteres");
      console.log("  hexadecimales. NO es el «API Read Access Token», que es mucho más");
      console.log("  largo y empieza por eyJ… — ese no sirve para esta aplicación.\n");
    } else {
      console.log("  FALLA  No se pudo contactar con TMDB: " + e.message + "\n");
    }
    process.exit(1);
  }

  /* 2 · Búsqueda en español */
  const busqueda = await pedir("/search/movie", "query=Interestelar&language=es-ES");
  const peli = (busqueda.results || [])[0];
  console.log("  ok   Búsqueda en español: «" + (peli ? peli.title : "?") +
              "» (" + (peli ? peli.release_date.slice(0, 4) : "?") + ")");

  /* 3 · El dato central: dónde verla */
  const prov = await pedir("/movie/" + peli.id + "/watch/providers");
  const paises = Object.keys(prov.results || {}).filter((c) => c.length === 2);
  console.log("  ok   Disponibilidad real: " + paises.length + " países");

  const conEspanol = ["AR", "MX", "ES", "CO", "CL", "PE", "UY"].filter((c) => paises.includes(c));
  if (conEspanol.length) {
    console.log("\n  Mercados hispanohablantes donde está ahora mismo:");
    for (const c of conEspanol) {
      const bloque = prov.results[c];
      const nombres = [];
      for (const tipo of ["flatrate", "free", "ads", "rent", "buy"]) {
        (bloque[tipo] || []).forEach((p) => {
          if (!nombres.includes(p.provider_name)) nombres.push(p.provider_name);
        });
      }
      console.log("    " + c + "  " + nombres.slice(0, 5).join(", ") +
                  (nombres.length > 5 ? " +" + (nombres.length - 5) : ""));
    }
  }

  /* 4 · Catálogo de plataformas */
  const cat = await pedir("/watch/providers/movie", "language=es-ES");
  console.log("\n  ok   Catálogo de plataformas: " + (cat.results || []).length + " proveedores");

  console.log("\n  La clave funciona. Pégala en el engranaje ⚙ de la app");
  console.log("  y la pastilla de la cabecera pasará a «Datos en vivo».\n");
})().catch((e) => {
  console.error("\n  Error inesperado: " + e.message + "\n");
  process.exit(1);
});
