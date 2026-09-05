# GiveMyMovies - contexto de trabajo

## Fase actual

Este repositorio contiene la PWA GiveMyMovies y GMM Server. La aplicacion web
vive principalmente en `index.html`; `manifest.json` y `sw.js` completan la
PWA. El servidor local vive en `gmm-server/`.

## Reglas esenciales

- La version visible se encuentra en el footer de `index.html`, dentro de
  `#version-app`. Cada entrega nueva debe incrementar `V GMM NNNN`.
- Despues de cambiar recursos de la PWA, actualizar tambien la version de cache
  en `sw.js` cuando corresponda.
- No crear copias ni carpetas de respaldo dentro del proyecto. Git conserva el
  historial; usar commits y etiquetas para recuperar versiones anteriores.
- No modificar ni publicar `obsoleto/`.
- Nunca guardar claves, tokens, catalogos privados ni rutas personales fuera de
  `PRIVADO/` o `gmm-server/PRIVADO/`. Ambas carpetas deben seguir ignoradas.
- El unico destino Git permitido es
  `https://github.com/Alberthoma/GMM_Apk_TV.git`.
- Los ejecutables y otros artefactos generados no forman parte del codigo
  fuente. Compilarlos desde `gmm-server/build/Compilar.ps1` y distribuirlos
  mediante GitHub Releases cuando se necesiten.

## Estructura activa

- `index.html`: interfaz y logica principal de la PWA.
- `manifest.json`: metadatos de instalacion.
- `sw.js`: service worker y cache.
- `firestore.rules`: reglas de Firebase.
- `iconos/`: recursos visuales de la PWA.
- `gmm-server/`: servidor local, panel, instalador, compilacion y pruebas.
- `pruebas/`: pruebas de logica, interfaz, imagenes y PWA.
- `.githooks/pre-push`: impide publicar en otro repositorio.

## Verificacion minima

1. Ejecutar las pruebas de `gmm-server` con Node.js 22 o superior.
2. Instalar las dependencias de `pruebas/` con `npm ci` y ejecutar las suites
   aplicables.
3. Comprobar que `index.html`, `manifest.json` y `sw.js` usan rutas compatibles
   con GitHub Pages bajo `/GMM_Apk_TV/`.
4. Si cambia `gmm-server/src/`, recompilar los ejecutables antes de preparar una
   Release.
5. Revisar `git status` y buscar secretos antes de cada publicacion.

## Commit y publicacion

- **Commit:** realiza el cierre completo de la version y guarda los cambios
  localmente, sin enviarlos a GitHub.
- **Publica** o **push:** realiza el cierre completo, envia el commit a `main`,
  espera GitHub Pages y comprueba el cambio en la aplicacion publicada.
- Una rama de trabajo o de pull request no publica la aplicacion. GitHub Pages
  debe servir la rama `main` desde la raiz del repositorio.
- Antes del commit: incrementar `V GMM NNNN` en el footer, actualizar `VERSION`
  en `sw.js` cuando cambie la PWA, ejecutar pruebas y revisar secretos y
  `git status`.
- Si cambia `gmm-server/src/`, recompilar y probar los dos ejecutables antes de
  cerrar la version.
- Antes de cada push, consultar `origin/main` y detenerse ante cambios remotos
  inesperados.

## Trabajo pendiente de la nueva fase

Mantener aqui solamente tareas vigentes y concretas. Las decisiones cerradas y
el historial detallado pertenecen a Git, no a documentos acumulativos.
