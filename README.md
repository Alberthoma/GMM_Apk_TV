# GiveMyMovies

Aplicacion web instalable para descubrir peliculas y series, organizar listas
y conectarse con GMM Server para reproducir copias personales.

## Componentes

- La PWA se sirve desde `index.html`, `manifest.json` y `sw.js`.
- GMM Server y sus pruebas estan en `gmm-server/`.
- La aplicación nativa para TV está en `android-tv/`; su guía de instalación y pruebas está en `android-tv/README.md`.
- Las pruebas de la aplicacion estan en `pruebas/`.
- Las decisiones tecnicas vigentes estan resumidas en `PROJECT.md`.

## Desarrollo

La aplicacion web no requiere compilacion. Para GMM Server se necesita Node.js
22 o superior. Las dependencias locales y los datos privados no se publican.

```powershell
cd gmm-server
npm test
```

Para preparar las pruebas de la aplicacion:

```powershell
cd pruebas
npm ci
```

## Versiones

Cada entrega incrementa el numero `V GMM NNNN` mostrado en el footer de
`index.html`. El historial se conserva mediante commits, etiquetas y Releases;
no se crean carpetas de respaldo dentro del proyecto.

## Publicacion

El unico repositorio autorizado es:

`https://github.com/Alberthoma/GMM_Apk_TV.git`

Los ejecutables compilados se publican como archivos de GitHub Releases, no
dentro del arbol de codigo fuente.

### Protocolo obligatorio antes de publicar

1. Se revisan los archivos modificados y los archivos nuevos.
2. Un archivo nuevo (por ejemplo, una imagen, un APK o un script) solo se
   incluye cuando se confirma expresamente que debe formar parte del proyecto.
3. Se prueban los cambios y se crea un commit local con una descripción clara.
4. Solo después se ejecuta `1 - SUBIR a GitHub (push).bat`.

El BAT únicamente ejecuta `git push`: no hace `pull`, no descarga cambios del
repositorio, no borra carpetas y no añade archivos nuevos por su cuenta. Si la
publicación es rechazada, se detiene sin modificar la carpeta local.

## Privacidad

No se deben confirmar claves, tokens, credenciales, catalogos ni rutas locales.
Los datos personales permanecen unicamente en las carpetas ignoradas
`PRIVADO/` y `gmm-server/PRIVADO/`.
