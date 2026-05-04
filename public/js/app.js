// Global State
const state = {
    token: localStorage.getItem('pos_token') || null,
    user: JSON.parse(localStorage.getItem('pos_user')) || null,
    tables: [],
    menu: [],
    customers: [],
    currentTable: null,
    currentOrder: null,
    activeCategory: null,
    orderMultiplier: 1 // Sipariş ürün çarpanı
};

// DOM Elements
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('#main-header .nav-btn');
const mainHeader = document.getElementById('main-header');
const loggedUserName = document.getElementById('logged-user-name');
const btnLogout = document.getElementById('btn-logout');

const tablesGrid = document.getElementById('tables-grid');
const currentTableName = document.getElementById('current-table-name');
const categoryList = document.getElementById('category-list');
const productsGrid = document.getElementById('products-grid');
const receiptItems = document.getElementById('receipt-items');
const receiptTotal = document.getElementById('receipt-total');
const btnPay = document.getElementById('btn-pay');
const toastContainer = document.getElementById('toast-container');
const emptyTableOverlay = document.getElementById('empty-table-overlay');
const btnOpenOrder = document.getElementById('btn-open-order');
const btnCancelOrder = document.getElementById('btn-cancel-order');

// Kullanılmayan eski referansları kaldırdık
// Admin DOM
const adminUserList = document.getElementById('admin-user-list');
const adminTableList = document.getElementById('admin-table-list');
const adminCatList = document.getElementById('admin-category-list');
const newProdCat = document.getElementById('new-prod-cat');
const reportStaffList = document.getElementById('report-staff-list');
const reportProductsList = document.getElementById('report-products-list');

// ========================
// BAŞLANGIÇ & GİRİŞ KONTROLÜ
// ========================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuthStatus();
});

function checkAuthStatus() {
    if (state.token && state.user) {
        // Zaten giriş yapmış
        performLoginRoutines();
    } else {
        // Giriş yapmamış
        switchView('login-view');
        mainHeader.style.display = 'none';
    }
}

async function loadQuickUsers() {
    const container = document.getElementById('quick-login-users');
    if (!container) return;
    
    container.innerHTML = '<div class="loading" style="grid-column: span 2; text-align: center; color: #888;">Personeller Yükleniyor...</div>';
    
    try {
        const res = await secureFetch('/api/auth/quick-users');
        if(!res) return;
        const data = await res.json();
        
        container.innerHTML = '';
        if (data.success && data.data.length > 0) {
            data.data.forEach(user => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-secondary';
                btn.style.cssText = 'padding: 15px; font-size: 16px; background: rgba(255,255,255,0.05); border: 1px solid var(--accent-orange); color: white; border-radius: 8px;';
                btn.textContent = user.username;
                btn.addEventListener('click', () => doQuickLogin(user.username));
                container.appendChild(btn);
            });
        } else {
            container.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #888;">Personel bulunamadı.</div>';
        }
    } catch (err) {
        container.innerHTML = '<div style="grid-column: span 2; text-align: center; color: var(--accent-red);">Bağlantı hatası.</div>';
    }
}

async function doQuickLogin(username) {
    try {
        const res = await secureFetch('/api/auth/quick-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        if(!res) return;
        const data = await res.json();
        
        if (data.success) {
            // Logout from old session not needed if we overwrite, but let's just replace the token
            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('pos_token', data.token);
            localStorage.setItem('pos_user', JSON.stringify(data.user));
            
            document.getElementById('switch-user-overlay').style.display = 'none';
            showToast('Personel değiştirildi!', 'success');
            performLoginRoutines();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Bağlantı hatası', 'error');
    }
}

function performLoginRoutines() {
    mainHeader.style.display = 'flex';
    loggedUserName.textContent = state.user.username + (state.user.role === 'admin' ? ' (Yönetici)' : '');
    
    // Admin butonlarını göster/gizle
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = state.user.role === 'admin' ? 'block' : 'none';
    });

    switchView('tables-view');
    navBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-target="tables-view"]').classList.add('active');

    initApp();
}

async function initApp() {
    await fetchTables();
    await fetchMenu();
    await fetchCustomers();
}

// Güvenli Fetch Yardımcısı (Tüm isteklere token ekler)
async function secureFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (state.token) {
        options.headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    const response = await fetch(url, options);
    
    // Eğer sunucu yetkisiz derse (token patlamışsa) çıkış yap
    if (response.status === 401 || response.status === 403) {
        if(url !== '/api/auth/login') {
            logout();
            showToast('Oturum süresi doldu.', 'error');
            return null;
        }
    }
    return response;
}

