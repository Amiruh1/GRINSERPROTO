'use strict';
(function () {
  const GR = window.GR;
  const grid = document.querySelector('#products-grid');
  const categories = document.querySelector('#products-categories');
  const search = document.querySelector('#products-search');
  const count = document.querySelector('#products-count');
  const MAX_QTY = 99;
  let selectedCategory = 'todas';
  let categoryWasSelected = false;

  function hasCategory(categoryId) {
    return categoryId === 'todas' || categoryId === 'ofertas' ||
      GR.CATEGORIAS.some((category) => category.id === categoryId) ||
      GR.getProducts().some((product) => product.categoria === categoryId);
  }

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
      return `<article class="card">
        <div class="card-media">${media}${discount ? `<span class="badge-off">-${discount}%</span>` : ''}</div>
        <div class="card-body">
          <span class="card-cat">${GR.esc(category.nombre)}${product.marca ? ` · ${GR.esc(product.marca)}` : ''}</span>
          <h3 class="card-title">${GR.esc(product.nombre)}</h3>
          <p class="card-desc">${GR.esc(product.descripcion || '')}</p>
          <div class="card-price"><strong>${GR.money(price)}</strong>${discount ? `<s>${GR.money(product.precio)}</s>` : ''}</div>
          <span class="stock ${product.stock <= 0 ? 'out' : product.stock <= 5 ? 'low' : ''}">${product.stock <= 0 ? 'Sin stock — consultar reposición' : 'Disponible para consulta'}</span>
          <button type="button" class="btn btn-primary btn-add" data-add="${GR.esc(product.id)}" ${product.stock <= 0 ? 'disabled' : ''}>
            ${GR.icon('cart', 17)} <span>Agregar al carrito</span>
          </button>
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

  function addToCart(id) {
    const product = GR.getProducts().find((entry) => entry.id === id);
    if (!product || product.activo === false || product.stock <= 0) {
      GR.toast('Producto sin stock.', 'error');
      return;
    }

    const cart = GR.read('carrito', []);
    const item = cart.find((entry) => entry.id === id);
    if (item && item.cantidad >= Math.min(product.stock, MAX_QTY)) {
      GR.toast(`Solo hay ${product.stock} unidad${product.stock === 1 ? '' : 'es'} disponible${product.stock === 1 ? '' : 's'}.`, 'error');
      return;
    }
    if (item) item.cantidad += 1;
    else cart.push({ id, cantidad: 1 });
    GR.write('carrito', cart);
    window.dispatchEvent(new CustomEvent('gr:cart'));
    GR.toast('Agregado al carrito.');
  }

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add]');
    if (button) addToCart(button.dataset.add);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const requestedCategory = params.get('categoria');
    if (hasCategory(requestedCategory)) {
      selectedCategory = requestedCategory;
    }
    search.value = params.get('q') || '';
    const renderLatestCatalog = () => {
      if (!categoryWasSelected) {
        selectedCategory = hasCategory(requestedCategory) ? requestedCategory : 'todas';
      } else if (!hasCategory(selectedCategory)) {
        selectedCategory = 'todas';
      }
      renderCategories();
      render();
    };
    renderLatestCatalog();
    search.addEventListener('input', render);
    categories.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      categoryWasSelected = true;
      selectedCategory = button.dataset.category;
      renderCategories();
      render();
    });
    GR.subscribeCatalogUpdates(renderLatestCatalog);
    GR.dataReady.then(renderLatestCatalog);
  });
})();
