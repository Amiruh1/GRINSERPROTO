# Configuración de Google Sheets

Este Apps Script publica productos y categorías, recibe perfiles de clientes y centraliza las cuentas de la tienda. Las credenciales se guardan únicamente en la pestaña privada **Usuarios** como un verificador PBKDF2-SHA-256 con salt; nunca se guarda la contraseña en texto plano ni se devuelven hashes al navegador.

## Preparar la hoja

1. Crea una hoja de cálculo nueva en Google Sheets.
2. Abre **Extensiones → Apps Script**, reemplaza el contenido de `Code.gs` por el archivo de este directorio y guarda. Si el proyecto ya está desplegado, usa la versión nueva de este archivo.
3. En el editor, ejecuta `setupGrinserSheets` y acepta los permisos. Se crearán las pestañas **Productos**, **Categorias**, **Clientes**, **Usuarios**, **Eventos** y **Pedidos** con sus encabezados y datos iniciales. La pestaña **Usuarios** debe permanecer privada.
4. Revisa los datos iniciales. Para imágenes usa URL HTTPS; para `activo` usa `TRUE` o `FALSE`. Mantén los nombres y el orden de las columnas.
5. Ve a **Implementar → Nueva implementación → Aplicación web**. Elige ejecutar como tu cuenta y permitir acceso a **Cualquier persona**. Copia la URL terminada en `/exec`.
6. Pega esa URL en `window.GRINSER_SHEETS_URL` dentro de `js/sheets-config.js`.
7. Publica el sitio. La tienda cargará productos y categorías desde la hoja; configura también la clave siguiente para poder editarlos desde el panel.

## Sincronizar cambios desde el panel de empresa

1. En Apps Script, abre **Configuración del proyecto** y agrega una propiedad de secuencia de comandos llamada `GRINSER_ADMIN_KEY`. Pon como valor una clave larga y privada; no la escribas en `Code.gs` ni en `js/sheets-config.js`.
2. Copia el `Code.gs` actualizado de este directorio al proyecto de Apps Script y guarda.
3. En **Implementar → Gestionar implementaciones**, edita la implementación web, selecciona **Nueva versión** y pulsa **Implementar**. Guardar `Code.gs` por sí solo no actualiza la URL `/exec`; es necesario publicar la nueva versión para activar registro e inicio de sesión centralizados.
4. Recarga el panel. Al guardar por primera vez un producto, stock, categoría o configuración de eventos, aparecerá un diálogo para ingresar esa clave. Se conserva solo en memoria hasta cerrar o recargar el panel.

El panel sincroniza productos al crear, editar, eliminar o registrar movimientos de stock, sincroniza categorías al crear, editar o eliminar, y guarda la configuración de **Eventos** en la pestaña correspondiente. Si la clave o la conexión fallan, el cambio no se confirma en el panel. Las modificaciones manuales en Sheets se reflejan en la tienda y el panel en el siguiente sondeo, como máximo en 15 segundos mientras estén visibles.

## Cuentas de tienda

- Los registros nuevos se guardan en **Usuarios** y pueden iniciar sesión desde distintos dispositivos. Todos los registros públicos reciben el rol **cliente**; no obtienen acceso al panel de empresa.
- En **Usuarios y roles**, el administrador debe ingresar `GRINSER_ADMIN_KEY` para consultar o cambiar roles/estados, crear cuentas y eliminar usuarios. Esta clave no se guarda en el navegador después de cerrar o recargar el panel.
- El navegador deriva el verificador con PBKDF2-SHA-256 y 120 000 iteraciones. Apps Script guarda el salt y el verificador en la hoja privada, sin exponerlos en las respuestas.
- Las cuentas locales antiguas de clientes pueden migrarse al iniciar sesión desde el navegador que conserva la cuenta y su contraseña. No se puede recuperar una contraseña olvidada ni migrar credenciales locales desde otro dispositivo.
- Si ya había una pestaña **Usuarios** creada manualmente, verifica que sus columnas correspondan a `id`, `nombre`, `email`, `telefono`, `password_salt`, `password_hash`, `rol`, `activo` y `creado`. No compartas la hoja ni concedas acceso a esta pestaña.
- La autenticación es un prototipo basado en Apps Script y una clave administrativa compartida; usa HTTPS, protege la hoja y la clave, y no reutilices contraseñas sensibles.

