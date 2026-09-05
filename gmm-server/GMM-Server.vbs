' GMM-Server.vbs — doble clic para abrir el panel de GMM Server.
'
' A proposito NO se lanza PowerShell oculto (-WindowStyle Hidden): Windows
' hereda ese estado oculto a la PRIMERA ventana que cree el proceso, que
' seria el propio panel, y se quedaria invisible. En vez de eso, el propio
' script de PowerShell oculta su consola nada mas arrancar (ve el comentario
' al principio de GMM-Server-Panel.ps1), asi que aqui basta con lanzarlo
' normal: solo se ve la consola una fraccion de segundo.

Set objShell = CreateObject("WScript.Shell")
carpeta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
script = """" & carpeta & "\GMM-Server-Panel.ps1" & """"
objShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & script, 1, False
