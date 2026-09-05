# GMM Server

Servidor multimedia personal de **GiveMyMovies**. Lee únicamente las carpetas que el
propietario configura y construye un catálogo local de sus archivos de vídeo. Ninguna
película se sube a Google Drive, Firebase ni otro almacenamiento en la nube.

**¿Primera vez con esto?** Sigue **[EMPEZAR-DESDE-CERO.md](EMPEZAR-DESDE-CERO.md)**, numerado
paso a paso desde instalar Node.js hasta ver tus películas en el móvil fuera de casa. Este
README es la referencia detallada de cada parte por separado.

**¿Lo vas a instalar en otro PC?** No hace falta copiar esta carpeta entera. Compila (o pide que
te compilen) **`GMM-Server.exe`** y **`GMM-Instalar.exe`** — ver "Compilar los .exe" más abajo —
y copia solo esos dos archivos. Llevan el motor entero incrustado dentro; nada de carpetas ni
archivos sueltos.

## Estado de esta entrega

Esta es la **fase 2** del proyecto:

- configuración privada separada del repositorio;
- escaneo recursivo de una o varias carpetas;
- reconocimiento inicial del título y año desde el nombre del archivo;
- catálogo persistente y regenerable;
- confirmación en dos revisiones antes de marcar disponible un archivo nuevo o modificado;
- detección de discos o carpetas desconectados;
- API local protegida;
- conexión desde la sección **▶ Te la tengo** de GiveMyMovies;
- enlaces temporales para reproducción y descarga, sin exponer la ruta física;
- reproducción HTTP con rangos, para poder avanzar y retroceder en formatos compatibles;
- conversión con FFmpeg para los vídeos que el navegador no reproduce tal cual;
- acceso remoto por Tailscale (ver "Acceso remoto" más abajo);
- ninguna operación para borrar o modificar películas;
- pruebas automáticas sin dependencias externas.

Las carátulas y fichas se resuelven desde la PWA con la clave personal de TMDB del usuario.

## Instalar Node.js, FFmpeg y Tailscale sin usar la consola

**`GMM-Instalar.vbs`**, en esta misma carpeta, abre un asistente con botones para las tres cosas
que puede necesitar un PC nuevo: instala **Node.js** (obligatorio: sin él, GMM Server no arranca),
**FFmpeg** y el cliente de **Tailscale**, todo con `winget`, sin que tengas que escribir nada en
una consola. Para Tailscale, además, te lleva a iniciar sesión y abre la página para instalar la
app en el móvil (eso sí hay que hacerlo a mano: es un inicio de sesión con tu cuenta). Si `winget`
no está disponible en tu PC, el asistente abre la página de descarga correspondiente en su lugar.
Es un script de PowerShell puro — no necesita Node.js instalado para funcionar él mismo, así que
no hay problema de "para instalar Node.js necesito Node.js". Las secciones siguientes explican lo
mismo paso a paso por si prefieres hacerlo a mano.

## Conversión con FFmpeg (vídeos que el navegador no reproduce tal cual)

Muchos `.mkv` no se reproducen en un `<video>` de navegador aunque el archivo esté perfectamente
sano: el contenedor Matroska no se reconoce de forma fiable, y algunos códecs de audio (AC3, DTS)
o de vídeo (HEVC) tampoco. GMM Server detecta esto solo, sin que tengas que hacer nada por
película:

1. **Instala FFmpeg** una vez en el PC que hace de servidor — por ejemplo
   `winget install Gyan.FFmpeg` — y comprueba que `ffmpeg` y `ffprobe` funcionan desde una
   consola nueva. Si prefieres no instalarlo en el `PATH`, indica la ruta completa de cada uno
   en `PRIVADO/configuracion.json` con `rutaFFmpeg` y `rutaFFprobe`.
2. **Sin FFmpeg instalado, no cambia nada**: el catálogo se sigue construyendo igual que antes de
   esta función, y los vídeos que el navegador no soporta simplemente se descargan (como hasta
   ahora). No hace falta desactivar nada a propósito.
