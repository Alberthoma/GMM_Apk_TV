# GMM TV

Aplicación nativa para Android TV. Presenta el catálogo **Te la tengo**, se maneja con
D-pad/OK/Back y usa Media3/ExoPlayer a pantalla completa. GMM Server es siempre el motor
principal; Jellyfin solo se consulta como respaldo opcional.

La interfaz de TV incluye encabezado GMM tipo cinta, cambio entre películas y series,
búsqueda por título o actor/actriz, filtros de año, género y calificación, orden por fecha,
alfabético o nota, y favoritas locales sin necesidad de cuenta. Mantén pulsado OK sobre una
carátula para añadirla o quitarla de Favoritas. TMDB completa y guarda localmente los datos
necesarios durante la primera indexación; los resultados siempre se limitan a los archivos
que realmente existen en **Te la tengo**.

## Flujo de reproducción

1. La app enumera los decodificadores reales del TV y envía sus capacidades a
   `POST /api/tv/reproducir/:id`.
2. GMM Server responde **Direct Play** y entrega el MKV/MP4 original cuando contenedor,
   vídeo y audio son compatibles.
3. Si solo falla el contenedor, FFmpeg hace **remux** (`-c copy`) a MP4. No recodifica ni
   pierde calidad.
4. Si falta un decodificador de vídeo o audio, FFmpeg hace **transcode** H.264/AAC y guarda
   el resultado en caché.
5. Si esa conversión falla y el usuario habilitó el respaldo, GMM busca la misma película
   en Jellyfin por TMDB o por título/año. Jellyfin no sustituye el catálogo principal.

Los enlaces multimedia son temporales, no revelan rutas del PC y aceptan solicitudes Range
para permitir avance y retroceso eficientes.

## Preparar GMM Server y Tailscale

1. Instala Tailscale en el PC y en el TCL Android TV e inicia ambos con la misma tailnet.
2. En `gmm-server/PRIVADO/configuracion.json`, usa `"host": "0.0.0.0"`, una
   `claveAdministracion` aleatoria de al menos 32 caracteres y configura tus carpetas.
3. Instala FFmpeg/FFprobe y configura sus rutas. Ejecuta `npm test` y después
   `node servidor.js` desde `gmm-server`.
4. Anota la IP Tailscale del PC (normalmente `100.x.y.z`) y permite el puerto TCP 7399 en el
   firewall solo para la red privada/Tailscale.
5. Jellyfin es opcional. Si se desea respaldo, añade `jellyfinUrl` y `jellyfinClaveApi`; si
   no existen o Jellyfin está apagado, GMM continúa normalmente.

## Instalar en TCL Android TV

1. Copia `GMM-TV-release.apk` al TV o usa `adb install -r GMM-TV-release.apk`.
2. En el TV permite *Instalar apps desconocidas* para el explorador utilizado.
3. Abre **GMM TV → Ajustes**. Introduce `http://IP_TAILSCALE_PC:7399` y la misma clave de
   administración. Activa o desactiva el respaldo Jellyfin.
4. Vuelve al catálogo. El primer elemento recibe foco y el borde dorado confirma la posición
   del mando. OK reproduce; Back vuelve; los controles de Media3 aceptan D-pad.

HTTP se permite deliberadamente porque el tráfico viaja cifrado dentro de Tailscale. No
expongas el puerto 7399 directamente a Internet.

## Cómo verificar cada estrategia

- **Direct Play:** MKV/MP4 con HEVC/H.264 y audio que el TCL anuncie. Al iniciar aparece
  “Direct Play · archivo original”. La CPU del PC debe permanecer baja y no aparece MP4 nuevo
  en la caché.
- **Remux:** archivo AVI/MOV con H.264/AAC. Aparece “Adaptando el contenedor…” una vez y luego
  “Remux · sin recodificar”.
- **Transcode:** archivo con códec no anunciado por el TV (por ejemplo DTS en ciertos modelos).
  Aparece “Convirtiendo solo lo necesario…” y luego “Transcodificación GMM”.
- **Jellyfin:** habilita el respaldo, configura una película equivalente y provoca un fallo de
  FFmpeg. Debe aparecer “Jellyfin · respaldo”.

Para diagnóstico, `adb logcat | findstr givemymovies` muestra fallos de red/reproductor. La
estrategia también aparece brevemente sobre el vídeo.

## Compilar

Requiere JDK 17, Android SDK Platform 35 y Build Tools 35.0.0:

```powershell
cd android-tv
.\gradlew.bat clean testDebugUnitTest assembleRelease
```

El APK se genera en `app/build/outputs/apk/release/app-release.apk`. La variante release usa
la firma de depuración para que sea instalable durante esta fase; antes de distribución pública
debe configurarse una clave de firma privada fuera del repositorio.
