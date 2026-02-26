/* main.js */
'use strict';

/* ====== Utiles ====== */
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

/* ====== Año dinámico en el footer ====== */
(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

/* ====== Header sólido al hacer scroll ====== */
(() => {
  const header = document.querySelector('header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  // estado inicial por si la página abre ya scrolleada
  onScroll();
})();

/* ====== Menú móvil (overlay + panel) ====== */
(() => {
  const btn   = document.getElementById('nav-toggle');
  const panel = document.getElementById('primary-nav');
  const scrim = document.getElementById('scrim');
  if (!btn || !panel || !scrim) return;

  let lastFocus = null;

  function setAria(open){
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function openMenu(){
    lastFocus = document.activeElement;

    panel.classList.add('is-open');
    scrim.classList.add('is-open');
    scrim.hidden = false;

    document.body.classList.add('no-scroll');
    setAria(true);

    // focus al primer link/botón del panel
    const first = panel.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  }

  function closeMenu(){
    panel.classList.remove('is-open');
    scrim.classList.remove('is-open');

    document.body.classList.remove('no-scroll');
    setAria(false);

    // ocultar scrim al terminar la transición
    setTimeout(() => {
      if (!scrim.classList.contains('is-open')) scrim.hidden = true;
    }, 220);

    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function isOpen(){
    return panel.classList.contains('is-open');
  }

  btn.addEventListener('click', () => {
    isOpen() ? closeMenu() : openMenu();
  });

  // Cerrar click en overlay (scrim)
  scrim.addEventListener('click', closeMenu);

  // Cerrar con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeMenu();
  });

  // Cerrar al click en links del panel
  panel.addEventListener('click', (e) => {
    if (e.target.closest('a') && isOpen()) closeMenu();
  });

  // Al pasar a desktop, asegurar estado correcto
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 861 && isOpen()) closeMenu();
  });

  // Estado inicial consistente
  setAria(false);
  scrim.hidden = true;
})();


/* ====== Copiar email (expuesto global) ====== */
window.copyEmail = function copyEmail() {
  const emailEl = document.getElementById('email-value');
  if (!emailEl) return;
  const email = emailEl.textContent.trim();

  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = email;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      notifyCopied();
    } catch {
      alert('No se pudo copiar.');
    }
  };

  const notifyCopied = () => {
    const btn = document.getElementById('copy-btn');
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = '¡Copiado!';
    const live = document.getElementById('copy-status');
    if (live) live.textContent = 'Email copiado al portapapeles';
    setTimeout(() => {
      btn.textContent = original;
      if (live) live.textContent = '';
    }, 1400);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(notifyCopied).catch(fallback);
  } else {
    fallback();
  }
};

/* ====== Filtro de proyectos (expuesto global) ====== */
window.filterProjects = function filterProjects(tag, el) {
  $all('[data-project]').forEach(card => {
    const tags = (card.dataset.tags || '');
    const ok = (tag === 'all' || tags.includes(tag));
    card.hidden = !ok;
  });
  $all('[data-filter]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (el) el.setAttribute('aria-pressed', 'true');

  try {
    const u = new URL(location.href);
    u.searchParams.set('tag', tag);
    history.replaceState({}, '', u);
  } catch { /* no-op en entornos sin History */ }
};

/* ====== Cards PDF clicables + teclado ====== */
(() => {
  const wireCards = () => {
    $all('.open-pdf').forEach(card => {
      // Evitar doble registro si se llama dos veces
      if (card.__wired) return;
      card.__wired = true;

      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return; // respetar clicks en enlaces internos
        const pdf = card.getAttribute('data-pdf');
        if (pdf) window.open(pdf, '_blank', 'noopener,noreferrer');
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') card.click();
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireCards, { once: true });
  } else {
    wireCards();
  }
})();

/* ====== Aplicar filtro desde la URL al cargar ====== */
(() => {
  const applyInitialFilter = () => {
    let t = 'all';
    try {
      const u = new URL(location.href);
      t = u.searchParams.get('tag') || 'all';
    } catch { /* fallback all */ }

    const btn = document.querySelector(`[data-filter="${t}"]`);
    // Usa la función global para mantener sincronización de estado/URL
    window.filterProjects(t, btn || null);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyInitialFilter, { once: true });
  } else {
    applyInitialFilter();
  }
})();

/* ====== Filtros de proyectos (académico / personal / todos) ====== */
(function () {
  const grid = document.querySelector('[data-projects-grid]');
  const buttons = document.querySelectorAll('.filter-btn');
  if (!grid || !buttons.length) return;

  function applyFilter(filter) {
    const cards = grid.querySelectorAll('[data-category]');
    cards.forEach(card => {
      const cat = card.getAttribute('data-category');
      const show = (filter === 'todos') || (cat === filter);
      card.style.display = show ? '' : 'none';
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // estado visual + accesible
      buttons.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      applyFilter(btn.dataset.filter);
    });
  });

  // Estado inicial
  applyFilter('todos');
})();

