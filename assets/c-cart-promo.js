/*
 * Cart drawer discount code + promo gift picker.
 * Loaded from sections/mini-cart.liquid on every page (not from the snippet) because the drawer
 * footer only renders with items in the cart, and snippet JavaScript is only bundled when the
 * snippet renders. Handlers are delegated to document so they survive drawer re-renders.
 * Markup: snippets/c-cart-discount-form.liquid and snippets/c-cart-gift-picker.liquid.
 */
(() => {
  if (window.cCartCodeReady) return;
  window.cCartCodeReady = true;

  const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };

  const post = async (url, body) => {
    const response = await fetch(`${root}${url}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description || data.message || 'Something went wrong. Please try again.');
    return data;
  };

  const getCart = async () => {
    const response = await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } });
    return response.json();
  };

  // Let the theme's cart drawer re-render itself (it fetches the mini-cart section when no sections are passed).
  const refreshDrawer = (cart) => {
    document.querySelectorAll('[data-cart-code-message]').forEach((el) => el.setAttribute('data-stale', ''));
    document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart } }));
  };

  // The drawer HTML is replaced asynchronously, so wait for the fresh message element before writing to it.
  const showMessage = (text, isError) => {
    const startedAt = Date.now();
    const write = () => {
      const el = document.querySelector('[data-cart-code-message]:not([data-stale])');
      if (el) {
        el.textContent = text;
        el.classList.toggle('is-error', Boolean(isError));
      } else if (Date.now() - startedAt < 3000) {
        setTimeout(write, 100);
      }
    };
    write();
  };

  const applyCode = async (rawCode, container) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    const promoCode = (container.dataset.promoCode || '').toUpperCase();

    let cart = await post('cart/update.js', { discount: code, attributes: { _discount_code: code } });
    const entry = (cart.discount_codes || []).find((discount) => discount.code.toUpperCase() === code);

    // The promo code stays saved even when it is not applicable yet (no gift chosen or not enough cases):
    // the gift picker guides the shopper and Shopify applies it as soon as the cart qualifies.
    if (code !== promoCode && !(entry && entry.applicable)) {
      cart = await post('cart/update.js', { discount: '', attributes: { _discount_code: '' } });
      refreshDrawer(cart);
      showMessage(`“${code}” isn't valid for this cart.`, true);
      return;
    }

    refreshDrawer(cart);
    if (code !== promoCode) showMessage('Discount code applied.');
  };

  // Removing the code also drops the gift picked with it, so it is never charged at full price by surprise.
  const removeCode = async () => {
    const current = await getCart();
    const updates = {};
    current.items.forEach((item) => {
      if (item.properties && item.properties._promo_gift) updates[item.key] = 0;
    });
    const cart = await post('cart/update.js', { updates, discount: '', attributes: { _discount_code: '' } });
    refreshDrawer(cart);
  };

  const chooseGift = async (button) => {
    const { promoGiftVariant, promoGiftLine, promoCode } = button.dataset;
    if (promoGiftLine) await post('cart/change.js', { id: promoGiftLine, quantity: 0 });
    await post('cart/add.js', {
      items: [{ id: Number(promoGiftVariant), quantity: 1, properties: { _promo_gift: promoCode } }],
    });
    refreshDrawer(await getCart());
  };

  const withLoading = async (el, task) => {
    el.classList.add('is-loading');
    try {
      await task();
    } catch (error) {
      el.classList.remove('is-loading');
      showMessage(error.message, true);
    }
  };

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-cart-code-form]');
    if (!form) return;
    event.preventDefault();
    const container = form.closest('[data-cart-code]');
    withLoading(container, () => applyCode(form.elements.discount.value, container));
  });

  document.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-cart-code-remove]');
    if (removeButton) {
      withLoading(removeButton.closest('[data-cart-code]'), removeCode);
      return;
    }

    const giftButton = event.target.closest('[data-promo-gift-variant]');
    if (giftButton && !giftButton.disabled) {
      withLoading(giftButton, () => chooseGift(giftButton));
    }
  });
})();
