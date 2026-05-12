// Always start fresh page loads scrolled to the top (no mid/lower restore)
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.addEventListener('pageshow', () => window.scrollTo(0, 0));

// ── Site-wide toast ─────────────────────────────────────────
function ensureToastStack() {
    let stack = document.getElementById('mb-toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'mb-toast-stack';
        stack.className = 'toast-stack';
        document.body.appendChild(stack);
    }
    return stack;
}
const TOAST_ICONS = { success: 'check', error: 'alert-triangle', info: 'info' };
window.showToast = function(message, type = 'info', duration = 3500) {
    const stack = ensureToastStack();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `
        <span class="toast-icon"><i data-lucide="${TOAST_ICONS[type] || 'info'}"></i></span>
        <span class="toast-msg">${message}</span>
        <button class="toast-close" aria-label="Dismiss">✕</button>
    `;
    stack.appendChild(t);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    requestAnimationFrame(() => t.classList.add('show'));
    const close = () => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    };
    t.querySelector('.toast-close').addEventListener('click', close);
    setTimeout(close, duration);
};

document.addEventListener('DOMContentLoaded', async () => {
    // Force top before any deferred content shifts the page
    window.scrollTo(0, 0);

    // ── Hard Version Reset ────────────────────────────────────
    const APP_VERSION = '1.0.4';
    const lastVersion = localStorage.getItem('mb_app_version');
    if (lastVersion !== APP_VERSION) {
        localStorage.clear(); // Wipe stale cache
        localStorage.setItem('mb_app_version', APP_VERSION);
        location.reload();    // One-time fresh reload
        return;
    }
    // ──────────────────────────────────────────────────────────

    // Mobile hamburger drawer (works on every page that includes app.js)
    initMobileDrawer();

    // Initialize Auth UI first so icons are ready for Lucide
    initAuthUI();

    // Initialize standard icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // For logged-in users: pull authoritative cart from Supabase, then poll for changes
    if (MainAPI.isAuthenticated()) {
        CartManager.syncFromSupabase()
            .catch(e => console.warn('Cart sync failed:', e))
            .finally(() => CartManager.startRealtimeSync());
    }

    // Load Data
    try {
        await Promise.all([
            loadBanners(),
            loadCategories(),
            loadProducts()
        ]);

        // Re-init icons for dynamic content
        lucide.createIcons();
    } catch (e) {
        console.error("Error initializing app:", e);
    }
});

// Re-sync cart when user returns to the tab (handles cross-device updates)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && MainAPI.isAuthenticated()) {
        CartManager.syncFromSupabase().catch(e => console.warn('Tab visibility cart sync failed:', e));
    }
});

let badgeAnimFrame = null;
function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if(!badge) return;
    const count = CartManager.getTotalItems();
    
    const oldCount = parseInt(badge.innerText) || 0;
    if (count === oldCount) {
        badge.style.display = count > 0 ? 'flex' : 'none';
        return;
    }

    // Cancel existing animation loop if any
    if (badgeAnimFrame) {
        cancelAnimationFrame(badgeAnimFrame);
        badgeAnimFrame = null;
    }

    // "Running count" effect: animate the number change
    if (count > oldCount) {
        let current = oldCount;
        const step = () => {
            if (current < count) {
                current++;
                badge.innerText = current;
                badgeAnimFrame = requestAnimationFrame(() => setTimeout(step, 40));
            } else {
                badge.innerText = count;
                badgeAnimFrame = null;
            }
        };
        step();
    } else {
        badge.innerText = count;
    }
    
    if (count > 0) {
        badge.style.display = 'flex';
        // Pop animation
        badge.style.transform = "translate(30%, -30%) scale(1.4)";
        badge.style.transition = "transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        setTimeout(() => {
            badge.style.transform = "translate(30%, -30%) scale(1)";
        }, 150);
    } else {
        badge.style.display = 'none';
    }
}

window._productRegistry = window._productRegistry || {};

window.addToCartById = function(key) {
    const prod = window._productRegistry[key];
    if (prod) CartManager.add(prod, 1);
};

window.buyNowById = function(key) {
    const prod = window._productRegistry[key];
    if (!prod) return;
    sessionStorage.setItem('mb_buynow', JSON.stringify([{ product: prod, quantity: 1 }]));
    window.location.href = 'checkout.html?buynow=1';
};