// ========================
// EVENT LISTENERS
// ========================
function setupEventListeners() {
    // LOGIN
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            
            if (data.success) {
                state.token = data.token;
                state.user = data.user;
                localStorage.setItem('pos_token', data.token);
                localStorage.setItem('pos_user', JSON.stringify(data.user));
                
                showToast('Giriş başarılı!', 'success');
                performLoginRoutines();
            } else {
                showToast(data.error, 'error');
            }
        } catch (err) {
            showToast('Bağlantı hatası', 'error');
        }
    });

    // LOGOUT
    btnLogout.addEventListener('click', logout);

    // PERSONEL DEĞİŞTİR
    document.getElementById('btn-switch-user')?.addEventListener('click', () => {
        document.getElementById('switch-user-overlay').style.display = 'flex';
        loadQuickUsers();
    });
    
    document.getElementById('btn-cancel-switch')?.addEventListener('click', () => {
        document.getElementById('switch-user-overlay').style.display = 'none';
    });

    // Navigasyon
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.dataset.target;
            switchView(target);
            navBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            if(target === 'tables-view') fetchTables();
            if(target === 'admin-view') loadAdminDashboard();
        });
    });

    document.querySelector('.back-to-tables').addEventListener('click', () => {
        switchView('tables-view');
        fetchTables(); 
    });

    btnPay.addEventListener('click', () => {
        openPaymentView();
    });

    // Kasa Ekranı İptal
    document.getElementById('btn-pay-cancel').addEventListener('click', () => {
        switchView('order-view');
    });

    // Hesap Yazdır
    document.getElementById('btn-print-bill').addEventListener('click', async () => {
        if (!state.currentOrder) return;
        const btn = document.getElementById('btn-print-bill');
        btn.disabled = true;
        btn.textContent = "Yazdırılıyor...";
        try {
            const res = await secureFetch(`/api/orders/${state.currentOrder.id}/print-bill`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast('Hesap pusulası yazdırıldı', 'success');
            } else {
                showToast('Yazıcı hatası: ' + data.error, 'error');
            }
        } catch (e) {
            showToast('Bağlantı hatası', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = "🖨️ Hesap Yazdır";
        }
    });

    // Kapatma İşlemleri Gelişmiş POS ekranına taşındı

    // Sipariş (Adisyon) Başlatma
    btnOpenOrder.addEventListener('click', async () => {
        try {
            const res = await secureFetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table_id: state.currentTable.id })
            });
            const data = await res.json();
            if(!data.success) throw new Error(data.error);
            emptyTableOverlay.style.display = 'none';
            await fetchActiveOrder(state.currentTable.id);
        } catch(err) {
            showToast('Masa açılamadı: ' + err.message, 'error');
        }
    });

    // Boş Masayı Kapatma (Yanlışlıkla açıldıysa)
    document.getElementById('btn-cancel-empty').addEventListener('click', async () => {
        if (!confirm('Adisyon tamamen iptal edilip masa kapatılacak. Emin misiniz?')) return;
        try {
            const res = await secureFetch(`/api/orders/${state.currentOrder.id}/cancel-empty`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Masa kapatıldı', 'success');
                switchView('tables-view');
                fetchTables();
            } else {
                showToast('Kapatılamadı: ' + data.error, 'error');
            }
        } catch (e) {
            showToast('Bağlantı hatası', 'error');
        }
    });

    // Boş masadan çık
    btnCancelOrder.addEventListener('click', () => {
        emptyTableOverlay.style.display = 'none';
        switchView('tables-view');
        fetchTables();
    });

    // Admin Sekmeler
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
            
            e.target.classList.add('active');
            const targetTab = e.target.dataset.tab;
            document.getElementById(targetTab).style.display = 'block';
            
            if (targetTab === 'tab-charts') {
                fetchChartData();
            }
        });
    });

    // Müşteri Ekleme
    document.getElementById('btn-add-cust').addEventListener('click', async () => {
        const name = document.getElementById('new-cust-name').value;
        const phone = document.getElementById('new-cust-phone').value;
        if (!name) return showToast('Müşteri adı zorunlu', 'error');
        
        const res = await secureFetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Müşteri Eklendi', 'success');
            document.getElementById('new-cust-name').value = '';
            document.getElementById('new-cust-phone').value = '';
            fetchCustomers();
        } else {
            showToast('Müşteri Eklenemedi', 'error');
        }
    });

    // Multiplier Button İşlemleri
    document.querySelectorAll('.multiplier-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.multiplier-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.orderMultiplier = parseInt(e.target.dataset.val);
        });
    });

    // Masa Taşıma Overlay ve İşlemleri
    const transferOverlay = document.getElementById('transfer-table-overlay');
    const transferSelect = document.getElementById('transfer-table-select');
    
    document.getElementById('btn-transfer-table').addEventListener('click', () => {
        if(!state.currentOrder || !state.currentTable) return;
        
        // Boş masaları dropdown'a doldur
        transferSelect.innerHTML = '<option value="">Hedef Masa Seçin</option>';
        const emptyTables = state.tables.filter(t => t.status === 'empty');
        emptyTables.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.table_name;
            transferSelect.appendChild(opt);
        });
        
        transferOverlay.style.display = 'flex';
    });

    document.getElementById('btn-cancel-transfer').addEventListener('click', () => {
        transferOverlay.style.display = 'none';
        transferSelect.value = '';
    });

    document.getElementById('btn-confirm-transfer').addEventListener('click', async () => {
        const targetId = transferSelect.value;
        if(!targetId) return showToast('Lütfen hedef masayı seçin', 'error');
        
        try {
            const res = await secureFetch(`/api/orders/${state.currentOrder.id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_table_id: targetId })
            });
            const data = await res.json();
            if(data.success) {
                showToast('Masa başarıyla aktarıldı', 'success');
                transferOverlay.style.display = 'none';
                switchView('tables-view');
                fetchTables();
            } else {
                showToast('Hata: ' + data.error, 'error');
            }
        } catch(err) {
            showToast('Bağlantı hatası', 'error');
        }
    });

    setupAdminListeners();
}

// ========================
// GELİŞMİŞ POS HESAP VE KASA İŞLEMLERİ
// ========================
let posSelectedItems = [];
let posInputValue = "";

function openPaymentView() {
    if(!state.currentOrder) return;
    switchView('payment-view');
    
    document.getElementById('pos-order-id').textContent = `#${state.currentOrder.id}`;
    document.getElementById('pos-table-name').textContent = state.currentTable.table_name;
    
    posSelectedItems = [];
    posInputValue = "";
    document.getElementById('pos-input-amount').value = "";
    document.getElementById('pos-input-discount').value = "";
    
    renderPosItems();
    updatePosTotals();

    // Müşteri Select Verilerini Doldur
    const pSel = document.getElementById('pos-customer-select');
    pSel.innerHTML = '<option value="">-- Müşteri Yok --</option>';
    state.customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} ${c.phone ? ' - ' + c.phone : ''}`;
        pSel.appendChild(opt);
    });
}

function renderPosItems() {
    const list = document.getElementById('pos-items-list');
    list.innerHTML = '';
    
    if(!state.currentOrder.items) return;
    
    state.currentOrder.items.forEach(item => {
        let remainingQty = item.quantity - (item.paid_quantity || 0);
        let paidQty = item.paid_quantity || 0;
        
        // Zaten ödenmiş kısımları "Paid" olarak ekle (Tek parça olarak)
        if (paidQty > 0) {
            const divPaid = document.createElement('div');
            divPaid.className = 'pos-item paid';
            divPaid.innerHTML = `
                <span>${item.product_name}</span>
                <span style="text-align: right;">${paidQty}</span>
                <span style="text-align: right;">₺${(paidQty * item.price_at_time).toFixed(2)}</span>
                <span></span>
            `;
            list.appendChild(divPaid);
        }

        // Kalan kısmı tek tek parçala
        for(let i = 0; i < remainingQty; i++) {
            const uniqueId = item.id + '-' + i;
            const div = document.createElement('div');
            div.className = 'pos-item';
            
            const isSelected = posSelectedItems.find(x => x.uniqueId === uniqueId);
            if(isSelected) div.classList.add('selected');
            
            div.innerHTML = `
                <span>${item.product_name}</span>
                <span style="text-align: right;">1</span>
                <span style="text-align: right;">₺${parseFloat(item.price_at_time).toFixed(2)}</span>
                <button class="btn-delete-pos-item" style="margin-left:auto; background:var(--accent-red); color:white; border:none; border-radius:4px; width:24px; height:24px; cursor:pointer; font-size:12px; line-height:1; display:flex; justify-content:center; align-items:center;">✕</button>
            `;
            
            div.addEventListener('click', (e) => {
                if(e.target.closest('.btn-delete-pos-item')) {
                    e.stopPropagation();
                    deleteOrderItem(state.currentOrder.id, item.id);
                    return;
                }
                
                if(isSelected) {
                    posSelectedItems = posSelectedItems.filter(x => x.uniqueId !== uniqueId);
                } else {
                    posSelectedItems.push({ 
                        uniqueId: uniqueId,
                        id: item.id, 
                        paid_qty: 1,
                        total_price: parseFloat(item.price_at_time) 
                    });
                }
                
                // Seçilenlerin toplamını Input'a yaz
                let selTotal = posSelectedItems.reduce((sum, x) => sum + x.total_price, 0);
                posInputValue = selTotal > 0 ? selTotal.toString() : "";
                document.getElementById('pos-input-amount').value = posInputValue ? `₺${parseFloat(posInputValue).toFixed(2)}` : "";
                
                renderPosItems();
            });
            list.appendChild(div);
        }
    });
}

function updatePosTotals() {
    let order = state.currentOrder;
    if(!order) return;
    
    let total = parseFloat(order.total_price) || 0;
    let discount = parseFloat(order.discount) || 0;
    let paidAmount = parseFloat(order.paid_amount) || 0;
    
    let remaining = total - discount - paidAmount;
    if(remaining < 0) remaining = 0;
    
    document.getElementById('pos-total').textContent = `₺${total.toFixed(2)}`;
    document.getElementById('pos-discount').textContent = `₺${discount.toFixed(2)}`;
    document.getElementById('pos-paid').textContent = `₺${paidAmount.toFixed(2)}`;
    document.getElementById('pos-remaining').textContent = `₺${remaining.toFixed(2)}`;
    
    if (!posInputValue && posSelectedItems.length === 0) {
        document.getElementById('pos-input-amount').value = remaining > 0 ? `₺${remaining.toFixed(2)}` : "₺0.00";
    }
}

document.getElementById('pos-input-amount').addEventListener('focus', (e) => {
    e.target.value = e.target.value.replace(/₺/g, '');
});

document.getElementById('pos-input-amount').addEventListener('input', (e) => {
    let val = e.target.value.replace(/₺/g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
    posInputValue = val;
});

document.getElementById('pos-input-amount').addEventListener('blur', (e) => {
    let displayVal = parseFloat(posInputValue);
    if (!isNaN(displayVal)) {
        e.target.value = `₺${displayVal.toFixed(2)}`;
    }
});

document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let val = e.target.dataset.val;
        if(e.target.id === 'btn-numpad-clear') {
            posInputValue = "";
            posSelectedItems = [];
            renderPosItems();
        } else {
            posInputValue += val;
        }
        
        let displayVal = parseFloat(posInputValue);
        document.getElementById('pos-input-amount').value = isNaN(displayVal) ? "" : `₺${displayVal}`;
    });
});

document.querySelectorAll('.fastpay-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let val = parseFloat(e.target.dataset.val);
        let current = parseFloat(posInputValue) || 0;
        let newVal = current + val;
        posInputValue = newVal.toString();
        document.getElementById('pos-input-amount').value = `₺${newVal.toFixed(2)}`;
    });
});

document.getElementById('btn-apply-discount')?.addEventListener('click', async () => {
    let dsc = parseFloat(document.getElementById('pos-input-discount').value) || 0;
    if(!state.currentOrder) return;
    
    const res = await secureFetch(`/api/orders/${state.currentOrder.id}/discount`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ discount: dsc })
    });
    const data = await res.json();
    if(data.success) {
        state.currentOrder.discount = data.discount;
        showToast('İskonto uygulandı!', 'success');
        updatePosTotals();
    }
});

document.querySelectorAll('.btn-pay-method').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let method = e.target.dataset.method;
        if(method) submitPosPayment(method);
    });
});

// MASALAR ARASI ÖĞE TAŞIMA (ITEM TRANSFER)
const itemTransferOverlay = document.getElementById('transfer-items-overlay');
const itemTransferSelect = document.getElementById('transfer-items-select');

document.getElementById('btn-transfer-items').addEventListener('click', () => {
    if (!posSelectedItems || posSelectedItems.length === 0) {
        return showToast('Önce taşınacak ürünleri seçin', 'error');
    }
    
    // Dropdown doldur
    itemTransferSelect.innerHTML = '<option value="">Hedef Masa Seçin (Açık/Kapalı)</option>';
    state.tables.forEach(t => {
        if(t.id !== state.currentTable.id) {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.table_name} (${t.status === 'empty' ? 'Boş' : 'Dolu'})`;
            itemTransferSelect.appendChild(opt);
        }
    });

    itemTransferOverlay.style.display = 'flex';
});

