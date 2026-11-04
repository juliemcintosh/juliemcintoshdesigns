(() => {
  const doc = document.documentElement;
  doc.classList.remove('no-js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Mobile drawer */
  const menuBtn = document.querySelector('.menu-btn');
  const scrim = document.querySelector('.scrim');
  const setNav = (open) => {
    doc.classList.toggle('nav-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn?.addEventListener('click', () => setNav(!doc.classList.contains('nav-open')));
  scrim?.addEventListener('click', () => setNav(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

  /* Home: once the wide reel scrolls up, the top menu fades out and the sidebar fades in */
  const heroWrap = doc.classList.contains('is-home') && document.querySelector('.home-hero');
  if (heroWrap) {
    /* The line, name and menu animate on load and each time the top menu comes back */
    const playIntro = () => { doc.classList.remove('intro-play'); void doc.offsetWidth; doc.classList.add('intro-play'); };
    let past = null;
    const sync = () => {
      const now = heroWrap.getBoundingClientRect().bottom < innerHeight * 0.5;
      if (now === past) return;
      past = now;
      doc.classList.toggle('side-in', now);
      if (!now) playIntro();
    };
    addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    sync();
  }

  /* Pencil marks: drag with a mouse on any empty spot to draw. The layer ignores all pointer
     input, so links, forms, video, text selection, keyboard and touch scrolling work as usual.
     Marks are kept in page coordinates so they scroll with the page; they clear on leaving it. */
  const PENCIL_WIDTH = 3;
  const PENCIL_COLOURS = ['#ab4adf', '#3bfbfa', '#fcd41a', '#db53ae', '#2776e0', '#f98a27', '#a4ec91', '#5f9e10', '#4cefaa', '#c9786a'];
  const NO_DRAW = 'a, button, input, textarea, select, option, label, summary, video, audio, iframe, text, [role="button"], [contenteditable], [tabindex]:not([tabindex="-1"]), .zoomable, .lightbox, .scrim, .menu-btn';
  const layer = document.createElement('canvas');
  layer.className = 'pencil-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const pen = layer.getContext('2d');
  const marks = [];
  let mark = null, colourAt = 0, queued = false;
  const paint = () => {
    queued = false;
    const dpr = devicePixelRatio || 1, w = innerWidth, h = innerHeight;
    if (layer.width !== Math.round(w * dpr) || layer.height !== Math.round(h * dpr)) { layer.width = Math.round(w * dpr); layer.height = Math.round(h * dpr); }
    pen.setTransform(dpr, 0, 0, dpr, -scrollX * dpr, -scrollY * dpr);
    pen.clearRect(scrollX, scrollY, w, h);
    pen.lineWidth = PENCIL_WIDTH; pen.lineCap = 'round'; pen.lineJoin = 'round';
    for (const m of marks) {
      if (m.maxY < scrollY - PENCIL_WIDTH || m.minY > scrollY + h + PENCIL_WIDTH) continue;
      const p = m.points;
      pen.strokeStyle = m.colour;
      pen.beginPath();
      pen.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length - 2; i += 2) pen.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
      pen.lineTo(p[p.length - 2], p[p.length - 1]);
      pen.stroke();
    }
  };
  const repaint = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  /* Pressing on words keeps normal text selection */
  const onText = (e) => {
    const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY);
    const node = pos ? pos.offsetNode : document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startContainer;
    if (!node || node.nodeType !== 3 || !node.nodeValue.trim()) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].some((r) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  };
  const onScrollbar = (e) => e.target.clientWidth > 0 && (e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight);
  const stopMark = () => { mark = null; doc.classList.remove('is-drawing'); };
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (!(e.target instanceof Element) || e.target.closest(NO_DRAW) || onScrollbar(e) || onText(e)) return;
    mark = { colour: PENCIL_COLOURS[colourAt], points: [e.pageX, e.pageY], minY: e.pageY, maxY: e.pageY, shown: false };
    doc.classList.add('is-drawing');
  });
  addEventListener('pointermove', (e) => {
    if (!mark) return;
    if (!e.buttons) { stopMark(); return; }
    const p = mark.points, dx = e.pageX - p[p.length - 2], dy = e.pageY - p[p.length - 1];
    if (dx * dx + dy * dy < 4) return;
    /* A plain click leaves nothing behind: the mark only appears once the mouse moves */
    if (!mark.shown) {
      mark.shown = true;
      marks.push(mark);
      colourAt = (colourAt + 1) % PENCIL_COLOURS.length;
    }
    p.push(e.pageX, e.pageY);
    mark.minY = Math.min(mark.minY, e.pageY);
    mark.maxY = Math.max(mark.maxY, e.pageY);
    repaint();
  });
  addEventListener('pointerup', stopMark);
  addEventListener('pointercancel', stopMark);
  addEventListener('blur', stopMark);
  /* Right-click on an empty spot erases every mark. The browser's menu stays for links, controls,
     the home carousel, words and selected text, and everywhere once there is nothing left to erase. */
  addEventListener('contextmenu', (e) => {
    if (!marks.length || e.button !== 2 || !(e.target instanceof Element)) return;
    if (e.target.closest(NO_DRAW) || e.target.closest('.reel') || onText(e) || getSelection().toString()) return;
    e.preventDefault();
    stopMark();
    marks.length = 0;
    repaint();
  });
  addEventListener('dragstart', (e) => { if (mark) e.preventDefault(); });
  addEventListener('scroll', repaint, { passive: true });
  addEventListener('resize', repaint);

  /* Scroll reveal: stagger siblings marked .reveal */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    if (sibs.length > 1 && !el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 6) * 90}ms`);
    io.observe(el);
  });

  /* Bead dividers pop in one by one */
  document.querySelectorAll('.beads').forEach((row) => {
    [...row.children].forEach((b, i) => { b.style.transitionDelay = `${i * 70}ms`; });
    io.observe(row);
  });

  /* Hero reel */
  const reel = document.querySelector('.reel');
  if (reel) {
    const slides = [...reel.querySelectorAll('.reel__slide')];
    const dots = [...reel.querySelectorAll('.reel__dot')];
    const cap = reel.querySelector('.reel__caption');
    const pauseBtn = reel.querySelector('.reel__pause');
    const ms = Number(reel.dataset.ms || 6000);
    reel.style.setProperty('--reel-ms', `${ms}ms`);
    let i = 0, timer = null, paused = reduce;
    const show = (n) => {
      /* The outgoing slide keeps its slow zoom until it has fully faded, so it never snaps back to size */
      const out = slides[i];
      out.classList.remove('is-active'); dots[i]?.classList.remove('is-active');
      out.classList.add('is-leaving');
      setTimeout(() => { if (!out.classList.contains('is-active')) out.classList.remove('is-leaving'); }, 1700);
      i = (n + slides.length) % slides.length;
      const s = slides[i];
      s.classList.remove('is-leaving');
      s.classList.add('is-active');
      const d = dots[i]; if (d) { d.classList.remove('is-active'); void d.offsetWidth; d.classList.add('is-active'); }
      if (cap) { cap.href = s.dataset.href; cap.querySelector('[data-cap]').innerHTML = s.dataset.cap; }
      s.querySelectorAll('img[loading="lazy"]').forEach((im) => im.removeAttribute('loading'));
      const nxt = slides[(i + 1) % slides.length]; nxt.querySelector('img')?.removeAttribute('loading');
    };
    const tick = () => { clearTimeout(timer); if (!paused) timer = setTimeout(() => { show(i + 1); tick(); }, ms); };
    dots.forEach((d, n) => d.addEventListener('click', () => { show(n); tick(); }));
    pauseBtn?.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
      pauseBtn.innerHTML = paused ? '&#9654;' : '&#10073;&#10073;';
      reel.classList.toggle('is-paused', paused);
      tick();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else tick(); });
    show(0); tick();
  }

  /* Map path on the home doors: draw in, then beads appear along it */
  const map = document.querySelector('.map-path');
  if (map) {
    const path = map.querySelector('path');
    const beads = [...map.querySelectorAll('.bead')];
    const len = path.getTotalLength();
    beads.forEach((b, n) => {
      const p = path.getPointAtLength(len * (n + 1) / (beads.length + 1));
      b.setAttribute('cx', p.x); b.setAttribute('cy', p.y);
    });
    if (!reduce) {
      path.style.strokeDasharray = `${len}`; path.style.strokeDashoffset = `${len}`;
      const mo = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 2600, easing: 'cubic-bezier(.4,.1,.2,1)', fill: 'forwards' })
          .finished.then(() => { path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; });
        beads.forEach((b, n) => b.animate(
          [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 700, delay: 600 + n * 520, fill: 'forwards', easing: 'ease-out' }));
        mo.disconnect();
      }, { threshold: 0.3 });
      mo.observe(map.parentElement);
    } else beads.forEach((b) => { b.style.opacity = 1; });
  }

  /* Filters */
  document.querySelectorAll('[data-filters]').forEach((bar) => {
    const target = document.querySelector(bar.dataset.filters);
    const label = document.querySelector('[data-showing]');
    bar.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      bar.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      const f = chip.dataset.f;
      target.querySelectorAll('[data-kind]').forEach((card) => {
        const show = f === 'all' || card.dataset.kind.split(' ').includes(f);
        if (show && card.hidden) {
          card.hidden = false;
          if (!reduce) card.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
        } else if (!show) card.hidden = true;
      });
      if (label) label.textContent = `Showing: ${f === 'all' ? 'All stories' : chip.textContent}`;
    });
  });

  /* Flipbook (The Deceiviest) */
  document.querySelectorAll('.flipbook').forEach((fb) => {
    const pages = [...fb.querySelectorAll('.flip__page')];
    const roles = [...fb.querySelectorAll('.flip__roles li')];
    const count = fb.querySelector('.flip__count');
    let n = 0, t = null;
    const go = (k) => {
      const prev = pages[n];
      n = (k + pages.length) % pages.length;
      pages.forEach((p) => p.classList.remove('is-active', 'is-gone'));
      if (prev !== pages[n]) prev.classList.add('is-gone');
      pages[n].classList.add('is-active');
      const role = Number(pages[n].dataset.role);
      roles.forEach((r, ri) => r.classList.toggle('is-on', ri === role));
      if (count) count.textContent = `${n + 1} / ${pages.length}`;
    };
    const auto = () => { clearInterval(t); if (!reduce) t = setInterval(() => go(n + 1), 3200); };
    fb.querySelector('[data-prev]')?.addEventListener('click', () => { go(n - 1); auto(); });
    fb.querySelector('[data-next]')?.addEventListener('click', () => { go(n + 1); auto(); });
    const vo = new IntersectionObserver(([e]) => { if (e.isIntersecting) auto(); else clearInterval(t); });
    vo.observe(fb);
    go(0);
  });

  /* Lightbox */
  const zoomables = [...document.querySelectorAll('.zoomable')];
  if (zoomables.length) {
    const lb = document.createElement('div');
    lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = '<figure style="margin:0;display:grid;justify-items:center"><img alt=""><figcaption class="lightbox__cap"></figcaption></figure>' +
      '<button class="lightbox__close" aria-label="Close">&#10005;</button><button class="lightbox__prev" aria-label="Previous image">&#8592;</button><button class="lightbox__next" aria-label="Next image">&#8594;</button>';
    document.body.append(lb);
    const img = lb.querySelector('img'), cap = lb.querySelector('.lightbox__cap');
    let cur = 0, last = null;
    const group = (el) => zoomables.filter((z) => z.closest('[data-gallery]') === el.closest('[data-gallery]'));
    const open = (el) => {
      cur = zoomables.indexOf(el);
      const src = el.dataset.full || el.currentSrc || el.src;
      img.src = src; img.alt = el.alt || '';
      cap.textContent = el.dataset.caption || el.closest('figure')?.querySelector('figcaption')?.textContent || el.alt || '';
      lb.classList.add('is-open'); last = document.activeElement; lb.querySelector('.lightbox__close').focus();
    };
    const step = (d) => { const g = group(zoomables[cur]); const k = g.indexOf(zoomables[cur]); open(g[(k + d + g.length) % g.length]); };
    const close = () => { lb.classList.remove('is-open'); last?.focus(); };
    zoomables.forEach((z) => {
      z.tabIndex = 0; z.setAttribute('role', 'button');
      z.addEventListener('click', () => open(z));
      z.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(z); } });
    });
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    lb.querySelector('.lightbox__close').addEventListener('click', close);
    lb.querySelector('.lightbox__prev').addEventListener('click', () => step(-1));
    lb.querySelector('.lightbox__next').addEventListener('click', () => step(1));
    addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
  }

  /* Contact form: posts to the form service set in build.js. The site's code never holds an email address. */
  const form = document.querySelector('#contact-form');
  if (form) {
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      if (data.get('website')) return; // honeypot
      const endpoint = form.dataset.endpoint;
      if (!endpoint) { status.textContent = 'This form isn’t connected yet, so your message wasn’t sent.'; return; }
      status.textContent = 'Sending…';
      try {
        const r = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error();
        form.reset(); status.textContent = 'Thank you. Your note is on its way, and Julie will reply soon.';
      } catch { status.textContent = 'That didn’t send. Please try again in a little while.'; }
    });
  }
})();
