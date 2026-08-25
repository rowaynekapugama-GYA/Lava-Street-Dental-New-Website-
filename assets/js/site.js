(function () {
  'use strict';
  var body = document.body;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Masthead hairline on scroll ---------- */
  var mast = document.getElementById('masthead');
  if (mast) {
    var onScroll = function () { mast.classList.toggle('stuck', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Desktop dropdowns ---------- */
  var drops = Array.prototype.slice.call(document.querySelectorAll('[data-drop]'));
  function closeDrops(except) {
    drops.forEach(function (d) {
      if (d !== except) {
        d.classList.remove('open');
        d.querySelector('button').setAttribute('aria-expanded', 'false');
      }
    });
  }
  drops.forEach(function (d) {
    var btn = d.querySelector('button');
    btn.addEventListener('click', function () {
      var open = !d.classList.contains('open');
      closeDrops(d);
      d.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-drop]')) { closeDrops(null); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') { return; }
    // Return focus to the trigger so keyboard users are not dropped back to the
    // top of the document when a panel closes.
    var openDrop = drops.filter(function (d) { return d.classList.contains('open'); })[0];
    closeDrops(null);
    if (openDrop) { openDrop.querySelector('button').focus(); }
  });

  /* ---------- Mobile drawer ---------- */
  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');
  function setDrawer(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.classList.toggle('open', open);
    if (open) { drawer.removeAttribute('hidden'); } else { drawer.setAttribute('hidden', ''); }
    body.classList.toggle('nav-open', open);
    if (open) { var a = drawer.querySelector('a, summary'); if (a) { a.focus(); } }
  }
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      setDrawer(burger.getAttribute('aria-expanded') !== 'true');
    });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) { setDrawer(false); } });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setDrawer(false); burger.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 860 && burger.getAttribute('aria-expanded') === 'true') { setDrawer(false); }
    });
  }

  /* ---------- Question accordions ---------- */
  var qs = Array.prototype.slice.call(document.querySelectorAll('.faq-q'));
  function setPanel(btn, open) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', String(open));
    panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '0px';
  }
  qs.forEach(function (btn) {
    setPanel(btn, btn.getAttribute('aria-expanded') === 'true');
    btn.addEventListener('click', function () {
      setPanel(btn, btn.getAttribute('aria-expanded') !== 'true');
    });
  });
  function remeasure() {
    qs.forEach(function (btn) { if (btn.getAttribute('aria-expanded') === 'true') { setPanel(btn, true); } });
  }
  window.addEventListener('resize', remeasure);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(remeasure); }

  /* ---------- Gentle reveals ---------- */
  var rising = document.querySelectorAll('.rise');
  if (still || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(rising, function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    Array.prototype.forEach.call(rising, function (el) { io.observe(el); });
  }

  /* ---------- Enquiry form: PREVIEW MODE. No endpoint supplied, so submission is
     always cancelled and the confirmation says plainly that nothing was sent.
     LAUNCH-TODO: wire the real endpoint before removing preventDefault(). ---------- */
  var enquiry = document.getElementById('enquiryForm');
  if (enquiry) {
    var note = document.getElementById('enquiryNote');
    enquiry.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('eqEmail');
      var value = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        note.className = 'wl-note err';
        note.textContent = 'Could you check that email address for us?';
        email.focus();
        return;
      }
      note.className = 'wl-note ok';
      note.textContent = 'Preview only — this form is not connected yet, so nothing was sent or saved. Developer TODO: wire the practice form endpoint, then restore the approved confirmation copy.';
      enquiry.reset();
    });
  }
}());
