# Grinser · Tienda (HTML, CSS y JavaScript)

Sitio estático de **Grinser EIRL – Grupo Innova Service**. Tiene catálogo, carrito, inicio de sesión y roles (cliente y administrador). No usa servidor: funciona directo en GitHub Pages.

## Estructura

```
index.html        Tienda: catálogo, carrito, inicio de sesión
admin.html        Panel de empresa (solo administradores): productos, usuarios y roles
css/styles.css    Estilos
js/productos.js   Catálogo inicial (edítalo o reemplázalo con el que exporta el panel)
js/categorias.js  Categorías iniciales (edítalo o reemplázalo con el que exporta el panel)
js/data.js        Utilidades, íconos y datos de contacto (WhatsApp, teléfono, correo, dirección)
js/auth.js        Cuentas, roles, ventana de login y la persona animada
js/store.js       Cabecera, carrusel, categorías, catálogo, carrito, pie de página y WhatsApp
js/admin.js       Panel de empresa
img/              Logo (con fondo azul y versión transparente para el pie de página)
```

Para cambiar el número de WhatsApp, el teléfono, el correo o la dirección, edita `GR.EMPRESA` en `js/data.js`.

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

Sin servidor, las cuentas, el carrito, los pedidos y los cambios del catálogo se guardan en el `localStorage` de **cada navegador**:

- Si el administrador edita productos, esos cambios solo los ve él. Para publicarlos: en el panel pulsa **Exportar productos.js**, reemplaza `js/productos.js` en el repositorio y sube el cambio.
- Si administra categorías, pulsa **Exportar categorías.js**, reemplaza `js/categorias.js` y sube el cambio para publicarlas en la tienda.
- Las cuentas y contraseñas no están protegidas como en un sistema real. Sirve como demo o prototipo. No guardes datos sensibles.

## Publicar en GitHub Pages

1. Crea un repositorio y sube el contenido de esta carpeta (con `index.html` en la raíz).
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En unos minutos la página queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

Para probarla en tu PC, basta con abrir `index.html` en el navegador.
