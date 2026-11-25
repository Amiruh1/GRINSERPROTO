# Configuración de Google Sheets

Este Apps Script publica productos y categorías para lectura pública y recibe perfiles de clientes. Los registros de clientes no se devuelven a la tienda y no se guardan contraseñas.

## Preparar la hoja

1. Crea una hoja de cálculo nueva en Google Sheets.
2. Abre **Extensiones → Apps Script**, reemplaza el contenido de `Code.gs` por el archivo de este directorio y guarda. Si el proyecto ya está desplegado, usa la versión nueva de este archivo.
3. En el editor, ejecuta `setupGrinserSheets` y acepta los permisos. Se crearán las pestañas **Productos**, **Categorias** y **Clientes** con sus encabezados y catálogo inicial.
4. Revisa los datos iniciales. Para imágenes usa URL HTTPS; para `activo` usa `TRUE` o `FALSE`. Mantén los nombres y el orden de las columnas.
5. Ve a **Implementar → Nueva implementación → Aplicación web**. Elige ejecutar como tu cuenta y permitir acceso a **Cualquier persona**. Copia la URL terminada en `/exec`.
6. Pega esa URL en `window.GRINSER_SHEETS_URL` dentro de `js/sheets-config.js`.
7. Publica el sitio. La tienda cargará productos y categorías desde la hoja; configura también la clave siguiente para poder editarlos desde el panel.

## Sincronizar cambios desde el panel de empresa

1. En Apps Script, abre **Configuración del proyecto** y agrega una propiedad de secuencia de comandos llamada `GRINSER_ADMIN_KEY`. Pon como valor una clave larga y privada; no la escribas en `Code.gs` ni en `js/sheets-config.js`.
2. Copia el `Code.gs` actualizado de este directorio al proyecto de Apps Script y guarda.
3. En **Implementar → Gestionar implementaciones**, edita la implementación web, selecciona **Nueva versión** y pulsa **Implementar**. La URL `/exec` existente se conserva.
4. Recarga el panel. Al guardar por primera vez un producto, stock o categoría, aparecerá un diálogo para ingresar esa clave. Se conserva solo en memoria hasta cerrar o recargar el panel.

El panel sincroniza productos al crear, editar, eliminar o registrar movimientos de stock, y sincroniza categorías al crear, editar o eliminar. Si la clave o la conexión fallan, el cambio no se confirma en el panel. Las modificaciones manuales en Sheets se reflejan en la tienda y el panel en el siguiente sondeo, como máximo en 15 segundos mientras estén visibles.

La tienda abierta en la misma sesión del navegador recibe los cambios del panel inmediatamente. En otros dispositivos, consulta Sheets cada 15 segundos mientras la pestaña está visible y al volver a ella. Para muchos visitantes, ese sondeo frecuente puede alcanzar las cuotas de Apps Script; un sitio de alto tráfico necesita un backend con actualizaciones en tiempo real.

Al publicar cambios de código, sube también los archivos HTML y JavaScript actualizados. Después de la primera publicación, recarga una vez las pestañas abiertas para que carguen la nueva versión; las siguientes actualizaciones del catálogo ya se aplican sin recargar.

Si la tienda muestra un error `401`, revisa en **Gestionar implementaciones** que la aplicación web permita acceso a **Cualquier persona**. Si `GRINSER_ADMIN_KEY` todavía no está configurada, Apps Script también rechazará las escrituras hasta agregarla en las propiedades del proyecto.

## Qué guarda y qué no

- **Productos** y **Categorias**: son datos públicos porque aparecen en la tienda.
- **Clientes**: nombre, correo, teléfono opcional y fecha de registro. La hoja permanece privada; el endpoint público solo permite registrar y no expone la lista.
- Las contraseñas nunca se envían a Sheets. El inicio de sesión actual del sitio sigue siendo local a cada navegador; esto centraliza el perfil del cliente, pero no crea autenticación compartida entre dispositivos.
- El stock actualizado desde el panel se refleja en Productos; el historial de movimientos y los pedidos siguen guardándose localmente.

La URL de la aplicación web es pública y cualquiera puede intentar enviar registros. El script valida los campos y evita duplicar correos. La clave de administración no está en los archivos del sitio, pero se transmite desde el navegador al guardar; no la compartas. Es una protección básica para este prototipo, no sustituye autenticación segura con backend. No publiques ni compartas la hoja de cálculo de Clientes.
