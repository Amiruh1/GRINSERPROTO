'use strict';
// Grinser · página del carrito (mismo diseño que el carrito de Novatech).
(function () {
  const GR = window.GR;
  const root = document.querySelector('#cart-root');
  const MAX_QTY = 99;

  const PERKS = [
    { icon: 'shield', title: 'Compra segura', text: 'Pagos protegidos con Culqi' },
    { icon: 'check', title: 'Productos originales', text: 'Garantía de marca' },
    { icon: 'headset', title: 'Soporte experto', text: 'Te asesoramos siempre' },
    { icon: 'truck', title: 'Envíos a todo el Perú', text: 'Lima y provincias' },
  ];

  const crumbs = `
    <nav class="crumbs" aria-label="Ruta">
      <a href="${GR.appPath('index.html')}">Inicio</a>${GR.icon('chevron-right', 13)}
      <a href="${GR.pagePath('productos.html')}">Productos</a>${GR.icon('chevron-right', 13)}
      <span aria-current="page">Carrito</span>
    </nav>`;

  function itemHtml(i) {
    const max = Math.min(i.stock, MAX_QTY);
    const lista = i.precio_lista > i.precio ? i.precio_lista : null;
    const href = GR.productHref(i);
    return `
      <li class="cart-item">
        <a href="${href}" class="cart-thumb" tabindex="-1" aria-hidden="true">${i.imagen ? `<img src="${GR.esc(GR.assetPath(i.imagen))}" alt="">` : GR.icon('box', 34)}</a>
        <div class="cart-info">
          <a href="${href}" class="cart-name">${GR.esc(i.nombre)}</a>
          ${i.marca ? `<span class="cart-brand">${GR.esc(i.marca)}</span>` : ''}
          <div class="cart-qty" role="group" aria-label="Cantidad de ${GR.esc(i.nombre)}">
            <button type="button" data-step="${GR.esc(i.id)}" data-d="-1" ${i.cantidad <= 1 ? 'disabled' : ''} aria-label="Quitar una unidad">${GR.icon('minus', 15)}</button>
            <input type="number" min="1" max="${max}" value="${i.cantidad}" data-qty-input="${GR.esc(i.id)}" aria-label="Cantidad">
            <button type="button" data-step="${GR.esc(i.id)}" data-d="1" ${i.cantidad >= max ? 'disabled' : ''} aria-label="Agregar una unidad">${GR.icon('plus', 15)}</button>
          </div>
          ${i.cantidad >= max && i.stock < MAX_QTY ? `<small class="cart-max">Máximo disponible: ${max}</small>` : ''}
        </div>
        <div class="cart-side">
          <button type="button" class="cart-del" data-del="${GR.esc(i.id)}" aria-label="Quitar ${GR.esc(i.nombre)} del carrito" title="Quitar">${GR.icon('trash', 18)}</button>
          <div class="cart-price">
            ${lista ? `<s>${GR.money(lista * i.cantidad)}</s>` : ''}
            <strong>${GR.money(i.precio * i.cantidad)}</strong>
            ${lista ? `<span class="cart-save">Ahorras ${GR.money((lista - i.precio) * i.cantidad)}</span>` : ''}
            ${i.cantidad > 1 ? `<small>${GR.money(i.precio)} c/u</small>` : ''}
          </div>
        </div>
      </li>`;
  }

  function render() {
    const items = GR.cartItems();
    if (!items.length) {
      root.innerHTML = `${crumbs}
        <div class="ck-card cart-empty">
          <span class="cart-empty-icon">${GR.icon('cart', 40)}</span>
          <h1>Tu carrito está vacío</h1>
          <p class="muted">Explora la tienda y agrega los productos que necesites.</p>
          <a href="${GR.pagePath('productos.html')}" class="btn cart-pay">Ir a la tienda ${GR.icon('arrow-right', 16)}</a>
        </div>`;
      return;
    }
    const t = GR.cartTotals(items);
    const igv = t.subtotal - t.subtotal / 1.18;
    const user = GR.currentUser();
    const waText = `Hola Grinser, necesito ayuda con mi pedido:\n${items.map((i) => `• ${i.cantidad} x ${i.nombre}`).join('\n')}`;
    root.innerHTML = `
      <div class="cart-page">
        ${crumbs}
        <header class="cart-head">
          <h1>Tu carrito de compras</h1>
          <p class="muted">Tu próximo equipo empieza aquí. Revisa los productos de tu pedido.</p>
        </header>

        <ul class="cart-perks" aria-label="Por qué comprar en Grinser">
          ${PERKS.map((b) => `<li><span>${GR.icon(b.icon, 20)}</span><div><strong>${b.title}</strong><small>${b.text}</small></div></li>`).join('')}
        </ul>

        <div class="cart-layout">
          <section class="ck-card cart-list" aria-labelledby="cart-items-title">
            <h2 id="cart-items-title">${GR.icon('cart', 20)} Productos en tu carrito <span class="cart-count">(${t.count})</span></h2>
            <ul>${items.map(itemHtml).join('')}</ul>
            <div class="cart-list-foot">
              <a href="${GR.pagePath('productos.html')}" class="cart-back">${GR.icon('chevron-left', 15)} Seguir comprando</a>
              <button type="button" class="btn cart-clear" data-clear>${GR.icon('trash', 16)} Vaciar carrito</button>
            </div>
          </section>

          <aside class="cart-aside">
            <section class="ck-card cart-summary" aria-labelledby="cart-sum-title">
              <h2 id="cart-sum-title">Resumen del pedido</h2>
              <div class="cart-row"><span>Subtotal (${t.count} ${t.count === 1 ? 'producto' : 'productos'})</span><span>${GR.money(t.subtotal)}</span></div>
              ${t.ahorro > 0 ? `<div class="cart-row save"><span>Ya ahorras en ofertas</span><span>${GR.money(t.ahorro)}</span></div>` : ''}
              <div class="cart-row"><span>IGV (18 %) incluido</span><span>${GR.money(igv)}</span></div>
              <div class="cart-row"><span>Envío</span><span><small>Según tu zona</small></span></div>
              <p class="cart-note">${GR.icon('truck', 16)}<span>Enviamos a Lima y provincias. Te confirmamos el costo de envío al coordinar la entrega.</span></p>
              <div class="cart-total"><span>Total sin envío</span><strong>${GR.money(t.subtotal)}</strong></div>
              <small class="cart-fine">IGV incluido. El pago se realiza de forma segura con Culqi.</small>
              ${user
                ? `<a href="${GR.pagePath('checkout.html')}" class="btn cart-pay">${GR.icon('card', 18)} Proceder al pago</a>`
                : `<button type="button" class="btn cart-pay" data-login-buy>${GR.icon('user', 18)} Ingresa para comprar</button>`}
              <a href="${GR.pagePath('productos.html')}" class="btn cart-continue">Continuar comprando</a>
              <ul class="cart-trust">
                <li>${GR.icon('shield', 17)} Compra segura</li>
                <li>${GR.icon('headset', 17)} Soporte personalizado</li>
              </ul>
            </section>

            <section class="ck-card cart-help">
              <h2>¿Necesitas ayuda?</h2>
              <p class="muted">Contáctanos por WhatsApp y te asesoramos.</p>
              <a class="btn cart-wa" href="${GR.waLink(waText)}" target="_blank" rel="noopener noreferrer">${GR.waIcon(19)} Chatear con un asesor</a>
            </section>
          </aside>
        </div>
      </div>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    GR.authReady.then(render);
    GR.dataReady.then(render);
    GR.subscribeCatalogUpdates(render);
    window.addEventListener('gr:cart', render);
    window.addEventListener('gr:session', render);

    root.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.step) {
        const item = GR.cartItems().find((i) => i.id === t.dataset.step);
        if (item) GR.setCartQty(item.id, item.cantidad + Number(t.dataset.d));
      }
      if (t.dataset.del) { GR.removeFromCart(t.dataset.del); GR.toast('Producto quitado del carrito.'); }
      if (t.hasAttribute('data-clear') && confirm('¿Seguro que quieres quitar todos los productos de tu carrito?')) GR.clearCart();
      if (t.hasAttribute('data-login-buy')) GR.openAuth('login', { onSuccess: () => { location.href = GR.pagePath('checkout.html'); } });
    });
    root.addEventListener('change', (e) => {
      if (e.target.dataset.qtyInput) GR.setCartQty(e.target.dataset.qtyInput, e.target.value);
    });
  });
})();
