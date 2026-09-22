# AION2 Daeva Command Center Web v2.8

Versión web estática del tracker AION2. Usa IndexedDB para guardar los datos de cada usuario localmente en el navegador. La aplicación también está preparada como PWA para instalarse como una app desde navegadores compatibles.

## v2.6
- PWA instalable con iconos de 192 y 512 px.
- Botón `⬇ INSTALAR` aparece solo cuando el navegador ofrece instalación.
- Service Worker actualizado a una estrategia de navegación network-first para evitar cargar un `index.html` antiguo después de una actualización.
- Recursos estáticos versionados (`v=20`).
- El núcleo sigue funcionando con IndexedDB y puede usarse sin cuentas ni backend.

## Ejecutar en Windows

1. Extrae el ZIP en una carpeta nueva.
2. Ejecuta `run_local.bat`.
3. El navegador abrirá `http://127.0.0.1:8000/?v=20`.
4. Mantén abierta la ventana de comandos mientras uses la aplicación.

## Instalar como aplicación

En un navegador compatible, cuando aparezca `⬇ INSTALAR`, pulsa el botón y acepta la instalación. En una web publicada, el sitio debe servirse por HTTPS (localhost también es válido para pruebas).

## Datos

Los datos se guardan localmente en IndexedDB. Usa `EXPORTAR` para crear una copia JSON que puedas importar en otro navegador o dispositivo.


v2.6: detección reforzada de instalación PWA y relación estable del manifest. en la cabecera con texto "INSTALAR APP" y distintivo "RECOMENDADO" para hacerlo visible desde la primera visita.


Instalación PWA v2.4: en Chrome/Edge, si el navegador expone beforeinstallprompt, el botón INSTALAR APP abre directamente el diálogo nativo. El listener se registra al principio de la carga para no perder el evento. El botón ? abre la ayuda manual cuando sea necesaria; iOS usa instrucciones porque no admite beforeinstallprompt.


## v2.6 – detección de instalación
La detección de instalación PWA se ha reforzado para Chrome/Edge de escritorio: el manifest se auto-referencia mediante `related_applications`, se valida el identificador estable de la PWA y se vuelve a comprobar al recuperar el foco de la pestaña. Esto permite ocultar el botón de instalación cuando Chrome puede confirmar que la PWA ya está instalada. En localhost puede requerirse reinstalar la PWA después de cambiar el manifest para que Chrome registre la nueva relación. La detección de `getInstalledRelatedApps()` requiere un navegador compatible y contexto seguro; al publicar la aplicación en HTTPS y con el dominio definitivo debe conservarse el mismo `id` estable en el manifest.

## Branding y apoyo
La v2.6 incorpora la marca `by dkinghd` y el botón `APOYAR`. El enlace de apoyo está configurado en `app.js` y apunta a `https://ko-fi.com/dkinghd_`.



## v2.7
- Enlace de apoyo configurado: https://ko-fi.com/dkinghd_
- El botón `☕ APOYAR` abre la sección de apoyo con enlace directo a Ko-fi.
- Recursos y Service Worker versionados a v2.7.


## v2.8
- Sección `☕ APOYAR` renovada con presentación más clara y discreta.
- Branding `by dkinghd` reforzado dentro de la sección de apoyo.
- Enlace directo a Ko-fi: https://ko-fi.com/dkinghd_
- Sin objetivo económico: se mantiene la sección limpia y centrada en el apoyo voluntario.
- Service Worker y recursos versionados a v2.8.
