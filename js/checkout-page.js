'use strict';
// Grinser · checkout (mismo diseño que el de Novatech): Datos → Pago → Confirmación.
// El único método de pago es Culqi (Checkout Custom: tarjeta y Yape).
(function () {
  const GR = window.GR;
  const $ = (s) => document.querySelector(s);
  const root = $('#co-root');
  const CULQI = window.GRINSER_CULQI || {};
  const CULQI_SCRIPT = 'https://js.culqi.com/checkout-js';

  const STEPS = ['Datos', 'Pago', 'Confirmación'];
  const digits = (s, max) => String(s || '').replace(/\D/g, '').slice(0, max);
  const onlyWords = (v) => String(v || '').replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]/g, '').replace(/\s{2,}/g, ' ').slice(0, 120);
  const NAME_RE = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;

  let user = null;
  let step = 1;
  let busy = false;
  let err = '';
  let errors = {};
  let done = null;      // pedido creado
  let editingAddr = null; // id de la dirección que se edita (null = nueva)
  const f = { addr: '', nombre: '', dni: '', telefono: '', tipo_comprobante: 'boleta', ruc: '', razon_social: '', notas: '' };

  // ── Direcciones guardadas (en este navegador, por usuario) ─────────────
  const addrKey = () => `direcciones_${user.id}`;
  const getAddrs = () => GR.read(addrKey(), []);
  const saveAddrs = (list) => GR.write(addrKey(), list);

  // ── Pasos y resumen ────────────────────────────────────────────────────
  function stepper() {
    return `<ol class="co-steps" aria-label="Pasos de la compra">${STEPS.map((s, k) => {
      const n = k + 1;
      const state = n < step ? 'done' : n === step ? 'on' : '';
      const canGo = n < step && step < 3;
      return `<li class="${state}" ${n === step ? 'aria-current="step"' : ''}>
        <button type="button" ${canGo ? `data-go-step="${n}"` : 'disabled'}>
          <span class="co-dot">${n < step ? GR.icon('check', 16) : n}</span><span class="co-step-label">${s}</span>
        </button></li>`;
    }).join('')}</ol>`;
  }

  function summary(items, subtotal) {
    const igv = subtotal - subtotal / 1.18; // los precios incluyen IGV (18 %)
    return `
      <aside class="ck-card co-sum" aria-labelledby="co-sum-title">
        <h2 id="co-sum-title">Resumen del pedido</h2>
        <ul class="co-items">${items.map((i) => `
          <li>
            <span class="co-thumb">${i.imagen ? `<img src="${GR.esc(i.imagen)}" alt="">` : GR.icon('box', 22)}<b>${i.cantidad}</b></span>
            <span class="co-item-name">${GR.esc(i.nombre)}${i.cantidad > 1 ? `<small>${GR.money(i.precio)} c/u</small>` : ''}</span>
            <strong>${GR.money(i.precio * i.cantidad)}</strong>
          </li>`).join('')}</ul>
        <div class="co-row"><span>Subtotal (sin IGV)</span><span>${GR.money(subtotal - igv)}</span></div>
        <div class="co-row"><span>IGV (18 %)</span><span>${GR.money(igv)}</span></div>
        <div class="co-row"><span>Envío</span><span><small class="muted">Por coordinar</small></span></div>
        <div class="co-total"><span>Total</span><strong>${GR.money(subtotal)}</strong></div>
        <ul class="co-trust">
          <li>${GR.icon('shield', 16)} Pago seguro con Culqi</li>
          <li>${GR.icon('truck', 16)} Envío a domicilio a todo el Perú</li>
        </ul>
      </aside>`;
  }

  const field = (label, req, key, control, extra = '') => `
    <label class="co-field ${errors[key] ? 'bad' : ''} ${extra}">
      <span>${label}${req ? '<i aria-hidden="true"> *</i>' : ''}</span>
      ${control}
      ${errors[key] ? `<small role="alert">${GR.esc(errors[key])}</small>` : ''}
    </label>`;

  // ── Paso 1: datos y dirección ──────────────────────────────────────────
  function stepDatos() {
    const addrs = getAddrs();
    return `
      <form id="co-form-datos" novalidate>
        <h1 class="co-title">Datos de envío</h1>
        <fieldset class="co-sec">
          <legend>Datos del cliente</legend>
          <div class="co-grid g2">
            ${field('Correo electrónico', false, 'email', `<input class="co-input" value="${GR.esc(user.email)}" readonly title="Es el correo de tu cuenta: ahí te enviamos la confirmación.">`)}
            ${field('Nombre completo', true, 'nombre', `<input id="co-nombre" class="co-input" data-f="nombre" value="${GR.esc(f.nombre)}" placeholder="" autocomplete="name" maxlength="120">`)}
            ${field('DNI', true, 'dni', `<input id="co-dni" class="co-input" data-f="dni" data-digits="8" value="${GR.esc(f.dni)}" placeholder="" inputmode="numeric" maxlength="8">`)}
            ${field('Teléfono', true, 'telefono', `<input id="co-telefono" class="co-input" data-f="telefono" data-digits="9" value="${GR.esc(f.telefono)}" placeholder="" inputmode="numeric" autocomplete="tel" maxlength="9">`)}
          </div>
        </fieldset>

        <section class="co-ship ${errors.addr ? 'bad' : ''}" aria-labelledby="co-ship-title">
          <header class="co-ship-head">
            <span class="co-ship-tile">${GR.icon('pin', 20)}</span>
            <div><h2 id="co-ship-title">Dirección de envío</h2><p>¿A dónde enviamos tu pedido?</p></div>
            ${addrs.length ? `<button type="button" class="co-ship-new" data-addr-new>${GR.icon('plus', 16)} Nueva</button>` : ''}
          </header>
          ${addrs.length ? `
            <div class="co-ship-list" role="radiogroup" aria-label="Tus direcciones">
              ${addrs.map((a) => `
                <label class="co-ship-card ${f.addr === a.id ? 'on' : ''}">
                  <input type="radio" name="addr" class="sr-only" value="${GR.esc(a.id)}" ${f.addr === a.id ? 'checked' : ''}>
                  <span class="co-ship-check" aria-hidden="true">${GR.icon('check', 13)}</span>
                  <strong>${GR.esc(a.alias || 'Dirección')}${a.predeterminada ? '<em>Principal</em>' : ''}</strong>
                  <span>${GR.icon('user', 14)} ${GR.esc(a.destinatario)}${a.telefono_contacto ? ` · ${GR.esc(a.telefono_contacto)}` : ''}</span>
                  <span>${GR.icon('pin', 14)} ${GR.esc(a.direccion_linea1)}</span>
                  <small>${GR.esc([a.distrito, a.provincia, a.departamento].filter(Boolean).join(', '))}</small>
                  <button type="button" class="co-ship-edit" data-addr-edit="${GR.esc(a.id)}" aria-label="Editar ${GR.esc(a.alias || 'dirección')}" title="Editar">${GR.icon('edit', 15)}</button>
                </label>`).join('')}
            </div>` : `
            <div class="co-ship-empty">
              ${GR.icon('map', 46)}
              <p>No tienes direcciones guardadas.</p>
              <button type="button" class="co-ship-add" data-addr-new>${GR.icon('plus', 16)} Agregar dirección</button>
            </div>`}
          ${errors.addr ? `<p class="err co-ship-err" role="alert">${GR.esc(errors.addr)}</p>` : ''}
        </section>

        ${err ? `<p class="err" role="alert">${GR.esc(err)}</p>` : ''}
        <div class="co-actions">
          <a href="carrito.html" class="btn co-back">${GR.icon('chevron-left', 16)} Volver al carrito</a>
          <button type="submit" class="btn co-next">Continuar al pago ${GR.icon('chevron-right', 16)}</button>
        </div>
      </form>`;
  }

  // ── Paso 2: pago con Culqi ─────────────────────────────────────────────
  function stepPago(total) {
    const addr = getAddrs().find((a) => a.id === f.addr);
    const entrega = addr ? `${addr.direccion_linea1}${addr.distrito ? `, ${addr.distrito}` : ''}` : 'Envío a domicilio';
    const demo = !CULQI.publicKey;
    const yapeOff = total > (CULQI.yapeMax || 2000);
    return `
      <form id="co-form-pago" novalidate>
        <div class="co-review">
          ${GR.icon('truck', 18)}
          <span><b>${GR.esc(f.nombre)}</b> · ${GR.esc(f.telefono)}<small>${GR.esc(entrega)}</small></span>
          <button type="button" class="link-btn" data-go-step="1">Cambiar</button>
        </div>

        <section class="pay-card" aria-labelledby="pay-title">
          <header class="pay-head">
            <span class="pay-tile">${GR.icon('card', 20)}</span>
            <div><h2 id="pay-title">Método de pago</h2><p>Paga de forma segura con Culqi</p></div>
          </header>

          <div class="pay-methods one" role="radiogroup" aria-label="Método de pago">
            <button type="button" role="radio" aria-checked="true" class="pay-method on">
              <span class="pay-culqi" aria-hidden="true">culqi</span>
              <span><b>Culqi</b><small>Tarjeta de crédito / débito${CULQI.paymentMethods?.yape !== false ? ' · Yape' : ''}</small></span>
              <span class="pay-check" aria-hidden="true">${GR.icon('check', 14)}</span>
            </button>
          </div>
          <ul class="pay-accepts" aria-label="Medios aceptados">
            <li>Visa</li><li>Mastercard</li><li>American Express</li><li>Diners Club</li>${CULQI.paymentMethods?.yape !== false ? `<li class="${yapeOff ? 'off' : ''}">Yape</li>` : ''}
          </ul>
          <p class="pay-info">${GR.icon('lock', 16)} Al confirmar se abrirá la ventana segura de Culqi. Ahí ingresas los datos de tu tarjeta o tu código de Yape: Grinser no los ve ni los guarda.</p>
          ${yapeOff ? `<p class="pay-info warn">${GR.icon('info', 16)} Yape acepta pagos de hasta ${GR.money(CULQI.yapeMax || 2000)}. Para este pedido usa tarjeta.</p>` : ''}
          ${demo ? `<p class="pay-info warn">${GR.icon('info', 16)} Modo demostración: falta configurar la llave pública de Culqi. El pedido se registrará como pago de prueba, sin cobro.</p>` : ''}

          <div class="pay-divider"></div>

          <span class="pay-label">Tipo de comprobante</span>
          <div class="pay-docs" role="radiogroup" aria-label="Tipo de comprobante">
            ${[['boleta', 'file', 'Boleta'], ['factura', 'bank', 'Factura']].map(([id, ic, label]) => `
              <button type="button" role="radio" data-doc="${id}" aria-checked="${f.tipo_comprobante === id}" class="${f.tipo_comprobante === id ? 'on' : ''}">${GR.icon(ic, 15)} ${label}</button>`).join('')}
          </div>
          ${f.tipo_comprobante === 'factura' ? `
            <div class="pay-fields">
              ${field('RUC', true, 'ruc', `<input id="pay-ruc" class="co-input" data-f="ruc" data-digits="11" value="${GR.esc(f.ruc)}" placeholder="20123456789" inputmode="numeric" maxlength="11">`)}
              ${field('Razón social', true, 'razon_social', `<input id="pay-razon" class="co-input" data-f="razon_social" value="${GR.esc(f.razon_social)}" maxlength="150">`)}
            </div>` : ''}

          <label class="co-field pay-notes">
            <span>Comentario de entrega (opcional)</span>
            <textarea class="co-input" rows="3" data-f="notas" maxlength="500" placeholder="Referencias, instrucciones especiales, etc.">${GR.esc(f.notas)}</textarea>
          </label>
        </section>
        ${err ? `<p class="err" role="alert">${GR.esc(err)}</p>` : ''}
        <div class="co-actions">
          <button type="button" class="btn co-back" data-go-step="1">${GR.icon('chevron-left', 16)} Volver</button>
          <button type="submit" class="btn co-next" ${busy ? 'disabled' : ''}>${busy ? `<span class="spinner" aria-hidden="true"></span> ${busy === 'cobrando' ? 'Procesando pago…' : busy === 'preparando' ? 'Preparando pago…' : 'Abriendo Culqi…'}` : `${GR.icon('lock', 16)} Pagar con Culqi · ${GR.money(total)}`}</button>
        </div>
      </form>`;
  }

  // ── Paso 3: confirmación ───────────────────────────────────────────────
  function stepOk() {
    const v = done;
    const pagoTexto = v.pago.demo ? 'Culqi (pago de prueba)' : `Culqi · ${v.pago.metodo}`;
    return `
      <section class="ok-page" aria-labelledby="ok-title">
        <span class="ok-badge" aria-hidden="true">${GR.icon('check', 30)}</span>
        <h1 id="ok-title">¡Pedido confirmado!</h1>
        <p>Tu pedido <b>${GR.esc(v.id)}</b> fue registrado correctamente. Te escribiremos a <b>${GR.esc(v.email)}</b> o al <b>${GR.esc(v.cliente.telefono)}</b> para coordinar el despacho.</p>
        <dl class="ok-info">
          <div>${GR.icon('clock', 20)}<span><dt>Fecha</dt><dd>${new Date(v.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</dd></span></div>
          <div>${GR.icon('card', 20)}<span><dt>Método de pago</dt><dd>${GR.esc(pagoTexto)}</dd></span></div>
          <div>${GR.icon('tag', 20)}<span><dt>Total del pedido</dt><dd class="ok-total">${GR.money(v.total)}</dd></span></div>
        </dl>
        <div class="ok-actions">
          <a class="btn ok-primary" href="${GR.waLink(`Hola Grinser, acabo de hacer el pedido ${v.id} por ${GR.money(v.total)}. Quisiera coordinar la entrega.`)}" target="_blank" rel="noopener">${GR.waIcon(17)} Coordinar entrega por WhatsApp</a>
          <a href="productos.html" class="btn ok-secondary">${GR.icon('cart', 17)} Seguir comprando</a>
        </div>
      </section>`;
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function render() {
    user = GR.currentUser();
    if (!user) {
      root.innerHTML = `
        <div class="ck-card cart-empty">
          <span class="cart-empty-icon">${GR.icon('lock', 38)}</span>
          <h1>Inicia sesión para continuar</h1>
          <p class="muted">Necesitas una cuenta para finalizar tu compra.</p>
          <button type="button" class="btn cart-pay" data-login>${GR.icon('user', 17)} Ingresar</button>
        </div>`;
      return;
    }
    if (step === 3 && done) { root.innerHTML = stepOk(); window.scrollTo(0, 0); return; }
    const items = GR.cartItems();
    if (!items.length) {
      root.innerHTML = `
        <div class="ck-card cart-empty">
          <span class="cart-empty-icon">${GR.icon('cart', 40)}</span>
          <h1>No hay productos para pagar</h1>
          <p class="muted">Agrega productos a tu carrito para finalizar la compra.</p>
          <a href="productos.html" class="btn cart-pay">Ir a la tienda ${GR.icon('arrow-right', 16)}</a>
        </div>`;
      return;
    }
    const { subtotal } = GR.cartTotals(items);
    root.innerHTML = `
      <div class="co-page">
        ${stepper()}
        <div class="co-layout">
          <div class="ck-card co-main">${step === 1 ? stepDatos() : stepPago(subtotal)}</div>
          ${summary(items, subtotal)}
        </div>
      </div>`;
  }

  // Campos con error: se vacían y el primero queda seleccionado para volver a escribirlo.
  const FIELD_SEL = { nombre: '#co-nombre', dni: '#co-dni', telefono: '#co-telefono', ruc: '#pay-ruc', razon_social: '#pay-razon' };
  function fail(e) {
    errors = e;
    const keys = Object.keys(e).filter((k) => FIELD_SEL[k]);
    keys.forEach((k) => { f[k] = ''; });
    render();
    if (keys.length) $(FIELD_SEL[keys[0]])?.focus();
    else if (e.addr) root.querySelector('.co-ship')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  function validateDatos() {
    const e = {};
    if (f.nombre.trim().length < 3 || !NAME_RE.test(f.nombre.trim())) e.nombre = 'Escribe tu nombre completo (solo letras).';
    if (!/^\d{8}$/.test(f.dni)) e.dni = 'El DNI debe tener 8 dígitos.';
    if (!/^\d{9}$/.test(f.telefono)) e.telefono = 'Debe tener 9 dígitos.';
    const addrs = getAddrs();
    if (!addrs.some((a) => a.id === f.addr)) e.addr = addrs.length ? 'Elige la dirección de envío.' : 'Agrega una dirección de envío para continuar.';
    return Object.keys(e).length ? fail(e) : true;
  }

  function goStep(n) {
    step = n; err = ''; errors = {};
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Culqi ──────────────────────────────────────────────────────────────
  let culqiLoading = null;
  function loadCulqi() {
    if (window.CulqiCheckout) return Promise.resolve();
    culqiLoading ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CULQI_SCRIPT;
      script.onload = () => (window.CulqiCheckout ? resolve() : reject(new Error('Culqi no se cargó correctamente.')));
      script.onerror = () => { culqiLoading = null; reject(new Error('No se pudo cargar Culqi. Revisa tu conexión e inténtalo de nuevo.')); };
      document.body.appendChild(script);
    });
    return culqiLoading;
  }

  /** Abre la ventana de Culqi. onToken recibe el token (tkn_… tarjeta / ype_… Yape). */
  async function openCulqi(total, culqiOrder, onPaid) {
    await loadCulqi();
    const methods = { ...(CULQI.paymentMethods || { tarjeta: true, yape: true }) };
    if (total > (CULQI.yapeMax || 2000) || !culqiOrder) methods.yape = false;
    const [firstName, ...rest] = f.nombre.trim().split(/\s+/);
    const settings = { title: 'Grinser', currency: 'PEN', amount: Math.round(total * 100) };
    // Sin «order», Culqi solo muestra tarjeta: la orden la crea el Apps Script con la llave secreta.
    if (culqiOrder) settings.order = culqiOrder;
    const config = {
      settings,
      client: { email: user.email, firstName, lastName: rest.join(' ') },
      options: { lang: 'auto', installments: false, modal: true, paymentMethods: methods, paymentMethodsSort: Object.keys(methods) },
      appearance: {
        theme: 'default', hiddenCulqiLogo: false, menuType: 'sidebar',
        buttonCardPayText: 'Pagar', // Culqi agrega el monto al lado
        logo: new URL('img/logo-grinser.png', location.href).href,
        defaultStyle: { bannerColor: '#215f9a', buttonBackground: '#0f2c4c', menuColor: '#215f9a', linksColor: '#215f9a', buttonTextColor: '#ffffff', priceColor: '#0f2c4c' },
      },
    };
    const culqi = new window.CulqiCheckout(CULQI.publicKey, config);
    culqi.culqi = () => {
      if (culqi.token) {
        const token = culqi.token.id;
        culqi.close();
        onPaid({ token });
      } else if (culqi.order) {
        culqi.close();
        onPaid({ culqiOrder: culqi.order.id || culqiOrder });
      } else if (culqi.error) {
        err = culqi.error.user_message || culqi.error.merchant_message || 'Culqi no pudo procesar el pago. Inténtalo de nuevo.';
        render();
      }
    };
    culqi.open();
  }

  /** Datos del pedido que se envían al Apps Script para cobrar (el servidor recalcula precios y stock). */
  function orderPayload(items) {
    const addr = getAddrs().find((a) => a.id === f.addr);
    return {
      items: items.map((i) => ({ id: i.id, cantidad: i.cantidad })),
      cliente: { nombre: f.nombre.trim(), dni: f.dni, telefono: f.telefono },
      direccion: addr ? { direccion_linea1: addr.direccion_linea1, distrito: addr.distrito, provincia: addr.provincia, departamento: addr.departamento, referencia: addr.referencia || '' } : null,
      comprobante: { tipo: f.tipo_comprobante, ruc: f.tipo_comprobante === 'factura' ? f.ruc : '', razon_social: f.tipo_comprobante === 'factura' ? f.razon_social.trim() : '' },
      notas: f.notas.trim(),
    };
  }

  /**
   * Registra el pedido (mismo formato que usa «Ventas» en el panel).
   * charged: respuesta del Apps Script cuando Culqi aprobó el cobro (ya descontó el stock en la hoja).
   */
  function createOrder(pago, charged) {
    const items = GR.cartItems();
    if (!charged) {
      for (const i of items) {
        const p = GR.getProducts().find((x) => x.id === i.id);
        if (!p || p.stock < i.cantidad) { err = `${i.nombre} ya no tiene stock suficiente. Revisa tu carrito.`; render(); return; }
      }
    }
    const { subtotal } = GR.cartTotals(items);
    const addr = getAddrs().find((a) => a.id === f.addr);
    const pedido = {
      id: charged?.pedido || 'GR-' + Date.now().toString(36).toUpperCase().slice(-6),
      usuario: user.id, nombre: f.nombre.trim(), email: user.email, fecha: new Date().toISOString(),
      total: charged ? charged.total : subtotal, estado: charged ? 'pagado' : 'pendiente',
      items: charged?.items || items.map((i) => ({ id: i.id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })),
      cliente: { nombre: f.nombre.trim(), dni: f.dni, telefono: f.telefono },
      direccion: addr ? { ...addr } : null,
      envio: 'por coordinar',
      comprobante: { tipo: f.tipo_comprobante, ruc: f.tipo_comprobante === 'factura' ? f.ruc : '', razon_social: f.tipo_comprobante === 'factura' ? f.razon_social.trim() : '' },
      notas: f.notas.trim(),
      pago,
    };
    if (charged) {
      GR.refreshCatalog().catch(() => {}); // el stock ya se descontó en la hoja
    } else {
      const products = GR.getProducts().map((p) => { const it = items.find((i) => i.id === p.id); return it ? { ...p, stock: p.stock - it.cantidad } : p; });
      GR.saveProducts(products);
    }
    GR.write('pedidos', [...GR.read('pedidos', []), pedido]);
    GR.write(`checkout_${user.id}`, { nombre: f.nombre.trim(), dni: f.dni, telefono: f.telefono });
    GR.clearCart();
    done = pedido;
    step = 3;
    render();
    GR.toast(charged ? `Pago aprobado. Pedido ${pedido.id} creado.` : `Pedido ${pedido.id} creado.`);
  }

  /** Con el token de Culqi, el Apps Script crea el cargo; solo si el banco aprueba se confirma el pedido. */
  let preparedOrder = null; // { order, pedido, total, firma } orden de Culqi creada para este carrito

  async function chargeToken({ token = '', culqiOrder = '' }) {
    const items = GR.cartItems();
    const { subtotal } = GR.cartTotals(items);
    busy = 'cobrando'; err = ''; render();
    root.querySelector('.co-next')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try {
      const charged = await GR.chargeWithCulqi({
        token, culqiOrder, pedidoId: preparedOrder?.pedido || '', email: user.email, total: subtotal, pedido: orderPayload(items),
      });
      preparedOrder = null;
      busy = false;
      createOrder({ proveedor: 'culqi', metodo: charged.metodo, cargo: charged.cargo, estado: 'pagado' }, charged);
    } catch (ex) {
      busy = false;
      err = ex.message;
      render();
      root.querySelector('.co-actions')?.previousElementSibling?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function confirmar() {
    err = '';
    const e = {};
    if (f.tipo_comprobante === 'factura') {
      if (!/^\d{11}$/.test(f.ruc)) e.ruc = 'El RUC debe tener 11 dígitos.';
      if (f.razon_social.trim().length < 3) e.razon_social = 'Obligatorio';
    }
    if (Object.keys(e).length) return fail(e);
    errors = {};
    const { subtotal } = GR.cartTotals();
    if (!CULQI.publicKey) {
      createOrder({ proveedor: 'culqi', demo: true, metodo: 'Prueba', estado: 'sin cobro' });
      return;
    }
    if (!GR.sheetsConfigured) {
      err = 'Para cobrar con Culqi falta conectar el Apps Script (js/sheets-config.js).';
      render();
      return;
    }
    busy = 'abriendo'; render();
    try {
      // Yape necesita una orden de Culqi. Se crea una por carrito (se reutiliza si el cliente cierra y vuelve a abrir).
      let culqiOrder = '';
      const yapeOn = CULQI.paymentMethods?.yape !== false && subtotal <= (CULQI.yapeMax || 2000);
      if (yapeOn) {
        const items = GR.cartItems();
        const firma = JSON.stringify([items.map((i) => [i.id, i.cantidad]), subtotal]);
        if (!preparedOrder || preparedOrder.firma !== firma) {
          try {
            busy = 'preparando'; render();
            const created = await GR.createCulqiOrder({ email: user.email, total: subtotal, pedido: orderPayload(items) });
            preparedOrder = created.order ? { ...created, firma } : null;
          } catch (orderError) {
            preparedOrder = null;
            GR.toast(`Yape no está disponible ahora (${orderError.message}). Puedes pagar con tarjeta.`, 'error');
          }
          busy = 'abriendo'; render();
        }
        culqiOrder = preparedOrder?.order || '';
      }
      await openCulqi(subtotal, culqiOrder, chargeToken);
    } catch (ex) {
      err = ex.message;
    } finally {
      if (busy === 'abriendo') { busy = false; if (step !== 3) render(); }
    }
  }

  // ── Modal de dirección ─────────────────────────────────────────────────
  const ADDR_FIELDS = [
    { k: 'alias', label: 'Alias', req: 2, icon: 'tag', ph: 'Ej. Casa, Trabajo', clean: onlyWords, msg: 'Ponle un nombre, por ejemplo Casa.' },
    { k: 'destinatario', label: 'Destinatario', req: 3, icon: 'user', ph: 'Nombre de quien recibe', msg: 'Indica quién recibe el pedido.', ac: 'name' },
    { k: 'direccion_linea1', label: 'Dirección detallada', req: 5, icon: 'pin', ph: 'Av. / Jr. / Calle + número, dpto.', span: true, msg: 'Escribe la dirección con número.', ac: 'street-address' },
    { k: 'distrito', label: 'Distrito', req: 2, icon: 'store', ph: 'Ej. Miraflores', clean: onlyWords, msg: 'Obligatorio' },
    { k: 'provincia', label: 'Provincia', req: 2, icon: 'grid', ph: 'Ej. Lima', clean: onlyWords, msg: 'Obligatorio' },
    { k: 'departamento', label: 'Departamento', icon: 'map', ph: 'Ej. Lima', clean: onlyWords },
    { k: 'codigo_postal', label: 'Código postal', req: 5, icon: 'mail', ph: 'Ej. 15074', digits: 5, msg: 'Debe tener 5 dígitos.', hint: '5 dígitos, p. ej. 15074' },
    { k: 'telefono_contacto', label: 'Teléfono de contacto', icon: 'phone', ph: '', digits: 9 },
    { k: 'referencia', label: 'Referencias', icon: 'info', ph: 'Cerca de…, color de puerta…', span: true },
  ];

  function openAddr(id) {
    editingAddr = id || null;
    const a = getAddrs().find((x) => x.id === id) || { destinatario: f.nombre.trim() || user.nombre, telefono_contacto: f.telefono, predeterminada: !getAddrs().length };
    $('#addr-title').textContent = id ? 'Editar dirección' : 'Nueva dirección';
    $('#addr-fields').innerHTML = ADDR_FIELDS.map((d) => `
      <div class="adf-field ${d.span ? 'span' : ''}" data-adf="${d.k}">
        <label for="addr-${d.k}">${d.label}${d.req ? '<i aria-hidden="true"> *</i>' : '<em> (opcional)</em>'}</label>
        <div class="adf-box">${GR.icon(d.icon, 17)}<input id="addr-${d.k}" name="${d.k}" value="${GR.esc(a[d.k] || '')}" placeholder="${GR.esc(d.ph)}" maxlength="${d.digits || 220}" ${d.digits ? 'inputmode="numeric"' : ''} ${d.ac ? `autocomplete="${d.ac}"` : ''}></div>
        <small class="adf-hint">${d.hint || ''}</small>
      </div>`).join('');
    $('#addr-form').elements.predeterminada.checked = Boolean(a.predeterminada);
    $('#addr-dialog').showModal();
    $('#addr-alias').focus();
  }

  function saveAddr(e) {
    e.preventDefault();
    const form = $('#addr-form').elements;
    const data = {};
    let first = null;
    ADDR_FIELDS.forEach((d) => {
      const value = form[d.k].value.trim();
      data[d.k] = value;
      let msg = '';
      if (d.req && (d.digits ? !new RegExp(`^\\d{${d.digits}}$`).test(value) : value.length < d.req)) msg = d.msg;
      if (!msg && d.k === 'telefono_contacto' && value && !/^\d{9}$/.test(value)) msg = `Debe tener 9 dígitos (faltan ${9 - value.length}).`;
      const wrap = $(`[data-adf="${d.k}"]`);
      wrap.classList.toggle('bad', Boolean(msg));
      wrap.querySelector('small').className = msg ? 'adf-err' : 'adf-hint';
      wrap.querySelector('small').textContent = msg || d.hint || '';
      if (msg && !first) first = form[d.k];
    });
    if (first) { first.focus(); return; }
    data.predeterminada = form.predeterminada.checked;
    let list = getAddrs();
    const id = editingAddr || GR.uid('dir');
    const saved = { ...(list.find((x) => x.id === id) || {}), ...data, id };
    list = [saved, ...list.filter((x) => x.id !== id)];
    if (saved.predeterminada) list = list.map((x) => (x.id === id ? x : { ...x, predeterminada: false }));
    saveAddrs(list);
    f.addr = id;
    delete errors.addr;
    $('#addr-dialog').close();
    render();
    GR.toast('Dirección guardada.');
  }

  // ── Eventos ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    await GR.authReady;
    const init = () => {
      user = GR.currentUser();
      if (user) {
        const saved = GR.read(`checkout_${user.id}`, {});
        f.nombre ||= saved.nombre || user.nombre || '';
        f.dni ||= saved.dni || '';
        f.telefono ||= saved.telefono || '';
        const addrs = getAddrs();
        if (!addrs.some((a) => a.id === f.addr)) f.addr = (addrs.find((a) => a.predeterminada) || addrs[0])?.id || '';
      }
      render();
    };
    init();
    GR.dataReady.then(() => { if (step < 3) render(); });
    window.addEventListener('gr:session', init);
    window.addEventListener('gr:cart', () => { if (step < 3) render(); });

    root.addEventListener('input', (e) => {
      const k = e.target.dataset.f;
      if (!k) return;
      if (e.target.dataset.digits) e.target.value = digits(e.target.value, Number(e.target.dataset.digits));
      f[k] = e.target.value;
      if (errors[k]) { delete errors[k]; e.target.closest('.co-field')?.classList.remove('bad'); e.target.closest('.co-field')?.querySelector('small')?.remove(); }
    });
    root.addEventListener('change', (e) => {
      if (e.target.name === 'addr') { f.addr = e.target.value; delete errors.addr; render(); }
    });
    root.addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.target.id === 'co-form-datos' && validateDatos()) goStep(2);
      if (e.target.id === 'co-form-pago' && !busy) confirmar();
    });
    root.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.goStep) goStep(Number(t.dataset.goStep));
      if (t.dataset.doc) { f.tipo_comprobante = t.dataset.doc; render(); }
      if (t.hasAttribute('data-addr-new')) openAddr(null);
      if (t.dataset.addrEdit) { e.preventDefault(); openAddr(t.dataset.addrEdit); }
      if (t.hasAttribute('data-login')) GR.openAuth('login', { onSuccess: init });
    });

    $('#addr-form').addEventListener('submit', saveAddr);
    $('#addr-form').addEventListener('input', (e) => {
      const d = ADDR_FIELDS.find((x) => x.k === e.target.name);
      if (!d) return;
      if (d.digits) e.target.value = digits(e.target.value, d.digits);
      else if (d.clean) e.target.value = d.clean(e.target.value);
    });
    document.querySelectorAll('[data-addr-close]').forEach((b) => b.addEventListener('click', () => $('#addr-dialog').close()));
    $('#addr-dialog').addEventListener('mousedown', (e) => { if (e.target === e.currentTarget) $('#addr-dialog').close(); });
  });
})();
