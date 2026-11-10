/* C Sample Request (sections/c-sample-request.liquid).
   Steps 1-2 are one Shopify contact form shown in two panels; step 2 submits it.
   Shopify reloads the page after the post, so the name and email are kept in
   sessionStorage and step 3 (optional account) opens with them prefilled. */
(function () {
  document.querySelectorAll('[data-sreq]').forEach((root) => {
    const cfg = JSON.parse(root.querySelector('[data-sreq-config]').textContent);
    const form = root.querySelector('form.c-sreq__form');
    const KEY = 'c-sreq-contact';
    const track = (event, data) => window.cReorderTrack && window.cReorderTrack(event, data);

    const show = (step) => {
      root.querySelectorAll('[data-sreq-panel]').forEach((p) => { p.hidden = p.dataset.sreqPanel !== String(step); });
      root.querySelectorAll('[data-sreq-step-dot]').forEach((d) => {
        const n = Number(d.dataset.sreqStepDot);
        d.classList.toggle('is-active', n === step);
        d.classList.toggle('is-done', n < step);
        if (n === step) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
    };

    // required fields of one panel; marks the empty ones
    const valid = (panel) => {
      let ok = true;
      panel.querySelectorAll('input[required]').forEach((input) => {
        const bad = input.type === 'checkbox' ? !input.checked : !input.checkValidity();
        input.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad && ok) { input.focus(); ok = false; }
      });
      return ok;
    };

    root.querySelectorAll('[data-sreq-next]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const to = Number(btn.dataset.sreqNext);
        const from = btn.closest('[data-sreq-panel]');
        if (to > Number(from.dataset.sreqPanel) && !valid(from)) return;
        show(to);
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    if (form) {
      form.addEventListener('submit', (e) => {
        const panel = root.querySelector('[data-sreq-panel="2"]');
        const error = root.querySelector('[data-sreq-error]');
        if (!valid(root.querySelector('[data-sreq-panel="1"]'))) { e.preventDefault(); show(1); return; }
        if (!valid(panel)) { e.preventDefault(); error.textContent = cfg.missing; return; }
        error.textContent = '';
        const get = (n) => (form.querySelector(`[name="contact[${n}]"]`) || {}).value || '';
        form.querySelector('[data-sreq-body]').value = [
          cfg.intro,
          `${get('name')} · ${get('Practice name')} · ${get('email')}`,
          `${get('Street address')}, ${get('City')}, ${get('State')} ${get('ZIP')}`,
        ].join('\n');
        try { sessionStorage.setItem(KEY, JSON.stringify({ name: get('name'), email: get('email') })); } catch (err) { /* storage blocked */ }
        track('sample_request_sent', {});
        root.querySelector('[data-sreq-submit]').disabled = true;
      });
    }

    // after Shopify's reload: the request is in, offer the account
    const posted = new URLSearchParams(window.location.search).get('contact_posted') === 'true';
    if (root.querySelector('[data-sreq-sent]') || posted) {
      let saved = {};
      try { saved = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (err) { /* storage blocked */ }
      const account = root.querySelector('[data-sreq-account]');
      if (account) {
        const parts = String(saved.name || '').trim().split(/\s+/);
        account.querySelector('[data-sreq-first]').value = parts.shift() || '';
        account.querySelector('[data-sreq-last]').value = parts.join(' ');
        account.querySelector('[data-sreq-account-email]').value = saved.email || '';
        account.addEventListener('submit', (e) => {
          const pass = account.querySelector('[name="customer[password]"]');
          const confirm = account.querySelector('[data-sreq-confirm]');
          const error = account.querySelector('[data-sreq-pass-error]');
          if (pass.value !== confirm.value) {
            e.preventDefault();
            error.textContent = cfg.mismatch;
            confirm.setAttribute('aria-invalid', 'true');
            confirm.focus();
            return;
          }
          track('sample_request_account', {});
        });
      }
      show(3);
    } else {
      show(1);
    }
  });
})();