window.addToCartDirect = function(prodJson) {
    try {
        const prod = JSON.parse(decodeURIComponent(prodJson));
        CartManager.add(prod, 1);
    } catch(e) { console.error('addToCartDirect error:', e); }
};

window.buyNowDirect = function(prodJson) {
    try {
        const prod = JSON.parse(decodeURIComponent(prodJson));
        sessionStorage.setItem('mb_buynow', JSON.stringify([{ product: prod, quantity: 1 }]));
        window.location.href = 'checkout.html?buynow=1';
    } catch(e) { console.error('buyNowDirect error:', e); }
};

window.productCardHtml = function(prod) {
    window._productRegistry[prod.id] = prod;
    const img = MainAPI.getProductImage(prod);
    const price = MainAPI.getProductPrice(prod);
    const stockStatus = MainAPI.getStockStatus(prod);
    const stockClass = stockStatus === 'In Stock' ? 'in-stock' : (stockStatus === 'Coming Soon' ? 'coming-soon' : 'out-of-stock');
    const canAdd = stockStatus === 'In Stock';
    const rating = prod.rating || '0.0';
    let unit = prod.weight || prod.unit || '';
    if (prod.product_attributes && prod.product_attributes.length > 0) {
        const v = prod.product_attributes[0].attribute_value;
        unit = (unit && !v.toLowerCase().includes(unit.toLowerCase())) ? `${v} ${unit}` : v;
    }
    const key = prod.id;
    const btns = `
        <div class="prod-card-btns" onclick="event.stopPropagation();">
            <button class="prod-add-btn${canAdd ? '' : ' disabled'}" ${canAdd ? `onclick="event.stopPropagation();window.addToCartById('${key}');"` : 'disabled'}><i data-lucide="shopping-cart"></i> Cart</button>
            <button class="prod-buy-btn${canAdd ? '' : ' disabled'}" ${canAdd ? `onclick="event.stopPropagation();window.buyNowById('${key}');"` : 'disabled'}>Buy Now</button>
        </div>`;
    return `
        <div class="product-card fade-in-stagger" onclick="window.location.href='product.html?id=${prod.id}';" style="cursor:pointer;">
            <div class="prod-img-box">
                <img src="${img}" alt="${prod.title}" loading="lazy">
            </div>
            <div class="prod-info">
                <h3 class="prod-title">${prod.title}</h3>
                <div class="prod-meta">
                    ${unit ? `<span class="prod-variant-chip">${unit}</span>` : ''}
                    <div class="rating-pill"><i data-lucide="star"></i> ${rating}</div>
                    <span class="stock-pill ${stockClass}">${stockStatus}</span>
                </div>
                <div class="prod-price">₹${price}</div>
                ${btns}
            </div>
        </div>`;
};

window.addEventListener('cartUpdated', updateCartBadge);
document.addEventListener('DOMContentLoaded', updateCartBadge);

