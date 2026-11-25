'use strict';
(function () {
  const GR = window.GR;
  if (!GR) throw new Error('Los datos de Grinser deben cargarse antes del botón de WhatsApp.');

  let widget = document.querySelector('#wa');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'wa';
    widget.className = 'wa';
    widget.innerHTML = `
      <div class="wa-bubble" id="wa-bubble" hidden>
        <button type="button" class="wa-bubble-close" aria-label="Cerrar mensaje"><i data-icon="x" data-size="14"></i></button>
        <b>¡Hola! 👋</b>
        <p>¿Buscas tóner, repuestos o una impresora? Escríbenos y te asesoramos.</p>
      </div>
      <a class="wa-btn" id="wa-btn" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">
        <span class="wa-ic"></span>
        <span class="wa-copy"><small>¿Necesitas ayuda?</small><b>Escríbenos</b></span>
      </a>`;
    document.body.append(widget);
  }

  const bubble = widget.querySelector('#wa-bubble');
  const button = widget.querySelector('#wa-btn');
  button.href = GR.waLink();
  widget.querySelector('.wa-ic').innerHTML = GR.waIcon(28);
  GR.paintIcons(widget);

  let seen = false;
  try { seen = sessionStorage.getItem('grinser_wa') === '1'; } catch {}
  const hide = () => {
    bubble.hidden = true;
    try { sessionStorage.setItem('grinser_wa', '1'); } catch {}
  };
  if (!seen) {
    window.setTimeout(() => {
      if (!document.body.classList.contains('no-scroll')) {
        bubble.hidden = false;
        window.setTimeout(hide, 9000);
      }
    }, 3500);
  }
  widget.querySelector('.wa-bubble-close').addEventListener('click', hide);
  button.addEventListener('click', hide);
})();