document.getElementById('btn-cancel-item-transfer').addEventListener('click', () => {
    itemTransferOverlay.style.display = 'none';
    itemTransferSelect.value = '';
});

document.getElementById('btn-confirm-item-transfer').addEventListener('click', async () => {
    const targetTableId = itemTransferSelect.value;
    if(!targetTableId) return showToast('Hedef masa seçin', 'error');
    
    try {
        const res = await secureFetch(`/api/orders/${state.currentOrder.id}/items/transfer`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                target_table_id: targetTableId,
                items_to_transfer: posSelectedItems
            })
        });
        
        const data = await res.json();
        if(data.success) {
            showToast('Ürünler aktarıldı', 'success');
            itemTransferOverlay.style.display = 'none';
            posSelectedItems = [];
            
            // Eğer asıl masada açık order kalmadıysa (kapandıysa) ana menüye dön
            // Bunu API'den bilemiyoruz ancak fetchActiveOrder() başarısız olursa anlarız
            try {
                await fetchActiveOrder(state.currentTable.id);
                updatePosTotals();
                renderPosItems();
            } catch(e) {
                switchView('tables-view');
                fetchTables();
            }
        } else {
            showToast('Taşıma başarısız: ' + data.error, 'error');
        }
    } catch(err) {
        showToast('Bağlantı hatası', 'error');
    }
});

function confirmPaymentModal(amount, methodLabel) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('payment-confirm-overlay');
        const msgEl = document.getElementById('payment-confirm-message');
        const btnConfirm = document.getElementById('btn-confirm-payment-action');
        const btnCancel = document.getElementById('btn-cancel-payment-action');
        
        msgEl.innerHTML = `Tahsil edilecek tutar:<br><strong style="color:var(--accent-orange); font-size:28px; display:inline-block; margin:8px 0;">₺${amount}</strong><br>Ödeme Yöntemi: <strong style="color:white;">${methodLabel}</strong>`;
        
        overlay.style.display = 'flex';
        
        const cleanup = () => {
            btnConfirm.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
            overlay.style.display = 'none';
        };
        
        const onConfirm = () => {
            cleanup();
            resolve(true);
        };
        
        const onCancel = () => {
            cleanup();
            resolve(false);
        };
        
        btnConfirm.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
    });
}

