/* Wholesale "Number of packs" (snippets/c-wholesale-packs.liquid), inside the
   c-product-page form. The variant and selling plan are set by the page's own
   controls (variant cards, Recharge widget), so they are re-read on every change. */
(function () {
  document.querySelectorAll('[data-wspacks]').forEach((root) => {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    const data = JSON.parse(root.querySelector('[data-wspacks-data]').textContent);
    const form = root.closest('form');
    if (!form) return;
    const sid = root.dataset.section;
    const qtyInput = root.querySelector('[data-wspacks-qty]');
    const unitsEl = root.querySelector('[data-wspacks-units]');

    const money = (cents) => new Intl.NumberFormat('en-US', {
      style: 'currency', currency: data.currency || 'USD', minimumFractionDigits: 2,
    }).format(cents / 100);
    const qty = () => Math.max(1, Math.min(999, parseInt(qtyInput.value, 10) || 1));
    const variant = () => {
      const id = Number((form.querySelector('[name="id"]') || {}).value);
      return data.variants.find((v) => v.id === id) || data.variants[0];
    };
    const sellingPlan = () => String((form.querySelector('[name="selling_plan"]') || {}).value || '').trim();
    const unitsPerPack = (v) => {
      const m = String(v.title).match(/(\d+)\s*pack/i);
      return m ? Number(m[1]) : 0;
    };

    let last = '';
    const update = () => {
      const v = variant();
      const n = qty();
      qtyInput.value = n;
      const plan = sellingPlan();
      const unit = plan && v.plans[plan] !== undefined ? v.plans[plan] : v.price;
      const units = unitsPerPack(v);
      unitsEl.textContent = units ? `${n} × ${units} = ${n * units} ${data.units}` : '';

      const btn = form.querySelector(`.js-btn-${sid}`);
      // leave the button alone while it is adding or sold out
      if (!btn || btn.disabled || !v.available) return;
      const label = `${data.cta} ${n} ${n === 1 ? 'pack' : 'packs'} · ${money(unit * n)} →`;
      if (btn.textContent.trim() !== label) btn.textContent = label;
      last = `${v.id}|${plan}|${n}`;
    };

    root.querySelector('[data-wspacks-minus]').addEventListener('click', () => { qtyInput.value = qty() - 1; update(); });
    root.querySelector('[data-wspacks-plus]').addEventListener('click', () => { qtyInput.value = qty() + 1; update(); });
    qtyInput.addEventListener('change', update);
    form.addEventListener('change', update);
    form.addEventListener('click', () => setTimeout(update, 50));
    // variant cards and the Recharge widget set hidden inputs without events
    setInterval(() => {
      const key = `${variant().id}|${sellingPlan()}|${qty()}`;
      if (key !== last) update();
    }, 400);
    update();

    // Recharge's widget defaults to subscribe: select one-time once, on load.
    // The buyer can still pick the subscription afterwards.
    if (root.dataset.defaultOnce === 'true') {
      let tries = 0;
      const pickOnce = () => {
        const widget = form.querySelector('recharge-subscription-widget') || document.querySelector('recharge-subscription-widget');
        const radio = widget && widget.shadowRoot && widget.shadowRoot.querySelector('input[name="purchaseOption"][value="onetime"]');
        if (radio) {
          if (!radio.checked) radio.click();
          setTimeout(update, 100);
        } else if (tries++ < 40) setTimeout(pickOnce, 250);
      };
      pickOnce();
    }
  });
})();
