'use strict';
// Grinser · utilidades comunes: almacenamiento local, formato, íconos y avisos.
// Todo se guarda en el navegador (localStorage): no hay servidor.
(function () {
  const GR = (window.GR = window.GR || {});
  const PREFIX = 'grinser_';
  const isHtmlPage = () => /\/paginas_html\//i.test(location.pathname);
  GR.appPath = (path) => `${isHtmlPage() ? '../' : ''}${path}`;
  GR.pagePath = (page) => `${isHtmlPage() ? '' : 'paginas_html/'}${page}`;
  GR.assetPath = (path) => {
    const source = String(path || '');
    if (/^https?:\/\/drive\.google\.com\//i.test(source)) {
      const fileId = source.match(/[?&]id=([^&#]+)/i)?.[1] || source.match(/\/file\/d\/([^/?#]+)/i)?.[1];
      if (fileId) return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1200`;
    }
    return (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(source) || !isHtmlPage()) ? source : `../${source}`;
  };

  GR.read = (k, d) => {
    try { const v = JSON.parse(localStorage.getItem(PREFIX + k)); return v ?? d; } catch { return d; }
  };
  GR.write = (k, v) => {
    try { if (v == null) localStorage.removeItem(PREFIX + k); else localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch {}
  };
  GR.uid = (p = 'id') => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  GR.money = (n) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  GR.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── Catálogo ───────────────────────────────────────────────────────────
  const DEFAULT_CATEGORIAS = window.GRINSER_CATEGORIAS || [
    { id: 'fotocopiadoras', nombre: 'Fotocopiadoras', icon: 'copier' },
    { id: 'toner', nombre: 'Tóner y recargas', icon: 'drop' },
    { id: 'repuestos', nombre: 'Repuestos', icon: 'wrench' },
    { id: 'plotter', nombre: 'Plotter', icon: 'printer' },
    { id: 'papeleria', nombre: 'Papel y accesorios', icon: 'file' },
  ];
  const storedCategories = GR.read('categorias', null);
  GR.CATEGORIAS = Array.isArray(storedCategories) ? storedCategories : DEFAULT_CATEGORIAS;
  GR.saveCategories = (categories) => GR.write('categorias', categories);
  const EVENT_DEFINITIONS = [
    { id: 'navidad', name: 'Navidad', schedule: '24 y 25 de diciembre', icon: '🎄', dates: [[12, 24], [12, 25]], banner: '¡Feliz Navidad!', description: 'Gorro navideño en el logo y copos de nieve en la tienda.' },
    { id: 'ano_nuevo', name: 'Año Nuevo', schedule: '31 de diciembre y 1 de enero', icon: '🎆', dates: [[12, 31], [1, 1]], banner: '¡PRÓSPERO AÑO NUEVO!', description: 'Fuegos artificiales animados y un saludo especial en la tienda.' },
    { id: 'fiestas_patrias', name: 'Fiestas Patrias', schedule: '28 y 29 de julio', icon: '🇵🇪', dates: [[7, 28], [7, 29]], banner: '¡Felices Fiestas Patrias!', description: 'Escarapela rojiblanca en el logo.' },
  ];
  const DEFAULT_EVENTS = EVENT_DEFINITIONS.map(({ id }) => ({ id, enabled: true }));
  const DEFAULT_EVENT_MODE = 'automatic';
  const DEFAULT_MANUAL_EVENT = 'navidad';
  GR.EVENT_DEFINITIONS = EVENT_DEFINITIONS;
  GR.EVENTS = DEFAULT_EVENTS.map((event) => ({ ...event }));
  GR.EVENT_MODE = DEFAULT_EVENT_MODE;
  GR.MANUAL_EVENT_ID = DEFAULT_MANUAL_EVENT;
  GR.getActiveEvent = (date = new Date()) => {
    if (GR.EVENT_MODE === 'manual') {
      return EVENT_DEFINITIONS.find((event) =>
        event.id === GR.MANUAL_EVENT_ID && GR.EVENTS.some((setting) => setting.id === event.id && setting.enabled),
      ) || null;
    }
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const month = Number(parts.find((part) => part.type === 'month').value);
    const day = Number(parts.find((part) => part.type === 'day').value);
    return EVENT_DEFINITIONS.find((event) =>
      GR.EVENTS.some((setting) => setting.id === event.id && setting.enabled) &&
      event.dates.some(([eventMonth, eventDay]) => eventMonth === month && eventDay === day),
    ) || null;
  };
  const sheetsUrl = String(window.GRINSER_SHEETS_URL || '').trim();
  let sheetProducts = null;
  GR.sheetsConfigured = Boolean(sheetsUrl);
  GR.sheetsConnected = false;
  GR.sheetError = null;
  GR.dataReady = Promise.resolve(false);

  function normalizeEvents(events) {
    if (events == null) events = GR.EVENTS;
    if (!Array.isArray(events)) throw new Error('Google Sheets devolvió una configuración de eventos inválida.');
    const settings = new Map();
    events.forEach((event) => {
      if (!event || typeof event.id !== 'string' ||
          !EVENT_DEFINITIONS.some((definition) => definition.id === event.id) ||
          typeof event.enabled !== 'boolean' || settings.has(event.id)) {
        throw new Error('Google Sheets devolvió una configuración de eventos inválida.');
      }
      settings.set(event.id, event.enabled);
    });
    return EVENT_DEFINITIONS.map(({ id }) => ({
      id,
      enabled: settings.has(id) ? settings.get(id) : true,
    }));
  }

  function normalizeEventMode(mode) {
    if (mode == null) return GR.EVENT_MODE || DEFAULT_EVENT_MODE;
    if (mode !== 'automatic' && mode !== 'manual') {
      throw new Error('Google Sheets devolvió un modo de evento inválido.');
    }
    return mode;
  }

  function normalizeManualEventId(id) {
    if (id == null) id = GR.MANUAL_EVENT_ID || DEFAULT_MANUAL_EVENT;
    if (typeof id !== 'string' || !EVENT_DEFINITIONS.some((event) => event.id === id)) {
      throw new Error('Google Sheets devolvió un evento manual inválido.');
    }
    return id;
  }

  // ── Ficha del producto: fotos adicionales y especificaciones ─────────────
  // En Sheets se guardan como JSON; un producto sin estos datos devuelve listas vacías.
  const toList = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  GR.imagesOf = (product) => toList(product && product.imagenes)
    .map((url) => String(url || '').trim()).filter(Boolean).slice(0, 8);
  GR.specsOf = (product) => toList(product && product.especificaciones)
    .map((spec) => ({
      grupo: String(spec && spec.grupo || '').trim(),
      nombre: String(spec && spec.nombre || '').trim().replace(/\s*:+\s*$/, ''),
      valor: String(spec && spec.valor || '').trim(),
    }))
    .filter((spec) => spec.nombre && spec.valor).slice(0, 40);

  function normalizeCatalog(payload) {
    if (!payload || payload.ok === false || !Array.isArray(payload.products) || !Array.isArray(payload.categories)) {
      throw new Error('Google Sheets devolvió un catálogo con formato inválido.');
    }
    const categories = payload.categories.filter((category) => category && category.id && category.nombre)
      .map((category) => ({ id: String(category.id), nombre: String(category.nombre), icon: String(category.icon || 'box') }));
    const products = payload.products.filter((product) => product && product.id && product.nombre && product.categoria)
      .map((product) => ({
        ...product,
        id: String(product.id),
        nombre: String(product.nombre),
        categoria: String(product.categoria),
        marca: String(product.marca || ''),
        precio: Number(product.precio) || 0,
        precio_oferta: product.precio_oferta == null || product.precio_oferta === '' ? null : Number(product.precio_oferta),
        stock: Number(product.stock) || 0,
        descripcion: String(product.descripcion || ''),
        imagen: String(product.imagen || ''),
        activo: product.activo === true || String(product.activo).toLowerCase() === 'true',
        sku: String(product.sku || ''),
        imagenes: GR.imagesOf(product),
        especificaciones: GR.specsOf(product),
        garantia: String(product.garantia || ''),
      }));
    if (!categories.length) throw new Error('Google Sheets no contiene categorías válidas.');
    return {
      categories,
      products,
      events: normalizeEvents(payload.events),
      eventMode: normalizeEventMode(payload.eventMode),
      manualEventId: normalizeManualEventId(payload.manualEventId),
    };
  }

  function catalogSignature(catalog, includeCatalog = true, includeEvents = true) {
    const signature = [];
    if (includeCatalog) signature.push(
      catalog.categories.map((category) => [category.id, category.nombre, category.icon]),
      catalog.products.map((product) => [
        product.id, product.nombre, product.categoria, product.marca, product.precio,
        product.precio_oferta, product.stock, product.descripcion, product.imagen, product.activo,
        product.sku || '', GR.imagesOf(product), GR.specsOf(product), product.garantia || '',
      ]),
    );
    if (includeEvents) signature.push(
      catalog.events.map((event) => [event.id, event.enabled]),
      catalog.eventMode,
      catalog.manualEventId,
    );
    return JSON.stringify(signature);
  }

  function applyCatalogSnapshot(payload) {
    const catalog = normalizeCatalog(payload);
    const previous = sheetProducts ? catalogSignature({
      categories: GR.CATEGORIAS,
      products: sheetProducts,
      events: GR.EVENTS,
      eventMode: GR.EVENT_MODE,
      manualEventId: GR.MANUAL_EVENT_ID,
    }) : null;
    GR.CATEGORIAS = catalog.categories;
    sheetProducts = catalog.products;
    GR.EVENTS = catalog.events;
    GR.EVENT_MODE = catalog.eventMode;
    GR.MANUAL_EVENT_ID = catalog.manualEventId;
    GR.sheetsConnected = true;
    GR.sheetError = null;
    return previous !== catalogSignature(catalog);
  }

  function fetchSheetCatalog() {
    return new Promise((resolve, reject) => {
      const callbackName = `__grinserSheets_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => finish(new Error('Se agotó el tiempo de espera al cargar Google Sheets.')), 12000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      };
      const finish = (error, payload) => {
        cleanup();
        if (error) return reject(error);
        try { resolve(applyCatalogSnapshot(payload)); } catch (validationError) { reject(validationError); }
      };
      window[callbackName] = (payload) => finish(null, payload);
      script.onerror = () => finish(new Error('No se pudo conectar con Google Sheets.'));
      const separator = sheetsUrl.includes('?') ? '&' : '?';
      script.src = `${sheetsUrl}${separator}action=catalog&callback=${callbackName}`;
      document.head.appendChild(script);
    });
  }

  if (sheetsUrl) {
    GR.dataReady = fetchSheetCatalog().catch((error) => {
      GR.sheetError = error;
      return false;
    });
  }
  GR.refreshCatalog = () => sheetsUrl ? fetchSheetCatalog() : Promise.resolve(false);
  GR.applyCatalogSnapshot = applyCatalogSnapshot;

  const catalogChannel = sheetsUrl && 'BroadcastChannel' in window
    ? new BroadcastChannel('grinser-catalog')
    : null;
  GR.subscribeCatalogUpdates = (handler) => {
    if (!catalogChannel) return () => {};
    const listener = (event) => {
      if (!event.data || event.data.type !== 'catalog-updated') return;
      try {
        if (applyCatalogSnapshot(event.data.catalog)) handler();
      } catch (error) {
        GR.toast(`No se pudo aplicar la actualización del catálogo: ${error.message}`, 'error');
      }
    };
    catalogChannel.addEventListener('message', listener);
    return () => catalogChannel.removeEventListener('message', listener);
  };
  GR.publishCatalogUpdate = (catalog) => {
    if (catalogChannel) catalogChannel.postMessage({ type: 'catalog-updated', catalog });
  };

  function postToSheets(fields, expectedCatalog, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      if (!sheetsUrl) return reject(new Error('Falta configurar la URL de Google Sheets.'));
      const expectedState = expectedCatalog ? normalizeCatalog(expectedCatalog) : null;
      const expectedSignature = expectedState
        ? catalogSignature(expectedState, fields.action !== 'save-events', fields.action !== 'save-catalog')
        : null;
      const bytes = new Uint8Array(16);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
      else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
      const nonce = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const frame = document.createElement('iframe');
      const form = document.createElement('form');
      const frameName = `grinser-sheets-${nonce}`;
      frame.name = frameName;
      frame.title = 'Sincronización con Google Sheets';
      frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;bottom:0;border:0;opacity:0';
      form.method = 'post';
      form.action = sheetsUrl;
      form.target = frameName;
      form.acceptCharset = 'UTF-8';
      const addField = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };
      addField('nonce', nonce);
      Object.entries(fields).forEach(([name, value]) => addField(name, String(value ?? '')));
      let settled = false;
      let verificationTimer = null;
      let timeoutTimer = null;
      let lastVerificationError = null;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutTimer);
        window.clearTimeout(verificationTimer);
        window.removeEventListener('message', onMessage);
        form.remove();
        frame.remove();
        if (error) reject(error);
        else resolve(result);
      };
      const verifyCatalog = async () => {
        if (settled || !expectedSignature) return;
        try {
          await fetchSheetCatalog();
          if (settled) return;
          if (catalogSignature({
            categories: GR.CATEGORIAS,
            products: sheetProducts,
            events: GR.EVENTS,
            eventMode: GR.EVENT_MODE,
            manualEventId: GR.MANUAL_EVENT_ID,
          }, fields.action !== 'save-events', fields.action !== 'save-catalog') === expectedSignature) {
            finish(null, { ok: true, message: 'Catálogo verificado en Google Sheets.' });
            return;
          }
        } catch (error) {
          if (settled) return;
          lastVerificationError = error;
        }
        verificationTimer = window.setTimeout(verifyCatalog, 1500);
      };
      const onMessage = (event) => {
        const result = event.data;
        let source = event.source;
        let fromResponseFrame = false;
        for (let depth = 0; source && depth < 8; depth += 1) {
          if (source === frame.contentWindow) {
            fromResponseFrame = true;
            break;
          }
          source = source.parent;
        }
        if (!fromResponseFrame || !result || result.source !== 'grinser-sheets' || result.nonce !== nonce) return;
        if (!result.ok) return finish(new Error(result.message || 'No se pudo guardar en Google Sheets.'));
        finish(null, result);
      };
      timeoutTimer = window.setTimeout(() => {
        if (expectedSignature) {
          const message = lastVerificationError
            ? `No se pudo verificar el catálogo en Google Sheets: ${lastVerificationError.message}`
            : 'Google Sheets no reflejó el catálogo guardado. Verifica la conexión y vuelve a intentarlo.';
          finish(new Error(message));
        }
        else finish(new Error(fields.action === 'culqi-charge'
          ? 'No recibimos la confirmación del pago. Antes de volver a intentar, escríbenos por WhatsApp para verificar si se realizó el cobro.'
          : 'No se recibió confirmación de Google Sheets. Inténtalo nuevamente.'));
      }, timeoutMs);
      window.addEventListener('message', onMessage);
      document.body.append(frame, form);
      form.submit();
      if (expectedSignature) verificationTimer = window.setTimeout(verifyCatalog, 1500);
    });
  }

  /**
   * Cobra con Culqi desde Apps Script (la llave secreta solo vive allí).
   * Devuelve { pedido, cargo, total, metodo, items } si el banco aprobó el pago.
   */
  GR.chargeWithCulqi = async ({ token = '', culqiOrder = '', pedidoId = '', email, total, pedido }) => {
    const result = await postToSheets({
      action: 'culqi-charge', token, culqiOrder, pedidoId, email, total: Number(total).toFixed(2), pedido: JSON.stringify(pedido),
    }, null, 45000);
    return result.data || {};
  };

  /** Crea la orden de Culqi en Apps Script (sin orden, el checkout de Culqi solo muestra tarjeta). */
  GR.createCulqiOrder = async ({ email, total, pedido }) => {
    const result = await postToSheets({
      action: 'culqi-order', email, total: Number(total).toFixed(2), pedido: JSON.stringify(pedido),
    }, null, 30000);
    return result.data || {};
  };

  GR.saveClientToSheets = ({ nombre, email, telefono = '' }) => postToSheets({
    action: 'register-client', nombre, email, telefono, website: '',
  });

  GR.getUserSaltFromSheets = (email) => postToSheets({
    action: 'user-auth-challenge', email,
  });

  GR.registerUserToSheets = ({ nombre, email, telefono = '', passwordSalt, passwordHash }) => postToSheets({
    action: 'register-user', nombre, email, telefono, passwordSalt, passwordHash,
  });

  GR.loginUserFromSheets = ({ email, passwordSalt, passwordHash }) => postToSheets({
    action: 'login-user', email, passwordSalt, passwordHash,
  });

  GR.listUsersFromSheets = (adminKey) => postToSheets({ action: 'list-users', adminKey });

  GR.createUserInSheets = (adminKey, user) => postToSheets({
    action: 'admin-create-user',
    adminKey,
    nombre: user.nombre,
    email: user.email,
    telefono: user.telefono || '',
    rol: user.rol,
    passwordSalt: user.passwordSalt,
    passwordHash: user.passwordHash,
  });

  GR.updateUserInSheets = (adminKey, id, change) => postToSheets({
    action: 'update-user', adminKey, id, change: JSON.stringify(change),
  });

  GR.saveCatalogToSheets = async (adminKey, catalog) => {
    await postToSheets({ action: 'save-catalog', adminKey, catalog: JSON.stringify(catalog) }, catalog);
    sheetProducts = catalog.products.map((product) => ({ ...product }));
    GR.CATEGORIAS = catalog.categories.map((category) => ({ ...category }));
    GR.publishCatalogUpdate({
      products: sheetProducts,
      categories: GR.CATEGORIAS,
      events: GR.EVENTS,
      eventMode: GR.EVENT_MODE,
      manualEventId: GR.MANUAL_EVENT_ID,
    });
  };

  GR.uploadImageToSheets = (adminKey, { filename, mimeType, base64 }) => postToSheets({
    action: 'upload-image', adminKey, filename, mimeType, base64,
  }, null, 45000);

  GR.saveEventsToSheets = async (adminKey, configuration) => {
    const snapshot = normalizeCatalog({
      products: GR.getProducts(),
      categories: GR.CATEGORIAS,
      events: configuration.events,
      eventMode: configuration.mode,
      manualEventId: configuration.manualEventId,
    });
    await postToSheets({
      action: 'save-events',
      adminKey,
      events: JSON.stringify({
        events: snapshot.events,
        mode: snapshot.eventMode,
        manualEventId: snapshot.manualEventId,
      }),
    }, snapshot);
    GR.EVENTS = snapshot.events;
    GR.EVENT_MODE = snapshot.eventMode;
    GR.MANUAL_EVENT_ID = snapshot.manualEventId;
    GR.publishCatalogUpdate({
      products: GR.getProducts(),
      categories: GR.CATEGORIAS,
      events: GR.EVENTS,
      eventMode: GR.EVENT_MODE,
      manualEventId: GR.MANUAL_EVENT_ID,
    });
  };

  GR.cat = (id) => GR.CATEGORIAS.find((c) => c.id === id)
    || (id === 'impresoras' ? { id, nombre: 'Equipos de impresión', icon: 'printer' } : { id, nombre: id || 'Sin categoría', icon: 'box' });
  GR.precioFinal = (p) => (p.precio_oferta && p.precio_oferta < p.precio ? p.precio_oferta : p.precio);
  GR.enOferta = (p) => GR.precioFinal(p) < p.precio;

  // Con Sheets conectado el catálogo remoto prevalece; en modo local se usa el catálogo del navegador.
  GR.getProducts = () => sheetProducts ? sheetProducts.map((p) => ({ ...p }))
    : GR.read('productos', null) || (window.GRINSER_PRODUCTOS || []).map((p) => ({ ...p }));
  GR.saveProducts = (list) => GR.write('productos', list);
  GR.resetProducts = () => GR.write('productos', null);

  // ── Íconos (trazos de 24×24) ────────────────────────────────────────────
  const P = {
    printer: '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
    copier: '<path d="M3 11h18v9H3z"/><path d="M6 11V7h9l3 4"/><path d="M7 15h5M16 15h1"/><path d="M8 7V4h6"/>',
    drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    store: '<path d="M3 9l2-5h14l2 5"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bank: '<path d="M3 10h18L12 4z"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20a3 3 0 0 1-3 2h-3"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    handshake: '<path d="m11 17 2 2a1.4 1.4 0 0 0 2-2"/><path d="m14 14 2.5 2.5a1.4 1.4 0 0 0 2-2l-3-3"/><path d="m3 11 5-5 4 2 3-1 6 5-2.5 2.5"/><path d="M3 11l2 2M8 6l-2 7 4 4"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-left': '<path d="m15 6-6 6 6 6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  };
  GR.icon = (name, size = 20) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || P.box}</svg>`;

  // Logo de WhatsApp (relleno).
  GR.waIcon = (size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.88 9.88 0 0 1 9.88 9.9c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.9 0-3.17-1.24-6.16-3.48-8.4Z"/></svg>`;

  // Datos de contacto de la empresa.
  GR.EMPRESA = {
    whatsapp: '51986385044',
    telefono: '(51) 986 385 044',
    correo: 'ventas@grinser.com.pe',
    direccion: 'Jirón Lampa Nro. 960 Interior 104, Lima - Perú',
  };
  // Tiendas. Para agregar la foto de una tienda, súbela a img/ y escribe la ruta en «foto».
  GR.TIENDAS = [
    {
      nombre: 'Tienda Jr. Lampa',
      etiqueta: 'Tienda principal',
      direccion: 'Jr. Lampa 960, Interior 104',
      referencia: 'Cercado de Lima',
      foto: 'img/tienda-jr-lampa.png',
      mapa: 'Jr. Lampa 960, Lima 15001',
      telefono: '986 385 044',
    },
    {
      nombre: 'Tienda Av. Bolivia',
      direccion: 'Av. Bolivia 166',
      referencia: 'Cercado de Lima',
      foto: 'img/tienda-av-bolivia.png',
      mapa: 'Av. Bolivia 166, Lima',
      telefono: '986 385 044',
    },
  ];

  GR.waLink =(texto = 'Hola Grinser, quisiera información sobre sus productos.') => `https://wa.me/${GR.EMPRESA.whatsapp}?text=${encodeURIComponent(texto)}`;

  // Reemplaza <i data-icon="cart" data-size="18"></i> por el SVG.
  GR.paintIcons = (root = document) => {
    root.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = GR.icon(el.dataset.icon, Number(el.dataset.size) || 20); });
  };

  // ── Avisos (toast) ─────────────────────────────────────────────────────
  let toastTimer;
  GR.toast = (message, type = 'ok') => {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.className = `toast show ${type === 'error' ? 'is-error' : ''}`;
    el.innerHTML = `${GR.icon(type === 'error' ? 'x' : 'check', 18)}<span>${GR.esc(message)}</span>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  };

  document.addEventListener('DOMContentLoaded', () => GR.paintIcons());
})();