async function submitPosPayment(method) {
    if(!state.currentOrder) return;
    
    let amountToPay = parseFloat(posInputValue);
    if(isNaN(amountToPay) || amountToPay <= 0) {
        let order = state.currentOrder;
        amountToPay = (order.total_price - order.discount - order.paid_amount);
        if(amountToPay <= 0) return showToast('Ödenecek kalan tutar yok.', 'error');
    }
    
    let methodNames = {
        'cash': 'Nakit',
        'credit_card': 'Kredi Kartı',
        'meal_card': 'Yemek Çeki',
        'veresiye': 'Veresiye'
    };
    let methodLabel = methodNames[method] || method;
    
    const isConfirmed = await confirmPaymentModal(amountToPay.toFixed(2), methodLabel);
    if (!isConfirmed) {
        return;
    }

    const customer_id = document.getElementById('pos-customer-select').value || null;
    if (method === 'veresiye' && !customer_id) {
        return showToast('Veresiye işlemi için mutlaka Müşteri seçmelisiniz!', 'error');
    }
    
    const payload = { 
        amount: amountToPay, 
        payment_method: method, 
        customer_id: customer_id,
        paid_items: posSelectedItems 
    };
    
    try {
        const res = await secureFetch(`/api/orders/${state.currentOrder.id}/pay`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if(!res) return;
        const data = await res.json();
        
        if(data.success) {
            showToast(`Tahsilat başarılı: ₺${amountToPay.toFixed(2)}`, 'success');
            if(data.closed) {
                posSelectedItems = [];
                switchView('tables-view');
                fetchTables();
            } else {
                posSelectedItems = [];
                posInputValue = "";
                await fetchActiveOrder(state.currentTable.id);
                updatePosTotals();
                renderPosItems();
            }
        } else {
            showToast(data.error || 'Ödeme alınamadı', 'error');
        }
    } catch(err) {
        showToast('Bağlantı hatası', 'error');
    }
}

function logout() {
    secureFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    state.token = null;
    state.user = null;
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    checkAuthStatus();
}

function switchView(viewId) {
    views.forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'flex';
}

// ========================
// API & RENDER (MASALAR & SİPARİŞ)
// ========================

async function fetchTables() {
    const res = await secureFetch('/api/tables');
    if(!res) return;
    const data = await res.json();
    if(data.success) {
        state.tables = data.data;
        renderTables();
    }
}

async function fetchMenu() {
    const res = await secureFetch('/api/menu');
    if(!res) return;
    const data = await res.json();
    if(data.success) {
        state.menu = data.data;
        if(state.menu.length > 0) state.activeCategory = state.menu[0].id;
    }
}

async function fetchCustomers() {
    const res = await secureFetch('/api/customers');
    if(!res) return;
    const data = await res.json();
    if(data.success) {
        state.customers = data.data;
        renderCustomers();
    }
}

function renderTables() {
    tablesGrid.innerHTML = '';
    const now = new Date();
    state.tables.forEach(table => {
        const card = document.createElement('div');
        card.className = `table-card ${table.status}`;
        
        let statusText = table.status === 'occupied' ? 'Dolu' : (table.status === 'bill_requested' ? 'Hesap İstendi' : 'Boş');
        
        if (table.status === 'occupied' && table.last_order_time) {
            const lastOrderDate = new Date(table.last_order_time);
            const diffMinutes = Math.floor((now - lastOrderDate) / (1000 * 60));
            
            if (diffMinutes >= 60) {
                card.classList.add('warning-red');
                statusText += ` (${diffMinutes}dk)`;
            } else if (diffMinutes >= 30) {
                card.classList.add('warning-yellow');
                statusText += ` (${diffMinutes}dk)`;
            }
        }
        
        let extraHtml = '';
        if (table.status !== 'empty' && table.total_price !== undefined && table.total_price !== null) {
            const rem = parseFloat(table.total_price) - parseFloat(table.discount || 0) - parseFloat(table.paid_amount || 0);
            if (rem > 0) {
                extraHtml = `<div style="margin-top:8px; font-size:16px; font-weight:bold; color:#ffdd59;">₺${rem.toFixed(2)}</div>`;
            }
        }
        
        card.innerHTML = `<h3>${table.table_name}</h3><div class="table-status">${statusText}</div>${extraHtml}`;
        card.addEventListener('click', () => openTable(table));
        tablesGrid.appendChild(card);
    });
}

async function openTable(table) {
    state.currentTable = table;
    currentTableName.textContent = table.table_name;
    switchView('order-view');
    renderMenu();
    
    if(table.status === 'empty') {
        // Otomatik açmayı iptal et, overlay göster
        emptyTableOverlay.style.display = 'flex';
        receiptItems.innerHTML = '<div class="empty-receipt">Adisyon açılmamış.</div>';
        btnPay.disabled = true;
        receiptTotal.textContent = '₺0.00';
        state.currentOrder = null;
    } else {
        emptyTableOverlay.style.display = 'none';
        await fetchActiveOrder(table.id);
    }
}

async function fetchActiveOrder(tableId) {
    const res = await secureFetch(`/api/orders/active/${tableId}`);
    if(!res) return;
    const data = await res.json();
    if(data.success && data.data) {
        state.currentOrder = data.data;
    } else {
        state.currentOrder = { items: [], total_price: 0 };
    }
    // Taşı butonunu göster/gizle
    const moveBtn = document.getElementById('btn-move-items');
    if(moveBtn) moveBtn.style.display = (state.currentOrder.items && state.currentOrder.items.length > 0) ? 'inline-block' : 'none';
    
    // Boş Masayı Kapat butonunu göster/gizle
    const cancelEmptyBtn = document.getElementById('btn-cancel-empty');
    if (cancelEmptyBtn) {
        // Sepette henüz kaydedilmemiş ürün (orderCart) VEYA adisyonda kaydedilmiş ürün (items) yoksa iptal butonu görünsün
        const hasSavedItems = state.currentOrder.items && state.currentOrder.items.length > 0;
        cancelEmptyBtn.style.display = (!hasSavedItems) ? 'inline-block' : 'none';
    }

    renderReceipt();
}

function renderMenu() {
    categoryList.innerHTML = '';
    state.menu.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-btn ${state.activeCategory === cat.id ? 'active' : ''}`;
        btn.textContent = cat.category_name;
        btn.addEventListener('click', () => { state.activeCategory = cat.id; renderMenu(); });
        categoryList.appendChild(btn);
    });
    
    productsGrid.innerHTML = '';
    const activeCatData = state.menu.find(c => c.id === state.activeCategory);
    if(activeCatData && activeCatData.products) {
        activeCatData.products.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.position = 'relative';
            card.innerHTML = `
                <div class="product-name">${prod.product_name}</div>
                <div class="product-price">₺${parseFloat(prod.price).toFixed(2)}</div>
                <button class="btn-note" style="position:absolute; top:5px; right:5px; padding:2px 6px; font-size:12px; border:none; background:rgba(0,0,0,0.4); border-radius:4px; color:white; cursor:pointer;" title="Not Ekle">📝</button>
            `;
            
            card.addEventListener('click', (e) => {
                if(e.target.closest('.btn-note')) {
                    e.stopPropagation();
                    if(!state.currentOrder || !state.currentOrder.id) {
                        showToast('Önce masayı açmalısınız (Adisyon başlatın).', 'error');
                        return;
                    }
                    openProductNoteModal(prod);
                    return;
                }
                
                if(!state.currentOrder || !state.currentOrder.id) {
                    showToast('Önce masayı açmalısınız (Adisyon başlatın).', 'error');
                    return;
                }
                const qty = state.orderMultiplier || 1;
                const existing = orderCart.find(item => item.product.id === prod.id && !item.note);
                if(existing) {
                    existing.qty += qty;
                } else {
                    orderCart.push({ product: prod, qty, note: '' });
                }
                
                state.orderMultiplier = 1;
                document.querySelectorAll('.multiplier-btn').forEach(b => {
                    b.classList.remove('active');
                    if(b.dataset.val == "1") b.classList.add('active');
                });
                renderCart();
            });
            productsGrid.appendChild(card);
        });
    }
}

// ========================
// SEPET & ÜRÜN NOT MODALI
// ========================
let _pendingProduct = null;
let orderCart = []; // [{product, qty, note}]

function renderCart() {
    const div = document.getElementById('cart-items');
    const saveBtn = document.getElementById('btn-save-cart');
    const section = document.getElementById('cart-section');
    div.innerHTML = '';

    if(orderCart.length === 0) {
        section.style.display = 'none';
        saveBtn.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    saveBtn.style.display = 'block';

    orderCart.forEach((entry, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px 12px; border-bottom:1px solid rgba(243,156,18,0.2);';
        row.innerHTML = `
            <div style="flex:1;">
                <span style="font-weight:bold;">${entry.product.product_name}</span>
                <span style="color:#888; font-size:12px; margin-left:6px;">x${entry.qty}</span>
                ${entry.note ? `<div style="color:var(--accent-orange); font-size:11px;">📝 ${entry.note}</div>` : ''}
            </div>
            <span style="margin-right:10px; color:#f1c40f;">₺${(entry.product.price * entry.qty).toFixed(2)}</span>
            <button onclick="removeFromCart(${idx})" style="background:var(--accent-red); color:white; border:none; border-radius:4px; width:22px; height:22px; cursor:pointer; font-size:12px;">✕</button>
        `;
        div.appendChild(row);
    });
    
    // Sepette ürün varsa iptal butonunu gizle
    const cancelEmptyBtn = document.getElementById('btn-cancel-empty');
    if (cancelEmptyBtn) {
        const hasSavedItems = state.currentOrder && state.currentOrder.items && state.currentOrder.items.length > 0;
        cancelEmptyBtn.style.display = (!hasSavedItems && orderCart.length === 0) ? 'inline-block' : 'none';
    }
}

window.removeFromCart = function(idx) {
    orderCart.splice(idx, 1);
    renderCart();
};

function openProductNoteModal(prod) {
    if(!state.currentOrder) return;
    _pendingProduct = prod;
    document.getElementById('note-product-title').textContent = `📝 ${prod.product_name}`;
    document.getElementById('product-note-input').value = '';
    document.getElementById('product-note-overlay').style.display = 'flex';
    setTimeout(() => document.getElementById('product-note-input').focus(), 100);
}

document.getElementById('btn-cancel-product-note').addEventListener('click', () => {
    document.getElementById('product-note-overlay').style.display = 'none';
    _pendingProduct = null;
});

document.getElementById('btn-confirm-product-note').addEventListener('click', () => {
    if(!_pendingProduct) return;
    const note = document.getElementById('product-note-input').value.trim();
    document.getElementById('product-note-overlay').style.display = 'none';

    // Aynı ürün + aynı not varsa üstlerine yığ
    const qty = state.orderMultiplier || 1;
    const existing = orderCart.find(e => e.product.id === _pendingProduct.id && e.note === note);
    if(existing && !note) {
        existing.qty += qty;
    } else {
        orderCart.push({ product: _pendingProduct, qty, note });
    }
    // Çarpa sıfırla
    state.orderMultiplier = 1;
    document.querySelectorAll('.multiplier-btn').forEach(b => {
        b.classList.remove('active');
        if(b.dataset.val == "1") b.classList.add('active');
    });
    _pendingProduct = null;
    renderCart();
});

// Sepeti masaya kaydet
document.getElementById('btn-save-cart').addEventListener('click', async () => {
    if(!state.currentOrder || orderCart.length === 0) return;
    document.getElementById('btn-save-cart').disabled = true;
    let allOk = true;
    for(const entry of orderCart) {
        const res = await secureFetch(`/api/orders/${state.currentOrder.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: entry.product.id, quantity: entry.qty, note: entry.note || '' })
        });
        const data = await res.json();
        if(!data.success) { allOk = false; showToast('Ürün eklenemedi: ' + entry.product.product_name, 'error'); }
    }

    // Tüm ürünler kaydedildikten sonra TEK FİŞ bas
    if (allOk && orderCart.length > 0) {
        try {
            const printItems = orderCart.map(e => ({
                product_name: e.product.product_name,
                quantity: e.qty,
                note: e.note || ''
            }));
            secureFetch(`/api/orders/${state.currentOrder.id}/print-slip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: printItems })
            }).catch(err => console.error('Fiş hatası:', err));
        } catch(e) { console.error('Fiş gönderim hatası:', e); }
    }

    orderCart = [];
    renderCart();
    document.getElementById('btn-save-cart').disabled = false;
    if(allOk) showToast('Sipariş masaya kaydedildi ✔', 'success');
    await fetchActiveOrder(state.currentTable.id);
});

// Masa ekranından ürün taşıma (btn-move-items)
document.getElementById('btn-move-items').addEventListener('click', () => {
    if(!state.currentOrder) return;
    const overlay = document.getElementById('item-transfer-overlay');
    if(!overlay) return;
    // Ürünleri doldur
    const sel = document.getElementById('item-transfer-table-select');
    sel.innerHTML = '<option value="">Hedef Masa Seçin</option>';
    state.tables.filter(t => t.id !== state.currentTable.id).forEach(t => {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = `${t.table_name} (${t.status === 'occupied' ? 'Dolu' : 'Boş'})`;
        sel.appendChild(o);
    });
    // Seçilen ürünleri doldur
    const ilist = document.getElementById('item-transfer-product-list');
    ilist.innerHTML = '';
    state.currentOrder.items.forEach(item => {
        let remaining = item.quantity - (item.paid_quantity || 0);
        for(let i = 0; i < remaining; i++) {
            const uid = `${item.id}-${i}`;
            const row = document.createElement('label');
            row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer;';
            row.innerHTML = `<input type="checkbox" data-item-id="${item.id}" data-pay-qty="1" style="width:16px; height:16px;"> <span>${item.product_name}</span><span style="color:#888; font-size:12px; margin-left:auto;">₺${parseFloat(item.price_at_time).toFixed(2)}</span>`;
            ilist.appendChild(row);
        }
    });
    overlay.style.display = 'flex';
});

document.getElementById('btn-cancel-item-transfer').addEventListener('click', () => {
    document.getElementById('item-transfer-overlay').style.display = 'none';
});

document.getElementById('btn-confirm-item-transfer').addEventListener('click', async () => {
    const targetTableId = document.getElementById('item-transfer-table-select').value;
    if(!targetTableId) return showToast('Hedef masa seçin', 'error');

    const checked = document.querySelectorAll('#item-transfer-product-list input[type=checkbox]:checked');
    if(checked.length === 0) return showToast('En az bir ürün seçin', 'error');

    // Her item_id için kaç adet seçildiğini grupla
    const itemMap = {};
    checked.forEach(cb => {
        const id = cb.dataset.itemId;
        itemMap[id] = (itemMap[id] || 0) + 1;
    });

    const items = Object.entries(itemMap).map(([item_id, qty]) => ({ item_id: parseInt(item_id), quantity: qty }));

    try {
        const res = await secureFetch(`/api/orders/${state.currentOrder.id}/items/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_table_id: targetTableId, items })
        });
        const data = await res.json();
        if(data.success) {
            showToast('Ürünler taşındı ✔', 'success');
            document.getElementById('item-transfer-overlay').style.display = 'none';
            await fetchActiveOrder(state.currentTable.id);
            await fetchTables();
        } else {
            showToast('Hata: ' + data.error, 'error');
        }
    } catch(e) {
        showToast('Bağlantı hatası', 'error');
    }
});

