'use strict';
(function () {
  const GR = window.GR;
  const grid = document.querySelector('#products-grid');
  const categories = document.querySelector('#products-categories');
  const search = document.querySelector('#products-search');
  const count = document.querySelector('#products-count');
  let selectedCategory = 'todas';

  function render() {
    const query = search.value.trim().toLocaleLowerCase('es');
    const products = GR.getProducts().filter((product) => product.activo !== false &&
      (selectedCategory === 'todas' || (selectedCategory === 'ofertas' ? GR.enOferta(product) : product.categoria === selectedCategory)) &&
      (!query || `${product.nombre} ${product.marca || ''} ${GR.cat(product.categoria).nombre}`.toLocaleLowerCase('es').includes(query)));

    count.textContent = `${products.length} producto${products.length === 1 ? '' : 's'}${query ? ` para «${query}»` : ''}`;
    grid.innerHTML = products.length ? products.map((product) => {
      const category = GR.cat(product.categoria);
      const price = GR.precioFinal(product);
      const discount = GR.enOferta(product) ? Math.round((1 - price / product.precio) * 100) : 0;
      const media = product.imagen
        ? `<img src="${GR.esc(product.imagen)}" alt="${GR.esc(product.nombre)}" loading="lazy">`
        : `<span class="ph ph-${GR.esc(category.id)}">${GR.icon(category.icon, 46)}</span>`;
      const message = encodeURIComponent(`Hola Grinser, quisiera consultar por ${product.nombre}.`);
      return `<article class="card">
        <div class="card-media">${media}${discount ? `<span class="badge-off">-${discount}%</span>` : ''}</div>
        <div class="card-body">
          <span class="card-cat">${GR.esc(category.nombre)}${product.marca ? ` · ${GR.esc(product.marca)}` : ''}</span>
          <h3 class="card-title">${GR.esc(product.nombre)}</h3>
          <p class="card-desc">${GR.esc(product.descripcion || '')}</p>
          <div class="card-price"><strong>${GR.money(price)}</strong>${discount ? `<s>${GR.money(product.precio)}</s>` : ''}</div>
          <span class="stock ${product.stock <= 0 ? 'out' : product.stock <= 5 ? 'low' : ''}">${product.stock <= 0 ? 'Sin stock — consultar reposición' : 'Disponible para consulta'}</span>
          <a class="btn btn-primary btn-add" href="https://wa.me/${GR.EMPRESA.whatsapp}?text=${message}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
        </div>
      </article>`;
    }).join('') : '<p class="empty">No encontramos productos con esos filtros.</p>';
  }

  function renderCategories() {
    const products = GR.getProducts();
    const knownCategories = new Set(GR.CATEGORIAS.map((category) => category.id));
    const productCategories = [...new Set(products.map((product) => product.categoria))]
      .filter((id) => !knownCategories.has(id))
      .map((id) => GR.cat(id));
    const items = [{ id: 'todas', nombre: 'Todos', icon: 'grid' }, { id: 'ofertas', nombre: 'Ofertas', icon: 'percent' }, ...GR.CATEGORIAS, ...productCategories];
    categories.innerHTML = items.map((category) =>
      `<button type="button" class="chip ${selectedCategory === category.id ? 'on' : ''} ${category.id === 'ofertas' ? 'hot' : ''}" data-category="${GR.esc(category.id)}" aria-pressed="${selectedCategory === category.id}">${GR.icon(category.icon, 16)} ${GR.esc(category.nombre)}</button>`,
    ).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await GR.dataReady;
    const params = new URLSearchParams(window.location.search);
    const requestedCategory = params.get('categoria');
    if (requestedCategory === 'ofertas' || GR.CATEGORIAS.some((category) => category.id === requestedCategory) ||
        GR.getProducts().some((product) => product.categoria === requestedCategory)) {
      selectedCategory = requestedCategory;
    }
    search.value = params.get('q') || '';
    renderCategories();
    render();
    search.addEventListener('input', render);
    categories.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      selectedCategory = button.dataset.category;
      renderCategories();
      render();
    });
    GR.subscribeCatalogUpdates(() => {
      renderCategories();
      render();
    });
  });
})();