function initMobileDrawer() {
    // Skip on admin panel — it has its own sidebar drawer
    if (document.body.classList.contains('admin-body')) return;

    // Find any usable header: standard storefront `.header .header-container`,
    // or checkout-style `.checkout-header > .container`.
    const stdHeader = document.querySelector('.header .header-container');
    const checkoutHeader = document.querySelector('.checkout-header > .container');
    const headerRoot = stdHeader || checkoutHeader;
    if (!headerRoot) return;

    // Locate the right-hand slot. If missing (login, signup, profile, cart), create one.
    let rightSlot = headerRoot.querySelector('.header-right');
    if (!rightSlot) {
        rightSlot = document.createElement('div');
        rightSlot.className = 'header-right';
        rightSlot.style.marginLeft = 'auto';
        headerRoot.appendChild(rightSlot);
    }

    // Insert hamburger button if not present
    if (!headerRoot.querySelector('.mobile-menu-btn')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mobile-menu-btn';
        btn.setAttribute('aria-label', 'Open menu');
        btn.innerHTML = '<i data-lucide="menu" style="width:24px;height:24px;display:block;"></i>';
        btn.onclick = function() { toggleMobileDrawer(true); };

        // If page header uses dark background (e.g. profile), use white icon
        const headerEl = stdHeader ? stdHeader.closest('.header') : checkoutHeader.closest('.checkout-header');
        if (headerEl) {
            const inlineBg = (headerEl.getAttribute('style') || '').toLowerCase();
            if (inlineBg.includes('primary-dark') || inlineBg.includes('#00251a') || inlineBg.includes('rgb(0, 37, 26)')) {
                btn.style.color = '#ffffff';
            }
        }

        rightSlot.appendChild(btn);
    }

    // Build drawer once, attached to body
    if (!document.getElementById('mobile-drawer')) {
        const isLoggedIn = MainAPI && MainAPI.isAuthenticated && MainAPI.isAuthenticated();
        const userPath = isLoggedIn ? 'profile.html' : 'login.html';
        const userLabel = isLoggedIn ? 'My Profile' : 'Login / Sign Up';

        const backdrop = document.createElement('div');
        backdrop.className = 'mobile-drawer-backdrop';
        backdrop.id = 'mobile-drawer-backdrop';
        backdrop.addEventListener('click', () => toggleMobileDrawer(false));

        const drawer = document.createElement('aside');
        drawer.className = 'mobile-drawer';
        drawer.id = 'mobile-drawer';
        drawer.innerHTML = `
            <div class="mobile-drawer-header">
                <span class="brand-text">Menha Boutique</span>
                <button type="button" class="mobile-drawer-close" aria-label="Close menu" onclick="toggleMobileDrawer(false)">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <nav class="mobile-drawer-nav" id="mobile-drawer-nav">
                <a href="index.html"><i data-lucide="home"></i> Home</a>
                <a href="categories.html"><i data-lucide="grid"></i> Categories</a>
                <a href="cart.html"><i data-lucide="shopping-bag"></i> Cart</a>
                <a href="${userPath}"><i data-lucide="user"></i> ${userLabel}</a>
                ${isLoggedIn ? '<a href="orders.html"><i data-lucide="package"></i> My Orders</a>' : ''}
                ${isLoggedIn ? '<a href="addresses.html"><i data-lucide="map-pin"></i> Addresses</a>' : ''}
                ${isLoggedIn ? '<a href="javascript:MainAPI.logout()"><i data-lucide="log-out"></i> Logout</a>' : ''}
            </nav>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);

        // Highlight active link
        const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        drawer.querySelectorAll('.mobile-drawer-nav a').forEach(a => {
            const href = (a.getAttribute('href') || '').toLowerCase();
            if (href === path) a.classList.add('active');
        });
    }
}

function toggleMobileDrawer(open) {
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (!drawer || !backdrop) return;
    const shouldOpen = (typeof open === 'boolean') ? open : !drawer.classList.contains('open');
    drawer.classList.toggle('open', shouldOpen);
    backdrop.classList.toggle('open', shouldOpen);
    document.body.style.overflow = shouldOpen ? 'hidden' : '';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.toggleMobileDrawer = toggleMobileDrawer;

function initAuthUI() {
    if (MainAPI.isAuthenticated()) {
        const userBtn = document.querySelector('a[href="login.html"]');
        if (userBtn) {
            userBtn.title = "Profile";
            userBtn.innerHTML = '<i data-lucide="user"></i>';
            userBtn.href = "profile.html";
            userBtn.onclick = null;
        }
    }
}

async function loadBanners() {
    const bannerContainer = document.getElementById('banner-container');
    if (!bannerContainer) return;

    const banners = await MainAPI.fetchBanners();
    if (!banners || banners.length === 0) {
        bannerContainer.innerHTML = `
            <div style="width:100%; height:100%; background: linear-gradient(135deg, #f8fafc, #f1f5f9); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center;">
                <div style="width: 60px; height: 60px; background: rgba(0, 77, 64, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                    <i data-lucide="sparkles" style="color: var(--color-primary); opacity: 0.5;"></i>
                </div>
                <h3 style="color: var(--color-primary-dark); font-size: 1.1rem; font-weight: 700; margin: 0;">Special Offers Coming Soon</h3>
                <p style="color: var(--color-text-light); font-size: 0.9rem; margin-top: 0.5rem;">Stay tuned for our latest premium self-care collections.</p>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Build slides
    bannerContainer.innerHTML = banners.map((banner, i) => {
        const img = banner.imageUrl || banner.image_url || '';
        const link = banner.link || banner.link_url || banner.redirect_url || banner.url || '';
        const imgTag = img
            ? `<img src="${img}" alt="Banner ${i + 1}" class="banner-img" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" onerror="this.parentElement.style.background='linear-gradient(135deg,#f1f5f9,#e2e8f0)';this.style.display='none';">`
            : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);"></div>`;
        const inner = link
            ? `<a href="${link}" style="display:block;width:100%;height:100%;">${imgTag}</a>`
            : imgTag;
        return `<div class="banner-slide${i === 0 ? ' active' : ''}">${inner}</div>`;
    }).join('');

    // Show nav buttons only if more than 1 slide
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    if (banners.length <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }

    let current = 0;
    const slides = bannerContainer.querySelectorAll('.banner-slide');

    function goTo(index) {
        const prev = current;
        current = (index + banners.length) % banners.length;
        if (prev === current) return;

        // Instantly snap the incoming slide to off-screen right with no transition,
        // so it never mid-transitions from a previous slide-out position
        slides[current].style.transition = 'none';
        slides[current].classList.remove('active', 'slide-out');
        void slides[current].offsetWidth; // commit the instant position to the browser

        // Double rAF: first frame commits the snap, second frame enables transition and animates in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                slides[current].style.transition = '';
                slides[current].classList.add('active');
            });
        });

        // Slide previous slide out to left
        slides[prev].classList.add('slide-out');
        slides[prev].classList.remove('active');

        // After animation ends, snap old slide back to right instantly (no visible flash)
        setTimeout(() => {
            slides[prev].style.transition = 'none';
            slides[prev].classList.remove('slide-out');
            void slides[prev].offsetWidth;
            slides[prev].style.transition = '';
        }, 600);
    }

    window.carouselGoTo = goTo;
    window.carouselNext = () => { goTo(current + 1); resetTimer(); };
    window.carouselPrev = () => { goTo(current - 1); resetTimer(); };

    let timer = banners.length > 1 ? setInterval(() => goTo(current + 1), 4000) : null;
    function resetTimer() {
        if (!timer && banners.length <= 1) return;
        clearInterval(timer);
        timer = setInterval(() => goTo(current + 1), 4000);
    }

    bannerContainer.addEventListener('mouseenter', () => clearInterval(timer));
    bannerContainer.addEventListener('mouseleave', () => resetTimer());

    // Swipe support
    let touchStartX = 0;
    bannerContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        clearInterval(timer);
    }, { passive: true });
    bannerContainer.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) {
            dx < 0 ? goTo(current + 1) : goTo(current - 1);
        }
        resetTimer();
    }, { passive: true });
}

