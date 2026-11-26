'use strict';
// Grinser · ficha del producto (mismo diseño que la de Novatech): galería, precio, cantidad,
// especificaciones destacadas y pestañas Descripción / Especificaciones / Envío y garantía.
(function () {
  const GR = window.GR;
  const $ = (s) => document.querySelector(s);
  const root = $('#pd-root');
  const MAX_QTY = 99;
  let product = null;
  let photo = 0;
  let qty = 1;
  let tab = 'desc';

  // Ícono de cada especificación destacada según su nombre.
  function specIcon(name) {
    const n = name.toLowerCase();
    if (/marca|modelo|tipo|sku|serie/.test(n)) return 'tag';
    if (/velocidad|ppm|impresi|copia/.test(n)) return 'printer';
    if (/conect|wi-?fi|red|usb|ethernet/.test(n)) return 'route';
    if (/papel|bandeja|formato|tamaño/.test(n)) return 'file';
    if (/tóner|toner|tinta|rendimiento|consumible/.test(n)) return 'drop';
    return 'check';
  }

  /** Une las filas con la misma característica en una sola, con todos sus valores en orden. */
  function mergeSame(specs) {
    const out = [];
    specs.forEach((spec) => {
      const prev = out.find((item) => item.nombre.toLowerCase() === spec.nombre.toLowerCase());
      if (prev) prev.valores.push(spec.valor);
      else out.push({ ...spec, valores: [spec.valor] });
    });
    return out;
  }

  const images = () => [product.imagen, ...GR.imagesOf(product)].filter(Boolean);

  function galleryHtml() {
    const list = images();
    const n = list.length;
    const i = Math.min(photo, Math.max(0, n - 1));
    return `
      <div class="pd-gallery">
        <div class="pd-main" ${n > 1 ? 'tabindex="0"' : ''} aria-roledescription="galería" aria-label="Fotos de ${GR.esc(product.nombre)}">
          ${n ? `<img src="${GR.esc(list[i])}" alt="${GR.esc(product.nombre)}${n > 1 ? `, foto ${i + 1} de ${n}` : ''}">`
            : `<span class="pd-placeholder ph-${GR.esc(product.categoria)}">${GR.icon(GR.cat(product.categoria).icon, 96)}</span>`}
          ${n > 1 ? `
            <button type="button" class="pd-arrow prev" data-photo-step="-1" aria-label="Foto anterior">${GR.icon('chevron-left', 18)}</button>
            <button type="button" class="pd-arrow next" data-photo-step="1" aria-label="Foto siguiente">${GR.icon('chevron-right', 18)}</button>
            <span class="pd-count">${i + 1} / ${n}</span>` : ''}
        </div>
        ${n > 1 ? `<div class="pd-thumbs">${list.map((src, k) => `
          <button type="button" class="${k === i ? 'on' : ''}" data-photo="${k}" aria-label="Ver foto ${k + 1}" aria-current="${k === i}">
            <img src="${GR.esc(src)}" alt="" loading="lazy">
          </button>`).join('')}</div>` : ''}
      </div>`;
  }

  function infoHtml() {
    const final = GR.precioFinal(product);
    const offer = GR.enOferta(product);
    const descuento = offer ? Math.round((1 - final / product.precio) * 100) : 0;
    const inCart = GR.cartQty(product.id);
    const max = Math.max(0, Math.min(product.stock, MAX_QTY) - inCart);
    const q = Math.min(qty, Math.max(1, max));
    const stockTone = product.stock <= 0 ? 'bad' : product.stock <= 5 ? 'low' : 'ok';
    const stockText = product.stock <= 0 ? 'Agotado' : `${product.stock} unidad${product.stock === 1 ? '' : 'es'} disponible${product.stock === 1 ? '' : 's'}`;
    const highlights = mergeSame(GR.specsOf(product)).slice(0, 5);
    return `
      <div class="pd-info">
        ${product.marca ? `<a href="productos.html?q=${encodeURIComponent(product.marca)}" class="pd-brand">${GR.esc(product.marca)}</a>` : ''}
        <h1>${GR.esc(product.nombre)}</h1>
        <p class="pd-meta">
          ${product.sku ? `<span>SKU: <b>${GR.esc(product.sku)}</b></span>` : ''}
          ${product.marca ? `<span>Marca: ${GR.esc(product.marca)}</span>` : ''}
          <span>Categoría: <a href="productos.html?categoria=${encodeURIComponent(product.categoria)}">${GR.esc(GR.cat(product.categoria).nombre)}</a></span>
        </p>

        <div class="pd-price">
          <div class="pd-price-main">
            <span class="pd-now"><small>S/</small> ${GR.priceNumber(final)}</span>
            ${offer ? `<span class="pd-off">-${descuento}%</span><span class="pd-offer-tag">Con descuento</span>` : ''}
          </div>
          ${offer ? `<div class="pd-price-old"><s>${GR.shortMoney(product.precio)}</s><span class="pd-save">Ahorras ${GR.shortMoney(product.precio - final)}</span></div>` : ''}
        </div>

        <p class="pd-stock ${stockTone}"><span class="dot" aria-hidden="true"></span>${stockText}${inCart > 0 ? `<span class="muted"> · ${inCart} en tu carrito</span>` : ''}</p>

        ${product.stock > 0 ? `
          <span class="pd-label" id="qty-label">Cantidad:</span>
          <div class="pd-buy">
            <div class="pd-qty" role="group" aria-labelledby="qty-label">
              <button type="button" data-qty="-1" aria-label="Quitar uno" ${q <= 1 ? 'disabled' : ''}>${GR.icon('minus', 16)}</button>
              <input type="number" id="pd-qty" min="1" max="${Math.max(1, max)}" value="${q}" aria-label="Cantidad">
              <button type="button" data-qty="1" aria-label="Agregar uno" ${q >= max ? 'disabled' : ''}>${GR.icon('plus', 16)}</button>
            </div>
            <button type="button" class="btn btn-primary pd-add" data-buy="cart" ${max === 0 ? 'disabled' : ''}>${GR.icon('cart', 19)} ${max === 0 ? 'Ya tienes todo el stock' : 'Añadir al carrito'}</button>
          </div>
          <button type="button" class="btn pd-now-btn" data-buy="now" ${max === 0 ? 'disabled' : ''}>${GR.icon('cart', 18)} Comprar ahora</button>`
        : `<a class="btn btn-wa pd-ask" target="_blank" rel="noopener" href="${GR.waLink(`Hola Grinser, quisiera saber cuándo vuelve a estar disponible: ${product.nombre}${product.sku ? ` (${product.sku})` : ''}.`)}">${GR.waIcon(18)} Consultar disponibilidad</a>`}

        ${highlights.length ? `<ul class="pd-highlights">${highlights.map((s) => `
          <li>${GR.icon(specIcon(s.nombre), 19)}<span><b>${GR.esc(s.nombre)}:</b> ${GR.esc(s.valores.join(' · '))}</span></li>`).join('')}</ul>` : ''}

        <div class="pd-services">
          <button type="button" data-open-tab="envio">${GR.icon('shield', 22)}<span><strong>${product.garantia ? 'Garantía' : 'Producto original'}</strong><small>${GR.esc(product.garantia || 'Compra con respaldo de Grinser.')}</small></span>${GR.icon('chevron-right', 17)}</button>
          <button type="button" data-open-tab="envio">${GR.icon('truck', 22)}<span><strong>Envío a todo el Perú</strong><small>Lima y provincias · coordinamos contigo la entrega</small></span>${GR.icon('chevron-right', 17)}</button>
        </div>
      </div>`;
  }

  function tabsHtml() {
    const specs = GR.specsOf(product);
    const tabs = [['desc', 'Descripción'], ['specs', 'Especificaciones'], ['envio', 'Envío y garantía']];
    const groups = specs.reduce((acc, spec) => { (acc[spec.grupo || 'Información del producto'] ||= []).push(spec); return acc; }, {});
    let panel = '';
    if (tab === 'desc') panel = `<p class="pd-desc">${GR.esc(product.descripcion || 'Este producto aún no tiene descripción.')}</p>`;
    if (tab === 'specs') panel = specs.length ? `<div class="spec-groups">${Object.entries(groups).map(([group, items]) => `
      <div class="spec-group"><h3>${GR.esc(group)}</h3><dl>${mergeSame(items).map((s) => `
        <div><dt>${GR.esc(s.nombre)}</dt><dd>${s.valores.length > 1 ? `<ul class="spec-values">${s.valores.map((v) => `<li>${GR.esc(v)}</li>`).join('')}</ul>` : GR.esc(s.valores[0])}</dd></div>`).join('')}
      </dl></div>`).join('')}</div>` : '<p class="pd-desc">Este producto aún no tiene especificaciones.</p>';
    if (tab === 'envio') panel = `
      <div class="pd-ship">
        <div>${GR.icon('truck', 22)}<div><strong>Envío a todo el Perú</strong><p>Enviamos a Lima y provincias. El costo y el plazo dependen de tu zona; te los confirmamos al coordinar el pedido.</p></div></div>
        <div>${GR.icon('store', 22)}<div><strong>Recojo en tienda</strong><p>También puedes recoger tu pedido en nuestras tiendas de Lima. <a href="empresa.html#tiendas">Ver direcciones</a>.</p></div></div>
        <div>${GR.icon('shield', 22)}<div><strong>Garantía</strong><p>${GR.esc(product.garantia || 'Producto original. Ante cualquier defecto de fábrica, contáctanos con tu comprobante.')}</p></div></div>
      </div>`;
    return `
      <section class="pd-tabs" id="pd-tabs">
        <div class="pd-tablist" role="tablist" aria-label="Detalles del producto">
          ${tabs.map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-selected="${tab === id}" aria-controls="panel-${id}" tabindex="${tab === id ? 0 : -1}" class="${tab === id ? 'on' : ''}">${label}</button>`).join('')}
        </div>
        <div class="pd-panel" role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}">${panel}</div>
      </section>`;
  }

  function relatedHtml() {
    const all = GR.getProducts().filter((p) => p.activo !== false && p.id !== product.id);
    const sameCat = all.filter((p) => p.categoria === product.categoria);
    const sameBrand = all.filter((p) => product.marca && p.marca === product.marca && p.categoria !== product.categoria);
    const list = [...sameCat, ...sameBrand].slice(0, 4);
    if (!list.length) return '';
    return `
      <section class="pd-related" aria-labelledby="rel-title">
        <div class="section-head">
          <div><span class="kicker">También te puede gustar</span><h2 id="rel-title">Productos relacionados</h2></div>
          <a href="productos.html?categoria=${encodeURIComponent(product.categoria)}" class="see-all">Ver más en ${GR.esc(GR.cat(product.categoria).nombre)} ${GR.icon('arrow-right', 16)}</a>
        </div>
        <div class="pc-grid pc-grid-4">${list.map(GR.productCard).join('')}</div>
      </section>`;
  }

  function render() {
    const id = new URLSearchParams(location.search).get('id');
    product = GR.getProducts().find((p) => p.id === id && p.activo !== false) || null;
    if (!product) {
      root.innerHTML = `<div class="empty pd-missing">${GR.icon('search', 34)}<p>${id ? 'No encontramos este producto. Puede que ya no esté disponible.' : 'Producto no especificado.'}</p><a class="btn btn-primary" href="productos.html">Ver todos los productos</a></div>`;
      return;
    }
    const category = GR.cat(product.categoria);
    document.title = `${product.nombre} | Grinser`;
    root.innerHTML = `
      <nav class="crumbs pd-crumbs" aria-label="Ruta">
        <a href="index.html">Inicio</a>${GR.icon('chevron-right', 13)}
        <a href="productos.html?categoria=${encodeURIComponent(category.id)}">${GR.esc(category.nombre)}</a>${GR.icon('chevron-right', 13)}
        <span aria-current="page">${GR.esc(product.nombre)}</span>
      </nav>
      <article class="pd">${galleryHtml()}${infoHtml()}</article>
      ${tabsHtml()}
      ${relatedHtml()}`;
  }

  // Solo se vuelve a dibujar la parte que cambia (así no se pierde el foco ni el scroll).
  const swap = (selector, html) => { const el = root.querySelector(selector); if (el) el.outerHTML = html; };
  const stepPhoto = (d) => { const n = images().length; photo = (photo + d + n) % n; swap('.pd-gallery', galleryHtml()); };

  document.addEventListener('DOMContentLoaded', () => {
    render();
    GR.dataReady.then(render);
    GR.subscribeCatalogUpdates(render);
    window.addEventListener('gr:cart', () => { if (product) swap('.pd-info', infoHtml()); });

    root.addEventListener('click', (e) => {
      const t = e.target.closest('button, a');
      if (!t || !product) return;
      if (t.dataset.photoStep) stepPhoto(Number(t.dataset.photoStep));
      if (t.dataset.photo) { photo = Number(t.dataset.photo); swap('.pd-gallery', galleryHtml()); }
      if (t.dataset.qty) { qty = Math.max(1, (Number($('#pd-qty').value) || 1) + Number(t.dataset.qty)); swap('.pd-info', infoHtml()); }
      if (t.dataset.buy) {
        const q = Number($('#pd-qty').value) || 1;
        if (GR.addToCart(product.id, q)) {
          qty = 1;
          if (t.dataset.buy === 'now') { location.href = 'carrito.html'; return; }
        }
        swap('.pd-info', infoHtml());
      }
      if (t.dataset.tab || t.dataset.openTab) {
        tab = t.dataset.tab || t.dataset.openTab;
        swap('#pd-tabs', tabsHtml());
        if (t.dataset.openTab) $('#pd-tabs').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $(`#tab-${tab}`)?.focus({ preventScroll: Boolean(t.dataset.openTab) });
      }
      if (t.dataset.add) GR.addToCart(t.dataset.add);
    });
    root.addEventListener('change', (e) => {
      if (e.target.id === 'pd-qty') { qty = Math.max(1, Number(e.target.value) || 1); swap('.pd-info', infoHtml()); }
    });
    root.addEventListener('keydown', (e) => {
      if (e.target.closest('.pd-main') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        stepPhoto(e.key === 'ArrowLeft' ? -1 : 1);
        root.querySelector('.pd-main')?.focus();
      }
      if (e.target.closest('.pd-tablist') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const ids = ['desc', 'specs', 'envio'];
        tab = ids[(ids.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
        swap('#pd-tabs', tabsHtml());
        $(`#tab-${tab}`)?.focus();
      }
    });
  });
})();
