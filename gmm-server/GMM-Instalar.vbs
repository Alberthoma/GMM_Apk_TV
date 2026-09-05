' GMM-Instalar.vbs — doble clic para abrir el asistente de instalacion
' (FFmpeg y Tailscale).
'
' Mismo motivo que GMM-Server.vbs para no lanzar PowerShell oculto: vease el
' comentario alli. Aqui tambien es el propio script el que oculta su consola
' nada mas arrancar.

Set objShell = CreateObject("WScript.Shell")
carpeta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
script = """" & carpeta & "\GMM-Server-Instalador.ps1" & """"
objShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & script, 1, False
