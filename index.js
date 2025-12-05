// Optimized preloading with better error handling and resource prioritization
(async function () {
  try {
    window.__preloadedPages = window.__preloadedPages || {};
    window.__preloadedData = window.__preloadedData || null;

    // Prefetch critical resources in parallel with priority
    const preloadPromises = [
      fetch('pages/devices.html', { cache: 'no-cache' })
        .then(resp => resp.ok ? resp.text() : null)
        .then(txt => {
          if (txt) {
            window.__preloadedPages['pages/devices.html'] = txt;
            window.__preloadedPages['/devices'] = txt;
            window.__preloadedPages['/download'] = txt;
          }
        })
        .catch(() => { }),

      fetch('data/devices.json', { cache: 'no-cache' })
        .then(resp => resp.ok ? resp.json() : null)
        .then(data => {
          if (data) window.__preloadedData = data;
        })
        .catch(() => { })
    ];

    await Promise.allSettled(preloadPromises);

    // Cache API population (non-blocking)
    // Cache API disabled
    // if ('caches' in window) {
    //   caches.open('preload-v1')
    //     .then(cache => cache.addAll(['pages/devices.html', 'data/devices.json']))
    //     .catch(() => {});
    // }
  } catch (e) {
    console.error('preload bootstrap failed', e);
  }
})();

