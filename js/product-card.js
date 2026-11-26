'use strict';
// Grinser · tarjeta de producto (mismo diseño que el catálogo de Novatech) y carrito compartido
// por la página de Productos y la ficha del producto.
(function () {
  const GR = window.GR;
  const MAX_QTY = 99;

  GR.productHref = (product) => `producto.html?id=${encodeURIComponent(product.id)}`;

  // «S/ 4,990» grande; los céntimos solo se muestran si existen.
  GR.priceNumber = (value) => {
    const n = Number(value || 0);
    const decimals = Math.round(n * 100) % 100 !== 0;
    return n.toLocaleString('es-PE', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: 2 });
  };
  GR.shortMoney = (value) => `S/ ${GR.priceNumber(value)}`;

  GR.productMedia = (product, size = 54) => product.imagen
    ? `<img src="${GR.esc(product.imagen)}" alt="${GR.esc(product.nombre)}" loading="lazy">`
    : `<span class="pc-ph ph-${GR.esc(product.categoria)}">${GR.icon(GR.cat(product.categoria).icon, size)}</span>`;

  GR.productCard = (product) => {
    const final = GR.precioFinal(product);
    const offer = GR.enOferta(product);
    const ahorro = offer ? product.precio - final : 0;
    const descuento = offer ? Math.round((ahorro / product.precio) * 100) : 0;
    const href = GR.productHref(product);
    const stock = Number(product.stock) || 0;
    return `
      <article class="pc ${stock <= 0 ? 'is-out' : ''}">
        <div class="pc-tags">
          ${descuento > 0 ? `<span class="pc-discount" title="Con descuento">-${descuento}%</span>` : ''}
          <span class="pc-chip">${GR.esc(GR.cat(product.categoria).nombre)}</span>
        </div>
        <a href="${href}" class="pc-img" tabindex="-1" aria-hidden="true">${GR.productMedia(product)}</a>
        <div class="pc-body">
          <span class="pc-brand">${GR.esc(product.marca || GR.cat(product.categoria).nombre)}</span>
          <h3 class="pc-name"><a href="${href}" title="${GR.esc(product.nombre)}">${GR.esc(product.nombre)}</a></h3>
          <p class="pc-meta">
            <span><b>Stock:</b> ${stock > 10 ? 'Más de 10' : stock}</span>
            ${product.sku ? `<span><b>Ref.:</b> ${GR.esc(product.sku)}</span>` : ''}
          </p>
          <div class="pc-price-row">
            <div>
              <span class="pc-price"><small>S/</small> ${GR.priceNumber(final)}</span>
              ${offer ? `<span class="pc-old">${GR.money(product.precio)}</span>` : ''}
            </div>
            ${offer ? `<span class="pc-save"><small>Ahorra</small>${GR.shortMoney(ahorro)}</span>` : ''}
          </div>
          ${offer ? '<span class="pc-offer-tag">Con descuento</span>' : ''}
          ${stock <= 0 ? '<span class="pc-badge bad">Agotado</span>' : stock <= 3 ? `<span class="pc-badge low">¡Últimas ${stock}!</span>` : ''}
          <button type="button" class="btn pc-add" data-add="${GR.esc(product.id)}" ${stock <= 0 ? 'disabled' : ''}>
            ${GR.icon('cart', 17)} ${stock > 0 ? '<span>Agregar<span class="pc-add-long"> al carrito</span></span>' : 'Sin stock'}
          </button>
        </div>
      </article>`;
  };

  GR.cartQty = (id) => (GR.read('carrito', []).find((item) => item.id === id) || {}).cantidad || 0;

  /** Agrega al carrito sin pasar del stock. Devuelve true si se agregó. */
  GR.addToCart = (id, cantidad = 1) => {
    const product = GR.getProducts().find((entry) => entry.id === id);
    if (!product || product.activo === false || product.stock <= 0) {
      GR.toast('Producto sin stock.', 'error');
      return false;
    }
    const cart = GR.read('carrito', []);
    const item = cart.find((entry) => entry.id === id);
    const limit = Math.min(product.stock, MAX_QTY);
    const current = item ? item.cantidad : 0;
    if (current >= limit) {
      GR.toast(`Solo hay ${product.stock} unidad${product.stock === 1 ? '' : 'es'} disponible${product.stock === 1 ? '' : 's'}.`, 'error');
      return false;
    }
    const added = Math.min(cantidad, limit - current);
    if (item) item.cantidad += added;
    else cart.push({ id, cantidad: added });
    GR.write('carrito', cart);
    window.dispatchEvent(new CustomEvent('gr:cart'));
    GR.toast(added < cantidad ? `Solo se agregaron ${added}: es todo el stock disponible.` : 'Agregado al carrito.');
    return true;
  };
})();
