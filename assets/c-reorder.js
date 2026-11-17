/* C Reorder (sections/c-reorder.liquid).
   Edit step: pack steppers with live totals; edits are kept in localStorage per order,
   so a sign-in, password recovery or address change does not lose them.
   Review step: today's prices vs the last order, unavailable items left out (never
   swapped), saved address, then Continue to checkout.
   Checkout: lines go to /cart/add.js as one-time items (no selling_plan is ever sent),
   then /cart?reorder=checkout, where snippets/c-reorder-global.liquid hands off to the
   cart's checkout button so the WPD wholesale app keeps handling checkout. */
(function () {
  const track = (event, data) => window.cReorderTrack && window.cReorderTrack(event, data);

  document.querySelectorAll('[data-reorder]').forEach((root) => {
    const state = root.dataset.state;

    if (state !== 'guest') {
      // signed in: a pending return from login / password recovery is done
      try { localStorage.removeItem('c-reorder-return'); } catch (e) { /* storage blocked */ }
      try {
        if (!sessionStorage.getItem('c-reorder-reached')) {
          sessionStorage.setItem('c-reorder-reached', '1');
          track('reorder_account_reached', { state });
        }
      } catch (e) { track('reorder_account_reached', { state }); }
    }
    if (state !== 'reorder') return;

    const cfgEl = root.querySelector('[data-reorder-config]');
    const cfg = cfgEl ? JSON.parse(cfgEl.textContent) : {};
    const storeKey = `c-reorder:${cfg.orderId}`;
    const lines = [...root.querySelectorAll('[data-reorder-line]')].map((el) => ({
      el,
      id: Number(el.dataset.variant),
      name: el.dataset.name,
      flavor: el.dataset.flavor,
      units: el.dataset.units,
      price: Number(el.dataset.price),
      oldPrice: Number(el.dataset.oldPrice),
      available: el.dataset.available === 'true',
      url: el.dataset.url,
      input: el.querySelector('[data-reorder-input]'),
      packs: el.querySelector('[data-reorder-packs]'),
    }));

    const money = (cents) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cfg.currency || 'USD',
      minimumFractionDigits: cents % 100 ? 2 : 0,
    }).format(cents / 100);
    const qty = (l) => Math.max(0, Math.min(999, parseInt(l.input.value, 10) || 0));
    const active = () => lines.filter((l) => l.available && l.id && qty(l) > 0);
    const subtotal = () => active().reduce((sum, l) => sum + l.price * qty(l), 0);

    const save = () => {
      try { localStorage.setItem(storeKey, JSON.stringify(lines.map((l) => [l.id, qty(l)]))); } catch (e) { /* storage blocked */ }
    };
    const restore = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(storeKey) || 'null');
        if (!saved) return;
        saved.forEach(([id, q]) => {
          const l = lines.find((x) => x.id === id);
          if (l) l.input.value = q;
        });
      } catch (e) { /* storage blocked */ }
    };

    const update = () => {
      lines.forEach((l) => { l.input.value = qty(l); if (l.packs) l.packs.textContent = qty(l); });
      root.querySelectorAll('[data-reorder-subtotal]').forEach((el) => { el.textContent = money(subtotal()); });
      save();
    };

    lines.forEach((l) => {
      l.el.querySelector('[data-reorder-minus]').addEventListener('click', () => { l.input.value = qty(l) - 1; update(); });
      l.el.querySelector('[data-reorder-plus]').addEventListener('click', () => { l.input.value = qty(l) + 1; update(); });
      l.input.addEventListener('change', update);
    });
    restore();
    update();

    /* ---- Review ---- */
    const edit = root.querySelector('[data-reorder-step="edit"]');
    const review = root.querySelector('[data-reorder-step="review"]');
    const error = root.querySelector('[data-reorder-error]');
    const priceBox = root.querySelector('[data-reorder-prices]');
    const priceOk = root.querySelector('[data-reorder-price-ok]');
    const checkoutBtn = root.querySelector('[data-reorder-checkout]');
    let hasPriceChange = false;

    const label = (l) => `${l.name}${l.flavor ? ` · ${l.flavor}` : ''}`;
    const refreshCheckout = () => {
      checkoutBtn.disabled = !active().length || (hasPriceChange && !priceOk.checked);
    };

    const showReview = async () => {
      error.textContent = '';
      if (!active().length) { error.textContent = cfg.emptyError; edit.querySelector('[data-reorder-review]').after(error); return; }
      const rows = root.querySelector('[data-reorder-rows]');
      rows.innerHTML = '';
      hasPriceChange = false;
      active().forEach((l) => {
        const changed = l.oldPrice > 0 && l.price !== l.oldPrice;
        if (changed) hasPriceChange = true;
        const li = document.createElement('li');
        li.className = 'c-reorder__row';
        const left = document.createElement('div');
        left.textContent = label(l);
        const small = document.createElement('small');
        small.textContent = `${qty(l)} × ${l.units ? `${l.units} ${cfg.unitsLabel}` : ''} · ${cfg.oneTime}`;
        left.appendChild(small);
        const right = document.createElement('div');
        right.style.textAlign = 'right';
        right.textContent = money(l.price * qty(l));
        const each = document.createElement('small');
        each.textContent = `${money(l.price)} each`;
        if (changed) {
          const was = document.createElement('s');
          was.textContent = `${cfg.wasNow} ${money(l.oldPrice)}`;
          each.append(' ', was);
        }
        right.appendChild(each);
        li.append(left, right);
        rows.appendChild(li);
      });
      priceBox.hidden = !hasPriceChange;
      priceOk.checked = false;

      const missing = lines.filter((l) => !l.available || !l.id);
      const missBox = root.querySelector('[data-reorder-missing]');
      const missList = root.querySelector('[data-reorder-missing-list]');
      missList.innerHTML = '';
      missing.forEach((l) => {
        const p = document.createElement('p');
        p.append(`${label(l)} ${cfg.removed} `);
        const a = document.createElement('a');
        a.href = l.url || cfg.alternativesUrl;
        a.textContent = cfg.viewAlternatives;
        p.appendChild(a);
        missList.appendChild(p);
      });
      missBox.hidden = !missing.length;

      // Items already in the cart go to checkout too: say so, never hide it
      const note = root.querySelector('[data-reorder-cart-note]');
      note.hidden = true;
      try {
        const cart = await (await fetch(`${window.Shopify.routes.root}cart.js`, { cache: 'no-store' })).json();
        if (cart.item_count > 0) {
          note.textContent = cfg.cartNote.replace('[count]', cart.item_count);
          note.hidden = false;
        }
      } catch (e) { /* cart unreadable: checkout still shows it */ }

      edit.hidden = true;
      review.hidden = false;
      refreshCheckout();
      review.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      track('reorder_basket_reviewed', { lines: active().length, subtotal: subtotal() / 100, price_changed: hasPriceChange, unavailable: missing.length });
    };

    root.querySelector('[data-reorder-review]').addEventListener('click', () => {
      track('reorder_started', { source: 'buy_again' });
      showReview();
    });
    root.querySelector('[data-reorder-back]').addEventListener('click', () => { review.hidden = true; edit.hidden = false; });
    priceOk.addEventListener('change', refreshCheckout);

    checkoutBtn.addEventListener('click', async () => {
      if (checkoutBtn.disabled) return;
      checkoutBtn.disabled = true;
      error.textContent = '';
      // One-time only: no selling_plan, so a reorder never creates a subscription
      const items = active().map((l) => ({ id: l.id, quantity: qty(l) }));
      try {
        const res = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
        });
        if (!res.ok) throw new Error(await res.text());
        track('reorder_checkout', { lines: items.length, subtotal: subtotal() / 100 });
        try { localStorage.removeItem(storeKey); } catch (e) { /* storage blocked */ }
        window.location.href = `${window.Shopify.routes.root}cart?reorder=checkout`;
      } catch (e) {
        console.error('Reorder:', e);
        error.textContent = cfg.error;
        refreshCheckout();
      }
    });
  });
})();
