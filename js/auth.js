'use strict';
// Grinser · cuentas, roles y ventana de inicio de sesión.
// Roles: 'admin' (panel de empresa) y 'cliente' (tienda). Las cuentas viven en localStorage:
// sirve para una demo en GitHub Pages, no para datos reales (no hay servidor que las proteja).
(function () {
  const GR = window.GR;
  GR.ROLES = { admin: 'Administrador', cliente: 'Cliente' };
  const norm = (e) => String(e || '').trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  async function hash(salt, text) {
    const data = new TextEncoder().encode(`grinser:${salt}:${text}`);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (const b of data) h = ((h << 5) + h + b) >>> 0; // respaldo si no hay crypto.subtle
    return 'x' + h.toString(16);
  }
  const newSalt = () => Math.random().toString(36).slice(2, 12);

  GR.getUsers = () => GR.read('usuarios', []);
  GR.saveUsers = (list) => GR.write('usuarios', list);

  /** Crea una cuenta (usado por el registro y por el panel de empresa). */
  GR.createUser = async ({ nombre, email, password, rol = 'cliente' }) => {
    nombre = String(nombre || '').trim(); email = norm(email);
    if (nombre.length < 3) throw new Error('Escribe tu nombre completo.');
    if (!EMAIL_RE.test(email)) throw new Error('Escribe un correo válido.');
    if (String(password || '').length < 8 || password.length > 64) throw new Error('La contraseña debe tener entre 8 y 64 caracteres.');
    const users = GR.getUsers();
    if (users.some((u) => u.email === email)) throw new Error('Ese correo ya está registrado.');
    const salt = newSalt();
    const user = { id: GR.uid('u'), nombre, email, rol: GR.ROLES[rol] ? rol : 'cliente', activo: true, salt, pass: await hash(salt, password), creado: new Date().toISOString() };
    GR.saveUsers([...users, user]);
    return user;
  };

  // Cuentas de prueba la primera vez que se abre la página en un navegador.
  GR.authReady = (async () => {
    if (GR.read('usuarios', null)) return;
    GR.saveUsers([]);
    await GR.createUser({ nombre: 'Administrador Grinser', email: 'admin@grinser.com', password: 'Admin12345', rol: 'admin' });
    await GR.createUser({ nombre: 'Cliente Demo', email: 'cliente@grinser.com', password: 'Cliente12345', rol: 'cliente' });
  })();

  GR.currentUser = () => {
    const id = GR.read('sesion', null);
    const u = id && GR.getUsers().find((x) => x.id === id);
    return u && u.activo ? u : null;
  };
  const emitSession = () => window.dispatchEvent(new CustomEvent('gr:session', { detail: GR.currentUser() }));

  // El inicio de sesión es compartido. En el panel de empresa se valida que la cuenta sea administradora.
  GR.login = async (email, password, modo = 'cliente') => {
    await GR.authReady;
    const u = GR.getUsers().find((x) => x.email === norm(email));
    if (!u || (await hash(u.salt, password || '')) !== u.pass) throw new Error('Correo o contraseña incorrectos.');
    if (!u.activo) throw new Error('Tu cuenta está desactivada. Comunícate con Grinser.');
    if (modo === 'empresa' && u.rol !== 'admin') throw new Error('Esta cuenta no tiene acceso al panel de empresa.');
    GR.write('sesion', u.id);
    emitSession();
    return u;
  };

  GR.register = async (data) => {
    await GR.authReady;
    const u = await GR.createUser({ ...data, rol: 'cliente' });
    GR.write('sesion', u.id);
    emitSession();
    return u;
  };

  GR.logout = () => {
    GR.write('sesion', null);
    GR.toast('Sesión cerrada.');
    emitSession();
  };

  // ── Persona de Grinser: polo azul (color del logo) con el logo en el pecho ──
  // mood: 'idle' (mira lo que escribes) | 'shy' (se tapa los ojos) | 'peek' (los abre) | 'error'
  const C = { polo: '#215f9a', poloDark: '#163f69', skin: '#f1c29c', skinDark: '#dca57c', hair: '#2b1d16' };
  const SHOULDER = { l: [50, 204], r: [170, 204] };
  const HANDS = {
    idle: [[44, 272], [176, 272]],  // brazos abajo, a los lados
    error: [[44, 272], [176, 272]],
    shy: [[93, 100], [127, 100]],   // tapando los ojos
    peek: [[80, 142], [140, 142]],  // en las mejillas, dejando ver
  };
  const armSVG = (side) => `
    <g class="p-arm p-arm-${side}">
      <path class="p-forearm" fill="none" stroke="${C.skin}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="p-sleeve" fill="none" stroke="${C.polo}" stroke-width="28" stroke-linecap="round"/>
      <path class="p-cuff" fill="none" stroke="${C.poloDark}" stroke-width="28"/>
      <g class="p-palm">
        <path d="M-12 5c0-12 5-20 12-20s12 8 12 20c0 6-5 9-12 9s-12-3-12-9Z" fill="${C.skin}" stroke="${C.skinDark}" stroke-width="1.5"/>
        <path d="M-5-10v7M0-12v8M5-10v7" stroke="${C.skinDark}" stroke-width="1.5" stroke-linecap="round"/>
      </g>
    </g>`;

  GR.personaSVG = () => `
  <svg class="persona p-idle" viewBox="0 0 220 230" aria-hidden="true" focusable="false">
    <defs><clipPath id="p-clip"><rect x="0" y="0" width="220" height="230"/></clipPath></defs>
    <g clip-path="url(#p-clip)">
      <g class="p-body">
        <!-- polo -->
        <path d="M22 240c0-44 22-70 60-78h56c38 8 60 34 60 78Z" fill="${C.polo}"/>
        <path d="M60 186c-5 14-7 32-7 54M160 186c5 14 7 32 7 54" stroke="${C.poloDark}" stroke-width="2" fill="none" opacity=".5"/>
        <!-- cuello de la persona -->
        <path d="M96 136h28v28c-8 8-20 8-28 0Z" fill="${C.skinDark}"/>
        <!-- cuello del polo y botones -->
        <path d="M82 162 110 186 99 199 74 170Z" fill="${C.poloDark}"/>
        <path d="M138 162 110 186 121 199 146 170Z" fill="${C.poloDark}"/>
        <rect x="106" y="186" width="8" height="34" rx="2" fill="${C.poloDark}"/>
        <circle cx="110" cy="196" r="2.2" fill="#fff"/><circle cx="110" cy="209" r="2.2" fill="#fff"/>
        <!-- logo de la empresa bordado en el pecho -->
        <image href="img/logo-grinser.png" x="120" y="196" width="56" height="17.5" preserveAspectRatio="xMidYMid meet"/>
        <!-- cabeza -->
        <ellipse cx="60" cy="102" rx="8" ry="11" fill="${C.skinDark}"/>
        <ellipse cx="160" cy="102" rx="8" ry="11" fill="${C.skinDark}"/>
        <ellipse cx="110" cy="98" rx="50" ry="54" fill="${C.skin}"/>
        <path d="M60 96C55 58 80 38 112 38s56 22 48 58c-6-16-16-26-30-30-14 9-40 12-58 7-6 5-10 13-12 23Z" fill="${C.hair}"/>
        <ellipse cx="80" cy="122" rx="8" ry="5" fill="#f08f80" opacity=".35"/>
        <ellipse cx="140" cy="122" rx="8" ry="5" fill="#f08f80" opacity=".35"/>
        <!-- cara: se mueve hacia lo que escribes -->
        <g class="p-face">
          <path class="p-brows" d="M80 83q11-6 22 0M118 83q11-6 22 0" stroke="${C.hair}" stroke-width="4" stroke-linecap="round" fill="none"/>
          <path class="p-brows-sad" d="M80 82q11 1 22 5M118 87q11-4 22-5" stroke="${C.hair}" stroke-width="4" stroke-linecap="round" fill="none"/>
          <g class="p-eyes">
            <ellipse class="p-eye" cx="92" cy="100" rx="6" ry="8" fill="#1f2433"/>
            <ellipse class="p-eye" cx="128" cy="100" rx="6" ry="8" fill="#1f2433"/>
            <circle cx="94.5" cy="97" r="2" fill="#fff"/><circle cx="130.5" cy="97" r="2" fill="#fff"/>
          </g>
          <path class="p-eyes-x" d="M86 95l10 5-10 5M134 95l-10 5 10 5" stroke="#1f2433" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M110 104q-5 8 0 12" stroke="${C.skinDark}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path class="p-mouth" d="M98 124q12 10 24 0" stroke="#9c4a3c" stroke-width="3" fill="none" stroke-linecap="round"/>
          <ellipse class="p-mouth-o" cx="110" cy="126" rx="5" ry="6" fill="#9c4a3c"/>
          <path class="p-mouth-sad" d="M99 129q11-8 22 0" stroke="#9c4a3c" stroke-width="3" fill="none" stroke-linecap="round"/>
        </g>
        ${armSVG('l')}
        ${armSVG('r')}
      </g>
    </g>
  </svg>`;

  // Dibuja un brazo: manga corta del polo desde el hombro, antebrazo y mano.
  // El codo depende de la altura de la mano: abajo el brazo cuelga, arriba se dobla hacia la cara.
  function drawArm(svg, side, hx, hy) {
    const g = svg.querySelector(`.p-arm-${side}`);
    const [sx, sy] = SHOULDER[side];
    const t = Math.max(0, Math.min(1, (sy - hy) / (sy - 100)));
    const ex = (sx + (side === 'l' ? -2 : 2)) * (1 - t) + (sx + (hx - sx) * 0.3) * t;
    const ey = (sy + 40) * (1 - t) + (sy - 30) * t;
    // La manga apunta hacia el antebrazo.
    const tx = ex + (hx - ex) * 0.3 - sx, ty = ey + (hy - ey) * 0.3 - sy;
    const len = Math.hypot(tx, ty) || 1;
    const ux = tx / len, uy = ty / len;
    const cx = sx + ux * 24, cy = sy + uy * 24;
    const f = (n) => n.toFixed(1);
    g.querySelector('.p-forearm').setAttribute('d', `M${f(sx)} ${f(sy)}L${f(ex)} ${f(ey)}L${f(hx)} ${f(hy)}`);
    g.querySelector('.p-sleeve').setAttribute('d', `M${f(sx - ux * 6)} ${f(sy - uy * 6)}L${f(cx)} ${f(cy)}`);
    g.querySelector('.p-cuff').setAttribute('d', `M${f(cx - ux * 4)} ${f(cy - uy * 4)}L${f(cx + ux)} ${f(cy + uy)}`);
    g.querySelector('.p-palm').setAttribute('transform', `translate(${f(hx)} ${f(hy)})`);
  }

  // Movimiento suave de las manos, con un pequeño rebote al llegar.
  const easeOutBack = (k) => { const c = 1.15; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Actualiza la persona. look: -1 … 1 (hacia dónde mira mientras escribes). */
  GR.setPersona = (svg, mood = 'idle', look = 0) => {
    if (!svg) return;
    svg.setAttribute('class', `persona p-${mood}`);
    svg.querySelector('.p-face').style.transform = `translateX(${Math.max(-1, Math.min(1, look)) * 6}px)`;
    const target = HANDS[mood] || HANDS.idle;
    if (svg._mood === mood && svg._pos) return;
    svg._mood = mood;
    const from = svg._pos || target;
    cancelAnimationFrame(svg._raf);
    const start = performance.now();
    const step = (now) => {
      const k = reduceMotion() ? 1 : Math.min(1, (now - start) / 480);
      const e = easeOutBack(k);
      svg._pos = from.map((p, i) => [p[0] + (target[i][0] - p[0]) * e, p[1] + (target[i][1] - p[1]) * e]);
      drawArm(svg, 'l', ...svg._pos[0]);
      drawArm(svg, 'r', ...svg._pos[1]);
      if (k < 1) svg._raf = requestAnimationFrame(step);
    };
    step(start);
  };

  // ── Ventana de inicio de sesión / registro ───────────────────────────
  const CAPTIONS = {
    login: '¡Hola! Soy del equipo Grinser. Te acompaño a tu cuenta.',
    register: '¡Bienvenido! Crea tu cuenta en segundos.',
    empresa: 'Acceso para el equipo de Grinser 🖨️',
    shy: 'No miro tu contraseña 🙈',
    peek: '¡Ups! Ahora sí la veo 👀',
    error: 'Algo no cuadra… revisa tus datos.',
  };
  const field = (id, label, icon, attrs, only = '') => `
    <div class="af-field"${only ? ` data-only="${only}"` : ''}>
      <label for="${id}">${label}</label>
      <div class="af-input">${GR.icon(icon, 18)}<input id="${id}" ${attrs}></div>
    </div>`;

  let ui = null;
  const st = { mode: 'login', modo: 'cliente', focus: null, showPass: false, failed: false, busy: false, onSuccess: null, lastFocus: null };

  function build() {
    const wrap = document.createElement('div');
    wrap.className = 'auth-overlay';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" class="auth-close" data-close aria-label="Cerrar">${GR.icon('x', 18)}</button>
        <aside class="auth-side" aria-hidden="true">
          <img class="auth-logo" src="img/logo-grinser.png" alt="" width="200" height="63">
          <div class="auth-stage"><div class="auth-persona">${GR.personaSVG()}</div></div>
          <p class="auth-caption"></p>
        </aside>
        <div class="auth-panel">
          <div class="auth-tabs" role="tablist" aria-label="Acceso">
            <button type="button" role="tab" data-mode="login">Iniciar sesión</button>
            <button type="button" role="tab" data-mode="register">Crear cuenta</button>
          </div>
          <div class="auth-title-row">
            <h2 id="auth-title" class="auth-title"></h2>
          </div>
          <p class="auth-sub"></p>
          <form novalidate>
            ${field('af-nombre', 'Nombre completo', 'user', 'name="nombre" autocomplete="name" maxlength="80"', 'register')}
            ${field('af-email', 'Correo', 'mail', 'name="email" type="email" autocomplete="email" placeholder="tucorreo@ejemplo.com" maxlength="120"')}
            <div class="af-field">
              <label for="af-pass">Contraseña</label>
              <div class="af-input">
                ${GR.icon('lock', 18)}
                <input id="af-pass" name="password" type="password" maxlength="64">
                <button type="button" class="af-eye" aria-pressed="false" aria-label="Mostrar contraseña">${GR.icon('eye-off', 18)}</button>
              </div>
              <span class="af-hint" data-only="register">Entre 8 y 64 caracteres.</span>
            </div>
            ${field('af-pass2', 'Confirmar contraseña', 'lock', 'name="password2" type="password" autocomplete="new-password" maxlength="64"', 'register')}
            <p class="err" role="alert" hidden></p>
            <button class="btn btn-primary af-submit" type="submit"><span class="af-submit-text"></span>${GR.icon('arrow-right', 17)}</button>
          </form>
          <p class="af-switch"></p>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const $ = (s) => wrap.querySelector(s);
    ui = { wrap, $, svg: $('.persona'), form: $('form'), err: $('.err'), pass: $('#af-pass'), pass2: $('#af-pass2'), email: $('#af-email'), nombre: $('#af-nombre'), eye: $('.af-eye') };

    wrap.querySelector('[data-close]').addEventListener('click', close);
    wrap.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => go(b.dataset.mode)));
    $('.af-switch').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
    ui.eye.addEventListener('click', () => { st.showPass = !st.showPass; render(); });

    wrap.querySelectorAll('input').forEach((inp) => {
      // Los campos de contraseña cuentan como «contraseña» para la persona (se tapa los ojos).
      const key = inp.id === 'af-pass2' ? 'af-pass' : inp.id;
      inp.addEventListener('focus', () => { st.focus = key; render(); });
      inp.addEventListener('blur', () => { st.focus = null; setTimeout(render, 0); });
      inp.addEventListener('input', () => { st.failed = false; render(); });
    });
    ui.form.addEventListener('submit', submit);
    wrap.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const els = [...ui.wrap.querySelectorAll('button, input, a[href]')].filter((x) => !x.disabled && x.offsetParent);
    if (!els.length) return;
    if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus(); }
  }

  function showErr(msg) { ui.err.textContent = msg; ui.err.hidden = !msg; }

  function render() {
    if (!ui) return;
    const { $ } = ui;
    const reg = st.mode === 'register';
    const empresa = !reg && st.modo === 'empresa';

    ui.wrap.querySelectorAll('[data-mode]').forEach((b) => { const on = b.dataset.mode === st.mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ui.wrap.querySelectorAll('[data-only="register"]').forEach((el) => { el.hidden = !reg; });
    ui.wrap.querySelector('[data-mode="register"]').hidden = empresa;

    $('#auth-title').textContent = empresa ? 'Acceso empresa' : reg ? 'Crear cuenta' : 'Iniciar sesión';
    $('.auth-sub').textContent = reg ? 'Guarda tus datos y haz tus pedidos más rápido.'
      : empresa ? 'Solo para administradores: ingresa al panel de gestión de Grinser.'
      : 'Ingresa para finalizar tus pedidos.';
    $('.af-submit-text').textContent = st.busy ? 'Procesando…' : empresa ? 'Ingresar al panel' : reg ? 'Crear cuenta' : 'Iniciar sesión';
    ui.form.querySelector('.af-submit').disabled = st.busy;
    $('.af-switch').innerHTML = empresa ? '' : reg
      ? '¿Ya tienes cuenta? <button type="button" class="link-btn" data-go="login">Inicia sesión</button>'
      : '¿No tienes cuenta? <button type="button" class="link-btn" data-go="register">Créala gratis</button>';

    ui.pass.type = ui.pass2.type = st.showPass ? 'text' : 'password';
    ui.pass.autocomplete = reg ? 'new-password' : 'current-password';
    ui.eye.setAttribute('aria-pressed', st.showPass);
    ui.eye.setAttribute('aria-label', st.showPass ? 'Ocultar contraseña' : 'Mostrar contraseña');
    ui.eye.innerHTML = GR.icon(st.showPass ? 'eye' : 'eye-off', 18);

    // La persona se tapa los ojos con la contraseña y mira el texto que escribes.
    const onPass = st.focus === 'af-pass' || (Boolean(ui.pass.value) && !st.focus);
    const mood = st.failed ? 'error' : onPass ? (st.showPass ? 'peek' : 'shy') : 'idle';
    const typed = st.focus === 'af-email' ? ui.email.value : st.focus === 'af-nombre' ? ui.nombre.value : null;
    const look = typed == null ? 0 : Math.min(typed.length, 28) / 14 - 1;
    GR.setPersona(ui.svg, mood, look);
    $('.auth-caption').textContent = mood === 'idle' ? CAPTIONS[empresa ? 'empresa' : st.mode] : CAPTIONS[mood];
  }

  function go(mode) {
    st.mode = mode; st.showPass = false; st.failed = false;
    ui.pass.value = ''; ui.pass2.value = '';
    showErr(''); render();
    setTimeout(() => (st.mode === 'register' ? ui.nombre : ui.email).focus(), 30);
  }

  async function submit(e) {
    e.preventDefault();
    if (st.busy) return;
    showErr(''); st.failed = false;
    const reg = st.mode === 'register';
    const fail = (msg, el) => { showErr(msg); st.failed = true; render(); el?.focus(); };
    if (reg && ui.nombre.value.trim().length < 3) return fail('Escribe tu nombre completo.', ui.nombre);
    if (!EMAIL_RE.test(ui.email.value.trim())) return fail('Escribe un correo válido.', ui.email);
    if (!ui.pass.value) return fail('Escribe tu contraseña.', ui.pass);
    if (reg && ui.pass.value.length < 8) return fail('La contraseña debe tener al menos 8 caracteres.', ui.pass);
    if (reg && ui.pass.value !== ui.pass2.value) return fail('Las contraseñas no coinciden.', ui.pass2);

    st.busy = true; render();
    try {
      const u = reg
        ? await GR.register({ nombre: ui.nombre.value, email: ui.email.value, password: ui.pass.value })
        : await GR.login(ui.email.value, ui.pass.value, st.modo);
      const cb = st.onSuccess;
      st.busy = false;
      close();
      GR.toast(reg ? `¡Cuenta creada! Hola, ${u.nombre.split(' ')[0]}.` : `¡Hola, ${u.nombre.split(' ')[0]}!`);
      // El administrador va a su panel; el cliente se queda en la tienda.
      if (u.rol === 'admin' && !/admin\.html$/.test(location.pathname)) { location.href = 'admin.html'; return; }
      cb?.(u);
    } catch (ex) {
      st.busy = false;
      fail(ex.message);
    }
  }

  function close() {
    if (!ui || ui.wrap.hidden) return;
    ui.wrap.hidden = true;
    document.body.classList.remove('no-scroll');
    // Al cerrar no se conserva la contraseña.
    ui.pass.value = ''; ui.pass2.value = '';
    st.showPass = false; st.failed = false; st.focus = null; st.onSuccess = null;
    st.lastFocus?.focus?.({ preventScroll: true });
  }

  /** Abre la ventana. opts: { modo: 'cliente' | 'empresa', onSuccess(user) } */
  GR.openAuth = (mode = 'login', opts = {}) => {
    if (!ui) build();
    st.lastFocus = document.activeElement;
    st.modo = opts.modo || 'cliente';
    st.onSuccess = opts.onSuccess || null;
    ui.wrap.hidden = false;
    document.body.classList.add('no-scroll');
    go(mode);
  };
  GR.closeAuth = close;
})();
