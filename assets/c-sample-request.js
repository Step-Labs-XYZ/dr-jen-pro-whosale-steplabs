/* C Sample Request (sections/c-sample-request.liquid).
   The visitor fills the design's fields:
     1  first/last name, work email, practice website, practice name
     2  street, city, state, ZIP, the app's choice questions (as dropdowns whose options
        are read from the app's form), how they heard of us, licensed-practice
        confirmation -> sends the request
     3  optional account (Shopify create_customer), opened once the app confirms
   The request goes through Powerful Form Builder's form, rendered hidden in the
   section: on send its fields are filled from ours (cfg.fields, plus every field with
   data-sreq-app-field), and its own submit button is pressed. The app validates, stores the submission and sends its emails as usual;
   only its after-submit redirect is switched off so step 3 opens in place. */
(function () {
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // remember how the app's server answered the last send, to explain a failure
  let appSend = null;
  if (window.fetch && !window.fetch.cSreqWrapped) {
    const fetch0 = window.fetch;
    window.fetch = function (url) {
      const isSend = /\/api\/front\/form\/\d+\/send/.test(String(url && url.url || url));
      const req = fetch0.apply(this, arguments);
      if (isSend) {
        appSend = 'no response';
        req.then((res) => { appSend = `HTTP ${res.status}`; }, (err) => { appSend = `network: ${err && err.message}`; });
      }
      return req;
    };
    window.fetch.cSreqWrapped = true;
  }

  document.querySelectorAll('[data-sreq]').forEach((root) => {
    const cfg = JSON.parse(root.querySelector('[data-sreq-config]').textContent);
    const track = (event, data) => window.cReorderTrack && window.cReorderTrack(event, data);
    const request = root.querySelector('[data-sreq-request]');
    const sendBtn = root.querySelector('[data-sreq-send]');
    let sent = false;
    let waiting = null;

    const show = (step) => {
      root.dataset.sreqStep = step;
      root.querySelectorAll('[data-sreq-panel]').forEach((p) => { p.hidden = p.dataset.sreqPanel !== String(step); });
      request.hidden = step === 3;
      root.querySelectorAll('[data-sreq-dot]').forEach((d) => {
        const n = Number(d.dataset.sreqDot);
        d.classList.toggle('is-active', n === step);
        d.classList.toggle('is-done', n < step);
        if (n === step) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
    };
    const goTo = (step) => {
      show(step);
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const first = root.querySelector(`[data-sreq-panel="${step}"] :is(input:not([type="hidden"]), select)`);
      if (first) first.focus({ preventScroll: true });
    };

    // required fields of one step
    const valid = (step) => {
      const panel = root.querySelector(`[data-sreq-panel="${step}"]`);
      let ok = true;
      panel.querySelectorAll('input[required], select[required]').forEach((input) => {
        const filled = input.type === 'checkbox'
          ? input.checked
          : input.value.trim() !== '' && (input.type !== 'email' || EMAIL.test(input.value.trim()));
        if (filled) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', 'true');
        if (!filled && ok) { input.focus(); ok = false; }
      });
      panel.querySelector('[data-sreq-error]').textContent = ok ? '' : cfg.missing;
      return ok;
    };

    const val = (name) => request.elements[name].value.trim();
    const names = () => ({ first: val('first_name'), last: val('last_name') });

    // ---- Powerful Form Builder's hidden form
    const appForm = () => root.querySelector('[data-sreq-app] .globo-form-app form');
    const setApp = (form, name, value) => {
      form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
        // a choice: true/false ticks every box, text ticks the option with that value
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = typeof value === 'string' ? input.value === value : !!value;
        else input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    const fillApp = (form) => {
      const f = cfg.fields;
      const { first, last } = names();
      const address = [val('practice'), val('street'), val('city'), `${val('state')} ${val('zip')}`.trim()]
        .filter(Boolean).join(', ');
      setApp(form, f.first, first);
      setApp(form, f.last, last);
      setApp(form, f.email, val('email'));
      setApp(form, f.contact, `${first} ${last}`.trim());
      setApp(form, f.address, address);
      setApp(form, f.licensed, request.elements.licensed.checked);
      const extra = [...request.querySelectorAll('[data-sreq-app-field]')];
      extra.forEach((field) => setApp(form, field.dataset.sreqAppField, field.value.trim()));
      // anything the app still marks required is a question this design doesn't ask
      const asked = Object.values(f).concat(extra.map((field) => field.dataset.sreqAppField));
      form.querySelectorAll('[presence]').forEach((input) => {
        if (!asked.includes(input.name)) input.removeAttribute('presence');
      });
    };
    // our dropdowns take their options from the app's radios/checkboxes
    const fillOptions = (form) => {
      request.querySelectorAll('select[data-sreq-app-field]').forEach((select) => {
        const inputs = form.querySelectorAll(`[name="${select.dataset.sreqAppField}"]`);
        [...new Set([...inputs].map((input) => input.value))].forEach((v) => select.add(new Option(v, v)));
      });
    };
    const prepareApp = () => {
      const form = appForm();
      if (!form || form.dataset.sreqReady) return !!form;
      form.dataset.sreqReady = 'true';
      form.querySelectorAll('input, select, textarea, button, a').forEach((el) => el.setAttribute('tabindex', '-1'));
      watchAppErrors(form);
      fillOptions(form);
      // keep the visitor on this page after sending (step 3 opens instead of the app's redirect)
      const app = window.Globo && Globo.FormBuilder && Globo.FormBuilder.forms && Globo.FormBuilder.forms[cfg.formId];
      if (app && app.afterSubmit) app.afterSubmit = Object.assign({}, app.afterSubmit, { action: 'none' });
      return true;
    };

    const failed = (reason) => {
      clearTimeout(waiting);
      waiting = null;
      sendBtn.disabled = false;
      root.querySelector('[data-sreq-panel="2"] [data-sreq-error]').textContent = reason ? `${cfg.sendError} (${reason})` : cfg.sendError;
    };

    // the app writes the server's refusal into its (hidden) error message: show it
    const watchAppErrors = (form) => {
      const box = form.querySelector('.message.error');
      if (!box) return;
      new MutationObserver(() => {
        const text = box.textContent.replace(/\s+/g, ' ').trim();
        if (waiting && text) failed(appSend ? `${text}, ${appSend}` : text);
      }).observe(box, { childList: true, subtree: true, characterData: true });
    };

    const openAccount = () => {
      const account = root.querySelector('[data-sreq-account]');
      if (account) {
        const { first, last } = names();
        account.querySelector('[data-sreq-first]').value = first;
        account.querySelector('[data-sreq-last]').value = last;
        account.querySelector('[data-sreq-account-email]').value = val('email');
      }
      goTo(3);
    };

    root.querySelector('[data-sreq-next]').addEventListener('click', () => {
      if (!valid(1)) return;
      track('sample_request_step', { step: 2 });
      goTo(2);
    });
    // a corrected field stops being flagged
    const unflag = (e) => {
      if (e.target.getAttribute('aria-invalid') !== 'true') return;
      e.target.removeAttribute('aria-invalid');
      const panel = e.target.closest('[data-sreq-panel]');
      if (!panel.querySelector('[aria-invalid="true"]')) panel.querySelector('[data-sreq-error]').textContent = '';
    };
    request.addEventListener('input', unflag);
    request.addEventListener('change', unflag);
    root.querySelectorAll('[data-sreq-back]').forEach((btn) => {
      btn.addEventListener('click', () => goTo(Number(btn.dataset.sreqBack)));
    });

    request.addEventListener('submit', (e) => {
      e.preventDefault();
      if (waiting || !valid(2)) return;
      // already sent (came back from step 3): don't send it twice
      if (sent) { openAccount(); return; }
      const form = appForm();
      const submit = form && form.querySelector('button[type="submit"], .wizard__submit');
      if (!prepareApp() || !submit) { failed(); return; }
      fillApp(form);
      sendBtn.disabled = true;
      appSend = null;
      waiting = setTimeout(() => {
        const flagged = [...form.querySelectorAll('.globo-form-control.has-error')]
          .map((c) => (c.querySelector('.globo-label, label') || c).textContent.replace(/\s+/g, ' ').trim().slice(0, 40));
        failed(appSend || `not sent by the app${flagged.length ? `: ${flagged.join(', ')}` : ''}`);
      }, 20000);
      submit.disabled = false;
      submit.click();
    });

    document.addEventListener('globo.formbuilder.form.submitted', (e) => {
      if (!waiting || e.detail.form !== appForm()) return;
      clearTimeout(waiting);
      waiting = null;
      sendBtn.disabled = false;
      const res = e.detail.response;
      const ok = Array.isArray(res) ? res.some((r) => r && String(r.success) === 'true') : !!res;
      if (!ok) { failed(appSend); return; }
      sent = true;
      track('sample_request_sent', {});
      openAccount();
    });

    const account = root.querySelector('[data-sreq-account]');
    if (account) {
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

    // a create_customer error reloads the page: go straight back to step 3
    if (root.querySelector('[data-sreq-account-errors]')) {
      sent = true;
      show(3);
    }

    // the app renders its form after load
    if (!prepareApp()) {
      const mo = new MutationObserver(() => { if (prepareApp()) mo.disconnect(); });
      mo.observe(root.querySelector('[data-sreq-app]'), { childList: true, subtree: true });
    }
  });
})();
