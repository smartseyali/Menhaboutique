// ============================================================
// Admin Panel JS - Menha Boutique (Supabase Direct)
// ============================================================

// Always render at top on load — no mid/lower scroll restore
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.addEventListener('pageshow', () => window.scrollTo(0, 0));

const SCHEMA = 'menha_boutique';

// ── STATE ─────────────────────────────────────────────────
let allProducts = [], allCategories = [], allOrders = [], allUsers = [], allBanners = [], allTariffs = [], allStates = [], allMessages = [], allCountries = [], allCities = [];

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const user = MainAPI.getUser();

    if (!user || !user.role || String(user.role).toLowerCase() !== 'admin') {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }

    document.getElementById('admin-content').style.display = 'block';
    document.getElementById('admin-user-name').textContent = user.first_name || 'Admin';

    initTabs();
    await loadDashboard();

    // Global file upload handler to compress to Base64
    document.addEventListener('change', async (e) => {
        if (e.target.type === 'file' && e.target.accept.includes('image')) {
            // Variant image upload (per-variant, in product modal)
            const variantIdxAttr = e.target.getAttribute('data-variant-image-idx');
            if (variantIdxAttr !== null) {
                const idx = parseInt(variantIdxAttr);
                const file = e.target.files && e.target.files[0];
                if (!file || isNaN(idx) || !productVariants[idx]) return;
                try {
                    const compressed = await compressImage(file);
                    productVariants[idx].image = compressed;
                    renderVariants();
                } catch (err) {
                    showToast('Failed to process variant image', 'error');
                }
                return;
            }

            const tgtInputId = e.target.id;
            const hiddenInputId = tgtInputId.replace('-upload', '');
            const previewDivId = tgtInputId.replace('-upload', '-preview');
            
            const files = Array.from(e.target.files);
            if(!files.length) return;
            
            const fileChosenId = tgtInputId.replace('-upload', '-file-chosen');
            const fileChosenEl = document.getElementById(fileChosenId);
            if (fileChosenEl) {
                if (files.length === 1) fileChosenEl.textContent = files[0].name;
                else fileChosenEl.textContent = `${files.length} files selected`;
            }
            
            const previewDiv = document.getElementById(previewDivId);
            if(previewDiv) previewDiv.innerHTML = '<span style="color:#888;">Compressing...</span>';
            
            try {
                const b64s = [];
                for (let f of files) {
                    const compressed = await compressImage(f);
                    b64s.push(compressed);
                }
                
                if (tgtInputId === 'pf-image-upload') {
                    currentProductImages = currentProductImages.concat(b64s);
                    document.getElementById(hiddenInputId).value = JSON.stringify(currentProductImages);
                    const fileChosen = document.getElementById('pf-file-chosen');
                    if(fileChosen) fileChosen.textContent = `${currentProductImages.length} files selected`;
                    renderProductPreviewGallery();
                } else if (tgtInputId === 'bf-image-upload') {
                    currentBannerImages = currentBannerImages.concat(b64s);
                    document.getElementById(hiddenInputId).value = JSON.stringify(currentBannerImages);
                    const fileChosen = document.getElementById('bf-file-chosen');
                    if(fileChosen) fileChosen.textContent = `${currentBannerImages.length} files selected`;
                    renderBannerPreviewGallery();
                } else {
                    document.getElementById(hiddenInputId).value = JSON.stringify(b64s);
                    if(previewDiv) {
                        previewDiv.innerHTML = b64s.map(b => `<img src="${b}" style="height:60px; border-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.1)">`).join('');
                    }
                }
            } catch(err) {
                showToast('Failed to process image', 'error');
                if(previewDiv) previewDiv.innerHTML = '';
            }
        }
    });
});

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let MAX_WIDTH = 1000;
                if(img.width < MAX_WIDTH) MAX_WIDTH = img.width; // don't upscale
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = error => reject(error);
    });
}

// ── AUTH ──────────────────────────────────────────────────
function handleLogout() {
    localStorage.removeItem('login_user');
    window.location.href = 'login.html';
}

// ── SIDEBAR ───────────────────────────────────────────────
function toggleSidebar() {
    document.getElementById('adminSidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
}

// ── TABS ──────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const tab = link.dataset.tab;
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');
            document.getElementById('adminSidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('open');
            await loadTab(tab);
        });
    });
}

async function loadTab(tab) {
    switch(tab) {
        case 'dashboard': await loadDashboard(); break;
        case 'products': await loadProducts(); break;
        case 'categories': await loadCategories(); break;
        case 'orders': await loadOrders(); break;
        case 'users': await loadUsers(); break;
        case 'banners': await loadBanners(); break;
        case 'delivery': await loadDelivery(); break;
        case 'couriers': await loadCouriers(); break;
        case 'payment': await loadPayment(); break;
        case 'locations': await loadLocations(); break;
        case 'messages': await loadMessages(); break;
        case 'settings': await loadSettings(); break;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const t = document.getElementById('admin-toast');
    t.textContent = msg;
    t.className = `admin-toast show ${type}`;
    setTimeout(() => { t.className = 'admin-toast'; }, 3000);
}

// ── CONFIRM DELETE ─────────────────────────────────────────
function confirmDelete(msg, onOk) {
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-ok-btn').onclick = () => { closeAllModals(); onOk(); };
    openModal('confirm-modal');
}

// ── MODAL HELPERS ─────────────────────────────────────────
function openModal(id) {
    document.getElementById('modal-backdrop').classList.add('open');
    document.getElementById(id).classList.add('open');
    setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 50);
}
function closeAllModals() {
    document.getElementById('modal-backdrop').classList.remove('open');
    document.querySelectorAll('.admin-modal').forEach(m => m.classList.remove('open'));
    // Reset confirm modal to default state (in case viewMessage changed it)
    const okBtn = document.getElementById('confirm-ok-btn');
    if (okBtn) okBtn.style.display = '';
    const cancelBtn = document.querySelector('#confirm-modal .btn-secondary');
    if (cancelBtn) cancelBtn.textContent = 'Cancel';
}

// ── DASHBOARD ─────────────────────────────────────────────
async function loadDashboard() {
    try {
        const [products, categories, orders] = await Promise.all([
            Supabase.from('products').select('id').get(),
            Supabase.from('categories').select('id').get(),
            Supabase.from('orders').select('id,total_price,status,created_at,order_number,email').get()
        ]);

        document.getElementById('stat-products').textContent = products.length;
        document.getElementById('stat-categories').textContent = categories.length;
        document.getElementById('stat-orders').textContent = orders.length;
        const revenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
        document.getElementById('stat-revenue').textContent = '₹' + revenue.toFixed(0);

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const recent = orders.filter(o => new Date(o.created_at) > sevenDaysAgo);
        const recentEl = document.getElementById('recent-orders-list');
        if (recent.length === 0) {
            recentEl.innerHTML = '<div class="dash-item">No orders in last 7 days</div>';
        } else {
            recentEl.innerHTML = recent.slice(0, 5).map(o => `
                <div class="dash-item">
                    <span>#${o.order_number || o.id.substring(0,8)}</span>
                    <span>${o.email || ''}</span>
                    <span style="font-weight:700;color:var(--color-primary)">₹${parseFloat(o.total_price||0).toFixed(0)}</span>
                </div>`).join('');
        }

        const byStatus = {};
        orders.forEach(o => { const s = o.status || 'pending'; byStatus[s] = (byStatus[s] || 0) + 1; });
        document.getElementById('status-dist').innerHTML = Object.entries(byStatus)
            .map(([s, c]) => `<div class="status-pill pill-${s}">${s}: ${c}</div>`).join('');
    } catch(e) {
        console.error(e);
        showToast('Failed to load dashboard', 'error');
    }
}

let productVariants = [];
let originalVariantIds = [];
let originalExtraImageIds = [];

