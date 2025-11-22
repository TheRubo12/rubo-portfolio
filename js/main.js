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

/* ====== Menú lateral accesible ====== */
(() => {
  const btn   = document.getElementById('nav-toggle');
  const panel = document.getElementById('primary-nav');
  const scrim = document.getElementById('scrim');
  if (!btn || !panel || !scrim) return;

  let lastFocus = null;

  function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overscrollBehavior = lock ? 'contain' : '';
  }

  function firstFocusable(container) {
    return container.querySelector('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
  }

  function openMenu() {
    lastFocus = document.activeElement;
    btn.setAttribute('aria-expanded', 'true');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('show'));

    lockScroll(true);

    const first = firstFocusable(panel);
    if (first) first.focus();
  }

  function closeMenu(options = {}) {
    const { fromResize = false } = options;

    btn.setAttribute('aria-expanded', 'false');
    panel.classList.remove('open');
    scrim.classList.remove('show');
    lockScroll(false);

    // En móvil: el panel se oculta y aria-hidden debe ser true
    // En escritorio (fromResize): el panel es visible como menú normal ⇒ aria-hidden false
    panel.setAttribute('aria-hidden', fromResize ? 'false' : 'true');

    setTimeout(() => {
      if (!panel.classList.contains('open')) scrim.hidden = true;
    }, 200);

    if (!fromResize && lastFocus && document.contains(lastFocus)) {
      lastFocus.focus();
    }
  }

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    expanded ? closeMenu() : openMenu();
  });

  scrim.addEventListener('click', () => closeMenu());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  panel.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeMenu();
  });

  // Al pasar a escritorio, cerramos modo cajón pero dejamos el menú accesible
  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) {
      closeMenu({ fromResize: true });
    }
  });
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
      if (!article) return;

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