3. Con FFmpeg instalado, cada escaneo analiza los archivos nuevos o cambiados (con `ffprobe`, sin
   recodificar nada) y anota si son reproducibles tal cual, si basta con cambiar el contenedor
   (rápido, sin pérdida) o si hace falta recodificar de verdad (lento, usa la CPU del PC).
4. Al pulsar **Ver** sobre uno de esos títulos, GMM Server empieza la conversión y GiveMyMovies
   muestra "Preparando vídeo…" mientras tanto — puede tardar varios minutos la primera vez, según
   la duración de la película y la CPU del PC. El resultado se guarda en
   `PRIVADO/transcodificado/` (configurable con `rutaCacheTranscodificacion`), así que las
   siguientes veces se reproduce al instante. **Descargar** siempre entrega el archivo original,
   sin esperar ni convertir nada.
5. Solo se convierte un vídeo a la vez, para no saturar el PC con varias conversiones a la vez.

## Requisitos

- Windows de 64 bits.
- Node.js 22 o posterior.
- No necesita instalar paquetes de npm.

## Iniciar (con la app GMM-Server, recomendado)

**`GMM-Server.vbs`**, en esta misma carpeta, abre una aplicación de escritorio para
manejar todo sin PowerShell ni ventanas negras. **La primera vez que se abre, crea sola**
`PRIVADO/configuracion.json` (con una clave aleatoria) si todavía no existe — no hace falta
ejecutar nada por consola antes. La carpeta `PRIVADO` está excluida del repositorio.

- **Iniciar servidor** / **Detener servidor**, en un solo botón. Al iniciar, escanea las
  carpetas configuradas.
- **Escanear ahora**: refresca el catálogo sin reiniciar nada (usa `/api/escanear`,
  que ya trae el propio servidor).