En el editor de productos también puedes elegir imágenes desde el dispositivo. Se suben a Google Drive con acceso de lectura mediante enlace y se guarda su URL en el catálogo. Se admiten JPG, PNG, WebP y GIF de hasta 5 MB cada uno; esta función requiere desplegar la versión actualizada de `Code.gs` y autorizar el acceso a Drive con la cuenta propietaria del script. Cualquier persona con el enlace podrá ver esas imágenes.

## Eventos de temporada

En **Panel de empresa → Eventos**, habilita las temporadas que quieras ofrecer y elige el modo:

- **Automático según calendario**: muestra un evento habilitado solo en sus fechas, usando la hora de Perú.
- **Manual: mostrar ahora**: primero elige una temporada habilitada en el selector y luego cambia el modo para mostrarla a todos los visitantes de inmediato, aunque no sea su fecha. Vuelve a Automático para restaurar el calendario.

La configuración se guarda en la pestaña **Eventos** y se comparte con todos los visitantes. Las fechas automáticas son:

- Navidad: 24 y 25 de diciembre.
- Año Nuevo: 31 de diciembre y 1 de enero.
- Fiestas Patrias: 28 y 29 de julio.

Navidad muestra el gorro integrado en el logo y nieve; Año Nuevo muestra fuegos artificiales y el saludo «¡PRÓSPERO AÑO NUEVO!»; Fiestas Patrias integra la escarapela en el logo. Las animaciones se desactivan si el visitante ha indicado que prefiere movimiento reducido. El panel requiere que Google Sheets esté conectado para cambiar estas opciones. Al guardar por primera vez con la versión nueva, la pestaña **Eventos** se actualiza al formato con columnas `id`, `habilitado`, `modo` y `evento_manual`; las hojas existentes de dos columnas siguen leyéndose como Automático hasta entonces.

La tienda abierta en la misma sesión del navegador recibe los cambios del panel inmediatamente. En otros dispositivos, consulta Sheets cada 15 segundos mientras la pestaña está visible y al volver a ella. Para muchos visitantes, ese sondeo frecuente puede alcanzar las cuotas de Apps Script; un sitio de alto tráfico necesita un backend con actualizaciones en tiempo real.

Al publicar cambios de código, sube también los archivos HTML y JavaScript actualizados y las imágenes `img/logo-grinser-navidad.png` e `img/logo-grinser-fiestas-patrias.png`. Después de la primera publicación, recarga una vez las pestañas abiertas para que carguen la nueva versión; las siguientes actualizaciones del catálogo ya se aplican sin recargar.

Si la tienda muestra un error `401`, revisa en **Gestionar implementaciones** que la aplicación web permita acceso a **Cualquier persona**. Si `GRINSER_ADMIN_KEY` todavía no está configurada, Apps Script también rechazará las escrituras hasta agregarla en las propiedades del proyecto.

## Qué guarda y qué no

- **Productos**, **Categorias** y el estado habilitado de **Eventos**: son datos públicos porque afectan lo que aparece en la tienda.
- **Clientes**: nombre, correo, teléfono opcional y fecha de registro, en las columnas `id`, `nombre`, `email`, `telefono` y `creado`. La pestaña permanece privada; el endpoint solo permite registrar perfiles y no expone la lista.
- **Usuarios**: credenciales con salt y verificador, rol, estado y datos básicos de cuenta. La pestaña permanece privada; el endpoint público permite crear cuentas cliente e iniciar sesión, pero solo la clave administrativa autoriza consultar o modificar la lista.
- El stock actualizado desde el panel se refleja en Productos; el historial de movimientos y los pedidos siguen guardándose localmente.

La URL de la aplicación web es pública y cualquiera puede intentar registrar o iniciar sesión. El script valida los campos y evita duplicar correos. La clave de administración no está en los archivos del sitio, pero se transmite desde el navegador para operaciones protegidas; no la compartas. Es una protección básica para este prototipo, no sustituye autenticación robusta con backend. No publiques ni compartas la hoja de cálculo.
