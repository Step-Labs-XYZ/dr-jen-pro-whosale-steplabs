  document.addEventListener('DOMContentLoaded', () => {
    const sectionEl = document.querySelector('section.c-prod[id^="c-prod-"]');
    if (!sectionEl) return;
    const sId = sectionEl.id.replace(/^c-prod-/, '');
    const currentProductId = Number(sectionEl.dataset.productId || 0);
    const enableMainImageNavigationArrows = sectionEl.dataset.enableNavArrows === 'true';
    const enableInfiniteGallery = sectionEl.dataset.enableInfiniteGallery === 'true';
    const enableMobileZoom = sectionEl.dataset.enableMobileZoom === 'true';
    
    const mainImg = document.getElementById(`MainImage-${sId}`);
    const mainView = sectionEl ? sectionEl.querySelector('.c-prod__main-view') : null;
    const mainVideos = sectionEl ? sectionEl.querySelectorAll('.c-prod__main-video-wrap') : [];
    const thumbBtns = document.querySelectorAll(`.js-thumb-${sId}`);
    const prevMainBtn = document.querySelector(`.js-main-nav-prev-${sId}`);
    const nextMainBtn = document.querySelector(`.js-main-nav-next-${sId}`);
    const mobileZoomBtn = document.querySelector(`.js-mobile-zoom-${sId}`);
    const mobileZoomModal = sectionEl ? sectionEl.querySelector(`[data-mobile-zoom-modal="${sId}"]`) : null;
    const mobileZoomImage = mobileZoomModal ? mobileZoomModal.querySelector('.c-prod__zoom-image') : null;
    const zoomPrevBtn = document.querySelector(`.js-zoom-nav-prev-${sId}`);
    const zoomNextBtn = document.querySelector(`.js-zoom-nav-next-${sId}`);
    const radios = document.querySelectorAll(`.js-variant-radio-${sId}`);
    const hiddenInput = document.getElementById(`VariantInput-${sId}`);
    const priceEl = document.querySelector(`.js-price-${sId}`);
    const stockEl = document.querySelector(`.js-stock-${sId}`);
    const buyBtn = document.querySelector(`.js-btn-${sId}`);
    const cswWidget = sectionEl.querySelector('.c-subwidget');
    
    const jsonEl = document.getElementById(`ProductJSON-${sId}`);
    if(!jsonEl) return;
    const variantsData = JSON.parse(jsonEl.textContent);

    const parseVariantIds = (value) => {
      if (!value) return [];
      return value.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !Number.isNaN(id));
    };

    const setActiveThumbByImage = (imageUrl) => {
      let found = false;
      thumbBtns.forEach((btn) => {
        const isVisible = !btn.hasAttribute('hidden');
        const isMatch = isVisible && btn.dataset.image === imageUrl;
        btn.classList.toggle('is-active', isMatch);
        if (isMatch) found = true;
      });
      return found;
    };

    const showThumbsForVariant = (variantId) => {
      let visibleCount = 0;
      thumbBtns.forEach((btn) => {
        const variantIds = parseVariantIds(btn.dataset.variantIds);
        const shouldShow = !variantId || variantIds.length === 0 || variantIds.includes(variantId);
        if (shouldShow) {
          btn.removeAttribute('hidden');
          visibleCount += 1;
        } else {
          btn.setAttribute('hidden', 'hidden');
          btn.classList.remove('is-active');
        }
      });
      if (visibleCount === 0) {
        thumbBtns.forEach((btn) => btn.removeAttribute('hidden'));
      }
      const activeVisible = Array.from(thumbBtns).find((btn) => btn.classList.contains('is-active') && !btn.hasAttribute('hidden'));
      if (!activeVisible) {
        const firstVisible = Array.from(thumbBtns).find((btn) => !btn.hasAttribute('hidden'));
        if (firstVisible) {
          thumbBtns.forEach((btn) => btn.classList.remove('is-active'));
          firstVisible.classList.add('is-active');
          showGalleryMedia(firstVisible);
        }
      }
      updateMainImageNavigationState();
    };

    const getVisibleThumbs = () => Array.from(thumbBtns).filter((btn) => !btn.hasAttribute('hidden'));

    const getActiveVisibleThumbIndex = () => {
      const visibleThumbs = getVisibleThumbs();
      return visibleThumbs.findIndex((btn) => btn.classList.contains('is-active'));
    };

    function updateMainImageNavigationState() {
      if (!enableMainImageNavigationArrows) return;
      const visibleThumbs = getVisibleThumbs();
      const activeIndex = getActiveVisibleThumbIndex();
      const canNavigate = visibleThumbs.length > 1;
      if (prevMainBtn) {
        prevMainBtn.disabled = !canNavigate || (!enableInfiniteGallery && activeIndex <= 0);
      }
      if (nextMainBtn) {
        nextMainBtn.disabled = !canNavigate || (!enableInfiniteGallery && activeIndex >= visibleThumbs.length - 1);
      }
    }

    const navigateMainImage = (direction, forceInfinite = false) => {
      const visibleThumbs = getVisibleThumbs();
      if (visibleThumbs.length <= 1) {
        updateMainImageNavigationState();
        return;
      }

      let activeIndex = getActiveVisibleThumbIndex();
      if (activeIndex < 0) activeIndex = 0;
      let nextIndex = activeIndex + direction;

      if (enableInfiniteGallery || forceInfinite) {
        nextIndex = (nextIndex + visibleThumbs.length) % visibleThumbs.length;
      } else {
        nextIndex = Math.max(0, Math.min(nextIndex, visibleThumbs.length - 1));
      }

      if (visibleThumbs[nextIndex]) {
        visibleThumbs[nextIndex].click();
      }
    };

    // Navegación infinita dentro del modal de zoom mobile: reutiliza
    // navigateMainImage() (misma fuente de verdad: thumbs + mainImg) y solo
    // sincroniza la imagen del modal con la miniatura activa resultante.
    const navigateZoomImage = (direction) => {
      navigateMainImage(direction, true);
      const activeThumb = getVisibleThumbs().find((btn) => btn.classList.contains('is-active'));
      if (activeThumb && mobileZoomImage) {
        mobileZoomImage.src = activeThumb.dataset.image;
      }
    };

    const initMainImageSwipeNavigation = () => {
      if (!mainView) return;
      let isPointerDown = false;
      let startX = 0;
      let startY = 0;
      let deltaX = 0;
      let hasHorizontalIntent = false;
      const dragThreshold = 42;
      const intentThreshold = 10;

      mainView.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const target = event.target;
        if (target && target.closest('.c-prod__main-nav, .c-prod__mobile-zoom-btn, a, button, input, select, textarea')) {
          return;
        }
        isPointerDown = true;
        hasHorizontalIntent = false;
        deltaX = 0;
        startX = event.clientX;
        startY = event.clientY;
      });

      mainView.addEventListener('pointermove', (event) => {
        if (!isPointerDown) return;
        deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        if (!hasHorizontalIntent && Math.abs(deltaX) > intentThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
          hasHorizontalIntent = true;
        }
        if (hasHorizontalIntent) {
          event.preventDefault();
        }
      });

      const finishSwipe = () => {
        if (!isPointerDown) return;
        isPointerDown = false;
        if (!hasHorizontalIntent) return;
        if (Math.abs(deltaX) < dragThreshold) return;
        if (deltaX < 0) navigateMainImage(1);
        else navigateMainImage(-1);
      };

      mainView.addEventListener('pointerup', finishSwipe);
      mainView.addEventListener('pointercancel', finishSwipe);
      mainView.addEventListener('pointerleave', finishSwipe);
    };

    // Gestos horizontales de trackpad (Magic Trackpad / Windows Precision Touchpad).
    // Estos gestos llegan como eventos 'wheel' con deltaX/deltaY, no como Pointer
    // Events. Clasificamos el GESTO completo (acumulado), no cada frame: un scroll
    // vertical real puede tener frames sueltos con deltaX > deltaY por ruido
    // diagonal, y clasificar por frame causaba falsos positivos que rompian el
    // scroll vertical. Una vez clasificado el gesto, la clasificacion se mantiene
    // fija hasta que el gesto termina (reset por inactividad).
    const initMainImageWheelNavigation = () => {
      if (!mainView) return;

      const classifyThreshold = 10; // acumulado minimo antes de poder clasificar
      const dominanceRatio = 1.3;   // cuanto debe dominar el eje horizontal
      const navThreshold = 8;       // acumulado horizontal minimo para navegar
      const cooldownTime = 500;
      const idleResetDelay = 150;

      let accumX = 0;
      let accumY = 0;
      let navAccumX = 0;
      let gestureState = 'pending'; // 'pending' | 'horizontal' | 'ignored'
      let cooldown = false;
      let idleTimer = null;

      const resetGesture = () => {
        accumX = 0;
        accumY = 0;
        navAccumX = 0;
        gestureState = 'pending';
      };

      mainView.addEventListener('wheel', (event) => {
        const target = event.target;
        if (target && target.closest('.c-prod__main-nav, .c-prod__mobile-zoom-btn, a, button, input, select, textarea')) {
          return;
        }

        clearTimeout(idleTimer);
        idleTimer = setTimeout(resetGesture, idleResetDelay);

        // Gesto ya identificado como scroll vertical: no volver a evaluarlo,
        // dejar pasar el scroll nativo sin ninguna interferencia.
        if (gestureState === 'ignored') return;

        if (gestureState === 'pending') {
          accumX += event.deltaX;
          accumY += event.deltaY;
          const absX = Math.abs(accumX);
          const absY = Math.abs(accumY);

          // Aun no hay suficiente movimiento acumulado para decidir con confianza.
          if (absX < classifyThreshold && absY < classifyThreshold) return;

          if (absX > absY * dominanceRatio) {
            gestureState = 'horizontal';
            navAccumX = accumX;
          } else {
            gestureState = 'ignored';
            return;
          }
        } else {
          navAccumX += event.deltaX;
        }

        // A partir de aqui el gesto ya esta confirmado como horizontal:
        // evita que se traduzca en navegacion/scroll del navegador.
        event.preventDefault();
        event.stopPropagation();

        if (cooldown) return;
        if (Math.abs(navAccumX) < navThreshold) return;

        navigateMainImage(navAccumX > 0 ? 1 : -1);
        navAccumX = 0;
        cooldown = true;
        setTimeout(() => {
          cooldown = false;
        }, cooldownTime);
      }, { passive: false });
    };

    const openMobileZoomModal = () => {
      if (!mobileZoomModal || !mobileZoomImage || !mainImg) return;
      mobileZoomImage.src = mainImg.currentSrc || mainImg.src;
      mobileZoomModal.classList.add('is-open');
      mobileZoomModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const canNavigateZoom = getVisibleThumbs().length > 1;
      if (zoomPrevBtn) zoomPrevBtn.hidden = !canNavigateZoom;
      if (zoomNextBtn) zoomNextBtn.hidden = !canNavigateZoom;
    };

    const closeMobileZoomModal = () => {
      if (!mobileZoomModal) return;
      mobileZoomModal.classList.remove('is-open');
      mobileZoomModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    const openMobileZoom = () => {
      if (!enableMobileZoom || window.innerWidth > 899) return;
      const sectionScope = document.getElementById(`shopify-section-${sId}`) || sectionEl;
      const reusableZoomTrigger = sectionScope
        ? sectionScope.querySelector('[data-zoom]:not(.js-mobile-zoom-' + sId + '), [aria-label="zoom-image"], [aria-label="Image zoom"]')
        : null;
      if (reusableZoomTrigger && reusableZoomTrigger !== mobileZoomBtn && typeof reusableZoomTrigger.click === 'function') {
        reusableZoomTrigger.click();
        return;
      }
      openMobileZoomModal();
    };

    const getSelectedOptionsMap = () => {
      const map = {};
      const checkedRadios = document.querySelectorAll(`.js-variant-radio-${sId}:checked`);
      checkedRadios.forEach((radio) => {
        const position = parseInt(radio.dataset.position, 10);
        if (!Number.isNaN(position)) map[position] = radio.value;
      });
      return map;
    };

    const updateQuantityCardBadges = (cardsGroup, flavorMode) => {
      if (!cardsGroup) return;
      const badges = cardsGroup.querySelectorAll('.c-prod__card-badge');
      badges.forEach((badge) => {
        const defaultText = (badge.dataset.badgeTplDefault || badge.dataset.badgeDefault || badge.textContent || '').trim();
        const orangeText  = (badge.dataset.badgeTplOrange  || badge.dataset.badgeOrange  || '').trim();
        badge.dataset.badgeDefault = defaultText;
        badge.dataset.badgeOrange  = orangeText;
        const nextText = (flavorMode === 'orange' && orangeText !== '') ? orangeText : defaultText;
        badge.textContent = nextText;
      });
    };

    const updateQuantityCardImages = () => {
      const cardsGroup = document.querySelector(`#c-prod-${sId} .c-prod__variant-group--cards[data-cards-option-position]`);
      if (!cardsGroup) return;
      const cardsPosition = parseInt(cardsGroup.dataset.cardsOptionPosition, 10);
      if (Number.isNaN(cardsPosition)) return;
      const selectedOptionsMap = getSelectedOptionsMap();
      const selectedVariant = variantsData.find((variant) => String(variant.id) === String(hiddenInput ? hiddenInput.value : ''));
      const cardRadios = cardsGroup.querySelectorAll(`.js-variant-radio-${sId}[data-position="${cardsPosition}"]`);
      const selectedValues = Object.values(selectedOptionsMap)
        .concat(selectedVariant ? selectedVariant.options : [])
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      const isOrangeMango = selectedValues.some((value) => /orange[\s-]*mango/.test(value));
      const flavorMode = isOrangeMango ? 'orange' : 'default';

      cardRadios.forEach((radio) => {
        const candidateOptions = [];
        const maxOptionIndex = Math.max(...variantsData.map((variant) => variant.options.length));
        for (let index = 1; index <= maxOptionIndex; index += 1) {
          if (index === cardsPosition) {
            candidateOptions[index - 1] = radio.value;
          } else {
            candidateOptions[index - 1] = selectedOptionsMap[index] || (selectedVariant ? selectedVariant.options[index - 1] : undefined);
          }
        }
        const matchedForCard = variantsData.find((variant) => {
          return variant.options.every((optionValue, optionIndex) => {
            const expected = candidateOptions[optionIndex];
            return !expected || optionValue === expected;
          });
        });
        const label = cardsGroup.querySelector(`label[for="${radio.id}"]`);
        const image = label ? label.querySelector('.c-prod__card-img') : null;
        if (!image) return;
        if (matchedForCard && matchedForCard.image) {
          image.src = matchedForCard.image;
        } else if (image.dataset.defaultSrc) {
          image.src = image.dataset.defaultSrc;
        }
      });
      updateQuantityCardBadges(cardsGroup, flavorMode);
    };

    const refreshCartUI = (response) => {
      const hasAlpine = typeof window.Alpine !== 'undefined';
      const cartHelper = hasAlpine ? Alpine.store('xCartHelper') : null;
      const miniCart = hasAlpine ? Alpine.store('xMiniCart') : null;
      const popupStore = hasAlpine ? Alpine.store('xPopup') : null;

      if (
        cartHelper
        && typeof cartHelper.getSectionsToRender === 'function'
        && response.sections
        && typeof getSectionInnerHTML === 'function'
      ) {
        cartHelper.getSectionsToRender().forEach((section) => {
          const sectionElement = document.querySelector(section.selector);
          if (sectionElement && response.sections[section.id]) {
            sectionElement.innerHTML = getSectionInnerHTML(response.sections[section.id], section.selector);
          }
        });
        const cartBubbleCount = document.querySelector('#cart-icon-bubble span');
        if (cartBubbleCount) {
          cartHelper.currentItemCount = parseInt(cartBubbleCount.textContent, 10) || cartHelper.currentItemCount;
        }
      }

      if (miniCart && typeof miniCart.openCart === 'function') {
        if (popupStore && typeof popupStore.close === 'function') popupStore.close();
        miniCart.openCart();
        document.dispatchEvent(new CustomEvent('eurus:cart:redirect'));
        document.dispatchEvent(new CustomEvent('eurus:cart:items-changed'));
      } else {
        document.dispatchEvent(new CustomEvent('cart:refresh'));
        document.dispatchEvent(new CustomEvent('cart:open'));
      }
    };

    const initCartDrawerScrollReset = () => {
      const cartDrawer = document.getElementById('CartDrawer');
      if (!cartDrawer || cartDrawer.dataset.scrollResetInitialized === 'true') return;
      const unlockScrollIfDrawerClosed = () => {
        const drawerIsHidden = cartDrawer.hasAttribute('hidden')
          || cartDrawer.getAttribute('aria-hidden') === 'true'
          || cartDrawer.style.display === 'none'
          || cartDrawer.offsetParent === null;
        if (drawerIsHidden) {
          document.body.classList.remove('overflow-hidden');
          document.body.style.removeProperty('overflow');
        }
      };
      cartDrawer.dataset.scrollResetInitialized = 'true';
      new MutationObserver(unlockScrollIfDrawerClosed).observe(cartDrawer, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'],
      });
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target) return;
        const clickedClose = target.closest('#CloseCart, #CartDrawer-Overlay, .group-close-btn');
        if (!clickedClose) return;
        setTimeout(unlockScrollIfDrawerClosed, 550);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setTimeout(unlockScrollIfDrawerClosed, 550);
      });
    };

    const hasCartDrawer = () => {
      const hasDrawerElement = document.querySelector('[data-cart-drawer], cart-drawer, #cart-drawer, #CartDrawer');
      const hasMiniCartStore = typeof window.Alpine !== 'undefined'
        && Alpine.store('xMiniCart')
        && typeof Alpine.store('xMiniCart').openCart === 'function';
      return Boolean(hasDrawerElement || hasMiniCartStore);
    };

    const getCartSections = () => {
      return (typeof window.Alpine !== 'undefined' && Alpine.store('xCartHelper') && typeof Alpine.store('xCartHelper').getSectionsToRender === 'function')
        ? Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id)
        : [];
    };

    const addItemsToCart = async (items) => {
      const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ items, sections: getCartSections() }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status === 422) {
        throw new Error(payload.description || 'Unable to add item to cart.');
      }
      refreshCartUI(payload);
      return payload;
    };

    const cartHasSubscribedMainProduct = async () => {
      const response = await fetch(`${window.Shopify.routes.root}cart.js`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!response.ok) throw new Error('Unable to load cart state.');
      const cart = await response.json();
      return Array.isArray(cart.items) && cart.items.some((item) => {
        return Number(item.product_id) === Number(currentProductId) && item.selling_plan_allocation;
      });
    };

    const initMainProductForm = () => {
      const productForm = sectionEl ? sectionEl.querySelector('form.c-prod__form') : null;
      if (!productForm || productForm.dataset.ajaxCartInitialized === 'true') return;
      productForm.dataset.ajaxCartInitialized = 'true';
      productForm.addEventListener('submit', async (event) => {
        if (!hasCartDrawer()) return;
        event.preventDefault();
        const submitButton = productForm.querySelector('.js-btn-' + sId);
        const originalText = submitButton ? submitButton.innerHTML : '';
        const variantId = parseInt(hiddenInput ? hiddenInput.value : '', 10);
        const sellingPlanInput = productForm.querySelector('[name="selling_plan"]');
        const sellingPlanValue = sellingPlanInput ? String(sellingPlanInput.value || '').trim() : '';
        const sellingPlanId = parseInt(sellingPlanValue, 10);
        if (!Number.isFinite(variantId)) return;
        if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'ADDING...'; }
        try {
          const item = { id: variantId, quantity: 1 };
          if (sellingPlanValue !== '' && sellingPlanValue !== 'null' && Number.isFinite(sellingPlanId)) {
            item.selling_plan = sellingPlanId;
          }
          await addItemsToCart([item]);
        } catch (error) {
          console.error('[c-product-page] Main add to cart error', error);
        } finally {
          if (submitButton) { submitButton.disabled = false; submitButton.innerHTML = originalText; }
        }
      });
    };

    const initUpsellForms = () => {
      const upsellForms = sectionEl ? sectionEl.querySelectorAll('.c-prod__upsell-form') : [];
      upsellForms.forEach((form) => {
        if (form.dataset.initialized === 'true') return;
        form.dataset.initialized = 'true';
        const submitButton = form.querySelector('.js-upsell-atc-' + sId);
        if (!submitButton) return;
        submitButton.addEventListener('click', async (event) => {
          if (!hasCartDrawer()) return;
          event.preventDefault();
          event.stopPropagation();
          const originalText = submitButton ? submitButton.innerHTML : '';
          const variantId = parseInt(form.dataset.variantId || form.querySelector('[name="id"]')?.value || '', 10);
          const sellingPlanId = parseInt(form.dataset.sellingPlanId || '', 10);
          if (!Number.isFinite(variantId)) return;
          if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'ADDING...'; }
          try {
            let shouldApplySubscription = false;
            if (Number.isFinite(sellingPlanId) && sellingPlanId > 0) {
              shouldApplySubscription = await cartHasSubscribedMainProduct();
            }
            const item = { id: variantId, quantity: 1 };
            if (shouldApplySubscription) item.selling_plan = sellingPlanId;
            await addItemsToCart([item]);
          } catch (error) {
            console.error('[c-product-page] Upsell add to cart error', error);
          } finally {
            if (submitButton) { submitButton.disabled = false; submitButton.innerHTML = originalText; }
          }
        });
      });
    };

    // Custom Subscribe/One-time selector, built directly on Shopify's native
    // selling plans (product.selling_plan_groups / variant.selling_plan_allocations)
    // instead of Recharge's widget, so every color/text/behavior stays fully
    // editable in the theme editor. Add to cart still goes through the normal
    // main product form + Shopify cart API — Recharge keeps managing the
    // subscription contract on the backend via the selling_plan line item.
    const initSubscribeSelector = () => {
      if (!cswWidget) return;
      const subPriceEl = cswWidget.querySelector('.js-csw-sub-price');
      const subCompareEl = cswWidget.querySelector('.js-csw-sub-compare');
      const onetimePriceEl = cswWidget.querySelector('.js-csw-onetime-price');
      const freqSelect = cswWidget.querySelector('.js-csw-frequency');
      const sellingPlanInput = cswWidget.querySelector('.js-csw-selling-plan-input');
      const purchaseTypeRadios = cswWidget.querySelectorAll('.js-csw-purchase-type');
      const subCard = cswWidget.querySelector('.c-subwidget__card--sub');
      const giftsBox = cswWidget.querySelector('.js-csw-gifts');
      const badgeEl = cswWidget.querySelector('.js-csw-badge');
      const badgeNumEl = cswWidget.querySelector('.js-csw-badge-num');
      const benefit1El = cswWidget.querySelector('.js-csw-benefit-1');
      const benefit1NumEl = cswWidget.querySelector('.js-csw-benefit-1-num');
      const cardEls = cswWidget.querySelectorAll('.js-csw-card');
      const triggerMode = cswWidget.dataset.giftTriggerMode || 'fixed';
      const triggerQtys = (cswWidget.dataset.giftTriggerQtys || '3,4')
        .split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
      const lastTwoQtys = Array.from(new Set(variantsData.map((v) => v.qty_option_index).filter((n) => n > 0)))
        .sort((a, b) => a - b).slice(-2);

      const getPurchaseType = () => {
        const checked = cswWidget.querySelector('.js-csw-purchase-type:checked');
        return checked ? checked.value : 'subscribe';
      };

      const updateGiftsVisibility = (variant) => {
        if (!giftsBox) return;
        const qty = variant ? variant.qty_option_index : 0;
        const activeQtys = triggerMode === 'last_two' ? lastTwoQtys : triggerQtys;
        const shouldShow = activeQtys.includes(qty);
        giftsBox.hidden = !shouldShow;
      };

      const updatePurchaseTypeUI = (plan) => {
        const type = getPurchaseType();
        if (subCard) subCard.classList.toggle('is-selected', type === 'subscribe');
        if (sellingPlanInput) sellingPlanInput.value = type === 'subscribe' && plan ? plan.id : '';
      };

      const updateDiscountUI = (plan) => {
        const discount = plan ? (plan.discount_percent || 0) : 0;
        if (badgeEl) badgeEl.hidden = discount <= 0;
        if (badgeNumEl) badgeNumEl.textContent = discount;
        if (benefit1El) benefit1El.hidden = discount <= 0;
        if (benefit1NumEl) benefit1NumEl.textContent = discount;
      };

      const update = (variant) => {
        if (!variant) return;
        if (onetimePriceEl) onetimePriceEl.textContent = variant.price || '';
        const plans = Array.isArray(variant.selling_plans) ? variant.selling_plans : [];
        if (freqSelect && plans.length) {
          // p.name viene tal cual de Recharge (ya suele incluir el % de ahorro
          // en el propio nombre del plan) — no se le agrega ningún sufijo aquí
          // para evitar duplicar el porcentaje.
          const selectedIdBefore = freqSelect.value;
          freqSelect.innerHTML = plans.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
          if (selectedIdBefore && plans.some((p) => String(p.id) === String(selectedIdBefore))) {
            freqSelect.value = selectedIdBefore;
          }
        }
        const selectedId = freqSelect ? freqSelect.value : '';
        const plan = plans.find((p) => String(p.id) === String(selectedId)) || plans[0];
        if (plan) {
          if (freqSelect) freqSelect.value = plan.id;
          if (subPriceEl) subPriceEl.textContent = plan.price || '';
          if (subCompareEl) subCompareEl.textContent = plan.compare_at_price || '';
        }
        updatePurchaseTypeUI(plan);
        updateDiscountUI(plan);
        updateGiftsVisibility(variant);
      };

      purchaseTypeRadios.forEach((radio) => radio.addEventListener('change', () => {
        const current = variantsData.find((v) => String(v.id) === String(hiddenInput.value));
        update(current);
      }));
      if (freqSelect) {
        freqSelect.addEventListener('change', () => {
          const current = variantsData.find((v) => String(v.id) === String(hiddenInput.value));
          update(current);
        });
      }

      // Toda la tarjeta es clickeable para seleccionar la opción, no solo el radio.
      cardEls.forEach((card) => {
        card.addEventListener('click', (event) => {
          if (event.target.closest('select, a, button, input')) return;
          const radio = card.querySelector('.js-csw-purchase-type');
          if (!radio || radio.checked) return;
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });

      cswWidget.__cswUpdate = update;
    };

    const initLaborDayBannerButtons = () => {
      const bannerButtons = sectionEl ? sectionEl.querySelectorAll('.js-laborday-banner-cta') : [];
      bannerButtons.forEach((button) => {
        if (button.dataset.labordayInitialized === 'true') return;
        button.dataset.labordayInitialized = 'true';
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          const productId = Number(button.dataset.labordayProductId || 0);
          if (!Number.isFinite(productId) || productId <= 0) return;
          const originalMarkup = button.innerHTML;
          button.disabled = true;
          button.innerHTML = 'ADDING...';
          try {
            if (!hasCartDrawer()) {
              window.location.href = `${window.Shopify.routes.root}cart`;
              return;
            }
            await addItemsToCart([{ id: productId, quantity: 1 }]);
          } catch (error) {
            console.error('[c-product-page] Labor day banner add to cart error', error);
          } finally {
            button.disabled = false;
            button.innerHTML = originalMarkup;
          }
        });
      });
    };

    // ── Galería de miniaturas ──
    const dots = document.querySelectorAll(`.js-dot-${sId}`);

    const showGalleryMedia = (thumb) => {
      if (!thumb) return;
      const isVideo = thumb.dataset.mediaType === 'video';
      if (mainImg) {
        mainImg.hidden = isVideo;
        mainImg.style.display = isVideo ? 'none' : '';
        if (!isVideo) mainImg.src = thumb.dataset.image;
      }
      mainVideos.forEach((videoWrap) => {
        const isActive = isVideo && videoWrap.dataset.mediaId === thumb.dataset.mediaId;
        videoWrap.hidden = !isActive;
        videoWrap.style.display = isActive ? 'block' : 'none';
        const video = videoWrap.querySelector('video');
        if (!isActive && video) video.pause();
      });
    };
    
    thumbBtns.forEach((btn, index) => {
      btn.addEventListener('click', function() {
        thumbBtns.forEach(b => b.classList.remove('is-active'));
        dots.forEach(d => d.classList.remove('is-active'));
        this.classList.add('is-active');
        if (dots[index]) dots[index].classList.add('is-active');
        if (mainImg) {
          mainImg.style.opacity = '0.5';
          setTimeout(() => {
            showGalleryMedia(this);
            mainImg.style.opacity = '1';
          }, 150);
        } else {
          showGalleryMedia(this);
        }
        updateMainImageNavigationState();
        
        // Scroll horizontal (solo dentro del track de miniaturas) para que la
        // miniatura activa sea siempre visible, sin afectar el scroll vertical
        // de la página (scrollIntoView con block:'nearest' scrollea el ancestro
        // vertical más cercano, que en este layout es la propia página).
        const thumbsTrack = this.parentElement;
        if (thumbsTrack) {
          const targetLeft = this.offsetLeft - (thumbsTrack.clientWidth - this.clientWidth) / 2;
          thumbsTrack.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
        }

      });
    });

    if (thumbBtns[0]) showGalleryMedia(thumbBtns[0]);

    if (enableMainImageNavigationArrows) {
      if (prevMainBtn) {
        prevMainBtn.addEventListener('click', () => {
          // Quita el foco antes de navegar: si el botón queda disabled en el
          // mismo click (límite de galería no infinita), el navegador fuerza
          // un blur y puede ajustar el scroll de la página al mover el foco.
          prevMainBtn.blur();
          navigateMainImage(-1);
        });
      }
      if (nextMainBtn) {
        nextMainBtn.addEventListener('click', () => {
          nextMainBtn.blur();
          navigateMainImage(1);
        });
      }
      updateMainImageNavigationState();
    }

    initMainImageSwipeNavigation();
    initMainImageWheelNavigation();

    if (enableMobileZoom) {
      if (mobileZoomBtn) {
        mobileZoomBtn.addEventListener('click', openMobileZoom);
      }
      if (mobileZoomModal) {
        const closeZoomButtons = mobileZoomModal.querySelectorAll('[data-mobile-zoom-close]');
        closeZoomButtons.forEach((btn) => btn.addEventListener('click', closeMobileZoomModal));
        mobileZoomModal.addEventListener('click', (event) => {
          if (event.target === mobileZoomModal) closeMobileZoomModal();
        });
      }
      if (zoomPrevBtn) zoomPrevBtn.addEventListener('click', () => navigateZoomImage(-1));
      if (zoomNextBtn) zoomNextBtn.addEventListener('click', () => navigateZoomImage(1));
    }

    // ── Navegación por puntos ──
    dots.forEach((dot, index) => {
      dot.addEventListener('click', function() {
        thumbBtns[index].click();
      });
    });

    // Resetear scroll de miniaturas al inicio (siempre muestra desde la primera)
    const thumbsContainer = document.querySelector(`#c-prod-${sId} .c-prod__thumbs`);
    if (thumbsContainer) {
      thumbsContainer.scrollLeft = 0;
    }

    // ── Variantes ──
    // Detect whether Variant Image Wizard + Swatch (or Shopify-native variant-image
    // assignment) has configured images per variant. Detection: at least one thumbnail
    // carries a non-empty data-variant-ids attribute.
    const galleryHasVariantAssignments = Array.from(thumbBtns).some(function(btn) {
      return parseVariantIds(btn.dataset.variantIds).length > 0;
    });

    // Activate a thumbnail and update the main image with a crossfade.
    // Does NOT touch the hidden/visible state of any other thumbnail.
    function activateThumb(thumb) {
      if (!thumb) return;
      thumbBtns.forEach(function(btn) { btn.classList.remove('is-active'); });
      thumb.classList.add('is-active');
      if (mainImg) {
        mainImg.style.opacity = '0.5';
        setTimeout(function() {
          showGalleryMedia(thumb);
          mainImg.style.opacity = '1';
        }, 150);
      }
      // Keep the thumbnail horizontally in view inside its scroll track.
      const track = thumb.parentElement;
      if (track) {
        const targetLeft = thumb.offsetLeft - (track.clientWidth - thumb.clientWidth) / 2;
        track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
      }
    }

    // en el diseno v2 la galeria arranca en la primera imagen del producto;
    // la imagen de la variante solo se aplica cuando el comprador cambia de variante
    const isProdV2 = !!document.querySelector('#c-prod-' + sId + '.c-prod--v2');
    function updateVariant(isInit) {
      let currentOptions = [];
      const checkedRadios = document.querySelectorAll(`.js-variant-radio-${sId}:checked`);
      checkedRadios.forEach(radio => {
        currentOptions[parseInt(radio.dataset.position) - 1] = radio.value;
      });
      const matchedVariant = variantsData.find(v =>
        v.options.every((val, index) => val === currentOptions[index])
      );
      if (!matchedVariant) return;

      // ── 1. Form / URL / price / stock / button ──────────────────────────────
      hiddenInput.value = matchedVariant.id;
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('variant', matchedVariant.id);
      window.history.replaceState({}, '', newUrl);
      const addToCartLabel = buyBtn?.dataset?.addLabel || 'ADD TO CART';
      const soldOutLabel   = buyBtn?.dataset?.soldOutLabel || 'SOLD OUT';
      if (priceEl) priceEl.innerHTML = matchedVariant.price;
      if (matchedVariant.available) {
        if (buyBtn) {
          buyBtn.disabled = false;
          // en v2 el nodo usa una flecha SVG de 16x12, no el caracter
          const arrowV2 = '<svg class="c-prod__arrow-v2" xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 18 14" fill="none" aria-hidden="true"><path d="M0.75 6.75H16.75M10.75 12.75L16.75 6.75L10.75 0.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          buyBtn.innerHTML = addToCartLabel + (isProdV2 ? arrowV2 : ' &rarr;');
        }
        if (stockEl) stockEl.innerHTML = '<span class="c-prod__stock-dot"></span> In stock';
      } else {
        if (buyBtn) { buyBtn.disabled = true; buyBtn.innerHTML = soldOutLabel; }
        if (stockEl) stockEl.innerHTML = '<span class="c-prod__stock-dot" style="background:#fca5a5;"></span> Out of stock';
      }

      // ── 2. Gallery ──────────────────────────────────────────────────────────
      //
      // CASE 1 — No app / no variant-image assignments
      //   • All thumbnails remain visible in admin order (no filtering).
      //   • The variant's default image is applied directly to the main image.
      //   • The thumbnail strip is NOT scrolled to the variant image — the gallery
      //     resets so the FIRST thumbnail is always active after a variant change.
      //   • Navigation (arrows / swipe) therefore starts from the beginning of the
      //     full admin gallery, not from the variant's image position.
      //
      // CASE 2 — Variant Image Wizard + Swatch is configured
      //   • ONLY thumbnails explicitly assigned to this variant are shown.
      //   • Thumbnails with no variant assignment (global/admin images) are hidden.
      //   • The first visible (variant-assigned) thumbnail becomes active.
      //   • Navigation cycles ONLY through those assigned thumbnails.

      if (!galleryHasVariantAssignments) {
        // ── CASE 1: no app ───────────────────────────────────────────────────
        // Show all thumbnails (undo any previous filtering).
        thumbBtns.forEach(function(btn) { btn.removeAttribute('hidden'); });

        // Apply the variant's default image directly to the main image element.
        // This does NOT highlight any thumbnail — navigation is decoupled from
        // the variant image so the carousel always starts from position 0.
        if (matchedVariant.image && mainImg && !(isInit && isProdV2)) {
          mainImg.hidden = false;
          mainImg.style.display = '';
          mainImg.style.opacity = '0.5';
          setTimeout(function() {
            mainVideos.forEach(function(video) {
              video.hidden = true;
              const player = video.querySelector('video');
              if (player) player.pause();
            });
            mainImg.src = matchedVariant.image;
            mainImg.style.opacity = '1';
          }, 150);
        }

        // Reset gallery to the first thumbnail so arrow/swipe navigation
        // always begins at the start of the admin-ordered gallery.
        thumbBtns.forEach(function(btn) { btn.classList.remove('is-active'); });
        if (thumbBtns[0]) {
          thumbBtns[0].classList.add('is-active');
          const track = thumbBtns[0].parentElement;
          if (track) track.scrollTo({ left: 0, behavior: 'smooth' });
        }

      } else {
        // ── CASE 2: app configured ───────────────────────────────────────────
        // Show ONLY thumbnails assigned to this variant — hide everything else,
        // including global/admin images (empty data-variant-ids).
        thumbBtns.forEach(function(btn) {
          const ids = parseVariantIds(btn.dataset.variantIds);
          const keep = ids.includes(matchedVariant.id);
          if (keep) {
            btn.removeAttribute('hidden');
          } else {
            btn.setAttribute('hidden', 'hidden');
            btn.classList.remove('is-active');
          }
        });

        // Activate the first visible (variant-assigned) thumbnail.
        const firstAssigned = Array.from(thumbBtns).find(function(btn) {
          return !btn.hasAttribute('hidden');
        });
        activateThumb(firstAssigned);
      }

      updateMainImageNavigationState();
      updateQuantityCardImages();
      if (cswWidget && cswWidget.__cswUpdate) cswWidget.__cswUpdate(matchedVariant);
    }


    radios.forEach(radio => radio.addEventListener('change', () => updateVariant(false)));
    updateQuantityCardImages();
    updateVariant(true);

    document.addEventListener('keydown', (event) => {
      if (!mobileZoomModal || !mobileZoomModal.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        closeMobileZoomModal();
      } else if (event.key === 'ArrowLeft') {
        navigateZoomImage(-1);
      } else if (event.key === 'ArrowRight') {
        navigateZoomImage(1);
      }
    });

    document.addEventListener('rc-discount-updated', () => { updateQuantityCardImages(); });

    if (sectionEl) {
      initMainProductForm();
      initUpsellForms();
      initLaborDayBannerButtons();
      initSubscribeSelector();
      if (cswWidget && cswWidget.__cswUpdate) {
        cswWidget.__cswUpdate(variantsData.find((v) => String(v.id) === String(hiddenInput.value)));
      }
      initCartDrawerScrollReset();

      // ── Ingredients modals ──
      const ingredientsOpenButtons = sectionEl.querySelectorAll('[data-ingredients-open]');
      ingredientsOpenButtons.forEach((openButton) => {
        const container = openButton.closest('[data-shopify-editor-block], div');
        if (!container) return;
        const modal = container.querySelector('[data-ingredients-modal]');
        if (!modal) return;
        const closeButtons = modal.querySelectorAll('[data-ingredients-close]');
        const openModal = () => { modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; };
        const closeModal = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; };
        openButton.addEventListener('click', openModal);
        closeButtons.forEach((btn) => btn.addEventListener('click', closeModal));
        modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
      });

      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const openedModal = sectionEl.querySelector('.c-prod__ingredients-modal.is-open');
        if (!openedModal) return;
        openedModal.classList.remove('is-open');
        openedModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      });

      // ── Mobile: mover pills debajo de payment terms ──
      if (window.matchMedia('(max-width: 899px)').matches) {
        const paymentTerms = sectionEl.querySelector('.c-prod__payment-terms');
        const pillsGroup = sectionEl.querySelector('.c-prod__variant-group--pills');
        if (paymentTerms && pillsGroup && paymentTerms.parentElement) {
          paymentTerms.parentElement.insertAdjacentElement('afterend', pillsGroup);
        }
      }

      // ── Accordion ──
      const pacWraps = sectionEl.querySelectorAll('.pac-wrap');
      pacWraps.forEach((wrap) => {
        const headers = wrap.querySelectorAll('.pac-header');
        const openPacHeader = (headerToOpen) => {
          headers.forEach((h) => {
            const isTarget = h === headerToOpen;
            h.setAttribute('aria-expanded', isTarget ? 'true' : 'false');
            if (h.nextElementSibling) h.nextElementSibling.classList.toggle('is-open', isTarget);
          });
        };
        // Modo múltiple: todos abiertos de entrada y cada uno se cierra por su cuenta
        const multiOpen = wrap.dataset.multiOpen === 'true';
        const setOpen = (header, open) => {
          header.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (header.nextElementSibling) header.nextElementSibling.classList.toggle('is-open', open);
        };
        if (multiOpen) {
          // el diseno abre distintos tabs segun el breakpoint: en mobile solo los que
          // liste data-mobile-open (1-based); vacio = los mismos que en desktop
          const mobileOpen = (wrap.dataset.mobileOpen || '')
            .split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
          const isMobile = window.matchMedia('(max-width: 899px)').matches;
          headers.forEach((header, i) => {
            const openByDefault = (isMobile && mobileOpen.length) ? mobileOpen.indexOf(i + 1) !== -1 : true;
            setOpen(header, openByDefault);
            header.addEventListener('click', () => {
              setOpen(header, header.getAttribute('aria-expanded') !== 'true');
            });
          });
        } else {
          const defaultHeader = wrap.querySelector('.pac-item[data-default-open="true"] .pac-header');
          if (defaultHeader) { openPacHeader(defaultHeader); }
          else if (headers.length > 0) { openPacHeader(headers[0]); }
          headers.forEach((header) => {
            header.addEventListener('click', () => {
              const isOpen = header.getAttribute('aria-expanded') === 'true';
              openPacHeader(null);
              if (!isOpen) openPacHeader(header);
            });
          });
        }
        const triggers = wrap.querySelectorAll('.htu-trigger');
        triggers.forEach((trigger) => {
          const step = trigger.closest('.htu-step');
          const isSingleStep = step && step.hasAttribute('data-single-step') && step.getAttribute('data-single-step') === 'true';
          const body = trigger.nextElementSibling;
          if (isSingleStep && body) {
            trigger.setAttribute('aria-expanded', 'true');
            body.classList.add('is-open');
          }
          trigger.addEventListener('click', () => {
            const isOpen = trigger.getAttribute('aria-expanded') === 'true';
            const body = trigger.nextElementSibling;
            trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            if (body) body.classList.toggle('is-open', !isOpen);
          });
        });
      });

      // ── Flavor buttons (ingredients modal legacy) ──
      const flavorGroups = sectionEl.querySelectorAll('.c-prod__ingredients-flavors');
      flavorGroups.forEach((group) => {
        const flavorButtons = group.querySelectorAll('.c-prod__ingredients-flavor[data-flavor]');
        const paintFlavorButtons = () => {
          flavorButtons.forEach((item) => {
            const flavor = item.dataset.flavor;
            const isActive = item.classList.contains('is-active');
            let bg = '#f3f5f6';
            if (isActive && flavor === 'cool-mint') bg = '#CDFFF1';
            if (isActive && flavor === 'orange-mango') bg = '#FFC183';
            item.style.setProperty('background-color', bg, 'important');
          });
        };
        paintFlavorButtons();
        flavorButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            flavorButtons.forEach((item) => item.classList.remove('is-active'));
            btn.classList.add('is-active');
            paintFlavorButtons();
          });
        });
      });

      // ── Ingredients Tab Adicional ──
      const customTabButtons = sectionEl.querySelectorAll(`.js-ing-tab-btn-${sId}`);
      const customTabContents = sectionEl.querySelectorAll(`.js-ing-tab-content-${sId}`);
      customTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          customTabButtons.forEach(b => b.classList.remove('is-active'));
          customTabContents.forEach(c => c.classList.remove('is-active'));
          btn.classList.add('is-active');
          const targetId = btn.getAttribute('data-target');
          const targetContent = document.getElementById(targetId);
          if (targetContent) targetContent.classList.add('is-active');
        });
      });

      // ── Upsell Carousel ──
      sectionEl.querySelectorAll('.c-prod__upsell-carousel').forEach(carousel => {
        const dotsWrap = carousel.querySelector('.c-prod__upsell-carousel__dots');
        const track = carousel.querySelector('.c-prod__upsell-carousel__track');
        const cards = track ? Array.from(track.children) : [];
        const prevBtn = carousel.querySelector('.c-prod__upsell-carousel__arrow--prev');
        const nextBtn = carousel.querySelector('.c-prod__upsell-carousel__arrow--next');
        let currentIndex = 0;

        const isMobile = () => window.innerWidth <= 899;
        const slidesToShow = () => isMobile() ? 1 : 2;
        const totalSteps = () => Math.max(1, Math.max(0, cards.length - slidesToShow() + 1));

        function updateLayout() {
          const show = slidesToShow();
          const gap = 20;
          const widthValue = show > 1 ? `calc((100% - ${gap}px) / ${show})` : '100%';
          if (track) {
            cards.forEach(card => {
              card.style.flex = `0 0 ${widthValue}`;
            });
            currentIndex = Math.min(currentIndex, Math.max(0, cards.length - show));
            goTo(currentIndex, false);
          }
          updateProgress();
        }

        function buildProgress() {
          if (!dotsWrap) return;
          dotsWrap.innerHTML = '<div class="c-prod__upsell-carousel__progress"><div class="c-prod__upsell-carousel__progress-fill"></div></div>';
          const progress = dotsWrap.querySelector('.c-prod__upsell-carousel__progress');
          const clampIndex = idx => Math.max(0, Math.min(idx, Math.max(0, cards.length - slidesToShow())));

          const syncIndexFromPointer = event => {
            if (!progress) return;
            const rect = progress.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const width = Math.max(1, rect.width);
            const steps = totalSteps();
            const position = Math.min(1, Math.max(0, x / width));
            const nextIndex = Math.round(position * Math.max(0, steps - 1));
            goTo(clampIndex(nextIndex));
          };

          if (progress) {
            let isDragging = false;

            progress.addEventListener('click', event => {
              event.preventDefault();
              syncIndexFromPointer(event);
            });

            progress.addEventListener('pointerdown', event => {
              event.preventDefault();
              isDragging = true;
              progress.setPointerCapture(event.pointerId);
              syncIndexFromPointer(event);
            });

            progress.addEventListener('pointermove', event => {
              if (!isDragging) return;
              syncIndexFromPointer(event);
            });

            progress.addEventListener('pointerup', event => {
              if (!isDragging) return;
              isDragging = false;
              progress.releasePointerCapture(event.pointerId);
              syncIndexFromPointer(event);
            });

            progress.addEventListener('pointercancel', () => {
              isDragging = false;
            });
          }

          updateLayout();
        }

        function getSlideIndexFromScroll() {
          if (!track || cards.length === 0) return 0;
          const gap = 20;
          const cardWidth = cards[0].offsetWidth + gap;
          const rawIndex = Math.round(track.scrollLeft / cardWidth);
          return Math.max(0, Math.min(rawIndex, Math.max(0, cards.length - slidesToShow())));
        }

        function goTo(idx, smooth = true) {
          const show = slidesToShow();
          currentIndex = Math.max(0, Math.min(idx, Math.max(0, cards.length - show)));
          if (track && cards[currentIndex]) {
            track.scrollTo({ left: cards[currentIndex].offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
          }
          updateProgress();
        }

        function updateProgress() {
          if (!dotsWrap) return;
          const fill = dotsWrap.querySelector('.c-prod__upsell-carousel__progress-fill');
          const steps = totalSteps();
          const pct = ((currentIndex + 1) / steps) * 100;
          if (fill) fill.style.width = pct + '%';
        }

        function addTrackDragSupport() {
          if (!track) return;
          let isDragging = false;
          let startX = 0;
          let startScroll = 0;
          let threshold = 5;
          let hasMoved = false;

          track.style.cursor = 'grab';
          track.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            const target = event.target;
const isInteractiveControl = target.closest('input, select, a, button, [class*="rc-"], recharge-subscription-widget');
if (isInteractiveControl) return;
            
            isDragging = true;
            startX = event.clientX;
            startScroll = track.scrollLeft;
            hasMoved = false;
            track.setPointerCapture(event.pointerId);
            track.style.cursor = 'grabbing';
          }, true);

          track.addEventListener('pointermove', event => {
            if (!isDragging) return;
            const delta = startX - event.clientX;
            if (Math.abs(delta) > threshold) {
              hasMoved = true;
              event.preventDefault();
              track.scrollLeft = startScroll + delta;
            }
          }, true);

          const endDrag = event => {
            if (!isDragging) return;
            isDragging = false;
            hasMoved = false;
            try { track.releasePointerCapture(event.pointerId); } catch(e) {}
            track.style.cursor = 'grab';
            currentIndex = getSlideIndexFromScroll();
            goTo(currentIndex);
          };

          track.addEventListener('pointerup', endDrag, true);
          track.addEventListener('pointercancel', endDrag, true);
          track.addEventListener('mouseleave', endDrag, true);
          track.addEventListener('scroll', () => {
            currentIndex = getSlideIndexFromScroll();
            updateProgress();
          });
        }

        if (prevBtn) prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => goTo(currentIndex + 1));
        buildProgress();
        addTrackDragSupport();
        window.addEventListener('resize', updateLayout);

        // Initialize Recharge widgets
        if (window.customElements && customElements.get('recharge-subscription-widget')) {
          const widgets = carousel.querySelectorAll('recharge-subscription-widget');
          widgets.forEach(widget => {
            if (window.RechargeApp && window.RechargeApp.redraw) {
              window.RechargeApp.redraw(widget);
            }
            removeRechargeCurrencySuffix(widget);
          });
        }

        // ATC buttons del carousel
        carousel.querySelectorAll('.js-upsell-carousel-atc').forEach(btn => {
          btn.addEventListener('click', async function() {
            const variantId = parseInt(this.dataset.variantId, 10);
            const sellingPlanId = parseInt(this.dataset.sellingPlanId, 10);
            const learnUrl = this.dataset.learnUrl || '#';
            const originalHTML = this.innerHTML;

            if (!Number.isFinite(variantId)) {
              if (learnUrl !== '#') window.location.href = learnUrl;
              return;
            }

            // Detectar tipo de compra seleccionado en esa card
            const card = this.closest('.c-prod__upsell-card');
            const selectedRadio = card ? card.querySelector('.c-prod__upsell-radio:checked') : null;
            const purchaseType = selectedRadio ? selectedRadio.value : 'subscribe';

            this.disabled = true;
            this.textContent = 'ADDING...';

            try {
              const item = { id: variantId, quantity: 1 };
              if (purchaseType === 'subscribe' && Number.isFinite(sellingPlanId) && sellingPlanId > 0) {
                item.selling_plan = sellingPlanId;
              }
              await addItemsToCart([item]);
            } catch (error) {
              console.error('[c-product-page] Upsell carousel ATC error', error);
              this.textContent = 'ERROR';
              setTimeout(() => { this.innerHTML = originalHTML; this.disabled = false; }, 1200);
              return;
            }

            this.innerHTML = originalHTML;
            this.disabled = false;
          });
        });
      });

    } // end if (sectionEl)
  });

  (function syncRcSubscribeLabel() {
    // No-op: functionality removed per design decision.
  })();

  function removeRechargeCurrencySuffix(widget) {
    if (!widget) return;
    const root = widget.shadowRoot;
    if (!root) return;

    const normalizePriceText = text => {
      if (!text) return text;
      const t = String(text).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
      // remove explicit currency tokens and any existing dollar signs
      const cleaned = t.replace(/\b(?:US\$|USD|US)\b/gi, '').replace(/\$/g, '').trim();
      const m = cleaned.match(/([0-9]+(?:[.,][0-9]+)?)/);
      if (m) return '$' + m[1];
      return t.replace(/\b(?:US\$|USD|US)\b/gi, '').trim();
    };

    const parts = ['rc-purchase-option__price', 'rc-purchase-option__discounted-price', 'rc-purchase-option__original-price'];
    parts.forEach(part => {
      root.querySelectorAll(`[part="${part}"]`).forEach(el => {
        const original = el.textContent ? el.textContent.trim() : '';
        if (!original) return;
        const normalized = normalizePriceText(original);
        if (normalized !== original) {
          el.textContent = normalized;
        }
      });
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while (node = walker.nextNode()) {
      if (node.nodeValue && /\b(?:US\$|USD|US|\$)\b/i.test(node.nodeValue)) {
        node.nodeValue = normalizePriceText(node.nodeValue);
      }
    }
  }

  function observeRechargeCurrency(widget) {
    if (!widget) return;
    const root = widget.shadowRoot;
    if (!root || widget.__rcCurrencyObserver) return;
    const observer = new MutationObserver(() => {
      removeRechargeCurrencySuffix(widget);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    widget.__rcCurrencyObserver = observer;
  }

  // Reinitialize Recharge widgets on page load.
  //
  // The Recharge app can attach/re-render its shadow DOM at an unpredictable
  // moment (after its own async init, after RechargeApp.redraw, etc.), so a
  // single whenDefined()+fixed-timeout pass can run before the widget (or its
  // shadowRoot) actually exists and then never retry. Instead, poll fast at
  // first (every 500ms for ~30s) to catch initial render, then keep polling
  // slowly forever (every 3s) so the "$"-only price normalization keeps
  // applying after Recharge's own re-renders. Each pass is a cheap no-op
  // once already applied, so polling forever is safe.
  function initRechargeWidgetsWatcher() {
    let attempts = 0;
    const fastAttempts = 60; // ~30s at 500ms
    const tick = () => {
      attempts += 1;
      const widgets = document.querySelectorAll('.c-prod__upsell-card__recharge-wrap recharge-subscription-widget, .c-prod__app-wrapper recharge-subscription-widget');
      widgets.forEach(widget => {
        if (window.RechargeApp && window.RechargeApp.redraw && !widget.__rcRedrawCalled) {
          window.RechargeApp.redraw(widget);
          widget.__rcRedrawCalled = true;
        }
        if (!widget.shadowRoot) return;
        removeRechargeCurrencySuffix(widget);
        observeRechargeCurrency(widget);
      });
      setTimeout(tick, attempts < fastAttempts ? 500 : 3000);
    };
    tick();
  }

  if (window.customElements) {
    customElements.whenDefined('recharge-subscription-widget').then(initRechargeWidgetsWatcher);
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initRechargeWidgetsWatcher);
    } else {
      initRechargeWidgetsWatcher();
    }
  }