- **Añadir carpeta...**: abre el selector nativo de Windows (el mismo de "Guardar
  como") para elegir una carpeta o disco sin escribir la ruta a mano; **Quitar
  carpeta** la retira de la lista. Los cambios de carpetas piden reiniciar el
  servidor para aplicarse — el resto de la ventana no.
- La **clave de administración**, visible con un botón **Copiar**, para pegarla
  directamente en ⚙ de GiveMyMovies.
- **Activar HTTPS con Tailscale**: deja el servidor accesible por HTTPS de verdad dentro de tu
  tailnet (ver "Acceso remoto" más abajo), con un botón — sin escribir comandos.
- Si cierras la ventana con el servidor encendido, la app se oculta en la
  **bandeja del sistema** (junto al reloj) y el servidor sigue funcionando. Doble
  clic en el icono para volver a abrirla; clic derecho → **Detener servidor y
  salir** para apagarlo del todo.
- Solo deja abrir una copia a la vez: si haces doble clic de nuevo en
  `GMM-Server.vbs` mientras ya está abierta (aunque esté oculta en la bandeja), lo
  avisa en vez de intentar abrir un segundo servidor en el mismo puerto.

## Compilar los `.exe` (para llevar a otro PC sin copiar la carpeta entera)

`GMM-Server.vbs` + `GMM-Server-Panel.ps1` y `GMM-Instalar.vbs` + `GMM-Server-Instalador.ps1` son
el **código fuente**, pensado para editarse. Para entregarle esto a un usuario final —o a ti
mismo en otro PC— sin que vea una carpeta con una docena de archivos, se compilan a dos `.exe`
independientes:

```powershell
Install-Module ps2exe -Scope CurrentUser   # una sola vez
powershell -File build\Compilar.ps1
```

Genera `build\salida\GMM-Server.exe` y `build\salida\GMM-Instalar.exe`. Copia esos dos archivos
a donde haga falta — no necesitan nada más al lado.

**Cómo funciona `GMM-Server.exe`:** lleva el motor entero (`servidor.js`, `src/*.js`,
`preparar.js`, `configuracion.ejemplo.json`) incrustado dentro del propio `.exe`. La primera vez
que se ejecuta, lo extrae a `%LOCALAPPDATA%\GMM-Server\motor` y ahí vive también su
`PRIVADO\configuracion.json` — por eso el `.exe` puede moverse o copiarse a otro sitio sin perder
la configuración ni el catálogo, y por eso dos copias del `.exe` en dos PCs distintos no se pisan
entre sí. `GMM-Instalar.exe` no incrusta nada: solo llama a `winget` y abre páginas web, así que
se compila tal cual.

Ambos siguen necesitando **Node.js** instalado en el PC donde se ejecuten — no va incrustado (el
propio `GMM-Instalar.exe` lo instala). Compilar no cambia esa necesidad, solo evita que el
usuario tenga que ver o tocar los archivos que la resuelven.

**Advertencia honesta:** al ser un `.exe` sin firmar, Windows SmartScreen puede avisar ("Windows
protegió su PC") la primera vez que se ejecuta en un PC distinto de donde se compiló, sobre todo
si llegó por descarga (con la "marca de la Web"). Es el mismo aviso que sale con cualquier
programa nuevo sin firma digital — "Más información" → "Ejecutar de todas formas" lo pasa. Copiar
por USB o red local reduce bastante que aparezca, pero no lo garantiza.

## Preparar e iniciar a mano (alternativa, por si prefieres consola)

```powershell
npm.cmd run configurar
```

Crea `PRIVADO/configuracion.json` con una clave aleatoria. Abre ese archivo y cambia
`D:\\Peliculas` por la ruta real de tu carpeta. Se pueden declarar varias carpetas con
nombres distintos. Los mismos pasos también existen como `.bat`:

- **`1-configurar-y-escanear.bat`**: crea la configuración si hace falta, abre
  `PRIVADO/configuracion.json` en el Bloc de notas para editar las carpetas, y al
  cerrarlo escanea una vez.
- **`2-iniciar-servidor.bat`**: deja el servidor encendido (equivale a `npm.cmd
  start`).

O directamente por PowerShell, para actualizar el catálogo una sola vez y terminar:

```powershell
npm.cmd run escanear
```

Para dejar GMM Server funcionando y preparado para atender la aplicación:

```powershell
npm.cmd start
```

Con la configuración de ejemplo, el estado básico se puede comprobar en:

<http://127.0.0.1:7399/api/salud>

El catálogo completo exige la clave privada y está pensado para que lo consulte GMM,
no para exponerlo directamente en Internet.

## Conectar GiveMyMovies

Con el servidor iniciado, abre GiveMyMovies y ve a **⚙ Ajustes**. En la sección **GMM Server**
escribe:

- Dirección local: `http://127.0.0.1:7399`
- Clave: el valor `claveAdministracion` de `PRIVADO/configuracion.json`

Pulsa **Probar conexión**. Después abre **▶ Te la tengo**: verás el catálogo, con los botones
**Ver** y **Descargar** para cada archivo disponible. La clave queda guardada únicamente en ese
navegador. Cada reproducción genera un enlace temporal que caduca por defecto a los 10 minutos;
puedes cambiarlo con `duracionEnlaceMinutos` (entre 1 y 60) en la configuración privada.

### Acceso remoto (fuera de casa): HTTPS con Tailscale Serve

**GiveMyMovies se sirve por `https://`, y los navegadores bloquean que una página segura hable
con una dirección `http://` sin cifrar** ("contenido mixto") — así que una IP de Tailscale en
`http://` (lo que hacía esta sección hasta la versión anterior) conecta bien probada a mano desde
el propio PC, pero falla en silencio desde el navegador del móvil, sin explicar por qué. La forma
correcta es dejar que Tailscale ponga un candado HTTPS de verdad delante del servidor.

**Con `GMM-Server.vbs` / `GMM-Server.exe` (recomendado, sin consola):** en la ventana del panel,
sección "Acceso remoto seguro", botón **"Activar HTTPS con Tailscale"**. Detecta el nombre de
este PC en tu tailnet y ejecuta lo de abajo por ti; si tu cuenta de Tailscale todavía no tiene
activados los certificados, te lo dice con el enlace exacto para activarlo (una sola vez, hecho
a mano en la web de Tailscale — eso no se puede automatizar).

**A mano, por si prefieres verlo paso a paso:**

1. Instala [Tailscale](https://tailscale.com/) en el PC que conserva los vídeos y en cada
   dispositivo que vaya a reproducir, con la misma cuenta.
2. Activa **HTTPS Certificates** una vez, en <https://login.tailscale.com/admin/dns>.
3. En el PC, con Tailscale ya conectado:
   ```powershell
   tailscale serve --bg 7399
   ```
   Esto dice a Tailscale "sirve mi `http://127.0.0.1:7399` por HTTPS, con certificado real,
   dentro de mi tailnet" — sin tocar nada de la configuración de GMM Server ni de `host` (que
   puede quedarse en `127.0.0.1`, el valor por defecto: Tailscale Serve habla con el servidor
   por loopback, no hace falta exponerlo a otras interfaces).
4. La consola devuelve la dirección a usar, algo como `https://mi-pc.tailXXXX.ts.net` — **sin
   número de puerto**, va por el 443 de Tailscale. Esa es la dirección que va en **⚙ Ajustes →
   GMM Server** de cualquier dispositivo remoto.
5. `tailscale serve --bg` queda guardado en la configuración de Tailscale (no en la de GMM
   Server): sobrevive a reinicios del PC solo. Para desactivarlo: `tailscale serve --https=443 off`.

**Si tienes otra VPN a la vez** (NordVPN, ExpressVPN...), dos túneles VPN en el mismo dispositivo
es un conflicto conocido: Tailscale puede seguir mostrando "Connected" con todo en verde, pero el
tráfico real entre dispositivos deja de pasar. Desconecta la otra VPN mientras uses esto.

**¿Quieres que otra persona (con su propia cuenta) también pueda usar tu servidor?** Esto de
arriba es para tus propios dispositivos. Para invitar a alguien más sin meterlo en tu tailnet,
Tailscale tiene su propio flujo de invitación por correo (*Share machine*). Guía visual paso a
paso, con capturas reales: [`guias/tailscale-compartir-gmm/index.html`](../guias/tailscale-compartir-gmm/index.html)
(o el PDF en la misma carpeta, para entregárselo a la persona invitada).

<details>
<summary>Alternativa antigua: <code>host: 0.0.0.0</code> sin HTTPS (histórico, ya no recomendado)</summary>

Antes de descubrir el problema de contenido mixto, la vía era poner `"host": "0.0.0.0"` en
`PRIVADO/configuracion.json` para escuchar en todas las interfaces, y usar la IP de Tailscale
en `http://` directamente. Sigue siendo técnicamente posible (la clave de administración se
exige de 32+ caracteres para cualquier host distinto de local, y el preparador ya genera una
así), pero **no funciona desde la app de GiveMyMovies publicada** por el bloqueo de contenido
mixto explicado arriba — solo serviría para hablar con la API a mano (`curl`, Postman...), no
para la PWA real. Usa Tailscale Serve en su lugar.

</details>

## Probar

```powershell
npm.cmd test
```

Las pruebas crean películas ficticias dentro de una carpeta temporal. No recorren ni
modifican la biblioteca real del usuario.

## Convención de nombres recomendada

La identificación mejora si los archivos usan título y año:

```text
Dune Part Two (2024).mkv
The Matrix (1999) 1080p.mkv
Interestelar.2014.2160p.mp4
```

En la fase de TMDB habrá una revisión manual para los nombres ambiguos.
