/**
 * c-product.js
 * Shopify 2.0 product template interactions
 * Prefix: c-
 */

(function () {
  'use strict';

  /* ============================================================
     MEDIA GALLERY
     ============================================================ */
  function initMediaGallery(section) {
    const thumbs = section.querySelectorAll('.c-media-thumb');
    const featuredImg = section.querySelector('#c-featured-image');
    if (!thumbs.length || !featuredImg) return;

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        thumbs.forEach(function (t) { t.classList.remove('c-media-thumb--active'); });
        thumb.classList.add('c-media-thumb--active');
        featuredImg.style.opacity = '0';
        featuredImg.src = thumb.dataset.src;
        featuredImg.onload = function () {
          featuredImg.style.opacity = '1';
        };
      });
    });
  }

  /* ============================================================
     VARIANT SELECTION
     ============================================================ */
  function initVariantPicker(section) {
    const form = section.querySelector('.c-product-form');
    const inputs = section.querySelectorAll('.c-option-input');
    if (!inputs.length || !form) return;

    inputs.forEach(function (input) {
      input.addEventListener('change', function () {
        updateVariant(section, form);
      });
    });
  }

  function updateVariant(section, form) {
    const options = [];
    const optionGroups = section.querySelectorAll('.c-option-group');

    optionGroups.forEach(function (group) {
      const checked = group.querySelector('.c-option-input:checked');
      if (checked) options.push(checked.value);
    });

    // Find matching variant from product JSON
    const productDataEl = document.querySelector('[data-product-json]');
    if (!productDataEl) return;

    try {
      const productData = JSON.parse(productDataEl.textContent);
      const variant = productData.variants.find(function (v) {
        return v.options.every(function (opt, i) {
          return opt === options[i];
        });
      });

      if (variant) {
        applyVariant(section, form, variant);
      }
    } catch (e) {
      console.warn('[c-product] Could not parse product JSON', e);
    }
  }

  function applyVariant(section, form, variant) {
    // Update hidden variant id
    const idInput = form.querySelector('.c-variant-id-input');
    if (idInput) idInput.value = variant.id;

    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url.toString());

    // Update ATC button
    const btn = form.querySelector('.c-btn-atc');
    if (btn) {
      btn.disabled = !variant.available;
      btn.textContent = variant.available
        ? (btn.dataset.addLabel || 'Add to cart')
        : (btn.dataset.soldLabel || 'Sold out');
    }

    // Update price
    updatePrice(section, variant);

    // Update stock badge
    const stockEl = section.querySelector('.c-stock-badge');
    if (stockEl) {
      stockEl.classList.toggle('c-stock-badge--in', variant.available);
      stockEl.classList.toggle('c-stock-badge--out', !variant.available);
    }

    // Dispatch Shopify variant change event (for apps)
    document.dispatchEvent(new CustomEvent('variant:changed', {
      detail: { variant: variant }
    }));
  }

  function updatePrice(section, variant) {
    const priceEl = section.querySelector('.c-price__regular, .c-price__sale');
    const compareEl = section.querySelector('.c-price__compare');
    if (!priceEl) return;

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: window.Shopify && window.Shopify.currency ? window.Shopify.currency.active : 'USD',
      minimumFractionDigits: 2
    });

    const price = variant.price / 100;
    const comparePrice = variant.compare_at_price ? variant.compare_at_price / 100 : null;

    priceEl.textContent = formatter.format(price);

    if (compareEl) {
      if (comparePrice && comparePrice > price) {
        compareEl.textContent = formatter.format(comparePrice);
        compareEl.style.display = '';
      } else {
        compareEl.style.display = 'none';
      }
    }
  }

  /* ============================================================
     BUNDLE PICKER
     ============================================================ */
  function initBundlePicker(section) {
    const options = section.querySelectorAll('.c-bundle-option');
    const form = section.querySelector('.c-product-form');
    if (!options.length) return;

    options.forEach(function (option) {
      option.addEventListener('click', function () {
        options.forEach(function (o) { o.classList.remove('c-bundle-option--active'); });
        option.classList.add('c-bundle-option--active');

        const input = option.querySelector('.c-bundle-input');
        if (input) {
          input.checked = true;
          const qty = parseInt(input.value, 10);
          // Update form quantity if a qty input exists
          const qtyInput = form ? form.querySelector('[name="quantity"]') : null;
          if (qtyInput) qtyInput.value = qty;
        }
      });
    });
  }

  /* ============================================================
     QUANTITY STEPPER
     ============================================================ */
  function initQtyStepper(section) {
    const minus = section.querySelector('#c-qty-minus');
    const plus = section.querySelector('#c-qty-plus');
    const input = section.querySelector('#c-qty-input');
    if (!minus || !plus || !input) return;

    minus.addEventListener('click', function () {
      const val = parseInt(input.value, 10);
      if (val > 1) input.value = val - 1;
    });

    plus.addEventListener('click', function () {
      const val = parseInt(input.value, 10);
      input.value = val + 1;
    });
  }

  /* ============================================================
     SUBSCRIBE TOGGLE
     ============================================================ */
  function initSubscribeToggle(section) {
    const radios = section.querySelectorAll('.c-subscribe-radio');
    const options = section.querySelectorAll('.c-subscribe-option');

    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        options.forEach(function (o) { o.classList.remove('c-subscribe-option--active'); });
        radio.closest('.c-subscribe-option').classList.add('c-subscribe-option--active');
      });
    });
  }

  /* ============================================================
     ADD TO CART — AJAX
     ============================================================ */
  function initAjaxCart(section) {
    const form = section.querySelector('.c-product-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      // Only intercept if theme has a cart drawer; otherwise let default behaviour
      const hasDrawer = document.querySelector('[data-cart-drawer], cart-drawer, #cart-drawer');
      if (!hasDrawer) return;

      e.preventDefault();

      const btn = form.querySelector('.c-btn-atc');
      const originalText = btn ? btn.textContent : '';

      if (btn) {
        btn.disabled = true;
        btn.textContent = btn.dataset.addingLabel || 'Adding…';
      }

      const formData = new FormData(form);

      fetch('/cart/add.js', {
        method: 'POST',
        body: formData,
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function (r) { return r.json(); })
        .then(function () {
          document.dispatchEvent(new CustomEvent('cart:refresh'));
          document.dispatchEvent(new CustomEvent('cart:open'));
          if (btn) {
            btn.textContent = btn.dataset.addedLabel || 'Added!';
            setTimeout(function () {
              btn.disabled = false;
              btn.textContent = originalText;
            }, 2000);
          }
        })
        .catch(function (err) {
          console.error('[c-product] ATC error', err);
          if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
          }
        });
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    const sections = document.querySelectorAll('.c-product-page');
    sections.forEach(function (section) {
      initMediaGallery(section);
      initVariantPicker(section);
      initBundlePicker(section);
      initQtyStepper(section);
      initSubscribeToggle(section);
      initAjaxCart(section);
    });
  }

  // Shopify section events (theme editor)
  document.addEventListener('shopify:section:load', function (e) {
    const section = e.target.querySelector('.c-product-page');
    if (section) {
      initMediaGallery(section);
      initVariantPicker(section);
      initBundlePicker(section);
      initQtyStepper(section);
      initSubscribeToggle(section);
      initAjaxCart(section);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
