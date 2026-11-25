'use strict';
(function () {
  const GR = window.GR;
  const header = document.querySelector('#site-header');
  const footer = document.querySelector('#site-footer');

  header.innerHTML = `
    <div class="wrap hdr-main">
      <a href="index.html" class="brand"><img src="img/logo-grinser.png" alt="Grinser EIRL – Grupo Innova Service" width="168" height="53"></a>
      <form class="hdr-search" role="search" action="productos.html" method="get">
        <label for="q" class="sr-only">Buscar productos</label>
        <input id="q" name="q" type="search" placeholder="Buscar por producto o marca…" autocomplete="off">
        <button type="submit" aria-label="Buscar">${GR.icon('search', 18)}</button>
      </form>
      <div id="user-area" class="account"></div>
    </div>
    <nav class="hdr-nav" aria-label="Principal">
      <div class="wrap hdr-nav-in">
        <div class="cat-menu">
          <button type="button" id="cat-toggle" class="cat-toggle" aria-expanded="false" aria-controls="cat-drop">
            ${GR.icon('menu', 18)}<span>Categorías</span>${GR.icon('chevron-down', 16)}
          </button>
          <div id="cat-drop" class="cat-drop" hidden></div>
        </div>
        <ul class="nav-links" id="nav-links">
          <li><a href="index.html">Inicio</a></li>
          <li><a href="index.html?categoria=ofertas#tienda" class="hot">Ofertas</a></li>
          <li><a href="empresa.html">Empresa</a></li>
          <li><a href="servicio-tecnico.html">Servicio Técnico</a></li>
          <li><a href="repuestos-insumos.html">Repuestos e Insumos</a></li>
          <li class="nav-product">
            <button type="button" class="nav-product-toggle" aria-expanded="false" aria-controls="nav-product-drop">
              Productos ${GR.icon('chevron-down', 15)}
            </button>
            <div class="nav-product-drop" id="nav-product-drop" hidden>
              <a href="productos.html">${GR.icon('grid', 17)}Ver todos los productos</a>
              ${GR.CATEGORIAS.map((category) => `<a href="productos.html?categoria=${encodeURIComponent(category.id)}">${GR.icon(category.icon, 17)}${GR.esc(category.nombre)}</a>`).join('')}
            </div>
          </li>
        </ul>
        <a href="index.html?carrito=1" id="cart-btn" class="cart-pill" aria-label="Abrir carrito">
          <span class="cart-ic">${GR.icon('cart', 20)}<b id="cart-count">0</b></span>
          <span id="cart-sum">S/ 0.00</span>
        </a>
      </div>
    </nav>`;

  footer.innerHTML = `
    <div class="wrap footer-in">
      <div class="footer-info">
        <img src="img/logo-grinser-transparente.png" alt="Grinser EIRL – Grupo Innova Service" width="210" height="66">
        <nav class="footer-links" aria-label="Enlaces del pie">
          <a href="index.html">Inicio</a>
          <a href="index.html?categoria=ofertas#tienda">Ofertas</a>
          <a href="productos.html">Productos</a>
          <a href="empresa.html">Empresa</a>
          <a href="servicio-tecnico.html">Servicio Técnico</a>
          <a href="repuestos-insumos.html">Repuestos e Insumos</a>
          <a href="empresa.html#tiendas">Nuestras tiendas</a>
          <a class="wa-text-link" target="_blank" rel="noopener">Contáctenos</a>
        </nav>
        <ul class="footer-contact">
          <li>${GR.icon('pin', 18)}<span id="f-dir"></span></li>
          <li>${GR.icon('phone', 18)}<a id="f-tel"></a></li>
          <li>${GR.icon('mail', 18)}<a id="f-mail"></a></li>
        </ul>
      </div>
      <div class="footer-map">
        <iframe title="Ubicación de Grinser: Jr. Lampa 960, Lima" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
          src="https://maps.google.com/maps?q=Jr.%20Lampa%20960%2C%20Lima%2015001&z=16&output=embed"></iframe>
      </div>
    </div>
    <div class="footer-bottom"><div class="wrap">© <span id="year"></span> Todos los derechos reservados por Grinser S.A.C.</div></div>`;

  const userArea = document.querySelector('#user-area');
  const renderUser = () => {
    const user = GR.currentUser();
    if (!user) {
      userArea.innerHTML = `<button type="button" class="acc-btn" data-login><span class="acc-ic">${GR.icon('user', 18)}</span><span class="acc-copy"><small>Mi cuenta</small><b>Iniciar sesión</b></span></button>`;
      return;
    }
    userArea.innerHTML = `
      <details class="user-menu">
        <summary class="acc-btn" aria-label="Menú de ${GR.esc(user.nombre)}">
          <span class="avatar" aria-hidden="true">${GR.esc(user.nombre.trim()[0].toUpperCase())}</span>
          <span class="acc-copy"><small>${GR.ROLES[user.rol]}</small><b>Hola, ${GR.esc(user.nombre.split(' ')[0])}</b></span>
          ${GR.icon('chevron-down', 16)}
        </summary>
        <div class="um-pop">
          <p class="um-mail">${GR.esc(user.email)}</p>
          ${user.rol === 'admin' ? `<a href="admin.html">${GR.icon('grid', 16)} Panel empresa</a>` : ''}
          <button type="button" data-logout>${GR.icon('logout', 16)} Cerrar sesión</button>
        </div>
      </details>`;
  };

  const renderCartSummary = () => {
    const cart = GR.read('carrito', []);
    const products = GR.getProducts();
    const totals = cart.reduce((result, item) => {
      const product = products.find((entry) => entry.id === item.id && entry.activo !== false);
      if (product) {
        result.count += item.cantidad;
        result.total += GR.precioFinal(product) * item.cantidad;
      }
      return result;
    }, { count: 0, total: 0 });
    document.querySelector('#cart-count').textContent = totals.count;
    document.querySelector('#cart-sum').textContent = GR.money(totals.total);
    document.querySelector('#cart-btn').setAttribute('aria-label', `Abrir carrito: ${totals.count} productos, ${GR.money(totals.total)}`);
  };

  const renderStores = () => {
    const stores = document.querySelector('#stores');
    if (!stores) return;
    stores.innerHTML = GR.TIENDAS.map((store, index) => {
      const mapQuery = encodeURIComponent(store.mapa);
      return `
        <article class="store">
          <div class="store-card">
            <div class="store-photo ${store.foto ? '' : 'is-empty'}">
              ${store.foto ? `<img src="${GR.esc(store.foto)}" alt="Fachada de ${GR.esc(store.nombre)}" loading="lazy">` : ''}
              ${store.etiqueta ? `<span class="store-tag">${GR.esc(store.etiqueta)}</span>` : ''}
            </div>
            <div class="store-info">
              <span class="store-num">0${index + 1}</span><h3>${GR.esc(store.nombre)}</h3>
              <p class="store-addr">${GR.icon('pin', 18)}<span><b>${GR.esc(store.direccion)}</b><small>${GR.esc(store.referencia)}</small></span></p>
              <p class="store-line">${GR.icon('phone', 16)} <a href="tel:+51${store.telefono.replace(/\D/g, '')}">${GR.esc(store.telefono)}</a></p>
              <div class="store-actions">
                <a class="btn btn-primary" href="https://www.google.com/maps/dir/?api=1&destination=${mapQuery}" target="_blank" rel="noopener">${GR.icon('route', 16)} Cómo llegar</a>
                <a class="btn btn-wa" href="${GR.waLink(`Hola Grinser, quisiera información de la ${store.nombre} (${store.direccion}).`)}" target="_blank" rel="noopener">${GR.waIcon(16)} WhatsApp</a>
              </div>
            </div>
          </div>
          <div class="store-map"><iframe title="Mapa de ${GR.esc(store.nombre)}: ${GR.esc(store.direccion)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${mapQuery}&z=17&output=embed"></iframe></div>
        </article>`;
    }).join('');
  };

  const closeMenus = () => {
    document.querySelector('#cat-drop').hidden = true;
    document.querySelector('#cat-toggle').setAttribute('aria-expanded', 'false');
    document.querySelector('#nav-product-drop').hidden = true;
    document.querySelector('.nav-product-toggle').setAttribute('aria-expanded', 'false');
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await GR.authReady;
    const company = GR.EMPRESA;
    document.querySelector('#year').textContent = new Date().getFullYear();
    document.querySelector('#f-dir').textContent = company.direccion;
    document.querySelector('#f-tel').textContent = company.telefono;
    document.querySelector('#f-tel').href = `tel:+${company.whatsapp}`;
    document.querySelector('#f-mail').textContent = company.correo;
    document.querySelector('#f-mail').href = `mailto:${company.correo}`;
    document.querySelectorAll('.wa-text-link').forEach((link) => { link.href = GR.waLink(); });
    const renderCategories = () => {
      const categories = [...GR.CATEGORIAS];
      for (const product of GR.getProducts()) {
        if (!categories.some((category) => category.id === product.categoria)) categories.push(GR.cat(product.categoria));
      }
      document.querySelector('#cat-drop').innerHTML = categories.map((category) =>
        `<button type="button" data-category="${GR.esc(category.id)}">${GR.icon(category.icon, 18)}<span>${GR.esc(category.nombre)}</span></button>`,
      ).join('') + `<a href="index.html?categoria=ofertas#tienda" class="hot">${GR.icon('percent', 18)}<span>Ofertas</span></a>`;
    };
    renderCategories();
    GR.dataReady.then(renderCategories);
    renderUser();
    renderCartSummary();
    renderStores();

    document.querySelector('#cat-toggle').addEventListener('click', () => {
      const drop = document.querySelector('#cat-drop');
      const open = drop.hidden;
      closeMenus();
      drop.hidden = !open;
      document.querySelector('#cat-toggle').setAttribute('aria-expanded', open);
    });
    document.querySelector('.nav-product-toggle').addEventListener('click', () => {
      const drop = document.querySelector('#nav-product-drop');
      const open = drop.hidden;
      closeMenus();
      drop.hidden = !open;
      document.querySelector('.nav-product-toggle').setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, a');
      if (target?.hasAttribute('data-login')) GR.openAuth('login');
      if (target?.hasAttribute('data-logout')) GR.logout();
      if (target?.dataset.category) location.href = `productos.html?categoria=${encodeURIComponent(target.dataset.category)}`;
      if (!event.target.closest('.cat-menu')) {
        document.querySelector('#cat-drop').hidden = true;
        document.querySelector('#cat-toggle').setAttribute('aria-expanded', 'false');
      }
      if (!event.target.closest('.nav-product')) {
        document.querySelector('#nav-product-drop').hidden = true;
        document.querySelector('.nav-product-toggle').setAttribute('aria-expanded', 'false');
      }
    });
    window.addEventListener('gr:session', renderUser);
    window.addEventListener('storage', (event) => {
      if (event.key === 'grinser_carrito' || event.key === 'grinser_productos') renderCartSummary();
    });
    window.addEventListener('gr:cart', renderCartSummary);
    GR.paintIcons(document);
  });
})();