/* ====== Botón "Ver más" para listas .steps ====== */
(() => {
  function initStepsToggles() {
    $all('[data-steps-toggle]').forEach((btn, index) => {
      // Evitar doble registro
      if (btn.__wired) return;
      btn.__wired = true;

      const article = btn.closest('article');
      if (article && article.classList.contains('ctf-pro')) return;

      const steps = article.querySelector('.steps');
      if (!steps) return;

      // Asegurar un id único para aria-controls
      if (!steps.id) {
        steps.id = `steps-${index}-${Math.random().toString(36).slice(2, 7)}`;
      }

      // Estado inicial: pasos ocultos
      steps.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', steps.id);

      btn.addEventListener('click', () => {
        const willShow = steps.hidden; // si está oculto, lo vamos a mostrar
        steps.hidden = !willShow;
        btn.textContent = willShow ? 'Ver menos' : 'Ver más';
        btn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStepsToggles, { once: true });
  } else {
    initStepsToggles();
  }
})();
function initMobileMenu() {
  const mobile = document.getElementById('mobileMenu');
  const openBtn = document.getElementById('openMenu');
  const closeBtn = document.getElementById('closeMenu');
  if (!mobile || !openBtn) return;

  let lastFocused = null;

  function setAria(open) {
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobile.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function openMobile() {
    lastFocused = document.activeElement;

    mobile.hidden = false;
    mobile.classList.add('is-open');
    document.body.classList.add('no-scroll');
    setAria(true);

    const firstLink = mobile.querySelector('.mobile-panel a, .mobile-panel button');
    if (firstLink) firstLink.focus();

    document.addEventListener('keydown', onKeydown);
  }

  function closeMobile() {
    mobile.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setAria(false);
    mobile.hidden = true;

    document.removeEventListener('keydown', onKeydown);

    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') closeMobile();
  }

  openBtn.addEventListener('click', openMobile);
  if (closeBtn) closeBtn.addEventListener('click', closeMobile);

  // Cerrar al click en el overlay
  mobile.addEventListener('click', (e) => {
    if (e.target === mobile) closeMobile();
  });

  // Cerrar al click en enlaces
  mobile.querySelectorAll('.mobile-panel a').forEach(a => {
    a.addEventListener('click', closeMobile);
  });
}

document.addEventListener('DOMContentLoaded', initMobileMenu);

/* ===== Botón volver arriba ===== */
(() => {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  const toggleBtn = () => {
    const show = window.scrollY > 400;
    btn.hidden = !show;
    btn.classList.toggle('show', show);
  };

  window.addEventListener('scroll', toggleBtn, { passive:true });
  toggleBtn(); // estado inicial

  btn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
})();

/* ===== CTF Carousel + Expand inline ===== */
(() => {
  function initCtfCarouselInline() {
    const carousel = document.querySelector('[data-ctf-carousel]');
    if (!carousel) return;

    const track = carousel.querySelector('[data-ctf-track]');
    const btnPrev = carousel.querySelector('[data-ctf-prev]');
    const btnNext = carousel.querySelector('[data-ctf-next]');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('article.ctf-pro'));
    if (!cards.length) return;

    // Cierra todas excepto una
    function closeAll(exceptCard) {
      cards.forEach(card => {
        if (exceptCard && card === exceptCard) return;
        card.dataset.open = "false";
        const b = card.querySelector('[data-steps-toggle]');
        if (b) b.textContent = "Ver más";
      });
    }

    // Toggle de una card
    function toggleCard(card) {
      const isOpen = card.dataset.open === "true";
      closeAll(card); // comportamiento tipo acordeón (una abierta)
      card.dataset.open = isOpen ? "false" : "true";

      const b = card.querySelector('[data-steps-toggle]');
      if (b) b.textContent = isOpen ? "Ver más" : "Ver menos";

      // centra en viewport cuando abres
      if (!isOpen) {
        card.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      }
    }

    // Scroll por card
    function scrollByCard(dir) {
      const first = cards[0];
      if (!first) return;
      const gap = 14; // igual que CSS
      const w = first.getBoundingClientRect().width + gap;
      track.scrollBy({ left: dir * w, behavior: 'smooth' });
    }

    if (btnPrev) btnPrev.addEventListener('click', () => scrollByCard(-1));
    if (btnNext) btnNext.addEventListener('click', () => scrollByCard(1));

    // Click "Ver más" -> expand inline (sin popup)
    track.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-steps-toggle]');
      if (!toggleBtn) return;

      const card = e.target.closest('article.ctf-pro');
      if (!card) return;

      e.preventDefault();
      toggleCard(card);
    });

    // Navegación inline dentro de la card (si añadiste botones)
    track.addEventListener('click', (e) => {
      const prevBtn = e.target.closest('[data-ctf-inline-prev]');
      const nextBtn = e.target.closest('[data-ctf-inline-next]');
      if (!prevBtn && !nextBtn) return;

      const card = e.target.closest('article.ctf-pro');
      if (!card) return;

      e.preventDefault();
      const idx = cards.indexOf(card);
      const nextIdx = prevBtn
        ? (idx - 1 + cards.length) % cards.length
        : (idx + 1) % cards.length;

      const target = cards[nextIdx];
      closeAll(target);
      target.dataset.open = "true";
      const b = target.querySelector('[data-steps-toggle]');
      if (b) b.textContent = "Ver menos";
      target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    });

    // Estado inicial: todo cerrado
    closeAll(null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCtfCarouselInline, { once: true });
  } else {
    initCtfCarouselInline();
  }
})();