// Screenshots carousel initializer (no phone frame)
(function () {
  function initScreenshotsCarousel(rootSection) {
    if (!rootSection || rootSection.dataset.carouselBound === '1') return;

    let slides = Array.from(rootSection.querySelectorAll('.carousel-slide'));
    let dots = [];
    const prev = rootSection.querySelector('[data-action="prev"]');
    const next = rootSection.querySelector('[data-action="next"]');
    const carousel = rootSection.querySelector('.carousel');

    if (!slides.length || !prev || !next) return;

    let N = slides.length;
    // Start index: read from data-start-index, default to 0 (first item)
    let currentIndex = 0;
    const startAttr = parseInt(carousel?.getAttribute('data-start-index'), 10);
    if (Number.isFinite(startAttr)) {
      const normIdx = ((startAttr % N) + N) % N;
      currentIndex = normIdx;
    }

    // Ensure pagination container exists
    let paginationEl = rootSection.querySelector('.pagination');
    if (!paginationEl && carousel) {
      paginationEl = document.createElement('div');
      paginationEl.className = 'pagination';
      paginationEl.setAttribute('aria-label', 'Screenshots pagination');
      carousel.appendChild(paginationEl);
    }

    // Responsive spacing calculations
    let shotW = 280;
    let gap = 40;
    let x1 = 0; // neighbor offset
    let x2 = 0; // far offset (hidden)

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const getCssPxVar = (el, varName, fallback) => {
      const val = getComputedStyle(el).getPropertyValue(varName).trim();
      const n = parseFloat(val);
      return Number.isFinite(n) ? n : fallback;
    };
    const getAttrNum = (el, name, fallback) => {
      const v = parseFloat(el?.getAttribute(name));
      return Number.isFinite(v) ? v : fallback;
    };

    function computeLayoutVars() {
      const containerW = (carousel?.clientWidth || rootSection.clientWidth || window.innerWidth);
      const minGap = getAttrNum(carousel, 'data-gap-min', 16);
      const maxGap = getAttrNum(carousel, 'data-gap-max', 72);
      const factor = getAttrNum(carousel, 'data-gap-factor', 0.06);

      // Use CSS --shot-w when available; fallback to first slide's width
      shotW = getCssPxVar(rootSection, '--shot-w', slides[0]?.offsetWidth || 280);
      gap = clamp(containerW * factor, minGap, maxGap);

      // Neighbor offset: a bit more than half width + responsive gap
      x1 = Math.round(shotW * 0.55 + gap);
      // Far offset: almost full width + extra gap (kept hidden via opacity/visibility)
      x2 = Math.round(shotW * 0.95 + gap * 2);
    }

    computeLayoutVars();

    const norm = (i) => ((i % N) + N) % N;
    const circOffset = (i) => {
      // shortest signed distance on a ring
      let d = i - currentIndex;
      if (d > N / 2) d -= N;
      if (d < -N / 2) d += N;
      return d;
    };

    function buildDots() {
      if (!paginationEl) return;
      paginationEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < N; i++) {
        const b = document.createElement('button');
        b.className = 'dot' + (i === currentIndex ? ' active' : '');
        b.dataset.slide = String(i);
        b.setAttribute('aria-label', `Go to slide ${i + 1}`);
        b.setAttribute('aria-current', i === currentIndex ? 'true' : 'false');
        b.addEventListener('click', () => goTo(i));
        frag.appendChild(b);
      }
      paginationEl.appendChild(frag);
      dots = Array.from(paginationEl.querySelectorAll('.dot'));
    }

    function getTransform(offset) {
      const abs = Math.abs(offset);
      const sign = offset === 0 ? 0 : offset > 0 ? 1 : -1;
      if (abs === 0) return 'translateX(0px) translateZ(0px) rotateY(0deg) scale(1)';
      if (abs === 1) return `translateX(${sign * x1}px) translateZ(-60px) rotateY(${-sign * 10}deg) scale(0.9)`;
      // farther than neighbors -> pushed out; remains hidden by opacity
      return `translateX(${sign * x2}px) translateZ(-140px) rotateY(${-sign * 20}deg) scale(0.7)`;
    }
    function getOpacity(offset) {
      const abs = Math.abs(offset);
      if (abs === 0) return 1;
      if (abs === 1) return 0.85;
      return 0; // hide anything beyond nearest neighbors
    }
    function getZIndex(offset) {
      const abs = Math.abs(offset);
      if (abs >= 2) return 0;
      return 10 - abs; // center (10), neighbors (9)
    }
    function getFilter(offset) {
      const abs = Math.abs(offset);
      if (abs >= 2) return 'none';
      return abs === 0 ? 'none' : 'blur(1px) brightness(0.9)';
    }

    function update() {
      slides.forEach((slide, index) => {
        const offset = circOffset(index);
        const abs = Math.abs(offset);

        slide.style.transform = getTransform(offset);
        slide.style.opacity = getOpacity(offset);
        slide.style.zIndex = String(getZIndex(offset));
        slide.style.filter = getFilter(offset);
        slide.style.pointerEvents = abs >= 2 ? 'none' : 'auto';
        // visibility is forced visible by CSS for smooth fades; leave as-is
      });

      dots.forEach((d, i) => {
        const active = i === currentIndex;
        d.classList.toggle('active', active);
        d.setAttribute('aria-current', active ? 'true' : 'false');
      });

      prev.disabled = false;
      next.disabled = false;
    }

    function goTo(index) {
      currentIndex = norm(index);
      update();
    }

    prev.addEventListener('click', () => goTo(currentIndex - 1));
    next.addEventListener('click', () => goTo(currentIndex + 1));
    buildDots();

    // Swipe support
    let startX = null;
    rootSection.addEventListener('pointerdown', (e) => { startX = e.clientX; }, { passive: true });
    rootSection.addEventListener('pointerup', (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) goTo(currentIndex + 1);
        else goTo(currentIndex - 1);
      }
      startX = null;
    });

    // Optimized resize handling with debouncing
    let resizeTimeout;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        computeLayoutVars();
        update();
      }, 100);
    };

    if ('ResizeObserver' in window && carousel) {
      const ro = new ResizeObserver(handleResize);
      ro.observe(carousel);
    } else {
      window.addEventListener('resize', handleResize, { passive: true });
    }

    // React to DOM changes: adding/removing .carousel-slide will rebuild slides and dots
    const track = rootSection.querySelector('.carousel-track');
    if (track && 'MutationObserver' in window) {
      const mo = new MutationObserver(() => {
        slides = Array.from(rootSection.querySelectorAll('.carousel-slide'));
        N = slides.length || 1;
        currentIndex = norm(currentIndex);
        computeLayoutVars();
        buildDots();
        update();
      });
      mo.observe(track, { childList: true, subtree: false });
    }

    update();
    rootSection.dataset.carouselBound = '1';
  }

  function tryInit() {
    const el = document.getElementById('screenshots');
    if (el) initScreenshotsCarousel(el);
  }

  // Run on first DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }

  // Observe SPA content changes (#app replaced by router)
  const app = document.getElementById('app');
  if (app && 'MutationObserver' in window) {
    const mo = new MutationObserver(() => {
      const el = document.getElementById('screenshots');
      if (el && el.dataset.carouselBound !== '1') initScreenshotsCarousel(el);
    });
    mo.observe(app, { childList: true, subtree: true });
  }
})();
