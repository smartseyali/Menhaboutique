const SUPABASE_URL = 'https://wrjzdrhvrluamygexyvi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyanpkcmh2cmx1YW15Z2V4eXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgwNjcsImV4cCI6MjA5MTkwNDA2N30.CQVMoSWZ1dDs0iFzpa9UjBTzRwW31ihjE-CMZcZwTBo';

// Tiny Supabase REST Wrapper (to match admin.js usage)
const Supabase = {
    from(table) {
        let method = 'GET';
        let body = null;
        let query = '';
        let filters = [];
        let orders = [];

        const builder = {
            select(columns = '*') {
                method = 'GET';
                query = `select=${columns}`;
                return this;
            },
            insert(data) {
                method = 'POST';
                body = data;
                return this;
            },
            update(data) {
                method = 'PATCH';
                body = data;
                return this;
            },
            delete() {
                method = 'DELETE';
                return this;
            },
            eq(column, value) {
                filters.push(`${column}=eq.${value}`);
                return this;
            },
            order(column, ascending = true) {
                orders.push(`${column}.${ascending ? 'asc' : 'desc'}`);
                return this;
            },
            or(filter) {
                filters.push(`or=(${filter})`);
                return this;
            },
            // Compatibility for older code using .get() or .execute()
            async get() {
                return await this;
            },
            async execute() {
                return await this;
            },
            // This makes the builder "awaitable"
            then(onFulfilled, onRejected) {
                let url = `${SUPABASE_URL}/rest/v1/${table}`;
                if (method === 'GET' || method === 'PATCH' || method === 'DELETE') {
                    const params = [];
                    if (query) params.push(query);
                    if (filters.length) params.push(...filters);
                    if (orders.length) params.push(`order=${orders.join(',')}`);
                    if (params.length) url += `?${params.join('&')}`;
                }

                // Security Check: UPDATE/DELETE must have filters
                if ((method === 'PATCH' || method === 'DELETE') && filters.length === 0) {
                    return Promise.reject(new Error(`${method} requires a WHERE clause (use .eq())`)).catch(onRejected);
                }

                const sessionToken = localStorage.getItem('menha_token');
                const options = {
                    method: method,
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${sessionToken || SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': method === 'POST' ? 'return=representation' : (method === 'PATCH' ? 'return=representation' : '')
                    }
                };
                if (body) options.body = JSON.stringify(body);

                return fetch(url, options)
                    .then(async response => {
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error(`Supabase ${method} Error:`, errorText);
                            throw new Error(errorText || `Supabase ${method} failed`);
                        }
                        if (response.status === 204) return [];
                        try {
                            return await response.json();
                        } catch(e) { return []; }
                    })
                    .then(onFulfilled, onRejected);
            }
        };
        return builder;
    },
    async rpc(fn, params = {}) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'RPC failed');
        }
        return await response.json();
    }
};

window.Supabase = Supabase;

