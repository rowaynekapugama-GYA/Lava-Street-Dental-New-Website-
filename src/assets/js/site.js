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

  /* ---------- Contact enquiry form ----------
     Inline validation, then a POST to /api/enquiry/ (Vercel function, emails
     via SMTP2GO). Errors show inline; the button is disabled while sending. */
  var enquiry = document.getElementById('enquiryForm');
  if (enquiry) {
    var note = document.getElementById('enquiryNote');
    var status = document.getElementById('enquiryStatus');
    var startedAt = document.getElementById('eqStartedAt');
    if (startedAt) { startedAt.value = String(Date.now()); }
    var fallback = enquiry.getAttribute('data-fallback') || '';
    var isAuPhone = function (v) {
      var d = v.replace(/[\s().-]/g, '');
      if (d.indexOf('+61') === 0) { d = '0' + d.slice(3); }
      return /^0[2-478]\d{8}$/.test(d);
    };
    var rules = [
      { id: 'eqFirst', key: 'firstName', msg: 'We just need a first name.', test: function (v) { return v.length > 0; } },
      { id: 'eqEmail', key: 'email', msg: 'Could you check that email address?', test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); } },
      { id: 'eqPhone', key: 'phone', msg: 'Please enter an Australian number, for example 0412 345 678.', test: function (v) { return v === '' || isAuPhone(v); } },
      { id: 'eqMsg', key: 'message', msg: 'Let us know how we can help.', test: function (v) { return v.length > 0; } },
      { id: 'eqConsent', key: 'consent', msg: 'Please tick the box so we can reply.', check: true, test: function () { return document.getElementById('eqConsent').checked; } }
    ];
    var val = function (r) { return r.check ? '' : document.getElementById(r.id).value.trim(); };
    var setMark = function (r, ok, text) {
      var input = document.getElementById(r.id);
      var msg = document.getElementById(r.id + 'Msg');
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (msg) { msg.textContent = ok ? '' : (text || r.msg); }
      return ok;
    };
    var busy = false;
    enquiry.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) { return; }
      status.textContent = '';
      note.textContent = '';
      var firstBad = null;
      rules.forEach(function (r) { if (!setMark(r, r.test(val(r))) && !firstBad) { firstBad = document.getElementById(r.id); } });
      if (firstBad) { firstBad.focus(); return; }
      var button = enquiry.querySelector('.btn-submit');
      var label = button.textContent;
      busy = true;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Sending\u2026';
      var payload = {
        firstName: document.getElementById('eqFirst').value.trim(),
        lastName: document.getElementById('eqLast').value.trim(),
        email: document.getElementById('eqEmail').value.trim(),
        phone: document.getElementById('eqPhone').value.trim(),
        message: document.getElementById('eqMsg').value.trim(),
        consent: document.getElementById('eqConsent').checked,
        company: document.getElementById('eqCompany').value,
        startedAt: startedAt ? startedAt.value : ''
      };
      fetch('/api/enquiry/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (data) {
          if (data.ok) {
            enquiry.reset();
            rules.forEach(function (r) { setMark(r, true); });
            note.className = 'wl-note ok';
            note.textContent = 'Thanks, ' + payload.firstName + '. Your message is on its way and we will be in touch soon.';
            return;
          }
          if (data.fields) {
            var first = null;
            rules.forEach(function (r) { if (data.fields[r.key]) { setMark(r, false, data.fields[r.key]); if (!first) { first = document.getElementById(r.id); } } });
            if (first) { first.focus(); }
          }
          status.textContent = (data.error || 'Sorry, something went wrong.') + fallback;
        })
        .catch(function () { status.textContent = 'We could not reach the server. Please check your connection and try again.' + fallback; })
        .then(function () {
          busy = false;
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.textContent = label;
        });
    });
  }
}());
