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

    // Mobile hamburger drawer (works on every page that includes app.js)
    initMobileDrawer();

    // Initialize Auth UI first so icons are ready for Lucide
    initAuthUI();

    // Initialize standard icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
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

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if(!badge) return;
    const count = CartManager.getTotalItems();
    badge.innerText = count;
    if (count > 0) {
        badge.style.display = 'flex';
        badge.style.transform = "translate(30%, -30%) scale(1.3)";
        setTimeout(() => {
            badge.style.transform = "translate(30%, -30%) scale(1)";
        }, 200);
    } else {
        badge.style.display = 'none';
    }
}

window.addToCartDirect = function(productStr) {
    const product = JSON.parse(decodeURIComponent(productStr));
    CartManager.add(product, 1);
};

window.buyNowDirect = function(productStr) {
    const product = JSON.parse(decodeURIComponent(productStr));
    sessionStorage.setItem('mb_buynow', JSON.stringify([{ product, quantity: 1 }]));
    window.location.href = 'checkout.html?buynow=1';
};

window.productCardHtml = function(prod) {
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
    const safeProdStr = encodeURIComponent(JSON.stringify(prod));
    const btns = `
        <div class="prod-card-btns">
            <button class="prod-add-btn${canAdd ? '' : ' disabled'}" ${canAdd ? `onclick="event.preventDefault();event.stopPropagation();window.addToCartDirect('${safeProdStr}');"` : 'disabled onclick="event.preventDefault();event.stopPropagation();"'}><i data-lucide="shopping-cart"></i> Cart</button>
            <button class="prod-buy-btn${canAdd ? '' : ' disabled'}" ${canAdd ? `onclick="event.preventDefault();event.stopPropagation();window.buyNowDirect('${safeProdStr}');"` : 'disabled onclick="event.preventDefault();event.stopPropagation();"'}>Buy Now</button>
        </div>`;
    return `
        <a href="product.html?id=${prod.id}" class="product-card fade-in-stagger">
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
        </a>`;
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
    const indicatorsContainer = document.getElementById('banner-indicators');
    if (!bannerContainer) return;

    const banners = await MainAPI.fetchBanners();
    if (!banners || banners.length === 0) {
        bannerContainer.innerHTML = '<div style="padding:2rem;text-align:center;">Promotional Banner</div>';
        return;
    }

    // Build slides
    bannerContainer.innerHTML = banners.map((banner, i) => {
        const img = banner.imageUrl || banner.image_url || 'https://via.placeholder.com/1200x500';
        const link = banner.link || banner.link_url || banner.redirect_url || banner.url || '';
        const inner = link
            ? `<a href="${link}" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;height:100%;"><img src="${img}" alt="Banner ${i + 1}" class="banner-img"></a>`
            : `<img src="${img}" alt="Banner ${i + 1}" class="banner-img">`;
        return `<div class="banner-slide${i === 0 ? ' active' : ''}">${inner}</div>`;
    }).join('');

    // Build dot indicators
    if (indicatorsContainer) {
        indicatorsContainer.innerHTML = banners.map((_, i) =>
            `<button class="carousel-dot${i === 0 ? ' active' : ''}" onclick="carouselGoTo(${i})" aria-label="Slide ${i + 1}"></button>`
        ).join('');
    }

    // Show nav buttons only if more than 1 slide
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    if (banners.length <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();

    let current = 0;
    const slides = bannerContainer.querySelectorAll('.banner-slide');
    const dots = indicatorsContainer ? indicatorsContainer.querySelectorAll('.carousel-dot') : [];

    function goTo(index) {
        const prev = current;
        current = (index + banners.length) % banners.length;
        if (prev === current) return;

        slides[prev].classList.add('slide-out');
        slides[prev].classList.remove('active');
        slides[current].style.transform = 'translateX(100%)';
        slides[current].classList.remove('slide-out');
        // Force reflow then activate
        slides[current].offsetWidth;
        slides[current].classList.add('active');

        setTimeout(() => slides[prev].classList.remove('slide-out'), 650);

        dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    window.carouselGoTo = goTo;
    window.carouselNext = () => { goTo(current + 1); resetTimer(); };
    window.carouselPrev = () => { goTo(current - 1); resetTimer(); };

    let timer = setInterval(() => goTo(current + 1), 5000);
    function resetTimer() { clearInterval(timer); timer = setInterval(() => goTo(current + 1), 5000); }

    bannerContainer.addEventListener('mouseenter', () => clearInterval(timer));
    bannerContainer.addEventListener('mouseleave', () => { timer = setInterval(() => goTo(current + 1), 5000); });
    bannerContainer.addEventListener('touchstart', () => clearInterval(timer), { passive: true });
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