const MainAPI = {
    async fetchBanners() {
        try {
            return await Supabase.from('banners').select('*').eq('is_active', true).order('sequence', true).get();
        } catch (error) {
            console.error("Error fetching banners:", error);
            return [];
        }
    },

    async fetchCategories() {
        try {
            return await Supabase.from('categories').select('*').order('sequence', true).get();
        } catch (error) {
            console.error("Error fetching categories:", error);
            return [];
        }
    },

    async fetchProducts() {
        try {
            return await Supabase.from('products').select('*,product_attributes(*)').order('sequence', true).get();
        } catch (error) {
            console.error("Error fetching products:", error);
            return [];
        }
    },
    async fetchProductsByCategory(categoryId) {
        try {
            return await Supabase.from('products').select('*,product_attributes(*)').eq('category_id', categoryId).order('sequence', true).get();
        } catch (error) {
            console.error("Error fetching products by category:", error);
            return [];
        }
    },

    async fetchProductById(id) {
        try {
            const results = await Supabase.from('products').select('*,product_attributes(*)').eq('id', id).get();
            const product = results.length ? results[0] : null;
            if (product) {
                // Fetch images and reviews in parallel
                const [images, reviews] = await Promise.all([
                    this.fetchProductImages(id),
                    this.fetchReviews(id)
                ]);
                product.additional_images = images;
                product.reviews = reviews;
            }
            return product;
        } catch (error) {
            console.error("Error fetching product by ID:", error);
            return null;
        }
    },

    async fetchProductImages(productId) {
        try {
            return await Supabase.from('product_images').select('*').eq('product_id', productId).order('display_order', true).get();
        } catch (error) {
            console.error("Error fetching product images:", error);
            return [];
        }
    },

    async fetchReviews(productId) {
        try {
            // Joining with users to get the name of the reviewer
            return await Supabase.from('product_reviews').select('*, users(first_name, last_name)').eq('product_id', productId).order('created_at', false).get();
        } catch (error) {
            console.error("Error fetching reviews:", error);
            return [];
        }
    },

    async submitReview(reviewData) {
        try {
            const user = this.getUser();
            if (!user) throw new Error('You must be logged in to provide a review');

            const payload = {
                product_id: reviewData.product_id,
                user_id: user.id,
                rating: parseInt(reviewData.rating),
                comment: reviewData.comment,
                updated_at: new Date().toISOString()
            };

            return await Supabase.from('product_reviews').insert(payload);
        } catch (error) {
            console.error("Error submitting review:", error);
            throw error;
        }
    },
    
    getStockStatus(product) {
        const explicit = (product && product.status) || '';
        if (explicit === 'Coming Soon') return 'Coming Soon';
        const qty = parseInt((product && product.stock_quantity) || 0);
        if (qty > 0) return 'In Stock';
        return 'Out of Stock';
    },

    getProductImage(product) {
        if (product.primary_image) return product.primary_image;
        if (product.image) return product.image;
        if (product.imageUrl) return product.imageUrl;
        return 'https://via.placeholder.com/300x300?text=No+Image'; 
    },

    getProductPrice(product) {
        // If it's a cart item with a specific selected price, use it
        if (product.price && !product.new_price) return parseFloat(product.price);
        return parseFloat(product.new_price || product.price || 0);
    },

    async upsertUserAddress(addr) {
        const user = this.getUser();
        if(!user) throw new Error('User not logged in');
        
        const data = {
            user_id: user.id,
            first_name: addr.first_name,
            last_name: addr.last_name,
            address_line1: addr.address_line1 || addr.address_line,
            address_line2: addr.address_line2 || null,
            city: addr.city,
            state: addr.state,
            zip_code: addr.zip_code || addr.postal_code,
            country: addr.country || 'India',
            phone_number: addr.phone_number || user.phone_number,
            is_default: addr.is_default || false,
            updated_at: new Date().toISOString()
        };

        if (addr.id) {
            // Update
            return await Supabase.from('addresses').eq('id', addr.id).update(data);
        } else {
            // Insert
            return await Supabase.from('addresses').insert(data);
        }
    },

    async saveAddress(addr) {
        return this.upsertUserAddress(addr);
    },

    async getNextOrderNumber() {
        try {
            const results = await Supabase.from('order_prefix').select('*').get();
            if (!results || !results.length) {
                // Fallback if table is empty
                return 'ORD-' + Math.floor(Math.random()*10000);
            }
            
            const config = results[0];
            const prefix = config.prefix || 'ORD';
            const sequence = parseInt(config.next_sequence || 1000);
            
            const orderNum = `${prefix}-${sequence}`;
            
            // Increment for next time
            await Supabase.from('order_prefix').update({ next_sequence: sequence + 1 }).eq('id', config.id);
            
            return orderNum;
        } catch (e) {
            console.error("Order sequence error:", e);
            return 'ORD-' + Math.floor(Math.random()*10000);
        }
    },

    async decrementStock(productId, attributeId, qty) {
        if (!productId || !qty) return;

        // 1. Decrement variant stock (if applicable)
        if (attributeId) {
            try {
                const variants = await Supabase.from('product_attributes').select('stock_quantity').eq('id', attributeId).get();
                if (variants && variants.length) {
                    const newStock = Math.max(0, parseInt(variants[0].stock_quantity || 0) - qty);
                    await Supabase.from('product_attributes').eq('id', attributeId).update({ stock_quantity: newStock });
                }
            } catch (e) { console.warn('Variant stock update failed', e); }
        }

        // 2. Decrement product master stock and update status
        const products = await Supabase.from('products').select('stock_quantity,status').eq('id', productId).get();
        if (!products || !products.length) return;

        const product = products[0];
        const newStock = Math.max(0, parseInt(product.stock_quantity || 0) - qty);

        // Auto-set status based on stock — never override "Coming Soon"
        const update = { stock_quantity: newStock, updated_at: new Date().toISOString() };
        if (product.status !== 'Coming Soon') {
            update.status = newStock > 0 ? 'In Stock' : 'Out of Stock';
        }
        await Supabase.from('products').eq('id', productId).update(update);
    },

    async createOrder(orderData) {
        try {
            const user = this.getUser();
            const orderNum = await this.getNextOrderNumber();
            
            const orderPayload = {
                user_id: user ? user.id : null,
                order_number: orderNum,
                email: orderData.email,
                total_price: orderData.total_price,
                status: 'pending',
                payment_status: orderData.payment_status || 'unpaid',
                payment_method: orderData.payment_method || orderData.paymentMethod || 'cod',
                delivery_charge: orderData.delivery_charge || 0,
                address_id: orderData.shippingAddressId || orderData.address_id,
                comments: orderData.comments || '',
                payment_link: orderData.gateway_transaction_id || null,
                courier_id: orderData.courier_id || null,
                courier_name: orderData.courier_name || null
            };
            
            const results = await Supabase.from('orders').insert(orderPayload);
            const newOrder = (results && results.length) ? results[0] : results;
            
            if (orderData.items && orderData.items.length) {
                for (const item of orderData.items) {
                    const productId = item.productId || item.product_id;
                    const attributeId = item.variantId || item.attribute_id || null;
                    const qty = parseInt(item.quantity) || 0;

                    await Supabase.from('order_items').insert({
                        order_id: newOrder.id,
                        product_id: productId,
                        quantity: qty,
                        unit_price: item.price || item.unit_price,
                        total_price: qty * (item.price || item.unit_price),
                        attribute_id: attributeId
                    });

                    // Auto-decrement stock and refresh status
                    try {
                        await this.decrementStock(productId, attributeId, qty);
                    } catch (stockErr) {
                        console.warn('Stock decrement failed for product', productId, stockErr);
                    }
                }
            }

            return { success: true, order: newOrder };
        } catch (error) {
            console.error("Order error:", error);
            throw error;
        }
    },

    async getAvailableCouriers() {
        try {
            return await Supabase.from('couriers').select('*').eq('is_active', true).get();
        } catch (e) {
            console.error(e);
            return [];
        }
    },
    async getAvailableGateways() {
        try {
            const gateways = await Supabase.from('payment_gateways').select('*').eq('is_active', true).get();
            return (gateways || []).filter(g => (g.type || '').toLowerCase() !== 'cod');
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async updateOrderPayment(orderNumber, status, transactionId = null) {
        try {
            const data = {
                payment_status: status,
                updated_at: new Date().toISOString()
            };
            if (transactionId) data.payment_link = transactionId; // Or store in a dedicated txn column if it exists

            await Supabase.from('orders').eq('order_number', orderNumber).update(data);
            return true;
        } catch (e) {
            console.error("Error updating order payment:", e);
            return false;
        }
    },

    async initiateGatewayPayment(order, gateway) {
        const type = gateway.type.toLowerCase();
        
        switch (type) {
            case 'razorpay':
                return this.handleRazorpay(order, gateway);
            case 'phonepe':
                return { type: 'redirect', url: await this.generatePhonePePaymentLink(order, gateway) };
            case 'stripe':
                return this.handleStripe(order, gateway);
            case 'cashfree':
                return this.handleCashfree(order, gateway);
            case 'payu':
                return this.handlePayU(order, gateway);
            case 'ccavenue':
                return this.handleCCAvenue(order, gateway);
            default:
                throw new Error('Selected payment gateway not supported yet');
        }
    },

    async handleRazorpay(order, gateway) {
        const creds = gateway.credentials;
        const options = {
            "key": creds.key_id,
            "amount": Math.round(order.total_price * 100),
            "currency": "INR",
            "name": "Menha Boutique",
            "description": "Order Payment",
            "image": "assets/images/logo.jpg",
            "handler": function (response) {
                // This will be called upon success
                // We need to trigger the post-payment logic
                window.location.href = window.location.origin + window.location.pathname + `?status=success&payment_id=${response.razorpay_payment_id}`;
            },
            "prefill": {
                "name": order.newAddress ? `${order.newAddress.first_name} ${order.newAddress.last_name}` : "",
                "email": order.email || ""
            },
            "theme": { "color": "#7c3aed" },
            "modal": {
                "ondismiss": function() {
                    window.location.reload();
                }
            }
        };
        
        return { type: 'function', fn: () => { const rzp = new Razorpay(options); rzp.open(); } };
    },

    async generatePhonePePaymentLink(order, gateway) {
        const creds = gateway.credentials;
        const merchantId = creds.merchantId;
        const saltKey = creds.saltKey;
        const saltIndex = creds.saltIndex;
        const isTest = gateway.is_test_mode;

        const transactionId = "TXN" + Date.now();
        const amount = Math.round(order.total_price * 100); // PhonePe expects amount in paise

        const payload = {
            merchantId: merchantId,
            merchantTransactionId: transactionId,
            merchantUserId: order.user_id || "GUEST",
            amount: amount,
            redirectUrl: window.location.origin + window.location.pathname + `?status=success&transactionId=${transactionId}`,
            redirectMode: "REDIRECT",
            callbackUrl: window.location.origin + window.location.pathname, 
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        const base64Payload = btoa(JSON.stringify(payload));
        const stringToHash = base64Payload + "/pg/v1/pay" + saltKey;
        const sha256 = CryptoJS.SHA256(stringToHash).toString();
        const xVerify = sha256 + "###" + saltIndex;

        if (isTest) {
            return window.location.origin + window.location.pathname + `?status=success&transactionId=${transactionId}`;
        }

        // Production PhonePe Endpoint
        const endpoint = "https://api.phonepe.com/apis/hermes/pg/v1/pay";
        // However, standard browser CORS will block this. Usually this needs a backend.
        // If the user wants pure frontend, we might have to use a different approach or they have a proxy.
        return `https://merchants.phonepe.com/pg/v1/pay?payload=${base64Payload}&x-verify=${xVerify}`;
    },

    // Placeholders for other gateways as they usually require server-side signing or specific client SDKs
    async handleStripe(order, gateway) {
        // Stripe usually needs a Stripe-Account or Checkout Session created server-side
        alert("Stripe Integration requires a backend endpoint to create Checkout Session.");
        throw new Error("Stripe logic pending backend implementation.");
    },

    async handleCashfree(order, gateway) {
        alert("Cashfree Integration requires server-side token generation.");
        throw new Error("Cashfree logic pending backend implementation.");
    },

    async handlePayU(order, gateway) {
        alert("PayU Integration requires server-side hash generation.");
        throw new Error("PayU logic pending backend implementation.");
    },

    async handleCCAvenue(order, gateway) {
        alert("CCAvenue Integration requires server-side encryption.");
        throw new Error("CCAvenue logic pending backend implementation.");
    },

    async getActiveGateway() {
        try {
            const gateways = await this.getAvailableGateways();
            return gateways.length ? gateways[0] : null;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    async calculateDeliveryCharge(stateCode, items) {
        try {
            const [stateRes, configRes] = await Promise.allSettled([
                Supabase.from('states').select('zone').or(`code.eq.${encodeURIComponent(stateCode)},name.eq.${encodeURIComponent(stateCode)}`).get(),
                Supabase.from('delivery_config').select('calculation_mode').get()
            ]);

            const state = stateRes.status === 'fulfilled' ? stateRes.value : [];
            const zone = (state.length > 0) ? state[0].zone : 'REST';
            
            let mode = 'WEIGHT';
            if (configRes.status === 'fulfilled' && configRes.value && configRes.value.length) {
                mode = configRes.value[0].calculation_mode;
            }
            
            let thresholdValue = 0;
            if (mode === 'RATE') {
                thresholdValue = items.reduce((sum, item) => sum + (this.getProductPrice(item.product) * item.quantity), 0);
            } else {
                items.forEach(item => {
                    const weightStr = item.product.weight || '0g';
                    const weightVal = parseInt(weightStr.replace(/[^0-9]/g, '')) || 0;
                    thresholdValue += weightVal * item.quantity;
                });
            }

            const allTariffs = await Supabase.from('delivery_tariffs').select('*').order('max_weight', true).get();
            
            // If mode is WEIGHT, and tariffs don't have tariff_type, we use all of them as fallback
            let modeTariffs = allTariffs.filter(t => (t.tariff_type || 'WEIGHT') === mode);
            if (mode === 'WEIGHT' && !modeTariffs.length && allTariffs.length) {
                modeTariffs = allTariffs;
            }
            
            if (!modeTariffs.length) return 0;

            const tier = modeTariffs.find(t => t.max_weight >= thresholdValue);
            if (!tier) {
                if (mode === 'RATE') return 0;
                const lastTier = modeTariffs[modeTariffs.length - 1];
                return lastTier ? (lastTier.prices[zone] || lastTier.prices['REST'] || 0) : 0;
            }
            return tier.prices[zone] || tier.prices['REST'] || 0;
        } catch (e) {
            console.error('Calculation error:', e);
            return 0;
        }
    },

    async login(emailOrPhone, password) {
        try {
            const users = await Supabase.from('users').select('*')
                .or(`email.eq.${emailOrPhone},phone_number.eq.${emailOrPhone}`)
                .get();
                
            if (!users.length) throw new Error('User not found');
            const user = users[0];
            // In a real app, we'd check password_hash (bcrypt) via RPC
            if (user.password_hash !== password) throw new Error('Invalid password');
            
            const data = { token: 'mock-jwt-token-' + user.id, user };
            this.setAuthToken(data.token, data.user);
            return data;
        } catch (error) {
            console.error("Login Error:", error);
            throw error;
        }
    },

    async register(userData) {
        try {
            // Check if user exists
            const existing = await Supabase.from('users').select('id').eq('email', userData.email).get();
            if (existing && existing.length) throw new Error('User already exists');

            const result = await Supabase.from('users').insert({
                email: userData.email,
                password_hash: userData.password, // Ideally hashed
                first_name: userData.firstName,
                last_name: userData.lastName,
                phone_number: userData.phoneNumber,
                role: 'customer'
            });
            
            const user = (result && result.length) ? result[0] : result;

            // Save default address if provided
            if (userData.address && user.id) {
                try {
                    await Supabase.from('addresses').insert({
                        user_id: user.id,
                        first_name: userData.firstName,
                        last_name: userData.lastName,
                        address_line1: userData.address.line1,
                        address_line2: userData.address.line2 || null,
                        city: userData.address.city,
                        state: userData.address.state,
                        zip_code: userData.address.postalCode,
                        country: userData.address.country,
                        phone_number: userData.phoneNumber,
                        is_default: true
                    });
                } catch (addrError) {
                    console.error("Error saving initial address:", addrError);
                }
            }
            
            const token = 'mock-jwt-token-' + (user.id || 'new');
            this.setAuthToken(token, user);
            return { success: true, user, token };
        } catch (error) {
            console.error("Registration Error:", error);
            throw error;
        }
    },

    async getUserAddresses() {
        try {
            const user = this.getUser();
            if (!user) return [];
            return await Supabase.from('addresses').select('*').eq('user_id', user.id).get();
        } catch (error) {
            console.error("Error fetching addresses:", error);
            return [];
        }
    },

    async deleteAddress(addressId) {
        try {
            return await Supabase.from('addresses').delete().eq('id', addressId).execute();
        } catch (error) {
            console.error("Error deleting address:", error);
            throw error;
        }
    },

    async getOrders() {
        try {
            const user = this.getUser();
            if (!user) return [];
            return await Supabase.from('orders')
                .select('*, items:order_items(*, product:products(*)), address:addresses(*)')
                .eq('user_id', user.id)
                .order('created_at', false)
                .get();
        } catch (error) {
            console.error("Error fetching orders:", error);
            return [];
        }
    },

    // Locations
    async getCountries() {
        try {
            return await Supabase.from('countries').select('*').order('name', true).get();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async getStates(countryId) {
        try {
            return await Supabase.from('states').select('*').eq('country_id', countryId).order('name', true).get();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async getCities(stateId) {
        try {
            return await Supabase.from('cities').select('*').eq('state_id', stateId).order('name', true).get();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    setAuthToken(token, user) {
        const sessionData = { token, user, storedAt: new Date().getTime() };
        localStorage.setItem('login_user', JSON.stringify(sessionData));
    },

    getAuthToken() {
        try {
            const sessionData = JSON.parse(localStorage.getItem('login_user'));
            return sessionData ? sessionData.token : null;
        } catch (e) { return null; }
    },

    getUser() {
        try {
            const sessionData = JSON.parse(localStorage.getItem('login_user'));
            return sessionData ? sessionData.user : null;
        } catch (e) { return null; }
    },

    logout() {
        localStorage.removeItem('login_user');
        window.location.href = 'login.html';
    },

    isAuthenticated() {
        return !!this.getAuthToken();
    },

    async requestPasswordReset(email) {
        try {
            const users = await Supabase.from('users').select('id,email,first_name').eq('email', email).get();
            if (!users || !users.length) {
                return { success: true };
            }
            const user = users[0];
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let otpCode = '';
            for (let i = 0; i < 6; i++) otpCode += chars[Math.floor(Math.random() * chars.length)];

            const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            await Supabase.from('users').update({ reset_otp: otpCode, otp_expires_at: expires }).eq('email', email).get();

            // Send OTP via email
            try {
                await MainAPI.sendEmail(email, 'otp', { name: user.first_name || '', otp: otpCode, purpose: 'reset' });
            } catch (mailErr) {
                console.error('Email send failed:', mailErr);
            }

            return { success: true };
        } catch (e) {
            console.error('Reset error:', e);
            return { success: true };
        }
    },

    async verifyPasswordOTP(email, otp) {
        try {
            const users = await Supabase.from('users').select('reset_otp,otp_expires_at').eq('email', email).get();
            if (!users || !users.length) return false;
            const user = users[0];
            if (!user.reset_otp) return false;
            if (user.reset_otp !== otp.trim().toUpperCase()) return false;
            if (user.otp_expires_at && new Date(user.otp_expires_at) < new Date()) return false;
            return true;
        } catch (e) {
            return false;
        }
    },

    async updatePassword(email, otp, newPassword) {
        try {
            const valid = await this.verifyPasswordOTP(email, otp);
            if (!valid) throw new Error('Invalid or expired OTP');
            await Supabase.from('users').update({ password_hash: newPassword, reset_otp: null, otp_expires_at: null }).eq('email', email).get();
            return { success: true };
        } catch (e) {
            throw e;
        }
    },

    // Central email sender — calls the Supabase Edge Function
    // type: 'otp' | 'welcome' | 'invoice' | 'order_status'
    async sendEmail(to, type, data = {}) {
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                },
                body: JSON.stringify({ type, to, data }),
            });
            return await res.json();
        } catch (e) {
            console.error('sendEmail error:', e);
        }
    }
};

const CartManager = {
    getCart() {
        return JSON.parse(localStorage.getItem('mb_cart') || '[]');
    },
    saveCart(cart) {
        localStorage.setItem('mb_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
    },
    add(product, quantity = 1) {
        const cart = this.getCart();
        const variantId = product.variant_id || '';
        const existing = cart.find(item => item.product.id === product.id && (item.product.variant_id || '') === variantId);
        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push({ product, quantity });
        }
        this.saveCart(cart);
        if (typeof window.showToast === 'function') {
            const name = product.title || product.name || 'Item';
            window.showToast(`Added "${name}" to cart`, 'success');
        }
    },
    update(productId, quantity, variantId = '') {
        const cart = this.getCart();
        const item = cart.find(i => i.product.id === productId && (i.product.variant_id || '') === variantId);
        if (item) {
            item.quantity = quantity;
            if (item.quantity <= 0) {
                this.remove(productId, variantId);
                return;
            }
            this.saveCart(cart);
        }
    },
    remove(productId, variantId = '') {
        let cart = this.getCart();
        cart = cart.filter(i => !(i.product.id === productId && (i.product.variant_id || '') === variantId));
        this.saveCart(cart);
    },
    clear() {
        this.saveCart([]);
    },
    getTotalItems() {
        return this.getCart().reduce((sum, item) => sum + item.quantity, 0);
    },
    getTotalPrice() {
        return this.getCart().reduce((sum, item) => {
            return sum + (MainAPI.getProductPrice(item.product) * item.quantity);
        }, 0);
    }
};

window.MainAPI = MainAPI;
window.CartManager = CartManager;

