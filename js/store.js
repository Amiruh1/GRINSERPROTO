'use strict';
// Grinser · tienda: cabecera, carrusel, categorías, catálogo, carrito, pie de página y WhatsApp.
(function () {
  const GR = window.GR;
  const $ = (s) => document.querySelector(s);
  const MAX_QTY = 99;

  let products = [];
  let cart = GR.read('carrito', []); // [{ id, cantidad }]
  // cat: 'todas' | 'ofertas' | id de categoría.  nav: enlace resaltado en el menú.
  const state = { cat: 'destacados', q: '', sort: 'relevancia', nav: 'inicio' };
  let categoryWasSelected = false;
  let catalogRefreshInProgress = false;
  let catalogRefreshFailed = false;

  const byId = (id) => products.find((p) => p.id === id);
  const visible = () => products.filter((p) => p.activo !== false);
  const countOf = (cat) => visible().filter((p) => (cat === 'ofertas' ? GR.enOferta(p) : cat === 'todas' || p.categoria === cat)).length;

  const media = (p, size = 46) => p.imagen
    ? `<img src="${GR.esc(GR.assetPath(p.imagen))}" alt="" loading="lazy">`
    : `<span class="ph ph-${GR.esc(p.categoria)}">${GR.icon(GR.cat(p.categoria).icon, size)}</span>`;

  // ── Navegación: menú, categorías y filtros ─────────────────────────────
  // Secciones de la página (el resto de enlaces filtran el catálogo).
  const SECTIONS = { inicio: null, empresa: '#empresa', 'servicio-tecnico': '#servicio-tecnico', tiendas: '#tiendas' };
  function goTo(nav) {
    state.nav = nav === 'tiendas' ? 'empresa' : nav;
    const isSection = nav in SECTIONS;
    if (!isSection) { categoryWasSelected = true; state.cat = nav; renderChips(); renderGrid(); }
    renderNav();
    closeCatDrop();
    closeNavProducts();
    const sel = isSection ? SECTIONS[nav] : '#tienda';
    const target = sel ? $(sel) : document.body;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (sel) setTimeout(() => target.focus({ preventScroll: true }), 400);
  }

  // ── Nuestras tiendas ───────────────────────────────────────────────────
  function renderStores() {
    const stores = $('#stores');
    if (!stores) return;
    stores.innerHTML = GR.TIENDAS.map((t, n) => {
      const mapQ = encodeURIComponent(t.mapa);
      return `
      <article class="store">
        <div class="store-card">
          <div class="store-photo ${t.foto ? '' : 'is-empty'}">
            ${t.foto ? `<img src="${GR.esc(t.foto)}" alt="Fachada de ${GR.esc(t.nombre)}" loading="lazy">`
              : `<span>${GR.icon('camera', 30)}<small>Foto próximamente</small></span>`}
            ${t.etiqueta ? `<span class="store-tag">${GR.esc(t.etiqueta)}</span>` : ''}
          </div>
          <div class="store-info">
            <span class="store-num">0${n + 1}</span>
            <h3>${GR.esc(t.nombre)}</h3>
            <p class="store-addr">${GR.icon('pin', 18)}<span><b>${GR.esc(t.direccion)}</b><small>${GR.esc(t.referencia)}</small></span></p>
            <p class="store-line">${GR.icon('phone', 16)} <a href="tel:+51${t.telefono.replace(/\D/g, '')}">${GR.esc(t.telefono)}</a></p>
            <div class="store-actions">
              <a class="btn btn-primary" href="https://www.google.com/maps/dir/?api=1&destination=${mapQ}" target="_blank" rel="noopener">${GR.icon('route', 16)} Cómo llegar</a>
              <a class="btn btn-wa" href="${GR.waLink(`Hola Grinser, quisiera información de la ${t.nombre} (${t.direccion}).`)}" target="_blank" rel="noopener">${GR.waIcon(16)} WhatsApp</a>
            </div>
          </div>
        </div>
        <div class="store-map">
          <iframe title="Mapa de ${GR.esc(t.nombre)}: ${GR.esc(t.direccion)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
            src="https://maps.google.com/maps?q=${mapQ}&z=17&output=embed"></iframe>
        </div>
      </article>`;
    }).join('');
  }

  function renderNav() {
    document.querySelectorAll('#nav-links [data-nav]').forEach((a) => {
      const on = a.dataset.nav === state.nav;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function renderCatDrop() {
    $('#cat-drop').innerHTML = `
      ${GR.CATEGORIAS.map((c) => `<button type="button" data-nav="${c.id}">${GR.icon(c.icon, 18)}<span>${GR.esc(c.nombre)}</span><small>${countOf(c.id)}</small></button>`).join('')}
      <button type="button" data-nav="ofertas" class="hot">${GR.icon('percent', 18)}<span>Ofertas</span><small>${countOf('ofertas')}</small></button>`;
  }
  const closeCatDrop = () => { $('#cat-drop').hidden = true; $('#cat-toggle').setAttribute('aria-expanded', 'false'); };
  const closeNavProducts = () => {
    const drop = $('#nav-product-drop');
    const toggle = $('.nav-product-toggle');
    if (drop) drop.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  };

  function renderCatCards() {
    const cards = $('#cat-cards');
    if (!cards) return;
    cards.innerHTML = [...GR.CATEGORIAS, { id: 'ofertas', nombre: 'Ofertas', icon: 'percent' }].map((c) => `
      <a href="#tienda" class="cat-card ${c.id === 'ofertas' ? 'is-hot' : ''}" data-nav="${c.id}">
        <span class="cat-card-copy"><b>${GR.esc(c.nombre)}</b><small>${c.id === 'ofertas' ? 'Precios especiales' : `${countOf(c.id)} producto${countOf(c.id) === 1 ? '' : 's'}`} →</small></span>
        <span class="cat-card-ic">${GR.icon(c.icon, 30)}</span>
      </a>`).join('');
  }

  function renderChips() {
    if (!$('#cat-chips')) return;
    const chips = [{ id: 'todas', nombre: 'Todo', icon: 'grid' }, { id: 'ofertas', nombre: 'Ofertas', icon: 'percent' }, ...GR.CATEGORIAS]
      .filter((c) => countOf(c.id) || c.id === state.cat);
    $('#cat-chips').innerHTML = chips.map((c) => `
      <button type="button" class="chip ${state.cat === c.id ? 'on' : ''} ${c.id === 'ofertas' ? 'hot' : ''}" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">
        ${GR.icon(c.icon, 16)} ${GR.esc(c.nombre)} <small>${countOf(c.id)}</small>
      </button>`).join('');
  }

  // ── Catálogo ───────────────────────────────────────────────────────────
  function filtered() {
    const q = state.q.trim().toLowerCase();
    const featuredView = state.cat === 'destacados';
    let list = visible().filter((p) =>
      (featuredView ? p.categoria === 'fotocopiadoras'
        : state.cat === 'todas' || (state.cat === 'ofertas' ? GR.enOferta(p) : p.categoria === state.cat)) &&
      (!q || `${p.nombre} ${p.marca} ${GR.cat(p.categoria).nombre} ${p.descripcion}`.toLowerCase().includes(q)));
    if (featuredView) list = list.slice(-4);
    if (state.sort === 'precio-asc') list.sort((a, b) => GR.precioFinal(a) - GR.precioFinal(b));
    else if (state.sort === 'precio-desc') list.sort((a, b) => GR.precioFinal(b) - GR.precioFinal(a));
    else if (state.sort === 'nombre') list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    else list.sort((a, b) => (b.stock > 0) - (a.stock > 0)); // relevancia: primero lo que tiene stock
    return list;
  }

  function card(p) {
    const final = GR.precioFinal(p);
    const off = GR.enOferta(p) ? Math.round((1 - final / p.precio) * 100) : 0;
    const inCart = cart.find((i) => i.id === p.id)?.cantidad || 0;
    const agotado = p.stock <= 0;
    return `
      <article class="card ${agotado ? 'is-out' : ''}">
        <a class="card-media" href="${GR.pagePath('producto.html')}?id=${encodeURIComponent(p.id)}" tabindex="-1" aria-hidden="true">${media(p)}${off ? `<span class="badge-off">-${off}%</span>` : ''}</a>
        <div class="card-body">
          <span class="card-cat">${GR.esc(GR.cat(p.categoria).nombre)}${p.marca ? ` · ${GR.esc(p.marca)}` : ''}</span>
          <h3 class="card-title"><a href="${GR.pagePath('producto.html')}?id=${encodeURIComponent(p.id)}">${GR.esc(p.nombre)}</a></h3>
          <p class="card-desc">${GR.esc(p.descripcion)}</p>
          <div class="card-price"><strong>${GR.money(final)}</strong>${off ? `<s>${GR.money(p.precio)}</s>` : ''}</div>
          <span class="stock ${agotado ? 'out' : p.stock <= 5 ? 'low' : ''}">${agotado ? 'Agotado' : p.stock <= 5 ? `¡Quedan ${p.stock}!` : `${p.stock} en stock`}</span>
          <button type="button" class="btn btn-primary btn-add" data-add="${p.id}" ${agotado ? 'disabled' : ''}>
            ${GR.icon('cart', 17)} <span>${agotado ? 'Sin stock' : inCart ? `Agregar (${inCart})` : 'Agregar'}</span>
          </button>
        </div>
      </article>`;
  }

  function renderGrid() {
    const list = filtered();
    const titulo = state.cat === 'todas' ? 'Nuestros productos'
      : state.cat === 'ofertas' || state.cat === 'destacados' ? 'Productos Destacados'
        : GR.cat(state.cat).nombre;
    $('#shop-title').textContent = titulo;
    $('#result-info').textContent = `${list.length} producto${list.length === 1 ? '' : 's'}${state.q.trim() ? ` para «${state.q.trim()}»` : ''}`;
    $('#grid').innerHTML = list.length ? list.map(card).join('')
      : `<div class="empty">${GR.icon('search', 34)}<p>No encontramos productos con esos filtros.</p><button type="button" class="btn" data-reset>Ver todo el catálogo</button></div>`;
  }

  let seasonalCanvas = null;
  let seasonalFrame = 0;
  let seasonalResizeHandler = null;
  let seasonalEventId = null;

  function stopSeasonalAnimation() {
    if (seasonalFrame) cancelAnimationFrame(seasonalFrame);
    seasonalFrame = 0;
    if (seasonalResizeHandler) window.removeEventListener('resize', seasonalResizeHandler);
    seasonalResizeHandler = null;
    if (seasonalCanvas) seasonalCanvas.remove();
    seasonalCanvas = null;
  }

  function startSeasonalAnimation(eventId) {
    const canvas = document.createElement('canvas');
    canvas.className = 'seasonal-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    if (!context) return;
    seasonalCanvas = canvas;
    document.body.appendChild(canvas);

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    seasonalResizeHandler = resize;
    resize();
    window.addEventListener('resize', resize);
    const width = () => window.innerWidth;
    const height = () => window.innerHeight;

    if (eventId === 'navidad') {
      const flakes = Array.from({ length: 64 }, () => ({
        x: Math.random() * width(),
        y: Math.random() * height(),
        radius: 1.5 + Math.random() * 3,
        speed: .5 + Math.random() * 1.5,
        drift: (Math.random() - .5) * .8,
      }));
      const animate = () => {
        context.clearRect(0, 0, width(), height());
        context.shadowColor = 'rgba(22, 70, 122, .38)';
        context.shadowBlur = 4;
        flakes.forEach((flake) => {
          flake.y += flake.speed;
          flake.x += flake.drift + Math.sin(flake.y / 35) * .35;
          if (flake.y > height() + flake.radius) {
            flake.y = -flake.radius;
            flake.x = Math.random() * width();
          }
          context.beginPath();
          context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          context.fillStyle = 'rgba(255, 255, 255, .86)';
          context.fill();
        });
        context.shadowBlur = 0;
        seasonalFrame = requestAnimationFrame(animate);
      };
      animate();
    } else if (eventId === 'ano_nuevo') {
      const rockets = [];
      const particles = [];
      let frameCount = 0;
      const launch = () => rockets.push({
        x: width() * (.12 + Math.random() * .76),
        y: height() + 4,
        target: height() * (.16 + Math.random() * .42),
        speed: 5 + Math.random() * 2,
        hue: Math.floor(Math.random() * 360),
      });
      const animate = () => {
        context.clearRect(0, 0, width(), height());
        context.globalCompositeOperation = 'lighter';
        frameCount += 1;
        if (frameCount % 48 === 1 && rockets.length < 3) launch();
        for (let i = rockets.length - 1; i >= 0; i -= 1) {
          const rocket = rockets[i];
          rocket.y -= rocket.speed;
          context.beginPath();
          context.arc(rocket.x, rocket.y, 2.2, 0, Math.PI * 2);
          context.fillStyle = `hsl(${rocket.hue}, 100%, 70%)`;
          context.fill();
          if (rocket.y <= rocket.target) {
            const count = 42 + Math.floor(Math.random() * 22);
            for (let j = 0; j < count; j += 1) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 1 + Math.random() * 4;
              particles.push({
                x: rocket.x, y: rocket.y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                life: 45 + Math.random() * 28, hue: rocket.hue,
              });
            }
            rockets.splice(i, 1);
          }
        }
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const particle = particles[i];
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.vy += .035;
          particle.life -= 1;
          if (particle.life <= 0) { particles.splice(i, 1); continue; }
          context.beginPath();
          context.arc(particle.x, particle.y, 1.8, 0, Math.PI * 2);
          context.fillStyle = `hsla(${particle.hue}, 100%, 68%, ${Math.min(particle.life / 24, 1)})`;
          context.fill();
        }
        context.globalCompositeOperation = 'source-over';
        seasonalFrame = requestAnimationFrame(animate);
      };
      animate();
    }
  }

  function renderSeasonalEvent() {
    const banner = $('#seasonal-banner');
    if (!banner) return;
    const event = GR.getActiveEvent();
    const eventId = event ? event.id : '';
    const logo = $('.brand img');
    const logoSources = {
      navidad: 'img/logo-grinser-navidad.png',
      fiestas_patrias: 'img/logo-grinser-fiestas-patrias.png',
    };
    const logoSource = event && logoSources[event.id] ? logoSources[event.id] : 'img/logo-grinser.png';
    if (logo.getAttribute('src') !== logoSource) logo.setAttribute('src', logoSource);
    if (event) {
      document.documentElement.dataset.seasonalEvent = event.id;
      banner.dataset.event = event.id;
      banner.textContent = event.banner;
      banner.hidden = false;
    } else {
      delete document.documentElement.dataset.seasonalEvent;
      banner.hidden = true;
      banner.textContent = '';
      delete banner.dataset.event;
    }
    if (eventId === seasonalEventId) return;
    stopSeasonalAnimation();
    seasonalEventId = eventId;
    if (!event || document.visibilityState !== 'visible' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (event.id === 'navidad' || event.id === 'ano_nuevo') startSeasonalAnimation(event.id);
  }

  function renderCatalogUpdate() {
    products = GR.getProducts();
    if (state.cat !== 'todas' && state.cat !== 'ofertas' && state.cat !== 'destacados' &&
        !GR.CATEGORIAS.some((category) => category.id === state.cat)) {
      state.cat = 'todas';
      state.nav = 'todas';
    }
    renderNav(); renderCatDrop(); renderCatCards(); renderChips();
    renderSeasonalEvent();
    saveCart();
  }

  async function refreshCatalog() {
    if (!GR.sheetsConfigured || catalogRefreshInProgress || document.visibilityState !== 'visible') return;
    catalogRefreshInProgress = true;
    try {
      const changed = await GR.refreshCatalog();
      catalogRefreshFailed = false;
      if (changed) renderCatalogUpdate();
    } catch (error) {
      if (!catalogRefreshFailed) GR.toast(`No se pudo actualizar el catálogo: ${error.message}`, 'error');
      catalogRefreshFailed = true;
    } finally {
      catalogRefreshInProgress = false;
    }
  }

  // ── Carrusel ───────────────────────────────────────────────────────────
  function initHero() {
    if (!$('#hero')) return;
    const slides = [...document.querySelectorAll('#hero .slide')];
    const dots = $('#hero .hero-dots');
    let i = 0, timer = null;
    dots.innerHTML = slides.map((_, n) => `<button type="button" aria-label="Diapositiva ${n + 1}"></button>`).join('');
    const show = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.inert = k !== i; });
      [...dots.children].forEach((d, k) => { d.classList.toggle('on', k === i); d.setAttribute('aria-current', k === i); });
    };
    const play = () => { clearInterval(timer); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => show(i + 1), 6500); };
    $('#hero').addEventListener('click', (e) => {
      const b = e.target.closest('[data-slide]'); if (b) { show(i + Number(b.dataset.slide)); play(); }
      const d = e.target.closest('.hero-dots button'); if (d) { show([...dots.children].indexOf(d)); play(); }
    });
    $('#hero').addEventListener('mouseenter', () => clearInterval(timer));
    $('#hero').addEventListener('mouseleave', play);
    // Deslizar con el dedo en el celular.
    let x0 = null;
    $('#hero').addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    $('#hero').addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1)); play(); } x0 = null; });
    show(0); play();
  }

  // ── Carrito ────────────────────────────────────────────────────────────
  function saveCart() {
    cart = cart.map((i) => { const p = byId(i.id); return p && p.activo !== false && p.stock > 0 ? { id: i.id, cantidad: Math.min(i.cantidad, p.stock, MAX_QTY) } : null; }).filter(Boolean);
    GR.write('carrito', cart);
    renderCart();
    renderGrid();
  }

  function addToCart(id) {
    const p = byId(id);
    if (!p || p.stock <= 0) return GR.toast('Producto sin stock.', 'error');
    const it = cart.find((i) => i.id === id);
    if (it && it.cantidad >= Math.min(p.stock, MAX_QTY)) return GR.toast(`Solo hay ${p.stock} unidad${p.stock === 1 ? '' : 'es'} disponible${p.stock === 1 ? '' : 's'}.`, 'error');
    if (it) it.cantidad += 1; else cart.push({ id, cantidad: 1 });
    saveCart();
    GR.toast('Agregado al carrito.');
    const btn = $('#cart-btn'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  }

  const totals = () => cart.reduce((t, i) => {
    const p = byId(i.id);
    if (p) { t.count += i.cantidad; t.total += GR.precioFinal(p) * i.cantidad; t.lista += p.precio * i.cantidad; }
    return t;
  }, { count: 0, total: 0, lista: 0 });

  function renderCart(done) {
    const t = totals();
    $('#cart-count').textContent = t.count;
    $('#cart-sum').textContent = GR.money(t.total);
    $('#cart-btn').setAttribute('aria-label', `Abrir carrito: ${t.count} producto${t.count === 1 ? '' : 's'}, ${GR.money(t.total)}`);

    const body = $('#cart-body');
    const foot = $('#cart-foot');
    if (done) {
      body.innerHTML = `<div class="cart-done">${GR.icon('check', 40)}<h3>¡Pedido registrado!</h3><p>N.° <b>${GR.esc(done.id)}</b> por <b>${GR.money(done.total)}</b>.</p><p class="muted">Nuestro equipo se comunicará contigo a <b>${GR.esc(done.email)}</b> para coordinar el pago y la entrega.</p>
        <a class="btn btn-wa" target="_blank" rel="noopener" href="${GR.waLink(`Hola Grinser, acabo de registrar el pedido ${done.id} por ${GR.money(done.total)}.`)}">${GR.waIcon(18)} Avisar por WhatsApp</a>
        <button type="button" class="link-btn" data-close-cart>Seguir comprando</button></div>`;
      foot.hidden = true;
      return;
    }
    if (!cart.length) {
      body.innerHTML = `<div class="cart-empty">${GR.icon('cart', 40)}<p>Tu carrito está vacío.</p><button type="button" class="btn" data-close-cart>Ver productos</button></div>`;
      foot.hidden = true;
      return;
    }
    body.innerHTML = `<ul class="cart-list">${cart.map((i) => {
      const p = byId(i.id);
      const final = GR.precioFinal(p);
      const max = Math.min(p.stock, MAX_QTY);
      return `
        <li class="cart-item">
          <div class="ci-media">${media(p, 26)}</div>
          <div class="ci-info">
            <b>${GR.esc(p.nombre)}</b>
            <small>${GR.money(final)} c/u${GR.enOferta(p) ? ` <s>${GR.money(p.precio)}</s>` : ''}</small>
            <div class="qty" role="group" aria-label="Cantidad de ${GR.esc(p.nombre)}">
              <button type="button" data-qty="${p.id}" data-d="-1" aria-label="Quitar uno" ${i.cantidad <= 1 ? 'disabled' : ''}>${GR.icon('minus', 14)}</button>
              <span aria-live="polite">${i.cantidad}</span>
              <button type="button" data-qty="${p.id}" data-d="1" aria-label="Agregar uno" ${i.cantidad >= max ? 'disabled' : ''}>${GR.icon('plus', 14)}</button>
            </div>
          </div>
          <div class="ci-side">
            <strong>${GR.money(final * i.cantidad)}</strong>
            <button type="button" class="icon-btn" data-remove="${p.id}" aria-label="Quitar ${GR.esc(p.nombre)} del carrito">${GR.icon('trash', 16)}</button>
          </div>
        </li>`;
    }).join('')}</ul>`;
    foot.hidden = false;
    $('#cart-save').hidden = t.lista <= t.total;
    $('#cart-save-v').textContent = `- ${GR.money(t.lista - t.total)}`;
    $('#cart-total').textContent = GR.money(t.total);
    $('#checkout').innerHTML = `${GR.currentUser() ? 'Finalizar pedido' : 'Inicia sesión para pedir'} ${GR.icon('arrow-right', 17)}`;
  }

  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    renderCart();
    $('#cart').hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => $('#cart').classList.add('open'));
    setTimeout(() => $('#cart .drawer-close').focus(), 50);
  }
  function closeCart() {
    $('#cart').classList.remove('open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { $('#cart').hidden = true; }, 250);
    lastFocus?.focus?.({ preventScroll: true });
  }

  function checkout() {
    if (!cart.length) return;
    const user = GR.currentUser();
    if (!user) {
      closeCart();
      GR.toast('Inicia sesión para finalizar tu pedido.', 'error');
      GR.openAuth('login', { onSuccess: () => openCart() });
      return;
    }
    products = GR.getProducts(); // el stock pudo cambiar en el panel
    for (const i of cart) {
      const p = byId(i.id);
      if (!p || p.activo === false || p.stock < i.cantidad) {
        saveCart();
        return GR.toast(`${p ? p.nombre : 'Un producto'} ya no tiene stock suficiente. Revisa tu carrito.`, 'error');
      }
    }
    const t = totals();
    if (!confirm(`¿Confirmas tu pedido por ${GR.money(t.total)}?`)) return;
    const pedido = {
      id: 'GR-' + Date.now().toString(36).toUpperCase().slice(-6),
      usuario: user.id, nombre: user.nombre, email: user.email, fecha: new Date().toISOString(), total: t.total, estado: 'pendiente',
      items: cart.map((i) => { const p = byId(i.id); return { id: p.id, nombre: p.nombre, precio: GR.precioFinal(p), cantidad: i.cantidad }; }),
    };
    products = products.map((p) => { const it = cart.find((i) => i.id === p.id); return it ? { ...p, stock: p.stock - it.cantidad } : p; });
    GR.saveProducts(products);
    GR.write('pedidos', [...GR.read('pedidos', []), pedido]);
    cart = [];
    GR.write('carrito', cart);
    renderChips(); renderGrid(); renderCatCards(); renderCatDrop();
    renderCart(pedido);
  }

  // ── Mi cuenta ──────────────────────────────────────────────────────────
  function renderUser() {
    const u = GR.currentUser();
    const area = $('#user-area');
    if (!u) {
      area.innerHTML = `<button type="button" class="acc-btn" data-login><span class="acc-ic">${GR.icon('user', 18)}</span><span class="acc-copy"><small>Mi cuenta</small><b>Iniciar sesión</b></span></button>`;
      return;
    }
    area.innerHTML = `
      <details class="user-menu">
        <summary class="acc-btn" aria-label="Menú de ${GR.esc(u.nombre)}">
          <span class="avatar" aria-hidden="true">${GR.esc(u.nombre.trim()[0].toUpperCase())}</span>
          <span class="acc-copy"><small>${GR.ROLES[u.rol]}</small><b>Hola, ${GR.esc(u.nombre.split(' ')[0])}</b></span>
          ${GR.icon('chevron-down', 16)}
        </summary>
        <div class="um-pop">
          <p class="um-mail">${GR.esc(u.email)}</p>
          ${u.rol === 'admin' ? `<a href="${GR.pagePath('admin.html')}">${GR.icon('grid', 16)} Panel empresa</a>` : ''}
          <button type="button" data-logout>${GR.icon('logout', 16)} Cerrar sesión</button>
        </div>
      </details>`;
  }

  // ── Pie de página ──────────────────────────────────────────────────────
  function initContact() {
    const E = GR.EMPRESA;
    $('#year').textContent = new Date().getFullYear();
    $('#f-dir').textContent = E.direccion;
    $('#f-tel').textContent = E.telefono; $('#f-tel').href = `tel:+${E.whatsapp}`;
    $('#f-mail').textContent = E.correo; $('#f-mail').href = `mailto:${E.correo}`;
    document.querySelectorAll('.wa-text-link').forEach((a) => { a.href = GR.waLink(); });
  }

  function initQuoteForm() {
    const dialog = $('#quote-dialog');
    const form = $('#quote-form');
    if (!dialog || !form) return;
    document.querySelectorAll('[data-quote-open]').forEach((button) => {
      button.addEventListener('click', () => dialog.showModal());
    });
    $('[data-quote-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = new FormData(form);
      const message = [
        'Hola Grinser, quisiera solicitar una cotización de servicio técnico.',
        `Nombre: ${fields.get('nombre')}`,
        `Teléfono: ${fields.get('telefono')}`,
        `Equipo: ${fields.get('equipo')}`,
        `Detalle: ${fields.get('detalle')}`,
      ].join('\n');
      const popup = window.open(GR.waLink(message), '_blank');
      if (!popup) {
        GR.toast('No se pudo abrir WhatsApp. Permite las ventanas emergentes y vuelve a intentarlo.', 'error');
        return;
      }
      popup.opener = null;
      dialog.close();
      form.reset();
    });
  }

  // ── Eventos ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    await GR.authReady;
    products = GR.getProducts();
    const requestedCategory = new URLSearchParams(window.location.search).get('categoria');
    if (requestedCategory === 'ofertas' || GR.CATEGORIAS.some((category) => category.id === requestedCategory)) {
      state.cat = requestedCategory;
      state.nav = requestedCategory;
    }
    if (GR.sheetError) GR.toast('No se pudo cargar Google Sheets; se muestran los datos locales.', 'error');
    renderUser(); renderNav(); renderCatDrop(); renderCatCards(); renderChips(); saveCart();
    renderStores(); renderSeasonalEvent(); initHero(); initContact(); initQuoteForm();
    catalogRefreshFailed = Boolean(GR.sheetError);
    if (GR.sheetsConfigured) catalogRefreshInProgress = true;
    GR.dataReady.then(() => {
      if (!GR.sheetsConfigured) return;
      catalogRefreshInProgress = false;
      if (GR.sheetError) {
        if (!catalogRefreshFailed) GR.toast('No se pudo cargar Google Sheets; se muestran los datos locales.', 'error');
        catalogRefreshFailed = true;
        return;
      }
      catalogRefreshFailed = false;
      if (!categoryWasSelected && (requestedCategory === 'ofertas' ||
          GR.CATEGORIAS.some((category) => category.id === requestedCategory))) {
        state.cat = requestedCategory;
        state.nav = requestedCategory;
      }
      renderCatalogUpdate();
    });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.addEventListener?.('change', () => {
      seasonalEventId = null;
      renderSeasonalEvent();
    });
    GR.subscribeCatalogUpdates(() => {
      catalogRefreshFailed = false;
      renderCatalogUpdate();
    });
    window.setInterval(refreshCatalog, 15000);
    window.setInterval(renderSeasonalEvent, 60000);
    window.addEventListener('focus', refreshCatalog);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        seasonalEventId = null;
        renderSeasonalEvent();
        refreshCatalog();
      } else {
        stopSeasonalAnimation();
        seasonalEventId = null;
      }
    });

    $('#q').addEventListener('input', (e) => { state.q = e.target.value; renderGrid(); });
    $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); state.q = $('#q').value; goTo(state.cat === 'todas' || state.cat === 'ofertas' ? state.cat : 'todas'); });
    $('#sort')?.addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
    $('#cart-btn').addEventListener('click', () => { location.href = GR.pagePath('carrito.html'); });
    $('#checkout').addEventListener('click', checkout);
    $('#cart-clear').addEventListener('click', () => { if (confirm('¿Vaciar el carrito?')) { cart = []; saveCart(); } });
    $('#cat-toggle').addEventListener('click', () => {
      const open = $('#cat-drop').hidden;
      $('#cat-drop').hidden = !open;
      $('#cat-toggle').setAttribute('aria-expanded', open);
    });
    $('.nav-product-toggle').addEventListener('click', () => {
      const drop = $('#nav-product-drop');
      const open = drop.hidden;
      closeCatDrop();
      drop.hidden = !open;
      $('.nav-product-toggle').setAttribute('aria-expanded', open);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.cat-menu')) closeCatDrop();
      if (!e.target.closest('.nav-product')) closeNavProducts();
      if (!e.target.closest('.user-menu')) document.querySelectorAll('.user-menu[open]').forEach((d) => d.removeAttribute('open'));
      const t = e.target.closest('button, a');
      if (!t) return;
      if (t.dataset.nav) { e.preventDefault(); goTo(t.dataset.nav); }
      if (t.dataset.cat) { categoryWasSelected = true; state.cat = t.dataset.cat; state.nav = ['todas', 'ofertas', ...GR.CATEGORIAS.map((c) => c.id)].includes(t.dataset.cat) ? t.dataset.cat : 'todas'; renderChips(); renderGrid(); renderNav(); }
      if (t.dataset.add) addToCart(t.dataset.add);
      if (t.hasAttribute('data-reset')) { categoryWasSelected = true; state.cat = 'todas'; state.q = ''; $('#q').value = ''; state.nav = 'todas'; renderChips(); renderGrid(); renderNav(); }
      if (t.dataset.qty) { const it = cart.find((i) => i.id === t.dataset.qty); if (it) { it.cantidad += Number(t.dataset.d); saveCart(); } }
      if (t.dataset.remove) { cart = cart.filter((i) => i.id !== t.dataset.remove); saveCart(); }
      if (t.hasAttribute('data-close-cart')) closeCart();
      if (t.hasAttribute('data-login')) GR.openAuth('login');
      if (t.hasAttribute('data-logout')) GR.logout();
    });
    $('#cart').addEventListener('click', (e) => { if (e.target.id === 'cart') closeCart(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#cart').hidden) closeCart();
      closeCatDrop(); closeNavProducts();
    });

    window.addEventListener('gr:session', () => { renderUser(); renderCart(); });
    // Cambios hechos en otra pestaña (por ejemplo, el panel de empresa).
    window.addEventListener('storage', (event) => {
      cart = GR.read('carrito', []);
      let catalogChanged = false;
      if (GR.sheetsConnected && ['grinser_productos', 'grinser_categorias'].includes(event.key)) {
        const productsFromStorage = event.key === 'grinser_productos' ? GR.read('productos', null) : GR.getProducts();
        const categoriesFromStorage = event.key === 'grinser_categorias' ? GR.read('categorias', null) : GR.CATEGORIAS;
        if (Array.isArray(productsFromStorage) && Array.isArray(categoriesFromStorage)) {
          try {
            if (GR.applyCatalogSnapshot({ products: productsFromStorage, categories: categoriesFromStorage })) {
              renderCatalogUpdate();
              catalogChanged = true;
            }
          } catch (error) {
            GR.toast(`No se pudo aplicar el cambio del catálogo: ${error.message}`, 'error');
          }
        }
      } else if (!GR.sheetsConnected) {
        products = GR.getProducts();
        const categories = GR.read('categorias', null);
        if (Array.isArray(categories)) GR.CATEGORIAS = categories;
        renderChips(); renderCatCards(); renderCatDrop(); saveCart();
      }
      if (GR.sheetsConnected && !catalogChanged) { renderCart(); renderGrid(); }
      renderUser();
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1') GR.openAuth('login');
    if (params.get('carrito') === '1') location.replace(GR.pagePath('carrito.html'));
  });
})();