async function addProductToOrder(product, note = '') {
    if(!state.currentOrder) return;
    
    let qty = state.orderMultiplier || 1;
    
    const res = await secureFetch(`/api/orders/${state.currentOrder.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, quantity: qty, note: note || '' })
    });
    const data = await res.json();
    if(data.success) {
        state.orderMultiplier = 1;
        document.querySelectorAll('.multiplier-btn').forEach(b => {
            b.classList.remove('active');
            if(b.dataset.val == "1") b.classList.add('active');
        });
        await fetchActiveOrder(state.currentTable.id);
    } else {
        showToast('Ürün eklenemedi: ' + (data.error || ''), 'error');
    }
}

function renderReceipt() {
    receiptItems.innerHTML = '';
    if(!state.currentOrder || !state.currentOrder.items || state.currentOrder.items.length === 0) {
        receiptItems.innerHTML = '<div class="empty-receipt">Henüz ürün eklenmedi</div>';
        btnPay.disabled = true;
        receiptTotal.textContent = '₺0.00';
        return;
    }
    btnPay.disabled = false;
    state.currentOrder.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'receipt-item';
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05);';
        const noteHtml = item.note ? `<div style="color: var(--accent-orange); font-size: 12px; margin-top: 2px;">📝 ${item.note}</div>` : '';
        div.innerHTML = `
            <div class="item-info" style="flex:1;">
                <div class="item-name" style="font-weight:bold;">${item.product_name}</div>
                <div class="item-meta" style="color:#888; font-size:13px;">${item.quantity} x ₺${parseFloat(item.price_at_time).toFixed(2)}</div>
                ${noteHtml}
            </div>
            <div class="item-total" style="font-weight:bold; margin-right:12px;">₺${(item.quantity * item.price_at_time).toFixed(2)}</div>
            <button onclick="deleteOrderItem(${state.currentOrder.id}, ${item.id})" style="background: var(--accent-red); color: white; border: none; border-radius: 4px; width: 28px; height: 28px; cursor: pointer; font-size: 14px; line-height:1;">✕</button>
        `;
        receiptItems.appendChild(div);
    });
    // Toplam ve İskonto Hesabı
    const total = parseFloat(state.currentOrder.total_price) || 0;
    const discount = parseFloat(state.currentOrder.discount) || 0;
    const netTotal = total - discount;

    if (discount > 0) {
        const discDiv = document.createElement('div');
        discDiv.style.cssText = 'display: flex; justify-content: space-between; padding: 4px 12px; color: #f1c40f; font-size: 14px; border-top: 1px dashed rgba(255,255,255,0.1);';
        discDiv.innerHTML = `<span>İskonto:</span><span>-₺${discount.toFixed(2)}</span>`;
        receiptItems.appendChild(discDiv);
    }

    receiptTotal.textContent = `₺${netTotal.toFixed(2)}`;
}

window.deleteOrderItem = async function(orderId, itemId) {
    if(!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    try {
        const res = await secureFetch(`/api/orders/${orderId}/items/${itemId}`, { 
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ quantity: 1 })
        });
        const data = await res.json();
        if(data.success) {
            showToast('Ürün silindi', 'success');
            await fetchActiveOrder(state.currentTable.id);
            // Eğer ödeme ekranındaysak ödeme ekranını da güncelle
            if(document.getElementById('payment-view').style.display === 'flex') {
                posSelectedItems = [];
                posInputValue = "";
                document.getElementById('pos-input-amount').value = "";
                renderPosItems();
                updatePosTotals();
            }
        } else {
            showToast('Hata: ' + data.error, 'error');
        }
    } catch(e) {
        showToast('Bağlantı hatası', 'error');
    }
};

// Müşteriler (Veresiye) Ekranı
function renderCustomers() {
    const clist = document.getElementById('customers-list');
    if(!clist) return;
    clist.innerHTML = '';
    
    payCustomerSelect.innerHTML = '<option value="">Seçiniz...</option>';

    state.customers.forEach(c => {
        // Dropdown'a ekle
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} ${c.phone ? ' - ' + c.phone : ''}`;
        payCustomerSelect.appendChild(opt);

        // Listeye ekle
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
        
        let balColor = c.balance > 0 ? 'var(--accent-red)' : 'var(--accent-green)';
        
        card.innerHTML = `
            <div>
                <div style="font-size: 18px; font-weight: bold;">${c.name}</div>
                <div style="font-size: 13px; color: #888;">${c.phone || 'Telefon Yok'}</div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                <div style="font-size: 20px; font-weight: bold; color: ${balColor};">₺${parseFloat(c.balance).toFixed(2)}</div>
                ${c.balance > 0 ? `<button onclick="receiveDebt(${c.id}, '${c.name}', ${c.balance})" class="btn btn-primary btn-small">Borç Tahsil Et</button>` : ''}
            </div>
        `;
        clist.appendChild(card);
    });
}

