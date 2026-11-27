'use strict';
// Grinser · página de Productos: filtros laterales (precio, categoría, marca, especificaciones y
// disponibilidad), orden y tarjetas con el mismo diseño del catálogo de Novatech.
(function () {
  const GR = window.GR;
  const $ = (s) => document.querySelector(s);
  const MAX_SPEC_FACETS = 6;
  const SHOW_OPTIONS = 6;

  const state = {
    q: '', cat: 'todas', ofertas: false, stock: false, min: '', max: '', sort: 'recientes',
    marcas: new Set(), specs: {}, open: new Set(), expanded: new Set(),
  };

  const norm = (text) => String(text || '').toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const visibleProducts = () => GR.getProducts().filter((product) => product.activo !== false);
  const categories = () => {
    const list = [...GR.CATEGORIAS];
    visibleProducts().forEach((product) => { if (!list.some((c) => c.id === product.categoria)) list.push(GR.cat(product.categoria)); });
    return list;
  };

  // Filtra todo menos la sección indicada (así cada sección muestra cuántos productos quedarían).
  function filtered(except = '') {
    const q = norm(state.q.trim());
    const min = state.min === '' ? null : Number(state.min);
    const max = state.max === '' ? null : Number(state.max);
    return visibleProducts().filter((product) => {
      const price = GR.precioFinal(product);
      if (except !== 'cat' && state.cat !== 'todas' && product.categoria !== state.cat) return false;
      if (except !== 'disp' && state.ofertas && !GR.enOferta(product)) return false;
      if (except !== 'disp' && state.stock && !(product.stock > 0)) return false;
      if (except !== 'precio' && min != null && price < min) return false;
      if (except !== 'precio' && max != null && price > max) return false;
      if (except !== 'marca' && state.marcas.size && !state.marcas.has(product.marca || '')) return false;
      const specs = GR.specsOf(product);
      for (const [name, values] of Object.entries(state.specs)) {
        if (except === `spec:${name}` || !values.size) continue;
        if (!specs.some((spec) => norm(spec.nombre) === name && values.has(spec.valor))) return false;
      }
      if (q) {
        const text = norm(`${product.nombre} ${product.marca} ${product.sku || ''} ${GR.cat(product.categoria).nombre} ${product.descripcion} ${specs.map((s) => `${s.nombre} ${s.valor}`).join(' ')}`);
        if (!q.split(/\s+/).every((word) => text.includes(word))) return false;
      }
      return true;
    });
  }

  function sorted(list) {
    const items = [...list];
    if (state.sort === 'precio-asc') items.sort((a, b) => GR.precioFinal(a) - GR.precioFinal(b));
    else if (state.sort === 'precio-desc') items.sort((a, b) => GR.precioFinal(b) - GR.precioFinal(a));
    else if (state.sort === 'nombre') items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    else if (state.sort === 'descuento') items.sort((a, b) => (1 - GR.precioFinal(b) / b.precio) - (1 - GR.precioFinal(a) / a.precio));
    else items.reverse(); // los últimos agregados en la hoja aparecen primero
    return items.sort((a, b) => (b.stock > 0) - (a.stock > 0));
  }

  // Especificaciones que sirven como filtro: las que tienen al menos 2 productos en esta sección.
  function specFacets() {
    if (state.cat === 'todas') return [];
    const scope = visibleProducts().filter((product) => product.categoria === state.cat);
    const byName = new Map();
    scope.forEach((product) => {
      const seen = new Set();
      GR.specsOf(product).forEach((spec) => {
        const key = norm(spec.nombre);
        if (!byName.has(key)) byName.set(key, { key, label: spec.nombre, products: 0, values: new Map() });
        const facet = byName.get(key);
        if (!seen.has(key)) { facet.products += 1; seen.add(key); }
        facet.values.set(spec.valor, (facet.values.get(spec.valor) || 0) + 1);
      });
    });
    // Solo sirve como filtro si algún valor se repite (p. ej. «Modelo» casi nunca se repite).
    const useful = (facet) => facet.products >= 2 && [...facet.values.values()].some((n) => n >= 2);
    return [...byName.values()].filter((facet) => useful(facet) || state.specs[facet.key]?.size)
      .sort((a, b) => b.products - a.products).slice(0, MAX_SPEC_FACETS);
  }

  const countBy = (list, keyOf) => list.reduce((map, product) => {
    [].concat(keyOf(product)).filter((k) => k !== '' && k != null).forEach((k) => map.set(k, (map.get(k) || 0) + 1));
    return map;
  }, new Map());

  // ── Secciones del panel de filtros ─────────────────────────────────────
  function section(id, title, count, body) {
    const open = state.open.has(id);
    return `
      <div class="sf-sec ${open ? 'open' : ''}">
        <button type="button" class="sf-sec-btn" data-sec="${GR.esc(id)}" aria-expanded="${open}" aria-controls="sf-${GR.esc(id)}">
          <span>${GR.esc(title)}${count ? `<span class="sf-count">${count}</span>` : ''}</span>${GR.icon('chevron-down', 16)}
        </button>
        ${open ? `<div class="sf-sec-body" id="sf-${GR.esc(id)}">${body}</div>` : ''}
      </div>`;
  }

  function optionList(id, options, type, isOn) {
    const all = state.expanded.has(id);
    const shown = all ? options : options.slice(0, SHOW_OPTIONS);
    return `<ul class="sf-opts">${shown.map((o) => `
      <li><label class="${isOn(o.value) ? 'on' : ''}">
        <input type="${type}" name="sf-${GR.esc(id)}" data-opt="${GR.esc(id)}" value="${GR.esc(o.value)}" ${isOn(o.value) ? 'checked' : ''}>
        <span class="sf-opt-label">${GR.esc(o.label)}</span><span class="sf-opt-count">${o.count}</span>
      </label></li>`).join('')}</ul>
      ${options.length > SHOW_OPTIONS ? `<button type="button" class="link-btn sf-more" data-more="${GR.esc(id)}">${all ? 'Ver menos' : `Ver ${options.length - SHOW_OPTIONS} más`}</button>` : ''}`;
  }

  function renderFilters() {
    const prices = visibleProducts().map(GR.precioFinal);
    const lo = prices.length ? Math.floor(Math.min(...prices)) : 0;
    const hi = prices.length ? Math.ceil(Math.max(...prices)) : 0;
    const catCounts = countBy(filtered('cat'), (p) => p.categoria);
    const brandCounts = countBy(filtered('marca'), (p) => p.marca || '');
    const dispBase = filtered('disp');

    const html = [
      section('precio', 'Rango de precio', state.min !== '' || state.max !== '' ? 1 : 0, `
        <div class="sf-price">
          <label>Mín.<input type="number" min="0" inputmode="numeric" data-price="min" placeholder="${lo}" value="${GR.esc(state.min)}"></label>
          <span aria-hidden="true">—</span>
          <label>Máx.<input type="number" min="0" inputmode="numeric" data-price="max" placeholder="${hi}" value="${GR.esc(state.max)}"></label>
        </div>
        <p class="sf-hint">Precios entre ${GR.shortMoney(lo)} y ${GR.shortMoney(hi)}</p>`),
      section('cat', 'Categoría', state.cat !== 'todas' ? 1 : 0, optionList('cat',
        [{ value: 'todas', label: 'Todas', count: filtered('cat').length },
          ...categories().map((c) => ({ value: c.id, label: c.nombre, count: catCounts.get(c.id) || 0 })).filter((o) => o.count || o.value === state.cat)],
        'radio', (v) => v === state.cat)),
      section('marca', 'Marca', state.marcas.size, optionList('marca',
        [...new Set([...brandCounts.keys(), ...state.marcas])].sort((a, b) => a.localeCompare(b, 'es'))
          .map((m) => ({ value: m, label: m, count: brandCounts.get(m) || 0 })),
        'checkbox', (v) => state.marcas.has(v))),
      ...specFacets().map((facet) => {
        const selected = state.specs[facet.key] || new Set();
        const counts = countBy(filtered(`spec:${facet.key}`), (p) => GR.specsOf(p).filter((s) => norm(s.nombre) === facet.key).map((s) => s.valor));
        const values = [...new Set([...counts.keys(), ...selected])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
        return section(`spec:${facet.key}`, facet.label, selected.size, optionList(`spec:${facet.key}`,
          values.map((v) => ({ value: v, label: v, count: counts.get(v) || 0 })), 'checkbox', (v) => selected.has(v)));
      }),
      section('disp', 'Disponibilidad', Number(state.stock) + Number(state.ofertas), `
        <ul class="sf-opts">
          <li><label class="${state.stock ? 'on' : ''}"><input type="checkbox" data-flag="stock" ${state.stock ? 'checked' : ''}><span class="sf-opt-label">Solo con stock</span><span class="sf-opt-count">${dispBase.filter((p) => p.stock > 0).length}</span></label></li>
          <li><label class="${state.ofertas ? 'on' : ''}"><input type="checkbox" data-flag="ofertas" ${state.ofertas ? 'checked' : ''}><span class="sf-opt-label">Solo ofertas</span><span class="sf-opt-count">${dispBase.filter(GR.enOferta).length}</span></label></li>
        </ul>`),
    ];
    $('#sf-sections').innerHTML = html.join('');
  }

  // ── Resultados ─────────────────────────────────────────────────────────
  function renderChips() {
    const chips = [];
    if (state.q.trim()) chips.push({ label: `«${state.q.trim()}»`, clear: () => { state.q = ''; $('#sf-q').value = ''; } });
    if (state.cat !== 'todas') chips.push({ label: GR.cat(state.cat).nombre, clear: () => { state.cat = 'todas'; } });
    if (state.min !== '' || state.max !== '') chips.push({ label: `${state.min !== '' ? GR.shortMoney(state.min) : 'S/ 0'} – ${state.max !== '' ? GR.shortMoney(state.max) : 'más'}`, clear: () => { state.min = ''; state.max = ''; } });
    state.marcas.forEach((m) => chips.push({ label: m, clear: () => state.marcas.delete(m) }));
    Object.values(state.specs).forEach((values) => values.forEach((v) => chips.push({ label: v, clear: () => values.delete(v) })));
    if (state.stock) chips.push({ label: 'Con stock', clear: () => { state.stock = false; } });
    if (state.ofertas) chips.push({ label: 'Ofertas', clear: () => { state.ofertas = false; } });
    chipActions = chips.map((c) => c.clear);
    $('#sf-chips').hidden = !chips.length;
    $('#sf-chips').innerHTML = chips.map((c, i) => `<button type="button" class="sf-chip" data-chip="${i}" aria-label="Quitar filtro ${GR.esc(c.label)}">${GR.esc(c.label)} ${GR.icon('x', 13)}</button>`).join('')
      + (chips.length ? '<button type="button" class="link-btn" data-clear-all>Limpiar todo</button>' : '');
  }
  let chipActions = [];

  function renderResults() {
    const list = sorted(filtered());
    const category = state.cat !== 'todas' ? GR.cat(state.cat) : null;
    const title = category ? category.nombre : state.ofertas ? 'Ofertas' : 'Todos los productos';
    $('#shop-title').textContent = title;
    $('#sf-scope-title').textContent = category ? category.nombre : 'Todo el catálogo';
    $('#sf-back').hidden = !category;
    $('#crumb-current').textContent = category ? category.nombre : 'Productos';
    document.title = `${title} | Grinser`;
    $('#shop-count').textContent = `${list.length} producto${list.length === 1 ? '' : 's'} encontrado${list.length === 1 ? '' : 's'}`;
    $('#shop-grid').innerHTML = list.length ? list.map(GR.productCard).join('') : `
      <div class="empty">${GR.icon('search', 34)}<p>No encontramos productos con esos filtros.</p>
        <button type="button" class="btn" data-clear-all>Quitar filtros</button></div>`;
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.cat !== 'todas') params.set('categoria', state.cat);
    else if (state.ofertas) params.set('categoria', 'ofertas');
    if (state.q.trim()) params.set('q', state.q.trim());
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);
  }

  function render() {
    renderFilters();
    renderChips();
    renderResults();
    syncUrl();
  }

  function clearAll() {
    Object.assign(state, { q: '', cat: 'todas', ofertas: false, stock: false, min: '', max: '' });
    state.marcas.clear();
    state.specs = {};
    $('#sf-q').value = '';
    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('categoria');
    if (requested === 'ofertas') state.ofertas = true;
    else if (requested) state.cat = requested;
    state.q = params.get('q') || '';
    $('#sf-q').value = state.q;
    if (state.cat !== 'todas') state.open.add('cat');
    const headerSearch = document.querySelector('#site-header #q');
    if (headerSearch) headerSearch.value = state.q;

    let timer;
    $('#sf-q').addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = $('#sf-q').value; render(); }, 180);
    });
    $('#shop-sort').addEventListener('change', (e) => { state.sort = e.target.value; renderResults(); });
    $('#sf-toggle').addEventListener('click', () => {
      const open = !document.querySelector('.shop-filters').classList.contains('open');
      document.querySelector('.shop-filters').classList.toggle('open', open);
      $('#sf-toggle').setAttribute('aria-expanded', open);
      $('#sf-toggle').textContent = open ? 'Ocultar' : 'Mostrar';
    });

    $('#sf-sections').addEventListener('click', (e) => {
      const sec = e.target.closest('[data-sec]');
      if (sec) {
        const id = sec.dataset.sec;
        if (state.open.has(id)) state.open.delete(id); else state.open.add(id);
        renderFilters();
        $(`[data-sec="${CSS.escape(id)}"]`)?.focus();
      }
      const more = e.target.closest('[data-more]');
      if (more) {
        const id = more.dataset.more;
        if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
        renderFilters();
      }
    });
    $('#sf-sections').addEventListener('change', (e) => {
      const input = e.target;
      if (input.dataset.price) {
        const value = input.value.trim();
        state[input.dataset.price] = value === '' || Number(value) < 0 ? '' : String(Number(value));
      } else if (input.dataset.flag) {
        state[input.dataset.flag] = input.checked;
      } else if (input.dataset.opt === 'cat') {
        state.cat = input.value;
        state.specs = {}; // las especificaciones cambian según la categoría
      } else if (input.dataset.opt === 'marca') {
        if (input.checked) state.marcas.add(input.value); else state.marcas.delete(input.value);
      } else if (input.dataset.opt?.startsWith('spec:')) {
        const key = input.dataset.opt.slice(5);
        state.specs[key] ||= new Set();
        if (input.checked) state.specs[key].add(input.value); else state.specs[key].delete(input.value);
      } else return;
      const focusKey = input.dataset.price ? `[data-price="${input.dataset.price}"]` : null;
      render();
      if (focusKey) $(focusKey)?.focus();
    });
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-chip]');
      if (chip) { chipActions[Number(chip.dataset.chip)]?.(); render(); }
      if (e.target.closest('[data-clear-all]')) clearAll();
      const add = e.target.closest('[data-add]');
      if (add) GR.addToCart(add.dataset.add);
    });

    const refresh = () => render();
    refresh();
    GR.subscribeCatalogUpdates(refresh);
    GR.dataReady.then(refresh);
  });
})();
