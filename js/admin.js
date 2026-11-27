'use strict';
// Grinser · panel de empresa: ventas, catálogo, categorías y usuarios.
(function () {
  const GR = window.GR;
  const $ = (s) => document.querySelector(s);
  let products = [];
  let editing = null; // id del producto que se edita (null = nuevo)
  let stockEditing = null;
  let categoryEditing = null;
  let imageUploading = false;
  let salesPeriod = 'todo';
  let sheetsWriteKey = '';
  let catalogSyncing = false;
  let eventSyncing = false;
  let catalogRefreshInProgress = false;
  let catalogRefreshFailed = false;
  const ORDER_STATUSES = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

  // ── Acceso: sin sesión se pide ingresar como empresa; un cliente vuelve a la tienda ──
  function guard() {
    const u = GR.currentUser();
    if (!u) {
      $('#admin').hidden = true;
      $('#guard').hidden = false;
      $('#guard').innerHTML = `<div class="guard-card"><img src="img/logo-grinser.png" alt="Grinser" width="220" height="69"><h1>Panel de empresa</h1><p class="muted">Inicia sesión con una cuenta de administrador.</p><button type="button" class="btn btn-primary" data-login>${GR.icon('lock', 17)} Ingresar</button><a class="link-btn" href="index.html">Volver a la tienda</a></div>`;
      GR.openAuth('login', { modo: 'empresa', onSuccess: guard });
      return false;
    }
    if (u.rol !== 'admin') {
      GR.toast('No tienes permisos para ver el panel de empresa.', 'error');
      setTimeout(() => { location.href = 'index.html'; }, 900);
      $('#guard').innerHTML = '<p class="muted">Redirigiendo a la tienda…</p>';
      return false;
    }
    $('#guard').hidden = true;
    $('#admin').hidden = false;
    $('#as-user').innerHTML = `<span class="avatar" aria-hidden="true">${GR.esc(u.nombre.trim()[0].toUpperCase())}</span><span class="um-copy"><b>${GR.esc(u.nombre.split(' ')[0])}</b><small>Administrador</small></span>`;
    products = GR.getProducts();
    renderProductCategoryOptions();
    renderAll();
    return true;
  }

  function renderAll() { renderStats(); renderProducts(); renderUsers(); renderSales(); renderCategories(); renderEvents(); }

  function updateCatalogSourceNote() {
    if (GR.sheetsConnected) {
      ['#p-reset', '#p-export', '#c-export'].forEach((selector) => { $(selector).disabled = true; });
      $('#p-new').disabled = false;
      $('#c-new').disabled = false;
      $('#p-source-note').textContent = 'Catálogo conectado a Sheets. Los cambios se guardan en la hoja al confirmarlos; la primera vez se solicitará la clave de administración.';
      $('#c-source-note').textContent = 'Categorías sincronizadas con Sheets. Los cambios se guardan al confirmarlos; la primera vez se solicitará la clave de administración.';
    } else if (GR.sheetsConfigured) {
      ['#p-new', '#p-reset', '#p-export', '#c-new', '#c-export'].forEach((selector) => { $(selector).disabled = true; });
      $('#p-source-note').textContent = 'Google Sheets está configurado, pero no se pudo conectar. No se permiten cambios hasta recuperar la conexión.';
      $('#c-source-note').textContent = 'Google Sheets está configurado, pero no se pudo conectar. No se permiten cambios hasta recuperar la conexión.';
    }
    updateEventsSourceNote();
  }

  function updateEventsSourceNote() {
    const note = $('#event-source-note');
    const connected = GR.sheetsConfigured && GR.sheetsConnected;
    const hasEnabledEvent = GR.EVENTS.some((event) => event.enabled);
    if (!GR.sheetsConfigured) {
      note.textContent = 'Configura Google Sheets para guardar estos controles y compartirlos con todos los visitantes.';
    } else if (!connected) {
      note.textContent = 'Google Sheets no está conectado. Los eventos no se pueden modificar hasta recuperar la conexión.';
    } else if (GR.EVENT_MODE === 'manual') {
      const selected = GR.EVENT_DEFINITIONS.find((event) => event.id === GR.MANUAL_EVENT_ID);
      note.textContent = `${selected ? selected.name : 'El evento elegido'} se muestra ahora a todos los visitantes. Cambia a automático para volver al calendario.`;
    } else {
      note.textContent = 'Conectado a Google Sheets. Automático usa el calendario de Perú. Puedes elegir aquí la temporada que se usará al activar el modo manual.';
    }
    note.classList.toggle('event-source-warning', !connected);
    $('#event-mode').disabled = !connected || eventSyncing;
    $('#event-mode').querySelector('option[value="manual"]').disabled = !hasEnabledEvent;
    $('#event-manual').disabled = !connected || eventSyncing || !hasEnabledEvent;
    $('#event-list').querySelectorAll('[data-event-toggle]').forEach((input) => {
      input.disabled = !connected || eventSyncing;
    });
  }

  async function refreshCatalogFromSheets() {
    if (!GR.sheetsConfigured || catalogRefreshInProgress ||
        catalogSyncing || eventSyncing || document.visibilityState !== 'visible' ||
        ['#p-dialog', '#c-dialog', '#stock-dialog'].some((selector) => $(selector).open)) return;
    catalogRefreshInProgress = true;
    try {
      const changed = await GR.refreshCatalog();
      catalogRefreshFailed = false;
      updateCatalogSourceNote();
      if (changed) {
        products = GR.getProducts();
        renderProductCategoryOptions();
        renderAll();
      }
    } catch (error) {
      if (!catalogRefreshFailed) GR.toast(`No se pudo actualizar el catálogo: ${error.message}`, 'error');
      catalogRefreshFailed = true;
    } finally {
      catalogRefreshInProgress = false;
    }
  }

  function renderProductCategoryOptions() {
    const categories = [...GR.CATEGORIAS];
    const knownIds = new Set(categories.map((category) => category.id));
    [...new Set(products.map((product) => product.categoria))].forEach((id) => {
      if (id && !knownIds.has(id)) categories.push(GR.cat(id));
    });
    $('#p-cat').innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>'
      + categories.map((category) => `<option value="${GR.esc(category.id)}">${GR.esc(category.nombre)}</option>`).join('');
  }

  async function syncCatalog(nextProducts, nextCategories) {
    if (GR.sheetsConfigured && !GR.sheetsConnected) throw new Error('No hay conexión con Google Sheets. Recarga el panel cuando la conexión esté disponible.');
    if (!GR.sheetsConfigured) return;
    if (catalogSyncing) throw new Error('Espera a que termine la sincronización actual.');
    catalogSyncing = true;
    try {
      if (!sheetsWriteKey) {
        const key = window.prompt('Ingresa la clave privada de Google Sheets para guardar los cambios:');
        if (key == null || !key.trim()) throw new Error('Se canceló la sincronización.');
        sheetsWriteKey = key.trim();
      }
      await GR.saveCatalogToSheets(sheetsWriteKey, { products: nextProducts, categories: nextCategories });
    } catch (error) {
      sheetsWriteKey = '';
      throw error;
    } finally {
      catalogSyncing = false;
    }
  }

  function renderStats() {
    const users = GR.getUsers();
    const items = [
      ['box', 'Productos', products.length],
      ['x', 'Agotados', products.filter((p) => p.stock <= 0).length],
      ['user', GR.sheetsConnected ? 'Cuentas locales' : 'Clientes', users.filter((u) => u.rol === 'cliente').length],
      ['briefcase', 'Administradores', users.filter((u) => u.rol === 'admin').length],
    ];
    $('#stats').innerHTML = items.map(([ic, l, v]) => `<div class="stat">${GR.icon(ic, 20)}<span><b>${v}</b><small>${l}</small></span></div>`).join('');
  }

  // ── Productos ──────────────────────────────────────────────────────────
  function renderProducts() {
    const q = $('#p-q').value.trim().toLowerCase();
    const list = products.filter((p) => !q || `${p.nombre} ${p.marca} ${GR.cat(p.categoria).nombre}`.toLowerCase().includes(q));
    $('#p-table').innerHTML = `
      <thead><tr><th>Producto</th><th>Categoría</th><th class="num">Precio</th><th class="num">Stock</th><th>Estado</th><th class="actions"><span class="sr-only">Acciones</span></th></tr></thead>
      <tbody>${list.length ? list.map((p) => `
        <tr>
          <td><div class="t-prod"><span class="t-thumb">${p.imagen ? `<img src="${GR.esc(p.imagen)}" alt="">` : GR.icon(GR.cat(p.categoria).icon, 20)}</span><span><b>${GR.esc(p.nombre)}</b><small>${GR.esc(p.sku || 'sin SKU')} · ${GR.esc(p.marca || 'sin marca')}</small></span></div></td>
          <td>${GR.esc(GR.cat(p.categoria).nombre)}</td>
          <td class="num">${GR.money(GR.precioFinal(p))}${GR.enOferta(p) ? `<br><s class="muted">${GR.money(p.precio)}</s>` : ''}</td>
          <td class="num"><span class="stock ${p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : ''}">${p.stock}</span></td>
          <td><span class="pill ${p.activo !== false ? 'ok' : ''}">${p.activo !== false ? 'Visible' : 'Oculto'}</span></td>
          <td class="actions">${GR.sheetsConfigured && !GR.sheetsConnected ? '<span class="pill">Sheets sin conexión</span>' : `
            <button type="button" class="icon-btn" data-stock="${p.id}" aria-label="Registrar movimiento de stock de ${GR.esc(p.nombre)}">${GR.icon('refresh', 16)}</button>
            <button type="button" class="icon-btn" data-edit="${p.id}" aria-label="Editar ${GR.esc(p.nombre)}">${GR.icon('edit', 16)}</button>
            <button type="button" class="icon-btn danger" data-del="${p.id}" aria-label="Eliminar ${GR.esc(p.nombre)}">${GR.icon('trash', 16)}</button>
          `}</td>
        </tr>`).join('') : '<tr><td colspan="6" class="muted center">Sin productos.</td></tr>'}</tbody>`;
  }

  const dateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const orderStatusLabel = (status) => status.charAt(0).toUpperCase() + status.slice(1);

  function filteredOrders() {
    const storedOrders = GR.read('pedidos', []);
    const clientQuery = $('#s-client').value.trim().toLowerCase();
    const productQuery = $('#s-product').value.trim().toLowerCase();
    const status = $('#s-status').value;
    const today = dateKey(new Date());
    const now = new Date();
    let defaultFrom = '';
    if (salesPeriod === 'hoy') defaultFrom = today;
    if (salesPeriod === '7dias') { const week = new Date(now); week.setDate(week.getDate() - 6); defaultFrom = dateKey(week); }
    if (salesPeriod === 'mes') defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const from = $('#s-from').value || defaultFrom;
    const to = $('#s-to').value || (salesPeriod === 'todo' ? '' : today);
    return (Array.isArray(storedOrders) ? storedOrders : []).filter((order) => {
      const customer = `${order.nombre || ''} ${order.email || ''} ${order.id || ''}`.toLowerCase();
      const items = Array.isArray(order.items) ? order.items : [];
      const productsText = items.map((item) => `${item.nombre || ''} ${item.id || ''}`).join(' ').toLowerCase();
      const day = dateKey(order.fecha);
      return (!clientQuery || customer.includes(clientQuery)) &&
        (!productQuery || productsText.includes(productQuery)) &&
        (!status || (order.estado || 'pendiente') === status) &&
        (!from || day >= from) && (!to || day <= to);
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  function renderSales() {
    if (!$('#s-table')) return;
    const orders = filteredOrders();
    const revenueOrders = orders.filter((order) => (order.estado || 'pendiente') !== 'cancelado');
    const revenue = revenueOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const stats = [
      ['box', 'Pedidos visibles', orders.length],
      ['card', 'Facturación visible', GR.money(revenue)],
      ['target', 'Ticket promedio', GR.money(revenueOrders.length ? revenue / revenueOrders.length : 0)],
      ['refresh', 'Pendientes', orders.filter((order) => (order.estado || 'pendiente') === 'pendiente').length],
      ['check', 'Entregados', orders.filter((order) => order.estado === 'entregado').length],
    ];
    $('#sales-stats').innerHTML = stats.map(([icon, label, value], i) => `
      <div class="stat sales-stat sales-stat-${i}">${GR.icon(icon, 20)}<span><small>${label}</small><b>${value}</b></span></div>`).join('');
    $('#s-table').innerHTML = `
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th class="num">Total</th><th class="actions">Detalle</th></tr></thead>
      <tbody>${orders.length ? orders.map((order) => {
        const status = ORDER_STATUSES.includes(order.estado) ? order.estado : 'pendiente';
        const customer = order.nombre || GR.getUsers().find((user) => user.id === order.usuario)?.nombre || 'Cliente';
        const items = Array.isArray(order.items) ? order.items : [];
        return `
          <tr>
            <td><button type="button" class="order-code" data-order-toggle="${GR.esc(order.id)}" aria-expanded="false">${GR.esc(order.id)}</button></td>
            <td><div class="order-customer"><b>${GR.esc(customer)}</b><small>${GR.esc(order.email || '—')}</small></div></td>
            <td>${new Date(order.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td><select class="order-status status-${status}" data-order-status="${GR.esc(order.id)}" aria-label="Estado del pedido ${GR.esc(order.id)}">
              ${ORDER_STATUSES.map((value) => `<option value="${value}" ${status === value ? 'selected' : ''}>${orderStatusLabel(value)}</option>`).join('')}
            </select></td>
            <td class="num"><b>${GR.money(order.total)}</b></td>
            <td class="actions"><button type="button" class="icon-btn order-expand" data-order-toggle="${GR.esc(order.id)}" aria-label="Ver detalle de ${GR.esc(order.id)}" aria-expanded="false">${GR.icon('chevron-down', 16)}</button></td>
          </tr>
          <tr class="order-detail-row" id="order-detail-${GR.esc(order.id)}" hidden><td colspan="6">
            <div class="order-detail"><b>Productos del pedido</b>
              ${items.length ? `<ul>${items.map((item) => `<li><span>${GR.esc(item.nombre)} <small>× ${Number(item.cantidad) || 0}</small></span><b>${GR.money(Number(item.precio || 0) * Number(item.cantidad || 0))}</b></li>`).join('')}</ul>` : '<p class="muted">No hay detalle de productos disponible.</p>'}
            </div>
          </td></tr>`;
      }).join('') : '<tr><td colspan="6" class="muted center">No hay pedidos para estos filtros.</td></tr>'}</tbody>`;
    document.querySelectorAll('[data-period]').forEach((button) => {
      button.classList.toggle('on', button.dataset.period === salesPeriod);
    });
  }

  // Ventana «Editar producto» (mismo diseño que el panel de Novatech).
  function openProduct(id) {
    editing = id || null;
    const p = products.find((x) => x.id === id) || { nombre: '', categoria: '', marca: '', precio: '', precio_oferta: '', stock: 0, descripcion: '', imagen: '', activo: true };
    const f = $('#p-form');
    $('#p-dlg-title').textContent = id ? 'Editar producto' : 'Nuevo producto';
    $('#p-dlg-sub').textContent = id ? p.nombre : 'Completa los datos; podrás editarlos cuando quieras.';
    $('#p-save span').textContent = id ? 'Guardar cambios' : 'Crear producto';
    $('#p-err').hidden = true;
    $('#p-err').textContent = '';
    for (const k of ['nombre', 'sku', 'marca', 'precio', 'stock', 'descripcion', 'imagen', 'garantia']) f.elements[k].value = p[k] ?? '';
    galleryDraft = GR.imagesOf(p);
    specsDraft = GR.specsOf(p).map((spec) => ({ ...spec }));
    $('#pf-gal-url').value = '';
    $('#pf-image-file').value = '';
    $('#pf-gal-files').value = '';
    renderGalleryDraft();
    renderSpecsDraft();
    f.elements.precio_oferta.value = p.precio_oferta ?? '';
    f.elements.categoria.value = p.categoria;
    f.elements.activo.checked = p.activo !== false;
    // Al editar, el stock no se cambia aquí: se usa «Movimiento de stock» para dejar registro.
    $('#pf-stock-wrap').hidden = Boolean(id);
    $('#pf-stock-now-wrap').hidden = !id;
    $('#pf-stock-note').hidden = !id;
    $('#pf-stock-now').value = `${p.stock} unid.`;
    $('#p-marcas').innerHTML = [...new Set(products.map((x) => x.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
      .map((m) => `<option value="${GR.esc(m)}"></option>`).join('');
    setProductSaving(false);
    updateProductPreview();
    $('#p-dialog').showModal();
    $('#p-dialog .pm-body').scrollTop = 0;
    f.elements.nombre.focus();
  }

  // ── Fotos adicionales y especificaciones (borradores mientras la ventana está abierta) ──
  let galleryDraft = [];
  let specsDraft = [];
  const SPEC_GROUPS = ['Información del producto', 'Impresión', 'Copiado', 'Escaneo', 'Conectividad', 'Consumibles', 'Papel', 'Características físicas', 'Compatibilidad'];
  const PHOTOCOPIER_SPECS = [
    'Formato estándar',
    'Color/B&N',
    'Tecnología',
    'Velocidad de numeración A4',
    'Gramaje mínimo de papel',
    'Gramaje máximo de papel',
  ];

  function renderGalleryDraft() {
    $('#pf-gal-label').textContent = `Fotos adicionales (${galleryDraft.length}/8)`;
    $('#pf-gallery').innerHTML = galleryDraft.map((url, i) => `
      <div class="pm-gal-thumb">
        <img src="${GR.esc(url)}" alt="Foto ${i + 2}">
        <div>
          <button type="button" class="btn btn-sm" data-gal-move="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Mover a la izquierda">←</button>
          <button type="button" class="btn btn-sm" data-gal-move="${i}" data-d="1" ${i === galleryDraft.length - 1 ? 'disabled' : ''} aria-label="Mover a la derecha">→</button>
          <button type="button" class="btn btn-sm pm-danger" data-gal-del="${i}" aria-label="Quitar foto ${i + 2}">✕</button>
        </div>
      </div>`).join('');
    $('#pf-gallery').hidden = !galleryDraft.length;
    $('#pf-gal-add').hidden = galleryDraft.length >= 8;
    $('#pf-gal-file-btn').hidden = galleryDraft.length >= 8;
  }

  function addGalleryUrl() {
    const url = $('#pf-gal-url').value.trim();
    if (!url) return;
    if (/^\s*(javascript|vbscript|data):/i.test(url)) return GR.toast('Usa una URL https:// o una ruta del repositorio.', 'error');
    if (galleryDraft.includes(url)) return GR.toast('Esa foto ya está en la galería.', 'error');
    galleryDraft = [...galleryDraft, url].slice(0, 8);
    $('#pf-gal-url').value = '';
    renderGalleryDraft();
  }

  async function uploadProductImage(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) throw new Error('Elige una imagen JPG, PNG, WebP o GIF.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Cada imagen debe pesar 5 MB o menos.');
    if (!GR.sheetsConfigured || !GR.sheetsConnected) {
      throw new Error('Conecta Google Sheets antes de subir imágenes.');
    }
    if (!sheetsWriteKey) {
      const key = window.prompt('Ingresa la clave privada de Google Sheets para subir la imagen:');
      if (key == null || !key.trim()) throw new Error('Se canceló la subida de la imagen.');
      sheetsWriteKey = key.trim();
    }
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
      reader.readAsDataURL(file);
    });
    try {
      const result = await GR.uploadImageToSheets(sheetsWriteKey, {
        filename: file.name,
        mimeType: file.type,
        base64,
      });
      if (!result.data || !result.data.url) throw new Error('Google Drive no devolvió la URL de la imagen.');
      return result.data.url;
    } catch (error) {
      sheetsWriteKey = '';
      throw error;
    }
  }

  async function withImageUpload(task) {
    if (imageUploading) return;
    imageUploading = true;
    ['#pf-image-file-btn', '#pf-gal-file-btn', '#pf-gal-btn'].forEach((selector) => { $(selector).disabled = true; });
    $('#p-dialog .pm-close').disabled = true;
    document.querySelectorAll('#p-dialog [data-dlg-close]').forEach((button) => { button.disabled = true; });
    $('#p-save').disabled = true;
    try {
      await task();
    } catch (error) {
      GR.toast(`No se pudo subir la imagen: ${error.message}`, 'error');
    } finally {
      imageUploading = false;
      ['#pf-image-file-btn', '#pf-gal-file-btn', '#pf-gal-btn'].forEach((selector) => { $(selector).disabled = false; });
      $('#p-dialog .pm-close').disabled = false;
      document.querySelectorAll('#p-dialog [data-dlg-close]').forEach((button) => { button.disabled = false; });
      $('#p-save').disabled = false;
    }
  }

  function renderSpecsDraft() {
    $('#spec-groups').innerHTML = [...new Set([...SPEC_GROUPS, ...products.flatMap((x) => GR.specsOf(x).map((spec) => spec.grupo))])]
      .filter(Boolean).map((g) => `<option value="${GR.esc(g)}"></option>`).join('');
    $('#pf-specs').innerHTML = specsDraft.map((spec, i) => `
      <div class="pm-spec-row">
        <input class="pm-input" list="spec-groups" placeholder="Grupo (ej. Impresión)" value="${GR.esc(spec.grupo)}" data-spec-i="${i}" data-spec-k="grupo" maxlength="60" aria-label="Grupo de la especificación ${i + 1}">
        <input class="pm-input" placeholder="Característica (ej. Velocidad)" value="${GR.esc(spec.nombre)}" data-spec-i="${i}" data-spec-k="nombre" maxlength="80" aria-label="Característica ${i + 1}">
        <input class="pm-input" placeholder="Valor (ej. 27 ppm)" value="${GR.esc(spec.valor)}" data-spec-i="${i}" data-spec-k="valor" maxlength="300" aria-label="Valor ${i + 1}">
        <div class="pm-spec-actions">
          <button type="button" class="btn btn-sm" data-spec-move="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir especificación ${i + 1}" title="Subir">↑</button>
          <button type="button" class="btn btn-sm" data-spec-move="${i}" data-d="1" ${i === specsDraft.length - 1 ? 'disabled' : ''} aria-label="Bajar especificación ${i + 1}" title="Bajar">↓</button>
          <button type="button" class="btn btn-sm pm-danger" data-spec-del="${i}" aria-label="Quitar especificación ${i + 1}" title="Quitar">✕</button>
        </div>
      </div>`).join('');
    $('#pf-spec-btn').hidden = specsDraft.length >= 40;
  }

  const moveItem = (list, i, d) => { const next = [...list]; [next[i], next[i + d]] = [next[i + d], next[i]]; return next; };

  function updateProductPreview() {
    const f = $('#p-form').elements;
    const precio = Number(f.precio.value);
    const oferta = f.precio_oferta.value === '' ? null : Number(f.precio_oferta.value);
    const valida = oferta != null && oferta > 0 && oferta < precio;
    $('#pf-final').value = precio > 0 ? GR.money(valida ? oferta : precio) : '—';
    $('#pf-final-hint').textContent = valida ? `Descuento de ${Math.round((1 - oferta / precio) * 100)}% sobre ${GR.money(precio)}.`
      : oferta != null && precio > 0 ? 'La oferta debe ser menor al precio de venta.' : 'Se calcula solo.';
    $('#pf-final-hint').classList.toggle('is-warn', oferta != null && precio > 0 && !valida);
    const url = f.imagen.value.trim();
    $('#pf-preview').innerHTML = url ? `<img src="${GR.esc(url)}" alt="Vista previa">` : GR.icon('image', 26);
    const img = $('#pf-preview img');
    if (img) img.addEventListener('error', () => { $('#pf-preview').innerHTML = GR.icon('image', 26); }, { once: true });
  }

  function setProductSaving(busy) {
    const btn = $('#p-save');
    btn.disabled = busy;
    btn.innerHTML = busy ? '<span class="spinner" aria-hidden="true"></span> <span>Guardando…</span>'
      : `${GR.icon('check', 17)} <span>${editing ? 'Guardar cambios' : 'Crear producto'}</span>`;
  }

  async function saveProduct() {
    if (imageUploading) return;
    const f = $('#p-form').elements;
    const err = (m, el) => { setProductSaving(false); $('#p-err').textContent = m; $('#p-err').hidden = false; el?.focus(); };
    const nombre = f.nombre.value.trim();
    const precio = Number(f.precio.value);
    const oferta = f.precio_oferta.value === '' ? null : Number(f.precio_oferta.value);
    const current = editing ? products.find((x) => x.id === editing) : null;
    const stock = current ? current.stock : Number(f.stock.value);
    if (nombre.length < 3) return err('Escribe el nombre del producto.', f.nombre);
    if (!f.categoria.value) return err('Selecciona una categoría para el producto.', f.categoria);
    if (!(precio > 0)) return err('El precio debe ser mayor que 0.', f.precio);
    if (oferta != null && !(oferta > 0 && oferta < precio)) return err('El precio de oferta debe ser menor que el precio normal.', f.precio_oferta);
    if (!Number.isInteger(stock) || stock < 0) return err('El stock debe ser un número entero de 0 o más.', f.stock);
    const sku = f.sku.value.trim();
    if (sku && products.some((x) => x.id !== editing && String(x.sku || '').toLowerCase() === sku.toLowerCase())) return err('Ya hay otro producto con ese SKU.', f.sku);
    const especificaciones = specsDraft
      .map((spec) => ({ grupo: spec.grupo.trim() || 'Información del producto', nombre: spec.nombre.trim().replace(/\s*:+\s*$/, ''), valor: spec.valor.trim() }))
      .filter((spec) => spec.nombre || spec.valor);
    const incompleta = specsDraft.findIndex((spec) => (spec.nombre.trim() || spec.valor.trim()) && !(spec.nombre.trim() && spec.valor.trim()));
    if (incompleta >= 0) {
      const campo = specsDraft[incompleta].nombre.trim() ? 'valor' : 'nombre';
      return err(`Completa la característica y el valor de la especificación ${incompleta + 1} (o quítala).`, $(`[data-spec-i="${incompleta}"][data-spec-k="${campo}"]`));
    }
    const data = {
      nombre, categoria: f.categoria.value, marca: f.marca.value.trim(), precio, precio_oferta: oferta, stock,
      descripcion: f.descripcion.value.trim(), imagen: f.imagen.value.trim(), activo: f.activo.checked,
      sku, imagenes: [...galleryDraft], especificaciones, garantia: f.garantia.value.trim(),
    };
    const wasEditing = Boolean(editing);
    $('#p-err').hidden = true;
    setProductSaving(true);
    const updatedProducts = editing
      ? products.map((p) => (p.id === editing ? { ...p, ...data } : p))
      : [...products, { id: GR.uid('p'), ...data }];
    try {
      await syncCatalog(updatedProducts, GR.CATEGORIAS);
    } catch (error) {
      return err(`No se guardó el producto en Google Sheets: ${error.message}`, f.nombre);
    }
    products = updatedProducts;
    GR.saveProducts(products);
    $('#p-dialog').close();
    GR.toast(wasEditing ? 'Producto actualizado.' : 'Producto creado.');
    renderStats(); renderProducts();
  }

  function exportProducts() {
    const js = `// Catálogo de Grinser exportado el ${new Date().toLocaleString('es-PE')}.\n// Reemplaza js/productos.js del repositorio con este archivo.\nwindow.GRINSER_PRODUCTOS = ${JSON.stringify(products, null, 2)};\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
    a.download = 'productos.js';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportCategories() {
    const js = `// Categorías de Grinser exportadas el ${new Date().toLocaleString('es-PE')}.\n// Reemplaza js/categorias.js del repositorio con este archivo.\nwindow.GRINSER_CATEGORIAS = ${JSON.stringify(GR.CATEGORIAS, null, 2)};\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
    a.download = 'categorias.js';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function updateOrderStatus(id, status) {
    if (!ORDER_STATUSES.includes(status)) return GR.toast('Estado de pedido no válido.', 'error');
    const orders = GR.read('pedidos', []);
    const order = orders.find((item) => item.id === id);
    if (!order) return GR.toast('No se encontró el pedido. Actualiza la lista.', 'error');
    GR.write('pedidos', orders.map((item) => item.id === id ? { ...item, estado: status } : item));
    GR.toast('Estado del pedido actualizado.');
    renderSales();
  }

  function exportSales() {
    const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Pedido', 'Cliente', 'Correo', 'Fecha', 'Estado', 'Total', 'Productos'],
      ...filteredOrders().map((order) => [
        order.id,
        order.nombre || 'Cliente',
        order.email || '',
        new Date(order.fecha).toLocaleString('es-PE'),
        order.estado || 'pendiente',
        Number(order.total || 0).toFixed(2),
        (Array.isArray(order.items) ? order.items : []).map((item) => `${item.nombre} x${item.cantidad}`).join('; '),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(',')).join('\r\n')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ventas-${dateKey(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function openStock(id) {
    stockEditing = products.find((product) => product.id === id);
    if (!stockEditing) return GR.toast('No se encontró el producto.', 'error');
    const form = $('#stock-form');
    form.reset();
    form.elements.cantidad.value = 1;
    $('#stock-title').textContent = 'Movimiento de stock';
    $('#stock-product-name').textContent = `${stockEditing.nombre}${stockEditing.marca ? ` · ${stockEditing.marca}` : ''}`;
    $('#stock-current').textContent = stockEditing.stock;
    $('#stock-err').hidden = true;
    updateStockPreview();
    renderStockHistory(stockEditing.id);
    $('#stock-dialog').showModal();
  }

  function updateStockPreview() {
    if (!stockEditing) return;
    const form = $('#stock-form').elements;
    const type = form.tipo.value;
    const quantity = Number(form.cantidad.value);
    form.cantidad.min = type === 'ajuste' ? '0' : '1';
    if (!Number.isInteger(quantity) || quantity < Number(form.cantidad.min)) {
      $('#stock-after').textContent = '—';
      return;
    }
    const after = type === 'entrada' ? stockEditing.stock + quantity
      : type === 'salida' ? stockEditing.stock - quantity : quantity;
    $('#stock-after').textContent = after >= 0 ? after : '—';
  }

  function renderStockHistory(productId) {
    const storedHistory = GR.read('movimientos_stock', []);
    const history = (Array.isArray(storedHistory) ? storedHistory : []).filter((entry) => entry.productoId === productId)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    $('#stock-history-table').innerHTML = `
      <thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Antes → después</th><th>Motivo</th></tr></thead>
      <tbody>${history.length ? history.map((entry) => `
        <tr><td>${new Date(entry.fecha).toLocaleString('es-PE')}</td><td><span class="movement-tag movement-${entry.tipo}">${GR.esc(entry.tipo)}</span></td>
        <td>${entry.cantidad}</td><td><b>${entry.antes} → ${entry.despues}</b></td><td>${GR.esc(entry.motivo)}</td></tr>`).join('')
        : '<tr><td colspan="5" class="muted center">Todavía no hay movimientos.</td></tr>'}</tbody>`;
  }

  async function saveStockMovement() {
    if (!stockEditing) return;
    const form = $('#stock-form').elements;
    const type = form.tipo.value;
    const quantity = Number(form.cantidad.value);
    const reason = form.motivo.value.trim();
    const min = type === 'ajuste' ? 0 : 1;
    const showError = (message, field) => {
      $('#stock-err').textContent = message;
      $('#stock-err').hidden = false;
      field?.focus();
    };
    if (!Number.isInteger(quantity) || quantity < min) return showError(`Ingresa una cantidad entera de ${min} o más.`, form.cantidad);
    if (reason.length < 2) return showError('Escribe el motivo del movimiento.', form.motivo);
    const before = stockEditing.stock;
    const after = type === 'entrada' ? before + quantity : type === 'salida' ? before - quantity : quantity;
    if (after < 0) return showError('La salida no puede dejar el stock por debajo de cero.', form.cantidad);

    const updatedProducts = products.map((product) => product.id === stockEditing.id ? { ...product, stock: after } : product);
    try {
      await syncCatalog(updatedProducts, GR.CATEGORIAS);
    } catch (error) {
      return showError(`No se guardó el stock en Google Sheets: ${error.message}`, form.cantidad);
    }
    products = updatedProducts;
    GR.saveProducts(products);
    const storedMovements = GR.read('movimientos_stock', []);
    const movements = Array.isArray(storedMovements) ? storedMovements : [];
    movements.push({
      id: GR.uid('mov'), productoId: stockEditing.id, tipo: type, cantidad: quantity,
      antes: before, despues: after, motivo: reason, fecha: new Date().toISOString(),
    });
    GR.write('movimientos_stock', movements);
    $('#stock-dialog').close();
    GR.toast('Movimiento de stock registrado.');
    stockEditing = null;
    renderStats(); renderProducts();
  }

  function renderCategories() {
    if (!$('#c-table')) return;
    $('#c-table').innerHTML = `
      <thead><tr><th>Categoría</th><th>Productos</th><th class="actions"><span class="sr-only">Acciones</span></th></tr></thead>
      <tbody>${GR.CATEGORIAS.length ? GR.CATEGORIAS.map((category) => {
        const count = products.filter((product) => product.categoria === category.id).length;
        return `<tr><td><div class="category-name">${GR.icon(category.icon, 20)}<b>${GR.esc(category.nombre)}</b></div></td>
          <td><span class="pill">${count} producto${count === 1 ? '' : 's'}</span></td>
          <td class="actions">${GR.sheetsConfigured && !GR.sheetsConnected ? '<span class="pill">Sheets sin conexión</span>' : `<button type="button" class="icon-btn" data-category-edit="${GR.esc(category.id)}" aria-label="Editar ${GR.esc(category.nombre)}">${GR.icon('edit', 16)}</button>
            <button type="button" class="icon-btn danger" data-category-delete="${GR.esc(category.id)}" aria-label="Eliminar ${GR.esc(category.nombre)}">${GR.icon('trash', 16)}</button>`}</td></tr>`;
      }).join('') : '<tr><td colspan="3" class="muted center">No hay categorías configuradas.</td></tr>'}</tbody>`;
  }

  function openCategory(id) {
    categoryEditing = id || null;
    const category = GR.CATEGORIAS.find((item) => item.id === id);
    const form = $('#c-form');
    form.reset();
    $('#c-err').hidden = true;
    $('#c-dlg-title').textContent = category ? 'Editar categoría' : 'Nueva categoría';
    form.elements.nombre.value = category?.nombre || '';
    form.elements.icono.value = category?.icon || 'box';
    $('#c-dialog').showModal();
  }

  async function saveCategory() {
    const form = $('#c-form').elements;
    const name = form.nombre.value.trim();
    const icon = form.icono.value;
    const fail = (message) => { $('#c-err').textContent = message; $('#c-err').hidden = false; form.nombre.focus(); };
    if (name.length < 3) return fail('El nombre debe tener al menos 3 caracteres.');
    if (GR.CATEGORIAS.some((item) => item.nombre.toLowerCase() === name.toLowerCase() && item.id !== categoryEditing)) {
      return fail('Ya existe una categoría con ese nombre.');
    }
    let updated;
    if (categoryEditing) {
      updated = GR.CATEGORIAS.map((item) => item.id === categoryEditing ? { ...item, nombre: name, icon } : item);
    } else {
      const id = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!id || GR.CATEGORIAS.some((item) => item.id === id)) return fail('Ese nombre genera un identificador repetido. Prueba otro nombre.');
      updated = [...GR.CATEGORIAS, { id, nombre: name, icon }];
    }
    try {
      await syncCatalog(products, updated);
    } catch (error) {
      return fail(`No se guardó la categoría en Google Sheets: ${error.message}`);
    }
    GR.CATEGORIAS = updated;
    GR.saveCategories(updated);
    $('#c-dialog').close();
    categoryEditing = null;
    refreshCategoryViews();
    GR.toast('Categoría guardada.');
  }

  async function deleteCategory(id) {
    const category = GR.CATEGORIAS.find((item) => item.id === id);
    if (!category) return;
    if (products.some((product) => product.categoria === id)) return GR.toast('No puedes eliminar una categoría que tiene productos asignados.', 'error');
    if (!confirm(`¿Eliminar la categoría «${category.nombre}»?`)) return;
    const updated = GR.CATEGORIAS.filter((item) => item.id !== id);
    try {
      await syncCatalog(products, updated);
    } catch (error) {
      return GR.toast(`No se eliminó la categoría en Google Sheets: ${error.message}`, 'error');
    }
    GR.CATEGORIAS = updated;
    GR.saveCategories(GR.CATEGORIAS);
    refreshCategoryViews();
    GR.toast('Categoría eliminada.');
  }

  function refreshCategoryViews() {
    renderProductCategoryOptions();
    renderCategories(); renderProducts();
  }

  async function deleteProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product || !confirm(`¿Eliminar «${product.nombre}»?`)) return;
    const updatedProducts = products.filter((item) => item.id !== id);
    try {
      await syncCatalog(updatedProducts, GR.CATEGORIAS);
    } catch (error) {
      return GR.toast(`No se eliminó el producto en Google Sheets: ${error.message}`, 'error');
    }
    products = updatedProducts;
    GR.saveProducts(products);
    renderStats(); renderProducts();
    GR.toast('Producto eliminado.');
  }

  // ── Usuarios y roles ───────────────────────────────────────────────────
  // Siempre debe quedar al menos un administrador activo.
  const adminsLeft = (users, exceptId) => users.filter((u) => u.rol === 'admin' && u.activo && u.id !== exceptId).length;

  function renderUsers() {
    const me = GR.currentUser();
    const q = $('#u-q').value.trim().toLowerCase();
    const list = GR.getUsers().filter((u) => !q || `${u.nombre} ${u.email}`.toLowerCase().includes(q));
    $('#u-table').innerHTML = `
      <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Creado</th><th class="actions"><span class="sr-only">Acciones</span></th></tr></thead>
      <tbody>${list.map((u) => {
        const self = u.id === me?.id;
        return `
        <tr>
          <td><div class="t-prod"><span class="avatar sm" aria-hidden="true">${GR.esc(u.nombre.trim()[0].toUpperCase())}</span><span><b>${GR.esc(u.nombre)}${self ? ' <em class="muted">(tú)</em>' : ''}</b><small>${GR.esc(u.email)}</small></span></div></td>
          <td><select data-rol="${u.id}" aria-label="Rol de ${GR.esc(u.nombre)}" ${self ? 'disabled title="No puedes cambiar tu propio rol"' : ''}>
            ${Object.entries(GR.ROLES).map(([k, l]) => `<option value="${k}" ${u.rol === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select></td>
          <td><button type="button" class="pill pill-btn ${u.activo ? 'ok' : ''}" data-toggle="${u.id}" ${self ? 'disabled' : ''} aria-label="${u.activo ? 'Desactivar' : 'Activar'} a ${GR.esc(u.nombre)}">${u.activo ? 'Activo' : 'Inactivo'}</button></td>
          <td>${new Date(u.creado).toLocaleDateString('es-PE')}</td>
          <td class="actions"><button type="button" class="icon-btn danger" data-udel="${u.id}" ${self ? 'disabled' : ''} aria-label="Eliminar a ${GR.esc(u.nombre)}">${GR.icon('trash', 16)}</button></td>
        </tr>`;
      }).join('')}</tbody>`;
  }

  function updateUser(id, change) {
    const users = GR.getUsers();
    const cur = users.find((u) => u.id === id);
    if (!cur) return;
    const losesAdmin = cur.rol === 'admin' && cur.activo && (change === 'delete' || change.rol === 'cliente' || change.activo === false);
    if (losesAdmin && !adminsLeft(users, id)) { GR.toast('Debe quedar al menos un administrador activo.', 'error'); renderUsers(); return; }
    GR.saveUsers(change === 'delete' ? users.filter((u) => u.id !== id) : users.map((u) => (u.id === id ? { ...u, ...change } : u)));
    GR.toast(change === 'delete' ? 'Usuario eliminado.' : 'Usuario actualizado.');
    renderStats(); renderUsers();
  }

  async function createUser() {
    const f = $('#u-form').elements;
    try {
      await GR.createUser({ nombre: f.nombre.value, email: f.email.value, password: f.password.value, rol: f.rol.value });
      $('#u-dialog').close();
      GR.toast('Usuario creado.');
      renderStats(); renderUsers();
    } catch (ex) { $('#u-err').textContent = ex.message; $('#u-err').hidden = false; }
  }

  // ── Eventos ────────────────────────────────────────────────────────────
  function renderEvents() {
    const host = $('#event-list');
    if (!host) return;
    const expanded = new Set([...host.querySelectorAll('[data-event-card][open]')].map((card) => card.dataset.eventCard));
    const active = GR.getActiveEvent();
    const connected = GR.sheetsConfigured && GR.sheetsConnected;
    $('#event-mode').value = GR.EVENT_MODE;
    $('#event-manual').innerHTML = GR.EVENT_DEFINITIONS.map((event) => {
      const enabled = GR.EVENTS.some((setting) => setting.id === event.id && setting.enabled);
      return `<option value="${event.id}" ${enabled ? '' : 'disabled'}>${GR.esc(event.name)}${enabled ? '' : ' (pausado)'}</option>`;
    }).join('');
    $('#event-manual').value = GR.MANUAL_EVENT_ID;
    host.innerHTML = GR.EVENT_DEFINITIONS.map((event) => {
      const setting = GR.EVENTS.find((item) => item.id === event.id);
      const enabled = setting ? setting.enabled : true;
      const status = !enabled ? 'Pausado' : active && active.id === event.id
        ? GR.EVENT_MODE === 'manual' ? 'Mostrándose manual' : 'Activo ahora'
        : GR.EVENT_MODE === 'manual' ? 'No seleccionado' : 'Programado';
      return `
        <details class="event-card" data-event-card="${event.id}" ${expanded.has(event.id) ? 'open' : ''}>
          <summary>
            <span class="event-icon" aria-hidden="true">${GR.esc(event.icon)}</span>
            <span class="event-copy"><b>${GR.esc(event.name)}</b><small>${GR.esc(event.schedule)}</small></span>
            <span class="event-status ${enabled ? '' : 'off'}">${status}</span>
          </summary>
          <div class="event-card-body">
            <p>${GR.esc(event.description)}</p>
            <label class="event-toggle">
              <input type="checkbox" data-event-toggle="${event.id}" ${enabled ? 'checked' : ''} ${connected && !eventSyncing ? '' : 'disabled'}>
              <span><b>Habilitar esta temporada</b><small>Disponible para la activación manual o automática.</small></span>
            </label>
          </div>
        </details>`;
    }).join('');
    updateEventsSourceNote();
  }

  async function saveEventSetting(id, enabled) {
    if (!GR.EVENT_DEFINITIONS.some((event) => event.id === id)) return;
    if (!enabled && GR.EVENT_MODE === 'manual' && GR.MANUAL_EVENT_ID === id) {
      GR.toast('Cambia a automático o selecciona otro evento antes de pausar el que se muestra.', 'error');
      renderEvents();
      return;
    }
    const nextEvents = GR.EVENTS.map((event) => event.id === id ? { ...event, enabled } : { ...event });
    await saveEventConfiguration(nextEvents, GR.EVENT_MODE, GR.MANUAL_EVENT_ID);
  }

  async function saveEventConfiguration(events, mode, manualEventId) {
    if (eventSyncing) { renderEvents(); return; }
    if (!GR.sheetsConfigured || !GR.sheetsConnected) {
      GR.toast('Conecta Google Sheets antes de modificar los eventos.', 'error');
      renderEvents();
      return;
    }
    if (mode === 'manual' && !events.some((event) => event.id === manualEventId && event.enabled)) {
      GR.toast('Habilita el evento que quieres mostrar manualmente.', 'error');
      renderEvents();
      return;
    }
    eventSyncing = true;
    renderEvents();
    try {
      if (!sheetsWriteKey) {
        const key = window.prompt('Ingresa la clave privada de Google Sheets para guardar los eventos:');
        if (key == null || !key.trim()) throw new Error('Se canceló la sincronización.');
        sheetsWriteKey = key.trim();
      }
      await GR.saveEventsToSheets(sheetsWriteKey, { events, mode, manualEventId });
      GR.toast(mode === 'manual' ? 'El evento ya se muestra para todos los visitantes.' : 'Modo automático guardado.');
    } catch (error) {
      sheetsWriteKey = '';
      GR.toast(`No se pudieron guardar los eventos: ${error.message}`, 'error');
    } finally {
      eventSyncing = false;
      renderEvents();
    }
  }

  function showTab(tab) {
    document.querySelectorAll('[data-tab]').forEach((b) => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'); });
    document.querySelectorAll('.tab').forEach((section) => { section.hidden = section.id !== `tab-${tab}`; });
    $('#stats').hidden = tab !== 'productos';
    $('#as-title').textContent = ({ productos: 'Catálogo admin', ventas: 'Ventas', categorias: 'Categorías', eventos: 'Eventos', usuarios: 'Usuarios y roles' })[tab] || 'Panel de empresa';
    if (tab === 'ventas') renderSales();
    if (tab === 'categorias') renderCategories();
    if (tab === 'eventos') renderEvents();
    document.body.classList.remove('menu-open');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await GR.authReady;
    await GR.dataReady;
    if (GR.sheetError) GR.toast('No se pudo cargar Google Sheets; se muestran los datos locales.', 'error');
    catalogRefreshFailed = Boolean(GR.sheetError);
    updateCatalogSourceNote();
    guard();
    window.setInterval(refreshCatalogFromSheets, 15000);
    window.addEventListener('focus', refreshCatalogFromSheets);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshCatalogFromSheets();
    });

    $('#p-q').addEventListener('input', renderProducts);
    $('#event-mode').addEventListener('change', () => {
      saveEventConfiguration(GR.EVENTS, $('#event-mode').value, GR.MANUAL_EVENT_ID);
    });
    $('#event-manual').addEventListener('change', () => {
      saveEventConfiguration(GR.EVENTS, $('#event-mode').value, $('#event-manual').value);
    });
    $('#u-q').addEventListener('input', renderUsers);
    $('#s-client').addEventListener('input', renderSales);
    $('#s-product').addEventListener('input', renderSales);
    $('#s-status').addEventListener('change', renderSales);
    $('#s-from').addEventListener('change', () => { salesPeriod = 'todo'; renderSales(); });
    $('#s-to').addEventListener('change', () => { salesPeriod = 'todo'; renderSales(); });
    document.querySelectorAll('[data-period]').forEach((button) => button.addEventListener('click', () => {
      salesPeriod = button.dataset.period;
      $('#s-from').value = ''; $('#s-to').value = '';
      renderSales();
    }));
    $('#s-clear').addEventListener('click', () => {
      $('#s-client').value = ''; $('#s-product').value = ''; $('#s-status').value = '';
      $('#s-from').value = ''; $('#s-to').value = ''; salesPeriod = 'todo'; renderSales();
    });
    $('#s-refresh').addEventListener('click', () => { products = GR.getProducts(); renderSales(); renderStats(); renderProducts(); });
    $('#s-export').addEventListener('click', exportSales);
    $('#p-new').addEventListener('click', () => openProduct(null));
    $('#u-new').addEventListener('click', () => { $('#u-form').reset(); $('#u-err').hidden = true; $('#u-dialog').showModal(); });
    $('#c-new').addEventListener('click', () => openCategory(null));
    $('#p-export').addEventListener('click', exportProducts);
    $('#c-export').addEventListener('click', exportCategories);
    $('#p-reset').addEventListener('click', () => {
      if (!confirm('¿Restablecer el catálogo al de js/productos.js? Se perderán los cambios hechos en este navegador.')) return;
      GR.resetProducts(); products = GR.getProducts(); renderStats(); renderProducts(); GR.toast('Catálogo restablecido.');
    });
    $('#p-form').addEventListener('submit', (e) => { e.preventDefault(); if (!$('#p-save').disabled) saveProduct(); });
    $('#p-cat').addEventListener('change', () => {
      if (editing || $('#p-cat').value !== 'fotocopiadoras') return;
      const existing = new Set(specsDraft.map((spec) => spec.nombre.trim().toLocaleLowerCase('es')));
      const additions = PHOTOCOPIER_SPECS
        .filter((name) => !existing.has(name.toLocaleLowerCase('es')))
        .map((nombre) => ({ grupo: 'Información del producto', nombre, valor: '' }));
      if (!additions.length) return;
      specsDraft = [...specsDraft, ...additions];
      renderSpecsDraft();
    });
    $('#pf-gal-btn').addEventListener('click', addGalleryUrl);
    $('#pf-gal-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addGalleryUrl(); } });
    $('#pf-image-file-btn').addEventListener('click', () => $('#pf-image-file').click());
    $('#pf-image-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      withImageUpload(async () => {
        const url = await uploadProductImage(file);
        $('#p-form').elements.imagen.value = url;
        updateProductPreview();
        GR.toast('Imagen principal subida.');
      });
      e.target.value = '';
    });
    $('#pf-gal-file-btn').addEventListener('click', () => $('#pf-gal-files').click());
    $('#pf-gal-files').addEventListener('change', (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      withImageUpload(async () => {
        const available = 8 - galleryDraft.length;
        if (files.length > available) GR.toast(`Solo puedes agregar ${available} imagen(es) más a la galería.`, 'error');
        for (const file of files.slice(0, available)) {
          const url = await uploadProductImage(file);
          if (!galleryDraft.includes(url)) {
            galleryDraft = [...galleryDraft, url];
            renderGalleryDraft();
          }
        }
      });
    });
    $('#pf-spec-btn').addEventListener('click', () => {
      specsDraft = [...specsDraft, { grupo: specsDraft.at(-1)?.grupo || 'Información del producto', nombre: '', valor: '' }];
      renderSpecsDraft();
      $(`[data-spec-i="${specsDraft.length - 1}"][data-spec-k="nombre"]`).focus();
    });
    $('#pf-specs').addEventListener('input', (e) => {
      const i = Number(e.target.dataset.specI);
      if (Number.isInteger(i) && specsDraft[i]) specsDraft[i][e.target.dataset.specK] = e.target.value;
    });
    $('#p-dialog').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.galMove) { galleryDraft = moveItem(galleryDraft, Number(b.dataset.galMove), Number(b.dataset.d)); renderGalleryDraft(); }
      if (b.dataset.galDel) { galleryDraft = galleryDraft.filter((_, k) => k !== Number(b.dataset.galDel)); renderGalleryDraft(); }
      if (b.dataset.specMove) { specsDraft = moveItem(specsDraft, Number(b.dataset.specMove), Number(b.dataset.d)); renderSpecsDraft(); }
      if (b.dataset.specDel) { specsDraft = specsDraft.filter((_, k) => k !== Number(b.dataset.specDel)); renderSpecsDraft(); }
    });
    $('#p-dialog').addEventListener('cancel', (e) => { if (imageUploading) e.preventDefault(); });
    $('#p-form').addEventListener('input', (e) => { if (['precio', 'precio_oferta', 'imagen'].includes(e.target.name)) updateProductPreview(); });
    $('#u-form').addEventListener('submit', (e) => { e.preventDefault(); createUser(); });
    $('#c-form').addEventListener('submit', (e) => { e.preventDefault(); saveCategory(); });
    $('#stock-form').addEventListener('submit', (e) => { e.preventDefault(); saveStockMovement(); });
    $('#stock-form').addEventListener('input', updateStockPreview);
    $('#stock-form').addEventListener('change', updateStockPreview);

    document.addEventListener('click', (e) => {
      const t = e.target.closest('button, [data-menu-close]');
      if (!t) return;
      if (t.dataset.tab) showTab(t.dataset.tab);
      if (t.dataset.stock) openStock(t.dataset.stock);
      if (t.dataset.edit) openProduct(t.dataset.edit);
      if (t.dataset.categoryEdit) openCategory(t.dataset.categoryEdit);
      if (t.dataset.categoryDelete) deleteCategory(t.dataset.categoryDelete);
      if (t.dataset.orderToggle) {
        const detail = document.getElementById(`order-detail-${t.dataset.orderToggle}`);
        if (detail) {
          detail.hidden = !detail.hidden;
          document.querySelectorAll('#s-table [data-order-toggle]').forEach((button) => {
            if (button.dataset.orderToggle === t.dataset.orderToggle) button.setAttribute('aria-expanded', !detail.hidden);
          });
        }
      }
      if (t.dataset.del) deleteProduct(t.dataset.del);
      if (t.dataset.toggle) { const u = GR.getUsers().find((x) => x.id === t.dataset.toggle); if (u) updateUser(u.id, { activo: !u.activo }); }
      if (t.dataset.udel) { const u = GR.getUsers().find((x) => x.id === t.dataset.udel); if (u && confirm(`¿Eliminar la cuenta de ${u.nombre}?`)) updateUser(u.id, 'delete'); }
      if (t.hasAttribute('data-dlg-close')) t.closest('dialog').close();
      if (t.hasAttribute('data-menu')) document.body.classList.toggle('menu-open');
      if (t.hasAttribute('data-menu-close')) document.body.classList.remove('menu-open');
      if (t.hasAttribute('data-login')) GR.openAuth('login', { modo: 'empresa', onSuccess: guard });
      if (t.hasAttribute('data-logout')) { GR.logout(); location.href = 'index.html'; }
    });
    document.addEventListener('change', (e) => {
      if (e.target.dataset.eventToggle) saveEventSetting(e.target.dataset.eventToggle, e.target.checked);
      if (e.target.dataset.rol) updateUser(e.target.dataset.rol, { rol: e.target.value });
      if (e.target.dataset.orderStatus) updateOrderStatus(e.target.dataset.orderStatus, e.target.value);
    });
    // Si la sesión cambia en otra pestaña, se vuelve a validar el acceso.
    window.addEventListener('storage', () => {
      const categories = GR.read('categorias', null);
      if (!GR.sheetsConnected && Array.isArray(categories)) GR.CATEGORIAS = categories;
      if (guard()) {
        renderAll();
      }
    });
  });
})();
