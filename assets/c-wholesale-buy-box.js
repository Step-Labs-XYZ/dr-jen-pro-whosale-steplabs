/* Wholesale PDP buy box (snippets/c-wholesale-buy-box.liquid).
   Picks the variant from the option pills, keeps packs x units and the CTA total live,
   and only sends selling_plan when the buyer picks the subscription (one-time default). */
(function () {
  document.querySelectorAll('[data-wsbb]').forEach((root) => {
    if (root.dataset.wsbbReady) return;
    root.dataset.wsbbReady = '1';
    const data = JSON.parse(root.querySelector('[data-wsbb-data]').textContent);
    const form = root.querySelector('[data-wsbb-form]');
    const idInput = root.querySelector('[data-wsbb-id]');
    const qtyInput = root.querySelector('[data-wsbb-qty]');
    const plan = root.querySelector('[data-wsbb-plan]');
    const cta = root.querySelector('[data-wsbb-cta]');

    const money = (cents) => new Intl.NumberFormat('en-US', {
      style: 'currency', currency: data.currency || 'USD', minimumFractionDigits: 2,
    }).format(cents / 100);
    const qty = () => Math.max(1, Math.min(999, parseInt(qtyInput.value, 10) || 1));
    const selected = () => [...root.querySelectorAll('[data-wsbb-option]:checked')]
      .sort((a, b) => a.dataset.wsbbOption - b.dataset.wsbbOption).map((i) => i.value);
    const variant = () => {
      const opts = selected();
      return data.variants.find((v) => v.options.every((o, i) => opts[i] === undefined || opts[i] === o)) || data.variants[0];
    };
    const mode = () => (root.querySelector('[data-wsbb-mode]:checked') || {}).value || 'once';
    const unitsPerPack = (v) => {
      if (data.packPos < 0) return 0;
      const m = String(v.options[data.packPos]).match(/(\d+)\s*pack/i);
      return m ? Number(m[1]) : 0;
    };

    const update = () => {
      const v = variant();
      const n = qty();
      qtyInput.value = n;
      idInput.value = v.id;
      const sub = mode() === 'sub' && plan;
      if (plan) { plan.hidden = !sub; plan.disabled = !sub; }
      const unit = sub && v.plans[plan.value] !== undefined ? v.plans[plan.value] : v.price;

      const once = root.querySelector('[data-wsbb-once-price]');
      if (once) once.textContent = `${money(v.price)} / pack`;
      const subPrice = root.querySelector('[data-wsbb-sub-price]');
      if (subPrice && plan) {
        const p = v.plans[plan.value];
        subPrice.textContent = p !== undefined ? `${money(p)} / pack` : '';
      }

      const units = unitsPerPack(v);
      const unitsEl = root.querySelector('[data-wsbb-units]');
      unitsEl.textContent = units ? `${n} × ${units} = ${n * units} ${data.units}` : '';
      unitsEl.hidden = !units;

      if (!v.available) {
        cta.disabled = true;
        cta.textContent = data.soldOut;
      } else {
        cta.disabled = false;
        cta.textContent = `${data.cta} ${n} ${n === 1 ? 'pack' : 'packs'} · ${money(unit * n)}`;
      }
    };

    root.querySelector('[data-wsbb-minus]').addEventListener('click', () => { qtyInput.value = qty() - 1; update(); });
    root.querySelector('[data-wsbb-plus]').addEventListener('click', () => { qtyInput.value = qty() + 1; update(); });
    qtyInput.addEventListener('change', update);
    root.addEventListener('change', (e) => { if (e.target.matches('[data-wsbb-option], [data-wsbb-mode], [data-wsbb-plan]')) update(); });
    form.addEventListener('submit', () => {
      // one-time unless the subscription is picked: a disabled select is not submitted
      if (plan && mode() !== 'sub') plan.disabled = true;
    });
    update();
  });
})();
