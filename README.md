# Grinser · Tienda (HTML, CSS y JavaScript)

Sitio estático de **Grinser EIRL – Grupo Innova Service**. Tiene catálogo, carrito, inicio de sesión y roles (cliente y administrador). No usa servidor: funciona directo en GitHub Pages.

## Estructura

```
index.html        Ofertas, banner de la tienda principal, carrito e inicio de sesión
empresa.html      Información de la empresa
servicio-tecnico.html  Servicios de soporte y mantenimiento
repuestos-insumos.html Repuestos, consumibles y asesoría por WhatsApp
productos.html    Catálogo de productos con filtros y consulta por WhatsApp
admin.html        Panel de empresa (solo administradores): productos, usuarios y roles
css/styles.css    Estilos
js/productos.js   Catálogo inicial (edítalo o reemplázalo con el que exporta el panel)
js/categorias.js  Categorías iniciales (edítalo o reemplázalo con el que exporta el panel)
js/sheets-config.js URL pública de la aplicación web de Google Apps Script
google-apps-script/Code.gs  API de lectura del catálogo y registro de clientes
js/data.js        Utilidades, íconos y datos de contacto (WhatsApp, teléfono, correo, dirección)
js/auth.js        Cuentas, roles, ventana de login y la persona animada
js/store.js       Ofertas de inicio, carrito, sesión y WhatsApp
js/productos-page.js  Catálogo y filtros de la página Productos
js/site-shell.js  Cabecera y pie compartidos por Empresa, Servicio Técnico y Productos
js/whatsapp-widget.js  Botón flotante de WhatsApp compartido por todas las páginas
js/admin.js       Panel de empresa
img/              Logo (con fondo azul y versión transparente para el pie de página)
```

Para cambiar el número de WhatsApp, el teléfono, el correo o la dirección, edita `GR.EMPRESA` en `js/data.js`.

## Conectar Google Sheets

El proyecto incluye un Apps Script en [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) y las instrucciones de configuración en [`google-apps-script/README.md`](./google-apps-script/README.md). Después de desplegarlo, pega la URL `/exec` en `js/sheets-config.js` y publica el sitio. La hoja será la fuente de productos y categorías; el panel puede sincronizar cambios tras configurar la clave `GRINSER_ADMIN_KEY` en Apps Script. La tienda abierta en la misma sesión recibe cambios inmediatamente; otras pestañas consultan Sheets cada 15 segundos mientras están visibles. Los registros guardan nombre, correo y teléfono opcional en una pestaña privada. Las contraseñas no se envían a Sheets y el inicio de sesión continúa siendo local a cada navegador.

## Cuentas de prueba

| Rol | Correo | Contraseña | Cómo ingresar |
|---|---|---|---|
| Administrador | admin@grinser.com | Admin12345 | Pestaña **Empresa** en «Iniciar sesión» |
| Cliente | cliente@grinser.com | Cliente12345 | Pestaña **Cliente** |

Cambia estas contraseñas desde el panel (crea tu propio administrador y elimina el de prueba).

## Roles

- **Cliente**: compra en la tienda. Se registra desde «Crear cuenta».
- **Administrador**: entra por «Empresa» y llega a `admin.html`. Ahí gestiona productos (crear, editar, ocultar, eliminar, stock y ofertas) y usuarios (crear, cambiar rol, activar o desactivar, eliminar). Siempre debe quedar al menos un administrador activo.

Un cliente que abre `admin.html` vuelve a la tienda. Un administrador no puede entrar por «Cliente».

## Importante: los datos se guardan en el navegador

Sin conectar Google Sheets, las cuentas, el carrito, los pedidos y los cambios del catálogo se guardan en el `localStorage` de **cada navegador**:

- Si no conectaste Google Sheets y el administrador edita productos, esos cambios solo los ve él. Para publicarlos: en el panel pulsa **Exportar productos.js**, reemplaza `js/productos.js` en el repositorio y sube el cambio.
- Si no conectaste Google Sheets y administras categorías, pulsa **Exportar categorías.js**, reemplaza `js/categorias.js` y sube el cambio para publicarlas en la tienda.
- Las cuentas y contraseñas no están protegidas como en un sistema real. Sirve como demo o prototipo. No guardes datos sensibles.

## Publicar en GitHub Pages

1. Crea un repositorio y sube el contenido de esta carpeta (con `index.html` en la raíz).
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En unos minutos la página queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

Para probarla en tu PC, basta con abrir `index.html` en el navegador.