window.receiveDebt = async function(id, name, balance) {
    const amountStr = prompt(`${name} isimli müşterinin ₺${balance} borcu var.\nNe kadarı tahsil edildi? (₺)`);
    if(!amountStr) return;
    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) return showToast('Geçersiz tutar', 'error');

    try {
        const res = await secureFetch(`/api/customers/${id}/pay`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if(data.success) {
            showToast('Tahsilat başarıyla kaydedildi!', 'success');
            fetchCustomers();
        } else {
            showToast('Hata: ' + data.error, 'error');
        }
    } catch(err) {
        showToast('Bağlantı hatası', 'error');
    }
}

// ========================
// ADMIN YÖNETİM İŞLEMLERİ
// ========================
async function loadAdminDashboard() {
    if(state.user.role !== 'admin') return;

    // Load Reports
    fetchDailyReports();

    // Load Users
    const uRes = await secureFetch('/api/admin/users');
    const uData = await uRes.json();
    adminUserList.innerHTML = '';
    if(uData.success) {
        uData.data.forEach(user => {
            const div = document.createElement('div'); div.className = 'list-item';
            div.innerHTML = `<span>${user.username} (${user.role})</span> <button onclick="deleteResource('/api/admin/users/${user.id}')">Sil</button>`;
            adminUserList.appendChild(div);
        });
    }

    // Load Tables & Menu
    await fetchTables();
    await fetchMenu();
    
    adminTableList.innerHTML = '';
    state.tables.forEach(t => {
        const div = document.createElement('div'); div.className = 'list-item';
        div.innerHTML = `<span>${t.table_name}</span> <button onclick="deleteResource('/api/admin/tables/${t.id}')">Sil</button>`;
        adminTableList.appendChild(div);
    });

    adminCatList.innerHTML = '';
    newProdCat.innerHTML = '';
    
    const adminProdList = document.getElementById('admin-products-list');
    if(adminProdList) adminProdList.innerHTML = '';

    state.menu.forEach(c => {
        // Kategori listesi
        const div = document.createElement('div'); div.className = 'list-item';
        div.innerHTML = `<span>${c.category_name}</span> <button onclick="deleteResource('/api/admin/categories/${c.id}')" style="background:var(--accent-red); color:white; border:none; border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer;">Sil</button>`;
        adminCatList.appendChild(div);
        
        const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.category_name;
        newProdCat.appendChild(opt);

        // Kategori Alt Başlığı + Ürünler
        if(adminProdList && c.products && c.products.length > 0) {
            const catHeader = document.createElement('div');
            catHeader.style.cssText = 'grid-column: 1 / -1; font-weight: bold; font-size: 15px; color: var(--accent-orange); border-bottom: 1px solid var(--border-color); padding: 8px 0; margin-top: 12px;';
            catHeader.textContent = c.category_name;
            adminProdList.appendChild(catHeader);

            c.products.forEach(p => {
                const pdiv = document.createElement('div');
                pdiv.style.cssText = 'background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; gap: 8px;';
                pdiv.innerHTML = `
                    <div style="flex:1;">
                        <div style="font-weight: bold; font-size: 15px;">${p.product_name}</div>
                        <div style="color: var(--accent-green); font-size: 13px;">₺${parseFloat(p.price).toFixed(2)}</div>
                    </div>
                    <button onclick="editProduct(${p.id}, '${p.product_name.replace(/'/g, '\\&apos;')}', ${p.price})" style="background: var(--accent-orange); color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 13px;">Düzenle</button>
                    <button onclick="deleteResource('/api/admin/products/${p.id}')" style="background: var(--accent-red); color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 13px;">Sil</button>
                `;
                adminProdList.appendChild(pdiv);
            });
        }
    });
}
// ========================
// RAPORLAR YÖNETİMİ
// ========================
async function fetchDailyReports() {
    const start = document.getElementById('report-start-date').value;
    const end = document.getElementById('report-end-date').value;
    
    let urlSummary = '/api/admin/reports/daily-summary';
    let urlProducts = '/api/admin/reports/daily-products';
    
    let queryParams = [];
    if(start) queryParams.push(`start=${encodeURIComponent(start)}`);
    if(end) queryParams.push(`end=${encodeURIComponent(end)}`);
    if(queryParams.length > 0) {
        let q = '?' + queryParams.join('&');
        urlSummary += q;
        urlProducts += q;
    }
    
    try {
        const resSum = await secureFetch(urlSummary);
        const dataSum = await resSum.json();
        if(dataSum.success) {
            const sum = dataSum.summary;
            document.getElementById('rep-pay-cash').textContent = parseFloat(sum.cash || 0).toFixed(2);
            document.getElementById('rep-pay-cc').textContent = parseFloat(sum.credit_card || 0).toFixed(2);
            document.getElementById('rep-pay-meal').textContent = parseFloat(sum.meal_card || 0).toFixed(2);
            document.getElementById('rep-pay-veresiye').textContent = parseFloat(sum.veresiye || 0).toFixed(2);
            document.getElementById('rep-pay-discount').textContent = parseFloat(sum.discount || 0).toFixed(2);
            
            document.getElementById('rep-total-masa').textContent = parseFloat(sum.total || 0).toFixed(2);
            document.getElementById('rep-servis-toplam').textContent = parseFloat(sum.total || 0).toFixed(2);
            document.getElementById('rep-net-satis').textContent = parseFloat(sum.total || 0).toFixed(2);
            document.getElementById('rep-genel-toplam').textContent = parseFloat(sum.total || 0).toFixed(2);

            // Ürün bazlı satış log tablosunu render et
            const tbody = document.getElementById('rep-orders-table');
            tbody.innerHTML = '';
            if(dataSum.orders && dataSum.orders.length > 0) {
                dataSum.orders.forEach(o => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    tr.innerHTML = `
                        <td style="padding:8px 10px;">#${o.adisyon_no}</td>
                        <td style="padding:8px 10px;">${o.masa}</td>
                        <td style="padding:8px 10px;">${o.operator}</td>
                        <td style="padding:8px 10px; font-weight:bold;">${o.product_name}</td>
                        <td style="padding:8px 10px; color:#888;">${o.category_name || '-'}</td>
                        <td style="padding:8px 10px; text-align:right;">${o.quantity}</td>
                        <td style="padding:8px 10px; text-align:right; color:var(--accent-green);">₺${parseFloat(o.line_total).toFixed(2)}</td>
                        <td style="padding:8px 10px; color:#888; font-size:13px;">${new Date(o.kapanis).toLocaleString('tr-TR')}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="8" style="padding:16px; color:#888; text-align:center;">Bu aralıkta kapatılmış adisyon yok</td></tr>';
            }
        }
        
        const resProd = await secureFetch(urlProducts);
        const dataProd = await resProd.json();
        if(dataProd.success) {
            const tbody = document.getElementById('rep-products-table');
            tbody.innerHTML = '';
            let tQty = 0; let tPrice = 0;
            if(dataProd.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="padding:16px; color:#888; text-align:center;">Bu tarihte satış kaydı yok</td></tr>';
            } else {
                dataProd.data.forEach((p, i) => {
                    tQty += parseFloat(p.total_quantity);
                    tPrice += parseFloat(p.total_price);
                    const tr = document.createElement('tr');
                    tr.style.cssText = i % 2 === 0 ? 'background: rgba(255,255,255,0.02);' : '';
                    tr.innerHTML = `
                        <td style="padding:10px; font-weight:bold;">${p.product_name}</td>
                        <td style="padding:10px; color:#888;">${p.category_name || '-'}</td>
                        <td style="padding:10px; text-align:right;">${p.total_quantity}</td>
                        <td style="padding:10px; text-align:right; color:var(--accent-green);">₺${parseFloat(p.total_price).toFixed(2)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            document.getElementById('rep-prod-total-qty').textContent = tQty;
            document.getElementById('rep-prod-total-price').textContent = tPrice.toFixed(2);
        }
    } catch(e) {
        console.error(e);
        showToast('Rapor yüklenirken hata', 'error');
    }
}

async function fetchItemLogs() {
    const start = document.getElementById('log-start-date').value;
    const end = document.getElementById('log-end-date').value;
    
    let url = '/api/admin/reports/item-logs';
    let params = [];
    if(start) params.push(`start=${encodeURIComponent(start)}`);
    if(end) params.push(`end=${encodeURIComponent(end)}`);
    if(params.length) url += '?' + params.join('&');

    try {
        const res = await secureFetch(url);
        const data = await res.json();
        const tbody = document.getElementById('item-logs-table');
        tbody.innerHTML = '';

        if(!data.success || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:#888;">Bu aralıkta kayıt yok</td></tr>';
            return;
        }

        data.data.forEach((log, i) => {
            const isCancel = log.eylem === 'cancel';
            const isDiscount = log.eylem === 'discount';
            const tr = document.createElement('tr');
            const baseBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
            const rowBg = isCancel
                ? 'background:rgba(231,76,60,0.08);'
                : isDiscount
                    ? 'background:rgba(241,196,15,0.06);'
                    : baseBg;
            tr.style.cssText = rowBg + 'border-bottom:1px solid rgba(255,255,255,0.04);';

            let actionBadge;
            if (isCancel) {
                actionBadge = `<span style="background:var(--accent-red); color:white; font-size:10px; padding:2px 6px; border-radius:4px;">İPTAL</span>`;
            } else if (isDiscount) {
                actionBadge = `<span style="background:#f1c40f; color:#111; font-size:10px; padding:2px 6px; border-radius:4px;">İSKONTO</span>`;
            } else {
                actionBadge = `<span style="background:var(--accent-green); color:#111; font-size:10px; padding:2px 6px; border-radius:4px;">EKLENDİ</span>`;
            }

            const tutar = Math.abs(parseFloat(log.toplam) || 0);
            const tutarRenk = isCancel ? 'var(--accent-red)' : isDiscount ? '#f1c40f' : 'var(--accent-green)';
            const tutarPrefix = (isCancel || isDiscount) ? '-' : '';

            tr.innerHTML = `
                <td style="padding:9px 10px;">#${log.adisyon_no}</td>
                <td style="padding:9px 10px;">${log.masa}</td>
                <td style="padding:9px 10px; font-weight:bold; color:var(--accent-orange);">${log.personel}</td>
                <td style="padding:9px 10px; ${isCancel ? 'text-decoration:line-through; color:#e74c3c;' : isDiscount ? 'color:#f1c40f; font-weight:bold;' : ''}">${log.urun}</td>
                <td style="padding:9px 10px; text-align:right;">${log.adet}</td>
                <td style="padding:9px 10px; text-align:right; color:${tutarRenk};">${tutarPrefix}₺${tutar.toFixed(2)}</td>
                <td style="padding:9px 10px; color:var(--accent-orange); font-style:italic; font-size:13px;">${log.not_var || '-'}</td>
                <td style="padding:9px 10px;">${actionBadge}</td>
                <td style="padding:9px 10px; color:#888; font-size:12px;">${new Date(log.tarih).toLocaleString('tr-TR')}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        showToast('Loglar yüklenemedi', 'error');
    }
}

function setupAdminListeners() {
    document.getElementById('btn-fetch-reports').addEventListener('click', fetchDailyReports);
    document.getElementById('btn-fetch-logs').addEventListener('click', fetchItemLogs);
    document.getElementById('btn-fetch-charts').addEventListener('click', fetchChartData);
    document.getElementById('trend-period-select-chart').addEventListener('change', fetchChartData);
    document.getElementById('global-chart-type').addEventListener('change', fetchChartData);

    document.getElementById('btn-add-user').addEventListener('click', async () => {
        const req = {
            username: document.getElementById('new-user-name').value,
            password: document.getElementById('new-user-pass').value,
            role: document.getElementById('new-user-role').value
        };
        await adminPost('/api/admin/users', req);
    });

    document.getElementById('btn-add-table').addEventListener('click', async () => {
        await adminPost('/api/admin/tables', { table_name: document.getElementById('new-table-name').value });
    });

    document.getElementById('btn-add-cat').addEventListener('click', async () => {
        await adminPost('/api/admin/categories', { category_name: document.getElementById('new-cat-name').value });
    });

    document.getElementById('btn-add-prod').addEventListener('click', async () => {
        await adminPost('/api/admin/products', {
            category_id: newProdCat.value,
            product_name: document.getElementById('new-prod-name').value,
            price: document.getElementById('new-prod-price').value
        });
    });
}

async function adminPost(url, bodyData) {
    const res = await secureFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    });
    const data = await res.json();
    if(data.success) { showToast('Eklendi', 'success'); loadAdminDashboard(); }
    else { showToast('Hata: ' + data.error, 'error'); }
}

window.editProduct = async function(id, currentName, currentPrice) {
    const newName = prompt(`Ürün adını girin:`, currentName);
    if(newName === null) return; // iptal
    const newPrice = prompt(`Yeni fiyatı girin (₺):`, currentPrice);
    if(newPrice === null) return; // iptal

    const priceNum = parseFloat(newPrice);
    if(!newName.trim() || isNaN(priceNum) || priceNum <= 0) {
        return showToast('Geçersiz bilgi girdiniz', 'error');
    }

    try {
        const res = await secureFetch(`/api/admin/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_name: newName.trim(), price: priceNum })
        });
        const data = await res.json();
        if(data.success) {
            showToast('Ürün güncellendi', 'success');
            await fetchMenu();
            loadAdminDashboard();
        } else {
            showToast('Hata: ' + data.error, 'error');
        }
    } catch(e) {
        showToast('Bağlantı hatası', 'error');
    }
};

window.deleteResource = async function(url) {
    if(!confirm("Emin misiniz?")) return;
    const res = await secureFetch(url, { method: 'DELETE' });
    const data = await res.json();
    if(data.success) { showToast('Silindi', 'success'); loadAdminDashboard(); }
    else { showToast('Hata: ' + data.error, 'error'); }
}

// ========================
// GRAFİKLER (CHART.JS)
// ========================
let revenueChartInstance = null;
let productChartInstance = null;
let staffChartInstance = null;

async function fetchChartData() {
    const start = document.getElementById('chart-start-date').value;
    const end = document.getElementById('chart-end-date').value;
    const chartType = document.getElementById('global-chart-type').value;

    let params = [];
    if(start) params.push(`start=${encodeURIComponent(start)}`);
    if(end) params.push(`end=${encodeURIComponent(end)}`);
    const qStr = params.length ? '?' + params.join('&') : '';

    try {
        // Personel Satış (Daily Summary içinden)
        const resSum = await secureFetch('/api/admin/reports/daily-summary' + qStr);
        const dataSum = await resSum.json();
        
        if (dataSum.success && dataSum.orders) {
            window.currentReportOrders = dataSum.orders;
            const staffSales = {};
            dataSum.orders.forEach(o => {
                const isCancel = o.eylem === 'cancel';
                const total = parseFloat(o.line_total);
                if(!staffSales[o.operator]) staffSales[o.operator] = 0;
                // Add if not cancelled, or subtract if it's a refund tracking?
                // Our line_total is already positive for additions. We should just sum it.
                // Wait, if isCancel is true, does it mean we should subtract? The user wants "hangi personel ne kadar ciro satış vermiş". Cancellations shouldn't count as revenue.
                if (!isCancel) {
                    staffSales[o.operator] += total;
                }
            });
            updateStaffChart(staffSales, chartType);
        }

        // Ürün Satış
        const resProd = await secureFetch('/api/admin/reports/daily-products' + qStr);
        const dataProd = await resProd.json();
        if(dataProd.success) {
            updateProductChart(dataProd.data, chartType);
        }

        // Ciro Trendi
        const period = document.getElementById('trend-period-select-chart').value;
        const trendUrl = `/api/admin/reports/revenue-trend?period=${period}` + (qStr ? '&'+qStr.substring(1) : '');
        const resTrend = await secureFetch(trendUrl);
        const dataTrend = await resTrend.json();
        if(dataTrend.success) {
            updateRevenueChart(dataTrend.data, chartType);
        }

    } catch (e) {
        showToast('Grafik verisi yüklenemedi', 'error');
    }
}

function updateRevenueChart(data, type) {
    const ctx = document.getElementById('revenueTrendCanvas').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy();
    
    revenueChartInstance = new Chart(ctx, {
        type: type === 'pie' || type === 'doughnut' ? 'bar' : type, // Pie/Doughnut for trend doesn't make sense, fallback to bar/line
        data: {
            labels: data.map(d => d.date_label),
            datasets: [{
                label: 'Ciro (₺)',
                data: data.map(d => parseFloat(d.total_revenue)),
                backgroundColor: 'rgba(230, 126, 34, 0.5)',
                borderColor: '#e67e22',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function updateProductChart(data, type) {
    const ctx = document.getElementById('productPieCanvas').getContext('2d');
    if (productChartInstance) productChartInstance.destroy();
    
    const topData = data.slice(0, 10);
    productChartInstance = new Chart(ctx, {
        type: type,
        data: {
            labels: topData.map(d => d.product_name),
            datasets: [{
                label: 'Satış Adedi',
                data: topData.map(d => parseInt(d.total_quantity)),
                backgroundColor: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e', '#ecf0f1', '#95a5a6'],
                borderWidth: 1, borderColor: '#111'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#ccc', font: {size: 11} } } } }
    });
}

function updateStaffChart(staffSalesObj, type) {
    const ctx = document.getElementById('staffRevenueCanvas').getContext('2d');
    if (staffChartInstance) staffChartInstance.destroy();

    const labels = Object.keys(staffSalesObj);
    const values = Object.values(staffSalesObj).map(v => v.toFixed(2));

    staffChartInstance = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: 'Ciro (₺)',
                data: values,
                backgroundColor: ['#2ecc71', '#e74c3c', '#f1c40f', '#3498db', '#9b59b6', '#e67e22', '#1abc9c'],
                borderWidth: 1, borderColor: '#111'
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: { color: '#ccc', font: {size: 11} } } },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const label = staffChartInstance.data.labels[idx];
                    showStaffDetailsModal(label);
                }
            }
        }
    });
}

function showStaffDetailsModal(staffName) {
    if (!window.currentReportOrders) return;
    
    document.getElementById('staff-details-title').textContent = staffName + ' - Satış Detayları';
    const tbody = document.getElementById('staff-details-tbody');
    const totalEl = document.getElementById('staff-details-total');
    tbody.innerHTML = '';
    
    let total = 0;
    
    // Filtrele: Bu personelin ve 'cancel' olmayan satırları
    const staffOrders = window.currentReportOrders.filter(o => o.operator === staffName && o.eylem !== 'cancel');
    
    staffOrders.forEach(o => {
        const lineTotal = parseFloat(o.line_total);
        total += lineTotal;
        
        const dateObj = new Date(o.kapanis || o.tarih || new Date());
        const timeStr = dateObj.getHours().toString().padStart(2, '0') + ':' + dateObj.getMinutes().toString().padStart(2, '0');
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #333';
        tr.innerHTML = `
            <td style="padding: 8px;">${timeStr}</td>
            <td style="padding: 8px;">${o.masa || '-'}</td>
            <td style="padding: 8px;">${o.product_name || o.urun || '?'}</td>
            <td style="padding: 8px; text-align: center;">${o.quantity || o.adet || 1}</td>
            <td style="padding: 8px; text-align: right; color:#2ecc71;">₺${lineTotal.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    if (staffOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:16px; text-align:center; color:#888;">Satış bulunamadı.</td></tr>';
    }
    
    totalEl.textContent = '₺' + total.toFixed(2);
    document.getElementById('staff-details-modal').style.display = 'flex';
}

document.getElementById('btn-close-staff-details').addEventListener('click', () => {
    document.getElementById('staff-details-modal').style.display = 'none';
});

// ========================
// UTILS
// ========================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
