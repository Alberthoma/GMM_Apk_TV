# Pruebas de givemymovies

**La aplicación no tiene dependencias.** Se abre con doble clic y punto. Esta carpeta es una
herramienta aparte, opcional, para comprobar que un cambio no rompió nada.

## Cómo se ejecutan

Desde la raíz del proyecto:

Para abrir la versión local de la app sin publicar, ejecuta `node pruebas/servidor-local.js` y
entra en `http://127.0.0.1:8080`. Solo escucha en este PC y bloquea `.git/`, `PRIVADO/`,
`gmm-server/` y `obsoleto/`.

```bash
node pruebas/logica.js      # 184 comprobaciones · sin dependencias · instantáneo
node pruebas/imagenes.js    #  15 comprobaciones · necesita internet · ~30 s
node pruebas/interfaz.js    # 127 comprobaciones · necesita playwright-core · ~60 s
node pruebas/pwa.js         #  20 comprobaciones · necesita playwright-core · ~20 s
```

La primera vez, para la de interfaz:

```bash
cd pruebas
npm install playwright-core
```

Si no está instalado, `interfaz.js` lo dice y sale sin marcar fallo — no rompe nada.
Usa un Chromium ya descargado en la caché de Playwright; si no encuentra ninguno,
te indica cómo bajarlo (`npx playwright install chromium`).

## Qué comprueba cada una

| Archivo | Cubre |
|---|---|
| `logica.js` | Filtrado por idioma, plataforma y país · frase resumen · insignias de confianza · orden por confianza · listas de favoritas y pendientes · exportar/importar · utilidades · coherencia interna del catálogo demo · lotes con concurrencia limitada · fusión de listas y mensajes de error de la cuenta (Firebase, V GMM 0029) |
| `imagenes.js` | Que cada carátula y cada foto del catálogo demo **pertenecen de verdad a esa ficha**, no solo que devuelven 200 |
| `interfaz.js` | El recorrido real en Chromium: arranque, autocompletado, búsqueda, filtros en caliente, casos de idioma, listas, persistencia tras recargar, modo actor, modal, modo trama, móvil a 375 px y el modal de cuenta (login/registro/recuperar, stubeado — V GMM 0029) |
| `pwa.js` | Que la app se **instala** de verdad: manifiesto válido, iconos que son PNG reales, service worker activo, funcionamiento sin conexión, y que **ninguna respuesta de la API queda cacheada** |

`pwa.js` levanta un servidor local propio, sin dependencias añadidas, porque los service
workers no existen sobre `file://`. `localhost` cuenta como origen seguro igual que HTTPS.

`clave.js` comprueba una clave de TMDB sin exponerla: `node pruebas/clave.js TU_CLAVE`.

`cargar.js` es la utilidad compartida: extrae el `<script>` de `index.html`, lo ejecuta con un
navegador simulado mínimo y devuelve `GMM`.

> Usa `vm.runInThisContext`, **no `eval`**. El `"use strict"` del script hace que `eval` cree
> su propio ámbito y las variables `var` nunca lleguen al global: `GMM` saldría `undefined`.

## Por qué existe `imagenes.js`

Un HTTP 200 en `image.tmdb.org` no prueba que la imagen sea de la película correcta.
En este proyecto ya pasó dos veces:

- El id `1417` **no** es *Volver*, es *El laberinto del fauno*. El correcto es **219**.
- El id `1281` **no** es Penélope Cruz, es Freddie Highmore. El correcto es **955**.

La comprobación fiable es leer `og:title` y `og:image` de la ficha pública de TMDB, que
siempre pertenecen a esa ficha. Y hay que pedirla con el mismo idioma que usa la app
(`?language=es-ES`), porque TMDB sirve una carátula distinta según el locale.

**Ejecuta esta prueba siempre que toques `GMM.demo`.**

## Capturas

`interfaz.js` deja cinco capturas en `pruebas/capturas/`. Sirven para revisar de un vistazo
que el aspecto no se rompió. No se versionan.