async function loadCategories() {
    const catContainer = document.getElementById('category-container');
    if (!catContainer) return;

    // Skeletons (replaced by real content once loaded)
    catContainer.innerHTML = Array.from({ length: 6 }).map(() => `
        <div style="display:inline-flex; flex-direction:column; align-items:center; gap:8px; margin-right:18px;">
            <div class="skeleton skeleton-circle"></div>
            <div class="skeleton skeleton-line w-60" style="width:60px;"></div>
        </div>
    `).join('');

    const categories = await MainAPI.fetchCategories();
    if (categories && categories.length > 0) {
        let html = '';
        const limit = Math.min(categories.length, 10);
        
        for (let i = 0; i < limit; i++) {
            const cat = categories[i];
            const img = cat.image || 'https://via.placeholder.com/100';
            const name = cat.name || 'Category';
            
            html += `
                <a href="categories.html?id=${cat.id}" class="category-item fade-in-stagger">
                    <div class="cat-img-wrapper">
                        <img src="${img}" alt="${name}" loading="lazy">
                    </div>
                    <span>${name}</span>
                </a>
            `;
        }
        catContainer.innerHTML = html;
    } else {
        catContainer.innerHTML = '<p>No categories found.</p>';
    }
}

async function loadProducts() {
    const prodContainer = document.getElementById('product-container');
    if (!prodContainer) return;

    // Skeleton cards (matches actual product card shape)
    prodContainer.innerHTML = Array.from({ length: 8 }).map(() => `
        <div class="skeleton-card">
            <div class="skeleton skeleton-img"></div>
            <div class="skeleton-body">
                <div class="skeleton skeleton-line lg w-80"></div>
                <div class="skeleton skeleton-line w-40"></div>
                <div class="skeleton skeleton-line w-60"></div>
            </div>
        </div>
    `).join('');

    const products = await MainAPI.fetchProducts();
    if (products && products.length > 0) {
        const limit = Math.min(products.length, 12);
        prodContainer.innerHTML = products.slice(0, limit).map(p => window.productCardHtml(p)).join('');
    } else {
        prodContainer.innerHTML = '<p>No products found.</p>';
    }
}