function renderVariants() {
    const container = document.getElementById('pf-attributes-container');
    if(!container) return;
    const baseUOM = document.getElementById('pf-uom').value || 'g';
    if(productVariants.length === 0) {
        container.innerHTML = '<span style="color:#888; font-size:0.9rem;">No variants added. Base attributes will be used.</span>';
        return;
    }
    container.innerHTML = productVariants.map((v, i) => `
        <div style="display:flex; gap:10px; align-items:flex-start; background:#fff; padding:10px; border:1px solid var(--color-border); border-radius:6px;">
            <div style="width:90px; flex-shrink:0;">
                <label style="font-size:0.8rem;color:#666;display:block;">Image</label>
                <div style="position:relative; width:80px; height:80px; border:1px dashed #cbd5e0; border-radius:6px; overflow:hidden; background:#f8fafc; display:flex; align-items:center; justify-content:center;">
                    ${v.image ? `<img src="${v.image}" style="width:100%; height:100%; object-fit:cover;">` : `<i data-lucide="image" style="width:24px; height:24px; color:#a0aec0;"></i>`}
                    <input type="file" accept="image/*" data-variant-image-idx="${i}" style="position:absolute; inset:0; opacity:0; cursor:pointer;">
                    ${v.image ? `<button type="button" onclick="clearVariantImage(${i})" style="position:absolute; top:2px; right:2px; background:#e53e3e; color:white; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; line-height:1;">×</button>` : ''}
                </div>
            </div>
            <div style="flex:1">
                <label style="font-size:0.8rem;color:#666;display:block;">Size (${baseUOM})</label>
                <input type="text" value="${v.value}" onchange="updateVariant(${i}, 'value', this.value)" placeholder="e.g. 250" style="width:100%; padding:6px; border:1px solid var(--color-border); border-radius:4px;">
            </div>
            <div style="flex:1">
                <label style="font-size:0.8rem;color:#666;display:block;">Price (₹) *</label>
                <input type="number" step="0.01" value="${v.price}" onchange="updateVariant(${i}, 'price', this.value)" style="width:100%; padding:6px; border:1px solid var(--color-border); border-radius:4px;" required>
            </div>
            <div style="flex:1">
                <label style="font-size:0.8rem;color:#666;display:block;">Old Price</label>
                <input type="number" step="0.01" value="${v.old_price||''}" onchange="updateVariant(${i}, 'old_price', this.value)" style="width:100%; padding:6px; border:1px solid var(--color-border); border-radius:4px;">
            </div>
            <div style="flex:1">
                <label style="font-size:0.8rem;color:#666;display:block;">Stock</label>
                <input type="number" value="${v.stock}" onchange="updateVariant(${i}, 'stock', this.value)" style="width:100%; padding:6px; border:1px solid var(--color-border); border-radius:4px;" required>
            </div>
            <div style="width:40px;text-align:right">
                <button type="button" class="btn-icon del" onclick="removeVariant(${i})" style="margin-top:15px;"><i data-lucide="trash-2"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

window.addAttributeRow = function() {
    const defaults = {
        value: '',
        price: document.getElementById('pf-price').value || '',
        old_price: document.getElementById('pf-old-price').value || '',
        stock: document.getElementById('pf-stock').value || 0,
        image: ''
    };
    productVariants.push(defaults);
    renderVariants();
};
window.updateVariant = function(idx, field, val) { productVariants[idx][field] = val; };
window.removeVariant = function(idx) { productVariants.splice(idx, 1); renderVariants(); };
window.clearVariantImage = function(idx) {
    if (productVariants[idx]) {
        productVariants[idx].image = '';
        renderVariants();
    }
};

let currentProductImages = [];

window.setPrimaryImage = function(index) {
    if(index === 0) return;
    const item = currentProductImages.splice(index, 1)[0];
    currentProductImages.unshift(item); // Move to start
    document.getElementById('pf-image').value = JSON.stringify(currentProductImages);
    renderProductPreviewGallery();
};

window.removeProductImage = function(index) {
    currentProductImages.splice(index, 1);
    document.getElementById('pf-image').value = currentProductImages.length ? JSON.stringify(currentProductImages) : '';
    const fileChosen = document.getElementById('pf-file-chosen');
    if(fileChosen) fileChosen.textContent = currentProductImages.length ? `${currentProductImages.length} files selected` : 'No file chosen';
    renderProductPreviewGallery();
};

function renderProductPreviewGallery() {
    const previewDiv = document.getElementById('pf-image-preview');
    if(!previewDiv) return;
    if(currentProductImages.length === 0) {
        previewDiv.innerHTML = '<span style="color:#888; grid-column: 1 / -1; text-align: center; padding: 20px;">No images uploaded. Click "Choose Files" to attach.</span>';
        return;
    }
    previewDiv.innerHTML = currentProductImages.map((img, idx) => `
        <div style="position:relative; width: 100%; height: 180px; border: ${idx === 0 ? '3px solid var(--color-primary)' : '1px solid var(--color-border)'}; border-radius: 8px; overflow: hidden; background: #fff; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <img src="${img}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            ${idx === 0 ? `<div style="position:absolute; top:8px; left:8px; background:var(--color-primary); color:white; font-size:0.7rem; padding:4px 10px; border-radius:12px; font-weight:600; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">PRIMARY</div>` : ''}
            
            <div style="position:absolute; bottom:0; left:0; right:0; background: rgba(255,255,255,0.9); padding: 8px; display:flex; justify-content:space-between; gap:5px; border-top: 1px solid rgba(0,0,0,0.05);">
                ${idx !== 0 ? `<button type="button" onclick="setPrimaryImage(${idx})" style="flex:1; background:var(--color-primary-dark); color:white; border:none; padding:6px 0; border-radius:4px; font-size:0.75rem; font-weight: 500; cursor:pointer;">Make Primary</button>` : '<div style="flex:1"></div>'}
                <button type="button" onclick="removeProductImage(${idx})" style="background:#e53e3e; color:white; border:none; padding:6px 10px; border-radius:4px; font-size:0.75rem; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// ── PRODUCTS ─────────────────────────────────────────────
async function loadProducts() {
    document.getElementById('products-tbody').innerHTML = '<tr><td colspan="7" class="loading-row">Loading...</td></tr>';
    try {
        allProducts = await Supabase.from('products').select('*').order('sequence').get();
        renderProducts(allProducts);
    } catch(e) { showToast('Failed to load products', 'error'); }
}
function renderProducts(list) {
    const tbody = document.getElementById('products-tbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No products found</td></tr>'; return; }
    tbody.innerHTML = list.map(p => {
        let statusBadgeClass = 'badge-inactive';
        if (p.status === 'In Stock') statusBadgeClass = 'badge-active';
        else if (p.status === 'Coming Soon') statusBadgeClass = 'badge-admin';
        return `
        <tr>
            <td><img src="${p.primary_image || 'https://via.placeholder.com/48'}" class="table-img" onerror="this.src='https://via.placeholder.com/48'"></td>
            <td style="max-width:200px;font-weight:600;">${p.title}</td>
            <td style="color:#888;font-size:0.8rem;">${p.sku}</td>
            <td style="font-weight:700;color:var(--color-primary)">₹${parseFloat(p.new_price).toFixed(2)}</td>
            <td>${p.stock_quantity}</td>
            <td><span class="${statusBadgeClass}">${p.status}</span></td>
            <td>
                <button class="btn-icon" data-id="${p.id}" onclick="openProductModal(this.dataset.id)"><i data-lucide="pencil"></i></button>
                <button class="btn-icon del" data-id="${p.id}" data-title="${p.title}" onclick="deleteProduct(this.dataset.id, this.dataset.title)"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`;
    }).join('');
    lucide.createIcons();
}
function filterProducts() {
    const q = document.getElementById('product-search').value.toLowerCase();
    renderProducts(allProducts.filter(p => p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
}

async function openProductModal(id = null) {
    document.getElementById('product-modal-title').textContent = id ? 'Edit Product' : 'Add Product';
    document.getElementById('product-form').reset();
    document.getElementById('pf-id').value = '';
    
    productVariants = [];
    originalVariantIds = [];
    originalExtraImageIds = [];
    currentProductImages = [];
    document.getElementById('pf-uom').onchange = renderVariants;
    renderProductPreviewGallery();

    // Load categories & brands for selects
    try {
        if (!allCategories.length) allCategories = await Supabase.from('categories').select('id,name').order('name').get();
        const brands = await Supabase.from('brands').select('id,name').order('name').get();
        document.getElementById('pf-category').innerHTML = '<option value="">No Category</option>' + allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        document.getElementById('pf-brand').innerHTML = '<option value="">No Brand</option>' + brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    } catch(e) {}

    if (id) {
        const p = allProducts.find(x => x.id === id);
        if (p) {
            document.getElementById('pf-id').value = p.id;
            document.getElementById('pf-title').value = p.title;
            document.getElementById('pf-sku').value = p.sku;
            document.getElementById('pf-price').value = p.new_price;
            document.getElementById('pf-old-price').value = p.old_price || '';
            document.getElementById('pf-stock').value = p.stock_quantity;
            const baseUOM = p.weight ? (p.weight.match(/[A-Za-z]+/) || ['g'])[0] : 'g';
            document.getElementById('pf-uom').value = baseUOM;
            document.getElementById('pf-category').value = p.category_id || '';
            document.getElementById('pf-brand').value = p.brand_id || '';
            document.getElementById('pf-status').value = p.status;
            document.getElementById('pf-sequence').value = p.sequence || 0;
            document.getElementById('pf-sale-tag').value = p.sale_tag || '';
            document.getElementById('pf-rating').value = p.rating || 0;
            
            document.getElementById('pf-image').value = p.primary_image || '';
            currentProductImages = p.primary_image ? [p.primary_image] : [];
            
            try {
                const imgs = await Supabase.from('product_images').select('*').eq('product_id', p.id).order('display_order').get();
                if(imgs && imgs.length) {
                    currentProductImages = currentProductImages.concat(imgs.map(x => x.image_url));
                    document.getElementById('pf-image').value = JSON.stringify(currentProductImages);
                    originalExtraImageIds = imgs.map(x => x.id);
                }
            } catch(e) {}
            
            document.getElementById('pf-desc').value = p.description || '';
            document.getElementById('pf-special').checked = p.is_special;
            document.getElementById('pf-combo').checked = p.is_combo;
            
            try {
                const attrs = await Supabase.from('product_attributes').select('*').eq('product_id', p.id).order('display_order').get();
                if(attrs && attrs.length) {
                    productVariants = attrs.map(a => ({
                        id: a.id,
                        value: a.attribute_value.replace(/[^0-9.]/g, ''),
                        price: a.price,
                        old_price: a.old_price,
                        stock: a.stock_quantity,
                        image: a.image_url || ''
                    }));
                    originalVariantIds = attrs.map(a => a.id);
                }
            } catch(e) {}
        }
    }
    const fileChosen = document.getElementById('pf-file-chosen');
    if(fileChosen) fileChosen.textContent = currentProductImages.length ? `${currentProductImages.length} files selected` : 'No file chosen';
    renderProductPreviewGallery();
    renderVariants();
    openModal('product-modal');
}

async function saveProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('pf-submit');
    btn.disabled = true; btn.textContent = 'Saving...';
    const id = document.getElementById('pf-id').value;
    const rawImage = document.getElementById('pf-image').value;
    let primary_image = rawImage;
    let extra_images = [];
    if(rawImage.startsWith('[')) {
        try {
            const arr = JSON.parse(rawImage);
            primary_image = arr[0] || '';
            extra_images = arr.slice(1);
        } catch(e){}
    }

    const stockQty = parseInt(document.getElementById('pf-stock').value);
    let computedStatus = document.getElementById('pf-status').value;
    // Auto-derive status from stock value unless admin chose Coming Soon
    if (computedStatus !== 'Coming Soon') {
        computedStatus = stockQty > 0 ? 'In Stock' : 'Out of Stock';
    }

    const data = {
        title: document.getElementById('pf-title').value,
        sku: document.getElementById('pf-sku').value,
        new_price: parseFloat(document.getElementById('pf-price').value),
        old_price: document.getElementById('pf-old-price').value ? parseFloat(document.getElementById('pf-old-price').value) : null,
        stock_quantity: stockQty,
        weight: document.getElementById('pf-uom').value || 'g',
        category_id: document.getElementById('pf-category').value || null,
        brand_id: document.getElementById('pf-brand').value || null,
        status: computedStatus,
        sequence: parseInt(document.getElementById('pf-sequence').value) || 0,
        sale_tag: document.getElementById('pf-sale-tag').value || null,
        rating: parseFloat(document.getElementById('pf-rating').value) || 0,
        primary_image: primary_image,
        description: document.getElementById('pf-desc').value || null,
        is_special: document.getElementById('pf-special').checked,
        is_combo: document.getElementById('pf-combo').checked,
        updated_at: new Date().toISOString()
    };
    try {
        let resultProdId = id;
        if (id) {
            await Supabase.from('products').eq('id', id).update(data);
            showToast('Product updated!');
        } else {
            const result = await Supabase.from('products').insert(data);
            resultProdId = (result && result.length > 0) ? result[0].id : null;
            showToast('Product created!');
        }

        // ── Sync extra product images: delete removed, insert new ──
        if (resultProdId) {
            // Delete any previously-saved extra images that are no longer present
            for (const oldId of originalExtraImageIds) {
                try { await Supabase.from('product_images').eq('id', oldId).delete(); } catch (e) { console.warn('Failed to delete product_image', oldId, e); }
            }
            originalExtraImageIds = [];
            // Insert current extras (always re-create — they have no stable client-side ID)
            for (let i = 0; i < extra_images.length; i++) {
                await Supabase.from('product_images').insert({
                    product_id: resultProdId,
                    image_url: extra_images[i],
                    is_primary: false,
                    display_order: i + 1
                });
            }
        }

        // ── Sync product variants: UPDATE existing, INSERT new, DELETE removed ──
        if (resultProdId) {
            const keptIds = new Set(productVariants.filter(v => v.id).map(v => v.id));
            const removedIds = originalVariantIds.filter(id => !keptIds.has(id));

            // Delete variants the user removed in the form
            for (const rid of removedIds) {
                try { await Supabase.from('product_attributes').eq('id', rid).delete(); } catch (e) { console.warn('Failed to delete variant', rid, e); }
            }

            // Update or insert the rest
            for (let i = 0; i < productVariants.length; i++) {
                const v = productVariants[i];
                if (!v.value) continue;
                const variantPayload = {
                    product_id: resultProdId,
                    attribute_type: 'weight',
                    attribute_value: v.value + (document.getElementById('pf-uom').value || 'g'),
                    price: parseFloat(v.price) || 0,
                    old_price: v.old_price ? parseFloat(v.old_price) : null,
                    stock_quantity: parseInt(v.stock) || 0,
                    is_default: (i === 0),
                    display_order: i
                };
                if (v.image) variantPayload.image_url = v.image;

                const trySave = async (payload, isUpdate) => {
                    if (isUpdate) {
                        return await Supabase.from('product_attributes').eq('id', v.id).update(payload);
                    } else {
                        return await Supabase.from('product_attributes').insert(payload);
                    }
                };

                try {
                    await trySave(variantPayload, !!v.id);
                } catch (err) {
                    // Fallback: image_url column missing in DB
                    if (err.message && err.message.includes('image_url')) {
                        delete variantPayload.image_url;
                        await trySave(variantPayload, !!v.id);
                    } else {
                        throw err;
                    }
                }
            }
            // Refresh originalVariantIds for the next save while modal stays open
            originalVariantIds = productVariants.filter(v => v.id).map(v => v.id);
        }

        closeAllModals();
        await loadProducts();
    } catch(err) {
        showToast(err.message || 'Save failed', 'error');
    }
    btn.disabled = false; btn.textContent = 'Save Product';
}

async function deleteProduct(id, name) {
    confirmDelete(`Delete product "${name}"?`, async () => {
        try {
            await Supabase.from('products').eq('id', id).delete();
            showToast('Product deleted');
            await loadProducts();
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}

// ── CATEGORIES ────────────────────────────────────────────
async function loadCategories() {
    document.getElementById('categories-tbody').innerHTML = '<tr><td colspan="5" class="loading-row">Loading...</td></tr>';
    try {
        allCategories = await Supabase.from('categories').select('*').order('sequence').get();
        renderCategories();
    } catch(e) { showToast('Failed to load categories', 'error'); }
}
function renderCategories() {
    const tbody = document.getElementById('categories-tbody');
    if (!allCategories.length) { tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No categories</td></tr>'; return; }
    tbody.innerHTML = allCategories.map(c => `
        <tr>
            <td><img src="${c.image || 'https://via.placeholder.com/48'}" class="table-img" onerror="this.src='https://via.placeholder.com/48'"></td>
            <td style="font-weight:600;">${c.name}</td>
            <td style="color:#888;font-size:0.8rem;">${c.slug}</td>
            <td>${c.sequence || 0}</td>
            <td>
                <button class="btn-icon" data-id="${c.id}" onclick="openCategoryModal(this.dataset.id)"><i data-lucide="pencil"></i></button>
                <button class="btn-icon del" data-id="${c.id}" data-name="${c.name}" onclick="deleteCategory(this.dataset.id, this.dataset.name)"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`).join('');
    lucide.createIcons();
}

function autoSlug() {
    const name = document.getElementById('cf-name').value;
    document.getElementById('cf-slug').value = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function openCategoryModal(id = null) {
    document.getElementById('cat-modal-title').textContent = id ? 'Edit Category' : 'Add Category';
    document.getElementById('category-form').reset();
    document.getElementById('cf-id').value = '';
    document.getElementById('cf-parent').innerHTML = '<option value="">None (Top Level)</option>' + allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (id) {
        const c = allCategories.find(x => x.id === id);
        if (c) {
            document.getElementById('cf-id').value = c.id;
            document.getElementById('cf-name').value = c.name;
            document.getElementById('cf-slug').value = c.slug;
            document.getElementById('cf-sequence').value = c.sequence || 0;
            document.getElementById('cf-parent').value = c.parent_id || '';
            document.getElementById('cf-image').value = c.image || '';
            document.getElementById('cf-image-preview').innerHTML = c.image ? `<img src="${c.image}" style="height:60px; border-radius:4px;">` : '';
            document.getElementById('cf-desc').value = c.description || '';
        }
    } else {
        document.getElementById('cf-image-preview').innerHTML = '';
    }
    openModal('category-modal');
}

async function saveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('cf-id').value;
    const rawImage = document.getElementById('cf-image').value || null;
    let category_image = rawImage;
    if(rawImage && rawImage.startsWith('[')) {
        try { category_image = JSON.parse(rawImage)[0] || null; } catch(e){}
    }

    const data = {
        name: document.getElementById('cf-name').value,
        slug: document.getElementById('cf-slug').value,
        sequence: parseInt(document.getElementById('cf-sequence').value) || 0,
        parent_id: document.getElementById('cf-parent').value || null,
        image: category_image,
        description: document.getElementById('cf-desc').value || null,
        updated_at: new Date().toISOString()
    };
    try {
        if (id) {
            await Supabase.from('categories').eq('id', id).update(data);
            showToast('Category updated!');
        } else {
            await Supabase.from('categories').insert(data);
            showToast('Category created!');
        }
        closeAllModals();
        await loadCategories();
    } catch(err) { showToast(err.message || 'Save failed', 'error'); }
}

async function deleteCategory(id, name) {
    confirmDelete(`Delete category "${name}"?`, async () => {
        try {
            await Supabase.from('categories').eq('id', id).delete();
            showToast('Category deleted');
            await loadCategories();
        } catch(e) { showToast(e.message || 'Delete failed', 'error'); }
    });
}

// ── ORDERS ────────────────────────────────────────────────
async function loadOrders() {
    document.getElementById('orders-tbody').innerHTML = '<tr><td colspan="9" class="loading-row">Loading...</td></tr>';
    try {
        // Fetch orders with items, addresses and potentially courier info
        allOrders = await Supabase.from('orders')
            .select('*, order_items(*, product:products(title, primary_image, sku)), address:addresses(*)')
            .order('created_at', false)
            .get();
        renderOrders(allOrders);
    } catch(e) { 
        console.error(e);
        showToast('Failed to load orders', 'error'); 
    }
}

function renderOrders(list) {
    const tbody = document.getElementById('orders-tbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" class="loading-row">No orders</td></tr>'; return; }
    
    tbody.innerHTML = list.map(o => {
        const date = new Date(o.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
        const items = (o.order_items || []).length;
        return `<tr>
            <td><input type="checkbox" class="order-checkbox" value="${o.id}"></td>
            <td style="font-weight:700;">#${o.order_number || o.id.substring(0,8)}</td>
            <td style="font-size:0.8rem;">${o.email || '—'}</td>
            <td>${items}</td>
            <td style="font-weight:700;color:var(--color-primary)">₹${parseFloat(o.total_price||0).toFixed(0)}</td>
            <td style="font-size:0.85rem;color:#666;">${o.courier_name || '—'}</td>
            <td style="font-size:0.8rem;">${o.payment_method || 'COD'}</td>
            <td><span class="status-pill pill-${o.status}">${o.status}</span></td>
            <td style="font-size:0.8rem;color:#888;">${date}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon" title="View Details" onclick="viewOrderDetails('${o.id}')"><i data-lucide="eye"></i></button>
                    <button class="btn-icon" title="Update Status" onclick="openOrderModal('${o.id}','${o.order_number}','${o.status}')"><i data-lucide="pencil"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
    lucide.createIcons();
    document.getElementById('order-select-all').checked = false;
    
    // Add change listeners to checkboxes to show/hide bulk actions
    document.querySelectorAll('.order-checkbox').forEach(cb => {
        cb.addEventListener('change', updateBulkActionsVisibility);
    });
    updateBulkActionsVisibility();
}

function toggleSelectAllOrders(checked) {
    document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = checked);
    updateBulkActionsVisibility();
}

function updateBulkActionsVisibility() {
    const selectedCount = document.querySelectorAll('.order-checkbox:checked').length;
    const bulkPanel = document.getElementById('bulk-order-actions');
    if (bulkPanel) {
        bulkPanel.style.display = selectedCount > 0 ? 'flex' : 'none';
    }
}

function filterOrders() {
    renderOrders(getFilteredOrders());
}

function clearOrderDateFilter() {
    document.getElementById('order-date-from').value = '';
    document.getElementById('order-date-to').value = '';
    filterOrders();
}

function getFilteredOrders() {
    const q = document.getElementById('order-search').value.toLowerCase();
    const s = document.getElementById('order-status-filter').value;
    const dateFrom = document.getElementById('order-date-from').value;
    const dateTo = document.getElementById('order-date-to').value;

    return allOrders.filter(o => {
        const matchQ = !q || (o.order_number||'').toLowerCase().includes(q) || (o.email||'').toLowerCase().includes(q);
        const matchS = !s || o.status === s;

        let matchDate = true;
        if (dateFrom || dateTo) {
            const orderTs = new Date(o.created_at).getTime();
            if (dateFrom) {
                const fromTs = new Date(dateFrom).getTime();
                if (orderTs < fromTs) matchDate = false;
            }
            if (dateTo) {
                const toTs = new Date(dateTo).getTime();
                if (orderTs > toTs) matchDate = false;
            }
        }

        return matchQ && matchS && matchDate;
    });
}

let currentViewOrder = null;

async function viewOrderDetails(id) {
    const order = allOrders.find(o => o.id === id);
    if (!order) return;
    currentViewOrder = order;

    document.getElementById('odm-title').textContent = `Order #${order.order_number || order.id.substring(0,8)}`;
    
    // Items List
    const itemsList = document.getElementById('odm-items-list');
    itemsList.innerHTML = (order.order_items || []).map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee;">
            <div style="display:flex; gap:15px; align-items:center;">
                <img src="${item.product && item.product.primary_image ? item.product.primary_image : 'https://via.placeholder.com/40'}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #eee;">
                <div>
                    <div style="font-weight:600;">${item.product ? item.product.title : 'Unknown Product'}</div>
                    <div style="color:#666; font-size:0.85rem;">Qty: ${item.quantity}</div>
                </div>
            </div>
            <div style="font-weight:600;">₹${parseFloat(item.total_price).toFixed(2)}</div>
        </div>
    `).join('') || '<div style="color:#888;">No items found.</div>';

    // Summary
    const subtotal = (order.order_items || []).reduce((sum, item) => sum + parseFloat(item.total_price), 0);
    document.getElementById('odm-summary').innerHTML = `
        <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Delivery Charge:</span><span>₹${parseFloat(order.delivery_charge || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.1rem; border-top:1px solid #eee; padding-top:10px; margin-top:5px;">
            <span>Total:</span><span>₹${parseFloat(order.total_price).toFixed(2)}</span>
        </div>
    `;

    // Address
    const addr = order.address;
    if (addr) {
        document.getElementById('odm-address').innerHTML = `
            <strong>${addr.first_name} ${addr.last_name}</strong><br>
            ${addr.address_line1}${addr.address_line2 ? ', ' + addr.address_line2 : ''}<br>
            ${addr.city}, ${addr.state} - ${addr.zip_code}<br>
            ${addr.country}<br>
            <strong>Phone:</strong> ${addr.phone_number}
        `;
    } else {
        document.getElementById('odm-address').innerHTML = '<span style="color:#888;">No address found.</span>';
    }

    // Customer
    document.getElementById('odm-customer').innerHTML = `
        <strong>Email:</strong> ${order.email || 'N/A'}<br>
        <strong>Order Date:</strong> ${new Date(order.created_at).toLocaleString()}<br>
        <strong>Status:</strong> <span class="status-pill pill-${order.status}">${order.status}</span>
    `;

    // Payment
    document.getElementById('odm-payment').innerHTML = `
        <strong>Method:</strong> ${order.payment_method || 'COD'}<br>
        <strong>Status:</strong> ${order.payment_status || 'Unpaid'}<br>
        ${order.payment_link ? `<strong>Link:</strong> <a href="${order.payment_link}" target="_blank" style="color:var(--color-primary); word-break:break-all;">Click Here</a>` : ''}
    `;

    // Courier
    const trackUrl = order.tracking_url ? `<a href="${order.tracking_url}" target="_blank" style="color:var(--color-primary); word-break:break-all;">${order.tracking_url}</a>` : 'N/A';
    document.getElementById('odm-courier').innerHTML = `
        <strong>Selected Courier:</strong> ${order.courier_name || 'Not selected'}<br>
        <strong>Courier ID:</strong> ${order.courier_id || 'N/A'}<br>
        <strong>Tracking ID:</strong> ${order.tracking_id || 'N/A'}<br>
        <strong>Tracking URL:</strong> ${trackUrl}
    `;

    openModal('order-details-modal');
}

function exportOrdersToExcel() {
    const filtered = getFilteredOrders();
    if (!filtered.length) { showToast('No orders to export', 'error'); return; }

    if (typeof XLSX === 'undefined') {
        showToast('Excel library not loaded', 'error');
        return;
    }

    const fmtDate = (iso) => {
        const d = new Date(iso);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const itemsSummary = (o) => {
        return (o.order_items || []).map(it => {
            const t = it.product ? it.product.title : 'Item';
            return `${t} (x${it.quantity})`;
        }).join(', ');
    };

    const customerName = (addr) => {
        if (!addr) return '';
        return `${addr.first_name || ''} ${addr.last_name || ''}`.trim();
    };

    // Sheet 1: Order Details — matches reference layout
    const orderHeaders = [
        'Order Number','Date','Email','Customer Name','Phone','Address','City','State','Zip',
        'Items','Total','Status','Payment Method','Tracking ID','Tracking URL'
    ];
    const orderRows = filtered.map(o => {
        const addr = o.address || {};
        return [
            o.order_number || o.id.substring(0, 8),
            fmtDate(o.created_at),
            o.email || '',
            customerName(addr) || null,
            addr.phone_number || null,
            addr.address_line1 ? `${addr.address_line1}${addr.address_line2 ? ' ' + addr.address_line2 : ''}` : null,
            addr.city || null,
            addr.state || null,
            addr.zip_code || null,
            itemsSummary(o),
            parseFloat(o.total_price || 0),
            o.status || 'pending',
            o.payment_method || 'cod',
            o.tracking_id || 'N/A',
            o.tracking_url || 'N/A'
        ];
    });
    const orderSheet = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);

    // Sheet 2: Packing Slips — address | order details (multiline cells)
    const packHeaders = ['address', 'order details', 'SKU details'];
    const packRows = filtered.map(o => {
        const addr = o.address || {};
        const name = customerName(addr);
        const addressBlock = [
            name,
            addr.address_line1 ? `${addr.address_line1}${addr.address_line2 ? ', ' + addr.address_line2 : ''}` : '',
            (addr.city || '') + (addr.state ? `, ${addr.state}` : '') + (addr.zip_code ? ` - ${addr.zip_code}` : ''),
            addr.country || 'India',
            addr.phone_number ? `Mob: ${addr.phone_number}` : ''
        ].filter(Boolean).join('\n');

        const itemsBlock = (o.order_items || []).map(it => {
            const t = it.product ? it.product.title : 'Item';
            return `${t} - ${it.quantity}`;
        }).join('\n');

        const skuBlock = (o.order_items || []).map(it => {
            const sku = it.product ? (it.product.sku || '') : '';
            return `${sku} - ${it.quantity}`;
        }).join('\n');

        return [addressBlock, itemsBlock, skuBlock];
    });
    const packSheet = XLSX.utils.aoa_to_sheet([packHeaders, ...packRows]);
    packSheet['!cols'] = [{ wch: 60 }, { wch: 50 }, { wch: 25 }];
    // Enable wrap text on multi-line cells
    Object.keys(packSheet).forEach(cell => {
        if (cell[0] !== '!' && packSheet[cell] && typeof packSheet[cell].v === 'string' && packSheet[cell].v.includes('\n')) {
            packSheet[cell].s = { alignment: { wrapText: true, vertical: 'top' } };
        }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, packSheet, 'Packing Slips');
    XLSX.utils.book_append_sheet(wb, orderSheet, 'Order Details');

    XLSX.writeFile(wb, `Orders_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function printSelectedOrders() {
    const selectedIds = Array.from(document.querySelectorAll('.order-checkbox:checked')).map(cb => cb.value);
    if (!selectedIds.length) { showToast('Please select at least one order', 'error'); return; }

    const ordersToPrint = allOrders.filter(o => selectedIds.includes(o.id));
    generateAndPrintLabels(ordersToPrint);
}

function printSingleOrder() {
    if (!currentViewOrder) return;
    generateAndPrintLabels([currentViewOrder]);
}

function generateAndPrintLabels(orders) {
    if (!orders || !orders.length) {
        showToast('No orders selected for printing', 'error');
        return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        showToast('Please allow popups to print labels', 'error');
        return;
    }

    let labelsHtml = '';
    orders.forEach(o => {
        const addr = o.address || {};
        const itemsHtml = (o.order_items || []).map(item => `
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:3px;">
                <span style="flex:1;">• ${item.product ? item.product.title : 'Product'}</span>
                <span style="margin-left:10px; font-weight:700;">x${item.quantity}</span>
            </div>
        `).join('');

        labelsHtml += `
            <div class="label-page">
                <div class="courier-label">
                    <div class="label-header">
                        <div class="brand">MENHA BOUTIQUE</div>
                        <div class="order-id">#${o.order_number || o.id.substring(0,8)}</div>
                    </div>
                    
                    <div class="shipping-section">
                        <div class="section-title">SHIP TO:</div>
                        <div class="customer-name">${addr.first_name || ''} ${addr.last_name || ''}</div>
                        <div class="address-lines">
                            ${addr.address_line1 || ''}<br>
                            ${addr.address_line2 ? addr.address_line2 + '<br>' : ''}
                            ${addr.city}, ${addr.state} - ${addr.zip_code}<br>
                            ${addr.country || 'India'}
                        </div>
                        <div class="phone-number">📞 ${addr.phone_number || ''}</div>
                    </div>

                    <div class="products-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #000;">
                        <div class="section-title">ORDER CONTENT:</div>
                        <div class="items-list">
                            ${itemsHtml}
                        </div>
                    </div>

                    <div class="label-footer">
                        <span>Date: ${new Date(o.created_at).toLocaleDateString()}</span>
                        <span>Total Qty: ${(o.order_items || []).reduce((s, i) => s + i.quantity, 0)}</span>
                    </div>
                </div>
            </div>
        `;
    });

    printWindow.document.write(`
        <html>
        <head>
            <title>Courier Labels - Menha Boutique</title>
            <style>
                body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f0f0; }
                @media print {
                    body { background: white; }
                    .label-page { page-break-after: always; padding: 0; margin: 0; border: none; }
                }
                .label-page { 
                    display: flex; 
                    justify-content: center; 
                    padding: 20px; 
                    background: #f0f0f0;
                }
                .courier-label {
                    width: 400px;
                    background: white;
                    border: 2px solid #000;
                    padding: 20px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                @media print {
                    .label-page { background: transparent; padding: 0; }
                    .courier-label { box-shadow: none; border: 2px solid #000; margin: 20px auto; }
                }
                .label-header {
                    border-bottom: 2px solid #000;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .brand { font-size: 20px; font-weight: 800; color: #000; letter-spacing: 1px; }
                .order-id { font-size: 14px; font-weight: 600; }
                .section-title { font-size: 12px; font-weight: 700; color: #666; margin-bottom: 5px; }
                .customer-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; }
                .address-lines { font-size: 14px; line-height: 1.4; margin-bottom: 10px; }
                .phone-number { font-size: 16px; font-weight: 700; border: 1px dashed #000; padding: 5px; display: inline-block; }
                .payment-info {
                    margin-top: 15px;
                    border: 2px solid #000;
                    padding: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f9f9f9;
                }
                .payment-method { font-size: 18px; font-weight: 900; }
                .amount-to-collect { font-size: 16px; font-weight: 700; }
                .label-footer {
                    margin-top: 15px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: #555;
                    border-top: 1px solid #eee;
                    padding-top: 8px;
                }
            </style>
        </head>
        <body>
            ${labelsHtml}
            <script>
                window.onload = function() {
                    window.print();
                    // window.close(); // Optional: close after printing
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


function openOrderModal(id, num, status) {
    document.getElementById('om-order-id').value = id;
    document.getElementById('om-order-num').textContent = num || id.substring(0, 8);
    document.getElementById('om-status').value = status;
    const order = allOrders.find(o => o.id === id);
    document.getElementById('om-tracking-id').value = (order && order.tracking_id) || '';
    document.getElementById('om-tracking-url').value = (order && order.tracking_url) || '';
    openModal('order-modal');
}
async function updateOrderStatus() {
    const id = document.getElementById('om-order-id').value;
    const status = document.getElementById('om-status').value;
    const trackingId = document.getElementById('om-tracking-id').value.trim();
    const trackingUrl = document.getElementById('om-tracking-url').value.trim();

    const payload = {
        status,
        tracking_id: trackingId || null,
        tracking_url: trackingUrl || null,
        updated_at: new Date().toISOString()
    };

    try {
        await Supabase.from('orders').eq('id', id).update(payload);
        showToast('Order updated!');
        closeAllModals();
        await loadOrders();
    } catch(e) {
        // Fallback if columns don't yet exist
        if (e.message && (e.message.includes('tracking_id') || e.message.includes('tracking_url'))) {
            try {
                await Supabase.from('orders').eq('id', id).update({ status, updated_at: new Date().toISOString() });
                showToast('Status saved (tracking columns missing in DB)', 'error');
                closeAllModals();
                await loadOrders();
                return;
            } catch (e2) {}
        }
        showToast('Update failed', 'error');
    }
}

async function bulkUpdateOrderStatus() {
    const selectedIds = Array.from(document.querySelectorAll('.order-checkbox:checked')).map(cb => cb.value);
    if (!selectedIds.length) {
        showToast('Please select at least one order', 'error');
        return;
    }

    const newStatus = document.getElementById('bulk-order-status').value;
    if (!confirm(`Update status of ${selectedIds.length} orders to "${newStatus}"?`)) return;

    const btn = document.querySelector('#bulk-order-actions button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
        await Promise.all(selectedIds.map(id => 
            Supabase.from('orders').eq('id', id).update({ 
                status: newStatus, 
                updated_at: new Date().toISOString() 
            })
        ));

        showToast(`${selectedIds.length} orders updated successfully!`);
        await loadOrders();
    } catch (e) {
        console.error('Bulk update error:', e);
        showToast('Failed to update some orders', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ── USERS ─────────────────────────────────────────────────
async function loadUsers() {
    document.getElementById('users-tbody').innerHTML = '<tr><td colspan="7" class="loading-row">Loading...</td></tr>';
    try {
        allUsers = await Supabase.from('users').select('id,email,first_name,last_name,phone_number,role,is_active,created_at').order('created_at', false).get();
        renderUsers(allUsers);
    } catch(e) { showToast('Failed to load users', 'error'); }
}
function renderUsers(list) {
    const tbody = document.getElementById('users-tbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No users</td></tr>'; return; }
    tbody.innerHTML = list.map(u => {
        const date = new Date(u.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
        return `<tr>
            <td style="font-weight:600;">${u.first_name || ''} ${u.last_name || ''}</td>
            <td style="font-size:0.82rem;">${u.email}</td>
            <td style="font-size:0.82rem;">${u.phone_number || '—'}</td>
            <td><span class="badge-${u.role}">${u.role}</span></td>
            <td><span class="${u.is_active ? 'badge-active' : 'badge-inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td style="color:#888;font-size:0.8rem;">${date}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon" onclick="viewUserAddresses('${u.id}', '${u.first_name} ${u.last_name}')" title="View Address"><i data-lucide="map-pin"></i></button>
                    <button class="btn-icon" onclick="toggleUserRole('${u.id}','${u.role}')" title="${u.role==='admin'?'Make Customer':'Make Admin'}"><i data-lucide="${u.role==='admin'?'user':'shield'}"></i></button>
                    <button class="btn-icon" onclick="toggleUserStatus('${u.id}',${u.is_active})" title="${u.is_active?'Deactivate':'Activate'}"><i data-lucide="${u.is_active?'user-x':'user-check'}"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
    lucide.createIcons();
}
function filterUsers() {
    const q = document.getElementById('user-search').value.toLowerCase();
    renderUsers(allUsers.filter(u => u.email.toLowerCase().includes(q) || (u.first_name||'').toLowerCase().includes(q) || (u.last_name||'').toLowerCase().includes(q)));
}
async function toggleUserRole(id, currentRole) {
    const newRole = currentRole === 'admin' ? 'customer' : 'admin';
    try {
        await Supabase.from('users').eq('id', id).update({ role: newRole, updated_at: new Date().toISOString() });
        showToast(`Role changed to ${newRole}`);
        await loadUsers();
    } catch(e) { showToast('Failed to update role', 'error'); }
}
async function toggleUserStatus(id, isActive) {
    const act = (typeof isActive === 'string') ? isActive === 'true' : !!isActive;
    try {
        await Supabase.from('users').eq('id', id).update({ is_active: !act, updated_at: new Date().toISOString() });
        showToast(`User ${act ? 'deactivated' : 'activated'}`);
        await loadUsers();
    } catch(e) { showToast('Failed to update status', 'error'); }
}

async function viewUserAddresses(userId, userName) {
    document.getElementById('uam-user-name').textContent = userName;
    document.getElementById('uam-list').innerHTML = '<div class="loading-shimmer" style="height:60px; border-radius:8px;"></div>';
    openModal('user-addresses-modal');

    try {
        const addresses = await Supabase.from('addresses').select('*').eq('user_id', userId).get();
        if (!addresses.length) {
            document.getElementById('uam-list').innerHTML = '<div style="color:#888; text-align:center; padding:1rem;">No addresses found for this user.</div>';
            return;
        }

        document.getElementById('uam-list').innerHTML = addresses.map(addr => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:15px; border-radius:8px; position:relative;">
                ${addr.is_default ? '<span style="position:absolute; top:10px; right:10px; background:var(--color-primary); color:white; font-size:0.7rem; padding:2px 8px; border-radius:10px;">DEFAULT</span>' : ''}
                <div style="font-weight:600; margin-bottom:5px;">${addr.first_name} ${addr.last_name}</div>
                <div style="font-size:0.9rem; line-height:1.5; color:#4a5568;">
                    ${addr.address_line1}${addr.address_line2 ? ', ' + addr.address_line2 : ''}<br>
                    ${addr.city}, ${addr.state} - ${addr.zip_code}<br>
                    ${addr.country}<br>
                    <strong>Phone:</strong> ${addr.phone_number}
                </div>
            </div>
        `).join('');
    } catch(e) {
        document.getElementById('uam-list').innerHTML = '<div style="color:#e53e3e; text-align:center; padding:1rem;">Failed to load addresses.</div>';
    }
}

// ── BANNERS ───────────────────────────────────────────────
let currentBannerImages = [];

window.setBannerPrimaryImage = function(index) {
    if(index === 0) return;
    const item = currentBannerImages.splice(index, 1)[0];
    currentBannerImages.unshift(item);
    document.getElementById('bf-image').value = JSON.stringify(currentBannerImages);
    renderBannerPreviewGallery();
};

window.removeBannerImage = function(index) {
    currentBannerImages.splice(index, 1);
    document.getElementById('bf-image').value = currentBannerImages.length ? JSON.stringify(currentBannerImages) : '';
    const fileChosen = document.getElementById('bf-file-chosen');
    if(fileChosen) fileChosen.textContent = currentBannerImages.length ? `${currentBannerImages.length} files selected` : 'No file chosen';
    renderBannerPreviewGallery();
};

function renderBannerPreviewGallery() {
    const previewDiv = document.getElementById('bf-image-preview');
    if(!previewDiv) return;
    if(currentBannerImages.length === 0) {
        previewDiv.innerHTML = '<span style="color:#888; grid-column: 1 / -1; text-align: center; padding: 20px;">No images uploaded. Click "Choose Files" to attach.</span>';
        return;
    }
    previewDiv.innerHTML = currentBannerImages.map((img, idx) => `
        <div style="position:relative; width: 100%; height: 180px; border: ${idx === 0 ? '3px solid var(--color-primary)' : '1px solid var(--color-border)'}; border-radius: 8px; overflow: hidden; background: #fff; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <img src="${img}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            ${idx === 0 ? `<div style="position:absolute; top:8px; left:8px; background:var(--color-primary); color:white; font-size:0.7rem; padding:4px 10px; border-radius:12px; font-weight:600; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">PRIMARY</div>` : ''}
            
            <div style="position:absolute; bottom:0; left:0; right:0; background: rgba(255,255,255,0.9); padding: 8px; display:flex; justify-content:space-between; gap:5px; border-top: 1px solid rgba(0,0,0,0.05);">
                ${idx !== 0 ? `<button type="button" onclick="setBannerPrimaryImage(${idx})" style="flex:1; background:var(--color-primary-dark); color:white; border:none; padding:6px 0; border-radius:4px; font-size:0.75rem; font-weight: 500; cursor:pointer;">Make Primary</button>` : '<div style="flex:1"></div>'}
                <button type="button" onclick="removeBannerImage(${idx})" style="background:#e53e3e; color:white; border:none; padding:6px 10px; border-radius:4px; font-size:0.75rem; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

async function loadBanners() {
    document.getElementById('banners-tbody').innerHTML = '<tr><td colspan="6" class="loading-row">Loading...</td></tr>';
    try {
        allBanners = await Supabase.from('banners').select('*').order('sequence').get();
        renderBanners();
    } catch(e) { showToast('Failed to load banners', 'error'); }
}
function renderBanners() {
    const tbody = document.getElementById('banners-tbody');
    if (!allBanners.length) { tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No banners</td></tr>'; return; }
    tbody.innerHTML = allBanners.map(b => `
        <tr>
            <td><img src="${b.image_url}" class="table-img" style="width:80px;height:40px;object-fit:cover;" onerror="this.src='https://via.placeholder.com/80x40'"></td>
            <td style="font-weight:600;">${b.title}</td>
            <td style="font-size:0.82rem;color:#888;">${b.type}</td>
            <td>${b.sequence || 0}</td>
            <td><span class="${b.is_active ? 'badge-active' : 'badge-inactive'}">${b.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn-icon" data-id="${b.id}" onclick="openBannerModal(this.dataset.id)"><i data-lucide="pencil"></i></button>
                <button class="btn-icon del" data-id="${b.id}" data-title="${b.title}" onclick="deleteBanner(this.dataset.id, this.dataset.title)"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`).join('');
    lucide.createIcons();
}

async function openBannerModal(id = null) {
    document.getElementById('banner-modal-title').textContent = id ? 'Edit Banner' : 'Add Banner';
    document.getElementById('banner-form').reset();
    document.getElementById('bf-id').value = '';
    if (id) {
        const b = allBanners.find(x => x.id === id);
        if (b) {
            document.getElementById('bf-id').value = b.id;
            document.getElementById('bf-title').value = b.title;
            document.getElementById('bf-type').value = b.type;
            document.getElementById('bf-sequence').value = b.sequence || 0;
            document.getElementById('bf-link').value = b.link || '';
            document.getElementById('bf-subtitle').value = b.subtitle || '';
            document.getElementById('bf-active').checked = b.is_active;
            
            document.getElementById('bf-image').value = b.image_url || '';
            currentBannerImages = b.image_url ? [b.image_url] : [];
        }
    } else {
        currentBannerImages = [];
    }
    const fileChosen = document.getElementById('bf-file-chosen');
    if(fileChosen) fileChosen.textContent = currentBannerImages.length ? `${currentBannerImages.length} files selected` : 'No file chosen';
    renderBannerPreviewGallery();
    openModal('banner-modal');
}
async function saveBanner(e) {
    e.preventDefault();
    const id = document.getElementById('bf-id').value;
    const rawImage = document.getElementById('bf-image').value;
    let banner_images = [rawImage];
    if(rawImage.startsWith('[')) {
        try { banner_images = JSON.parse(rawImage); } catch(e){}
    }

    try {
        if (id) {
            const data = {
                title: document.getElementById('bf-title').value,
                type: document.getElementById('bf-type').value,
                sequence: parseInt(document.getElementById('bf-sequence').value) || 0,
                link: document.getElementById('bf-link').value || null,
                subtitle: document.getElementById('bf-subtitle').value || null,
                image_url: banner_images[0],
                is_active: document.getElementById('bf-active').checked,
                updated_at: new Date().toISOString()
            };
            await Supabase.from('banners').eq('id', id).update(data);
            showToast('Banner updated!');
        } else {
            // Bulk insert multiple banners if multiple images selected
            for(let i=0; i<banner_images.length; i++) {
                const data = {
                    title: document.getElementById('bf-title').value + (banner_images.length > 1 ? ` ${i+1}` : ''),
                    type: document.getElementById('bf-type').value,
                    sequence: (parseInt(document.getElementById('bf-sequence').value) || 0) + i,
                    link: document.getElementById('bf-link').value || null,
                    subtitle: document.getElementById('bf-subtitle').value || null,
                    image_url: banner_images[i],
                    is_active: document.getElementById('bf-active').checked,
                    updated_at: new Date().toISOString()
                };
                await Supabase.from('banners').insert(data);
            }
            showToast(`${banner_images.length} Banner(s) created!`);
        }
        closeAllModals();
        await loadBanners();
    } catch(err) { showToast(err.message || 'Save failed', 'error'); }
}
async function deleteBanner(id, name) {
    confirmDelete(`Delete banner "${name}"?`, async () => {
        try {
            await Supabase.from('banners').eq('id', id).delete();
            showToast('Banner deleted');
            await loadBanners();
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}

// ── DELIVERY ──────────────────────────────────────────────
async function loadDelivery() {
    document.getElementById('tariffs-tbody').innerHTML = '<tr><td colspan="7" class="loading-row">Loading...</td></tr>';
    document.getElementById('states-tbody').innerHTML = '<tr><td colspan="4" class="loading-row">Loading...</td></tr>';
    try {
        const [tariffsRes, statesRes, configRes] = await Promise.allSettled([
            Supabase.from('delivery_tariffs').select('*').order('max_weight').get(),
            Supabase.from('states').select('id,name,code,zone').order('name').get(),
            Supabase.from('delivery_config').select('*').get()
        ]);
        
        allTariffs = tariffsRes.status === 'fulfilled' ? tariffsRes.value : [];
        allStates = statesRes.status === 'fulfilled' ? statesRes.value : [];
        
        if (configRes.status === 'fulfilled' && configRes.value && configRes.value.length) {
            const mode = configRes.value[0].calculation_mode || 'WEIGHT';
            const radio = document.querySelector(`input[name="delivery-mode"][value="${mode}"]`);
            if (radio) radio.checked = true;
        } else {
            // Default to WEIGHT if table missing or empty
            const radio = document.querySelector(`input[name="delivery-mode"][value="WEIGHT"]`);
            if (radio) radio.checked = true;
        }

        renderTariffs();
        renderStates();
    } catch(e) { 
        console.error('Delivery load error:', e);
        showToast('Failed to load some delivery data', 'error'); 
    }
}
function renderTariffs() {
    const tbody = document.getElementById('tariffs-tbody');
    if (!allTariffs.length) { tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No tariffs</td></tr>'; return; }
    tbody.innerHTML = allTariffs.map(t => `
        <tr>
            <td><span class="badge-${(t.tariff_type || 'WEIGHT').toLowerCase()}">${t.tariff_type || 'WEIGHT'}</span></td>
            <td style="font-weight:700;">${t.max_weight}${t.tariff_type === 'RATE' ? '' : 'g'}</td>
            <td>₹${t.prices?.TN ?? '—'}</td>
            <td>₹${t.prices?.SOUTH ?? '—'}</td>
            <td>₹${t.prices?.REST ?? '—'}</td>
            <td>₹${t.prices?.NE ?? '—'}</td>
            <td>
                <button class="btn-icon" onclick="openTariffModal('${t.id}')"><i data-lucide="pencil"></i></button>
                <button class="btn-icon del" onclick="deleteTariff('${t.id}')"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`).join('');
    lucide.createIcons();
}

async function updateDeliveryMode(mode) {
    try {
        const config = await Supabase.from('delivery_config').select('*').get();
        if (config && config.length) {
            await Supabase.from('delivery_config').eq('id', config[0].id).update({ calculation_mode: mode, updated_at: new Date().toISOString() });
        } else {
            await Supabase.from('delivery_config').insert({ calculation_mode: mode });
        }
        showToast(`Delivery mode changed to: ${mode}`);
    } catch (e) {
        console.error('Update mode error:', e);
        // If table doesn't exist, we just show a warning but keep it in UI
        showToast('Database table "delivery_config" missing. Changes not saved permanently.', 'error');
    }
}

function toggleTariffLabel(type) {
    const label = document.getElementById('tf-threshold-label');
    if (type === 'RATE') {
        label.textContent = 'Max Order Value (₹) *';
    } else {
        label.textContent = 'Max Weight (grams) *';
    }
}
function renderStates() {
    const tbody = document.getElementById('states-tbody');
    tbody.innerHTML = allStates.map(s => `
        <tr>
            <td style="font-weight:600;">${s.name}</td>
            <td style="color:#888;">${s.code || '—'}</td>
            <td>
                <select onchange="updateStateZone('${s.id}',this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid var(--color-border);font-size:0.82rem;">
                    ${['TN','SOUTH','REST','NE'].map(z => `<option value="${z}" ${s.zone===z?'selected':''}>${z}</option>`).join('')}
                </select>
            </td>
            <td><span class="status-pill pill-${s.zone?.toLowerCase() || 'rest'}" style="font-size:0.75rem;">${s.zone}</span></td>
        </tr>`).join('');
    lucide.createIcons();
}

function openTariffModal(id = null) {
    document.getElementById('tariff-modal-title').textContent = id ? 'Edit Tariff' : 'Add Tariff';
    document.getElementById('tariff-form').reset();
    document.getElementById('tf-id').value = '';
    
    // Default label
    toggleTariffLabel('WEIGHT');

    if (id) {
        const t = allTariffs.find(x => x.id === id);
        if (t) {
            document.getElementById('tf-id').value = t.id;
            document.getElementById('tf-type').value = t.tariff_type || 'WEIGHT';
            document.getElementById('tf-weight').value = t.max_weight;
            document.getElementById('tf-tn').value = t.prices?.TN ?? 0;
            document.getElementById('tf-south').value = t.prices?.SOUTH ?? 0;
            document.getElementById('tf-rest').value = t.prices?.REST ?? 0;
            document.getElementById('tf-ne').value = t.prices?.NE ?? 0;
            toggleTariffLabel(t.tariff_type || 'WEIGHT');
        }
    }
    openModal('tariff-modal');
}
async function saveTariff(e) {
    e.preventDefault();
    const id = document.getElementById('tf-id').value;
    const data = {
        max_weight: parseInt(document.getElementById('tf-weight').value),
        prices: {
            TN: parseInt(document.getElementById('tf-tn').value),
            SOUTH: parseInt(document.getElementById('tf-south').value),
            REST: parseInt(document.getElementById('tf-rest').value),
            NE: parseInt(document.getElementById('tf-ne').value)
        },
        tariff_type: document.getElementById('tf-type').value,
        updated_at: new Date().toISOString()
    };
    try {
        if (id) {
            await Supabase.from('delivery_tariffs').eq('id', id).update(data);
            showToast('Tariff updated!');
        } else {
            await Supabase.from('delivery_tariffs').insert(data);
            showToast('Tariff created!');
        }
        closeAllModals();
        await loadDelivery();
    } catch(err) { 
        console.error('Save tariff error:', err);
        // If tariff_type column missing, try saving without it
        if (err.message && err.message.includes('tariff_type')) {
            delete data.tariff_type;
            try {
                if (id) await Supabase.from('delivery_tariffs').eq('id', id).update(data);
                else await Supabase.from('delivery_tariffs').insert(data);
                showToast('Tariff saved (without type column)');
                closeAllModals();
                await loadDelivery();
                return;
            } catch(e2) {}
        }
        showToast(err.message || 'Save failed', 'error'); 
    }
}
async function deleteTariff(id) {
    confirmDelete('Delete this tariff?', async () => {
        try {
            await Supabase.from('delivery_tariffs').eq('id', id).delete();
            showToast('Tariff deleted');
            await loadDelivery();
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}
async function updateStateZone(id, zone) {
    try {
        await Supabase.from('states').eq('id', id).update({ zone });
        showToast('Zone updated!');
        const s = allStates.find(x => x.id === id);
        if (s) s.zone = zone;
    } catch(e) { showToast('Update failed', 'error'); }
}

// ── PAYMENT ───────────────────────────────────────────────
async function loadPayment() {
    const container = document.getElementById('payment-cards');
    container.innerHTML = '<div style="color:#888;padding:1rem;">Loading...</div>';
    try {
        const gateways = await Supabase.from('payment_gateways').select('*').get();
        if (!gateways.length) {
            container.innerHTML = '<div class="admin-card" style="text-align:center;color:#888;padding:3rem;">No payment gateways configured.<br><button class="btn-primary" style="margin-top:1rem;" onclick="openPaymentModal()">Add Gateway</button></div>';
            return;
        }
        container.innerHTML = gateways.map(gw => `
            <div class="payment-card ${gw.is_active ? 'active-gw' : ''}">
                <div class="payment-card-header">
                    <div class="payment-card-name">${gw.name}</div>
                    <span class="${gw.is_active ? 'badge-active' : 'badge-inactive'}">${gw.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div style="font-size:0.82rem;color:#888;margin-bottom:0.5rem;">Type: ${gw.type}</div>
                <div style="font-size:0.82rem;color:#888;margin-bottom:1rem;">${gw.is_test_mode ? '🧪 Test Mode' : '🔴 Live Mode'}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn-primary" style="font-size:0.8rem;padding:0.4rem 0.8rem;" 
                        data-id="${gw.id}" data-active="${gw.is_active}" onclick="toggleGateway(this.dataset.id, this.dataset.active)">
                        ${gw.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn-secondary" style="font-size:0.8rem;padding:0.4rem 0.8rem;" 
                        data-id="${gw.id}" onclick="openPaymentModal(this.dataset.id)">Edit</button>
                    <button class="btn-danger" style="font-size:0.8rem;padding:0.4rem 0.8rem;" 
                        data-id="${gw.id}" data-name="${gw.name}" onclick="deleteGateway(this.dataset.id, this.dataset.name)">Delete</button>
                </div>
            </div>`).join('');
    } catch(e) { showToast('Failed to load payment gateways', 'error'); }
}

let _allGateways = [];
async function openPaymentModal(id = null) {
    document.getElementById('pm-modal-title').textContent = id ? 'Edit Gateway' : 'Add Gateway';
    document.getElementById('payment-form').reset();
    document.getElementById('pmf-id').value = '';
    if (id) {
        try {
            const gateways = await Supabase.from('payment_gateways').select('*').eq('id', id).get();
            const gw = gateways[0];
            if (gw) {
                document.getElementById('pmf-id').value = gw.id;
                document.getElementById('pmf-name').value = gw.name;
                document.getElementById('pmf-type').value = gw.type;
                document.getElementById('pmf-creds').value = JSON.stringify(gw.credentials, null, 2);
                document.getElementById('pmf-active').checked = gw.is_active;
                document.getElementById('pmf-test').checked = gw.is_test_mode;
            }
        } catch(e) {}
    }
    openModal('payment-modal');
}
async function savePaymentGateway(e) {
    e.preventDefault();
    const id = document.getElementById('pmf-id').value;
    let creds = {};
    try { creds = JSON.parse(document.getElementById('pmf-creds').value); } catch { showToast('Invalid JSON in credentials', 'error'); return; }
    const data = {
        name: document.getElementById('pmf-name').value,
        type: document.getElementById('pmf-type').value,
        credentials: creds,
        is_active: document.getElementById('pmf-active').checked,
        is_test_mode: document.getElementById('pmf-test').checked,
        updated_at: new Date().toISOString()
    };
    try {
        if (id) {
            await Supabase.from('payment_gateways').eq('id', id).update(data);
            showToast('Gateway updated!');
        } else {
            await Supabase.from('payment_gateways').insert(data);
            showToast('Gateway created!');
        }
        closeAllModals();
        await loadPayment();
    } catch(err) { showToast(err.message || 'Save failed', 'error'); }
}
async function toggleGateway(id, isActive) {
    const act = (typeof isActive === 'string') ? isActive === 'true' : !!isActive;
    try {
        await Supabase.from('payment_gateways').eq('id', id).update({ is_active: !act, updated_at: new Date().toISOString() });
        showToast(`Gateway ${act ? 'deactivated' : 'activated'}`);
        await loadPayment();
    } catch(e) { showToast('Update failed', 'error'); }
}
async function deleteGateway(id, name) {
    confirmDelete(`Delete gateway "${name}"?`, async () => {
        try {
            await Supabase.from('payment_gateways').eq('id', id).delete();
            showToast('Gateway deleted');
            await loadPayment();
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}

// ── COURIERS ──────────────────────────────────────────────
let allCouriers = [];
async function loadCouriers() {
    const tbody = document.getElementById('couriers-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="loading-row">Loading...</td></tr>';
    try {
        allCouriers = await Supabase.from('couriers').select('*').order('name').get();
        if (!allCouriers.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="loading-row">No couriers found</td></tr>';
            return;
        }
        tbody.innerHTML = allCouriers.map(c => `
            <tr>
                <td style="font-weight:600;">${c.name}</td>
                <td><span class="${c.is_active ? 'badge-active' : 'badge-inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn-icon" onclick="openCourierModal('${c.id}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon del" onclick="deleteCourier('${c.id}', '${c.name}')"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`).join('');
        lucide.createIcons();
    } catch(e) { showToast('Failed to load couriers', 'error'); }
}

function openCourierModal(id = null) {
    document.getElementById('cur-modal-title').textContent = id ? 'Edit Courier' : 'Add Courier';
    document.getElementById('courier-form').reset();
    document.getElementById('cur-id').value = '';
    if (id) {
        const c = allCouriers.find(x => x.id === id);
        if (c) {
            document.getElementById('cur-id').value = c.id;
            document.getElementById('cur-name').value = c.name;
            document.getElementById('cur-active').checked = c.is_active;
        }
    }
    openModal('courier-modal');
}

async function saveCourier(e) {
    e.preventDefault();
    const id = document.getElementById('cur-id').value;
    const data = {
        name: document.getElementById('cur-name').value,
        is_active: document.getElementById('cur-active').checked
    };
    try {
        if (id) {
            await Supabase.from('couriers').eq('id', id).update(data);
            showToast('Courier updated!');
        } else {
            await Supabase.from('couriers').insert(data);
            showToast('Courier created!');
        }
        closeAllModals();
        await loadCouriers();
    } catch(err) { showToast(err.message || 'Save failed', 'error'); }
}

async function deleteCourier(id, name) {
    confirmDelete(`Delete courier "${name}"?`, async () => {
        try {
            await Supabase.from('couriers').eq('id', id).delete();
            showToast('Courier deleted');
            await loadCouriers();
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}

// ── SETTINGS ──────────────────────────────────────────────
async function loadSettings() {
    try {
        const results = await Supabase.from('order_prefix').select('*').get();
        if (results && results.length) {
            const config = results[0];
            document.getElementById('setting-order-prefix').value = config.prefix || 'ORD';
            document.getElementById('setting-order-sequence').value = config.next_sequence || '1000';
            // Store ID for update
            document.getElementById('order-settings-form').dataset.configId = config.id;
        }
    } catch (e) {
        console.warn("Settings fetch error:", e);
    }
}

async function saveOrderSettings(e) {
    if(e) e.preventDefault();
    const prefix = document.getElementById('setting-order-prefix').value || 'ORD';
    const sequence = parseInt(document.getElementById('setting-order-sequence').value || '1000');
    const configId = document.getElementById('order-settings-form').dataset.configId;
    
    try {
        const data = {
            prefix: prefix,
            next_sequence: sequence
        };
        
        if (configId) {
            await Supabase.from('order_prefix').update(data).eq('id', configId);
        } else {
            await Supabase.from('order_prefix').insert(data);
        }
        
        showToast('Order settings saved!');
        await loadSettings(); // Refresh to get ID if it was an insert
    } catch (e) {
        showToast('Failed to save settings', 'error');
        console.error(e);
    }
}

window.saveOrderSettings = saveOrderSettings;


// ── CONTACT MESSAGES ──────────────────────────────────────
async function loadMessages() {
    const tbody = document.getElementById('messages-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading...</td></tr>';
    try {
        allMessages = await Supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).get();
        renderMessages(allMessages);
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Failed to load messages.</td></tr>';
        console.error(e);
    }
}

function renderMessages(msgs) {
    const tbody = document.getElementById('messages-tbody');
    if (!msgs || msgs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No messages found.</td></tr>';
        return;
    }
    tbody.innerHTML = msgs.map(m => {
        const date = m.created_at ? new Date(m.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
        const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || '—';
        const shortMsg = m.message ? (m.message.length > 60 ? m.message.slice(0, 60) + '…' : m.message) : '—';
        return `<tr>
            <td style="white-space:nowrap;font-size:0.82rem;">${date}</td>
            <td style="font-weight:600;">${name}</td>
            <td>${m.email || '—'}</td>
            <td>${m.phone || '—'}</td>
            <td><span style="background:#f0fdf4;color:#15803d;padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;">${m.subject || '—'}</span></td>
            <td style="max-width:220px;">${shortMsg}</td>
            <td>
                <button class="btn-icon" title="View" onclick="viewMessage(${JSON.stringify(m).replace(/"/g, '&quot;')})"><i data-lucide="eye"></i></button>
                <button class="btn-icon" title="Delete" onclick="deleteMessage('${m.id}')"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function filterMessages() {
    const q = document.getElementById('msg-search').value.toLowerCase();
    if (!q) { renderMessages(allMessages); return; }
    renderMessages(allMessages.filter(m =>
        (m.first_name||'').toLowerCase().includes(q) ||
        (m.last_name||'').toLowerCase().includes(q) ||
        (m.email||'').toLowerCase().includes(q) ||
        (m.subject||'').toLowerCase().includes(q) ||
        (m.message||'').toLowerCase().includes(q)
    ));
}

function viewMessage(m) {
    const date = m.created_at ? new Date(m.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || '—';
    document.getElementById('confirm-msg').innerHTML = `
        <div style="text-align:left;line-height:1.8;">
            <div><strong>Date:</strong> ${date}</div>
            <div><strong>Name:</strong> ${name}</div>
            <div><strong>Email:</strong> ${m.email || '—'}</div>
            <div><strong>Phone:</strong> ${m.phone || '—'}</div>
            <div><strong>Subject:</strong> ${m.subject || '—'}</div>
            <div style="margin-top:8px;"><strong>Message:</strong><br><span style="white-space:pre-wrap;">${m.message || '—'}</span></div>
        </div>`;
    document.getElementById('confirm-ok-btn').style.display = 'none';
    const cancelBtn = document.querySelector('#confirm-modal .btn-secondary');
    if (cancelBtn) cancelBtn.textContent = 'Close';
    openModal('confirm-modal');
}

async function deleteMessage(id) {
    confirmDelete('Delete this contact message?', async () => {
        try {
            await Supabase.from('contact_messages').delete().eq('id', id);
            showToast('Message deleted');
            await loadMessages();
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}

window.filterMessages = filterMessages;
window.viewMessage = viewMessage;
window.deleteMessage = deleteMessage;

// Location window exposure
window.loadLocations = loadLocations;
window.loadCountries = loadCountries;
window.loadAdminStates = loadAdminStates;
window.loadCities = loadCities;
window.filterCities = filterCities;
window.openCountryModal = openCountryModal;
window.saveCountry = saveCountry;
window.deleteCountry = deleteCountry;
window.openStateModal = openStateModal;
window.saveState = saveState;
window.deleteState = deleteState;
window.openCityModal = openCityModal;
window.saveCity = saveCity;
window.deleteCity = deleteCity;
// ── LOCATIONS ──────────────────────────────────────────────
async function loadLocations() {
    await Promise.all([loadCountries(), loadAdminStates(), loadCities()]);
}

async function loadCountries() {
    try {
        allCountries = await Supabase.from('countries').select('*').order('name').get();
        const tbody = document.getElementById('countries-tbody');
        if (!allCountries.length) { tbody.innerHTML = '<tr><td colspan="3" class="loading-row">No countries</td></tr>'; return; }
        tbody.innerHTML = allCountries.map(c => `
            <tr>
                <td style="font-weight:600;">${c.name}</td>
                <td>${c.code}</td>
                <td>
                    <button class="btn-icon" onclick="openCountryModal('${c.id}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon del" onclick="deleteCountry('${c.id}', '${c.name}')"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`).join('');
        lucide.createIcons();
    } catch(e) { showToast('Failed to load countries', 'error'); }
}

async function loadAdminStates() {
    try {
        allStates = await Supabase.from('states').select('*, countries(name)').order('name').get();
        const tbody = document.getElementById('admin-states-tbody');
        if (!allStates.length) { tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No states</td></tr>'; return; }
        tbody.innerHTML = allStates.map(s => `
            <tr>
                <td style="font-weight:600;">${s.name}</td>
                <td>${s.code}</td>
                <td>${s.zone}</td>
                <td>${s.countries ? s.countries.name : '—'}</td>
                <td>
                    <button class="btn-icon" onclick="openStateModal('${s.id}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon del" onclick="deleteState('${s.id}', '${s.name}')"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`).join('');
        
        const filter = document.getElementById('city-state-filter');
        const currentVal = filter.value;
        filter.innerHTML = '<option value="">All States</option>' + 
            allStates.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        filter.value = currentVal;
        
        lucide.createIcons();
    } catch(e) { showToast('Failed to load states', 'error'); }
}

async function loadCities(stateId = null) {
    try {
        let query = Supabase.from('cities').select('*, states(name)').order('name');
        if (stateId) query = query.eq('state_id', stateId);
        allCities = await query.get();
        renderCities(allCities);
    } catch(e) { showToast('Failed to load cities', 'error'); }
}

function renderCities(list) {
    const tbody = document.getElementById('admin-cities-tbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="3" class="loading-row">No cities found</td></tr>'; return; }
    tbody.innerHTML = list.map(c => `
        <tr>
            <td style="font-weight:600;">${c.name}</td>
            <td>${c.states ? c.states.name : '—'}</td>
            <td>
                <button class="btn-icon" onclick="openCityModal('${c.id}')"><i data-lucide="pencil"></i></button>
                <button class="btn-icon del" onclick="deleteCity('${c.id}', '${c.name}')"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`).join('');
    lucide.createIcons();
}

function filterCities() {
    const q = document.getElementById('city-search').value.toLowerCase();
    renderCities(allCities.filter(c => c.name.toLowerCase().includes(q)));
}

// Country CRUD
function openCountryModal(id = null) {
    document.getElementById('country-modal-title').textContent = id ? 'Edit Country' : 'Add Country';
    document.getElementById('country-form').reset();
    document.getElementById('countf-id').value = id || '';
    if (id) {
        const c = allCountries.find(x => x.id === id);
        if (c) {
            document.getElementById('countf-name').value = c.name;
            document.getElementById('countf-code').value = c.code;
        }
    }
    openModal('country-modal');
}
async function saveCountry(e) {
    e.preventDefault();
    const id = document.getElementById('countf-id').value;
    const data = { name: document.getElementById('countf-name').value, code: document.getElementById('countf-code').value };
    try {
        if (id) await Supabase.from('countries').eq('id', id).update(data);
        else await Supabase.from('countries').insert(data);
        showToast('Country saved!');
        closeAllModals();
        loadCountries();
    } catch(err) { showToast(err.message, 'error'); }
}
function deleteCountry(id, name) {
    confirmDelete(`Delete country "${name}"?`, async () => {
        try {
            await Supabase.from('countries').eq('id', id).delete();
            showToast('Country deleted');
            loadCountries();
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}

// State CRUD
function openStateModal(id = null) {
    document.getElementById('state-modal-title').textContent = id ? 'Edit State' : 'Add State';
    document.getElementById('state-form').reset();
    document.getElementById('statef-id').value = id || '';
    document.getElementById('statef-country').innerHTML = allCountries.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (id) {
        const s = allStates.find(x => x.id === id);
        if (s) {
            document.getElementById('statef-name').value = s.name;
            document.getElementById('statef-code').value = s.code;
            document.getElementById('statef-country').value = s.country_id;
            document.getElementById('statef-zone').value = s.zone;
        }
    }
    openModal('state-modal');
}
async function saveState(e) {
    e.preventDefault();
    const id = document.getElementById('statef-id').value;
    const data = {
        name: document.getElementById('statef-name').value,
        code: document.getElementById('statef-code').value,
        country_id: document.getElementById('statef-country').value,
        zone: document.getElementById('statef-zone').value
    };
    try {
        if (id) await Supabase.from('states').eq('id', id).update(data);
        else await Supabase.from('states').insert(data);
        showToast('State saved!');
        closeAllModals();
        loadAdminStates();
    } catch(err) { showToast(err.message, 'error'); }
}
function deleteState(id, name) {
    confirmDelete(`Delete state "${name}"?`, async () => {
        try {
            await Supabase.from('states').eq('id', id).delete();
            showToast('State deleted');
            loadAdminStates();
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}

// City CRUD
function openCityModal(id = null) {
    document.getElementById('city-modal-title').textContent = id ? 'Edit City' : 'Add City';
    document.getElementById('city-form').reset();
    document.getElementById('cityf-id').value = id || '';
    document.getElementById('cityf-state').innerHTML = allStates.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (id) {
        const c = allCities.find(x => x.id === id);
        if (c) {
            document.getElementById('cityf-name').value = c.name;
            document.getElementById('cityf-state').value = c.state_id;
        }
    }
    openModal('city-modal');
}
async function saveCity(e) {
    e.preventDefault();
    const id = document.getElementById('cityf-id').value;
    const data = {
        name: document.getElementById('cityf-name').value,
        state_id: document.getElementById('cityf-state').value
    };
    try {
        if (id) await Supabase.from('cities').eq('id', id).update(data);
        else await Supabase.from('cities').insert(data);
        showToast('City saved!');
        closeAllModals();
        loadCities(document.getElementById('city-state-filter').value);
    } catch(err) { showToast(err.message, 'error'); }
}
function deleteCity(id, name) {
    confirmDelete(`Delete city "${name}"?`, async () => {
        try {
            await Supabase.from('cities').eq('id', id).delete();
            showToast('City deleted');
            loadCities(document.getElementById('city-state-filter').value);
        } catch(e) { showToast('Delete failed', 'error'); }
    });
}
