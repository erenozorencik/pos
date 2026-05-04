const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/authMiddleware');

// Tüm API (Pos) işlemleri için oturum şart!
router.use(requireAuth);

// =======================
// MASALAR API
// =======================

// Tüm masaları listele
router.get('/tables', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, 
                   (SELECT MAX(oi.created_at) 
                    FROM orders o 
                    JOIN order_items oi ON o.id = oi.order_id 
                    WHERE o.table_id = t.id AND o.status = 'open') as last_order_time,
                   (SELECT total_price FROM orders WHERE table_id = t.id AND status = 'open' LIMIT 1) as total_price,
                   (SELECT discount FROM orders WHERE table_id = t.id AND status = 'open' LIMIT 1) as discount,
                   (SELECT paid_amount FROM orders WHERE table_id = t.id AND status = 'open' LIMIT 1) as paid_amount
            FROM tables t 
            ORDER BY t.id ASC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('[API] GET /tables hatası:', error.message);
        res.status(500).json({ success: false, error: 'Veritabanı hatası' });
    }
});

// Masa durumunu güncelle
router.put('/tables/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const [result] = await pool.query('UPDATE tables SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true, affectedRows: result.affectedRows });
    } catch (error) {
        console.error('[API] PUT /tables/:id hatası:', error.message);
        res.status(500).json({ success: false, error: 'Veritabanı hatası' });
    }
});

// =======================
// MENÜ API (Kategoriler & Ürünler)
// =======================

// Kategorileri ve ürünleri getir (Örn: menü ekranı için tek sorguda rahatlık)
router.get('/menu', async (req, res) => {
    try {
        const [categories] = await pool.query('SELECT * FROM categories ORDER BY id ASC');
        const [products] = await pool.query('SELECT * FROM products ORDER BY category_id, id ASC');
        
        // Frontend'de rahat kullanım için ürünleri kategorilere yerleştirelim
        const menu = categories.map(cat => {
            return {
                ...cat,
                products: products.filter(p => p.category_id === cat.id)
            };
        });
        res.json({ success: true, data: menu });
    } catch (error) {
        console.error('[API] GET /menu hatası:', error.message);
        res.status(500).json({ success: false, error: 'Veritabanı hatası' });
    }
});

// =======================
// SİPARİŞ API
// =======================

// Masanın aktif siparişini (adisyonunu) getir
router.get('/orders/active/:table_id', async (req, res) => {
    try {
        const { table_id } = req.params;
        const [orders] = await pool.query(`
            SELECT o.*, 
                   COALESCE((SELECT SUM(amount) FROM payments WHERE order_id = o.id), 0) as paid_amount
            FROM orders o
            WHERE o.table_id = ? AND o.status = "open"
            ORDER BY o.id DESC LIMIT 1
        `, [table_id]);
        
        if (orders.length === 0) {
            return res.json({ success: true, data: null }); // Aktif sipariş yok
        }
        
        const order = orders[0];
        // Sipariş kalemlerini getir
        const [items] = await pool.query(`
            SELECT oi.*, p.product_name, oi.note
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
            ORDER BY oi.id ASC
        `, [order.id]);
        
        order.items = items;
        res.json({ success: true, data: order });
    } catch (error) {
        console.error('[API] GET /orders/active/:table_id hatası:', error.message);
        res.status(500).json({ success: false, error: 'Veritabanı hatası' });
    }
});

// Yeni sipariş oluştur (Hesap aç)
router.post('/orders', async (req, res) => {
    const connection = await pool.getConnection(); // Transaction için tek bağlantı
    try {
        const { table_id, user_id = 1 } = req.body; // user_id şimdilik varsayılan 1 (Admin/Staff)
        
        await connection.beginTransaction();
        
        // Önce masanın durumunu 'occupied' (dolu) yapalım
        await connection.query('UPDATE tables SET status = "occupied" WHERE id = ?', [table_id]);
        
        // Yeni order başlatalım (req.user artık middleware'den geliyor)
        const [result] = await connection.query('INSERT INTO orders (table_id, user_id, status) VALUES (?, ?, "open")', [table_id, req.user.id]);
        const orderId = result.insertId;
        
        await connection.commit();
        res.json({ success: true, order_id: orderId });
    } catch (error) {
        await connection.rollback();
        console.error('[API] POST /orders hatası:', error.message);
        res.status(500).json({ success: false, error: 'Veritabanı hatası' });
    } finally {
        connection.release();
    }
});

// Adisyona ürün ekle
router.post('/orders/:order_id/items', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { order_id } = req.params;
        const { product_id, quantity, note } = req.body;
        const added_by_user = req.user ? req.user.id : null;
        const itemNote = note && note.trim() ? note.trim() : null;
        
        await connection.beginTransaction();
        
        // Sipariş bilgisini al (table_id için)
        const [orderRows] = await connection.query('SELECT table_id FROM orders WHERE id = ?', [order_id]);
        if (orderRows.length === 0) throw new Error('Sipariş bulunamadı');
        const table_id = orderRows[0].table_id;

        const [tableRows] = await connection.query('SELECT table_name FROM tables WHERE id = ?', [table_id]);
        const tableName = tableRows.length > 0 ? tableRows[0].table_name : 'Masa ' + table_id;
        
        let addedByName = 'Sistem';
        if (added_by_user) {
            const [userRows] = await connection.query('SELECT username FROM users WHERE id = ?', [added_by_user]);
            if (userRows.length > 0) addedByName = userRows[0].username;
        }

        // Ürünün anlık fiyat ve adını bul
        const [products] = await connection.query('SELECT price, product_name FROM products WHERE id = ?', [product_id]);
        if (products.length === 0) throw new Error("Ürün bulunamadı");
        const price_at_time = products[0].price;
        const product_name = products[0].product_name;

        let order_item_id;
        
        // Not yoksa aynı product'ı birleştir, not varsa her zaman yeni satır ekle
        if (!itemNote) {
            const [existing] = await connection.query(
                'SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ? AND (note IS NULL OR note = "")',
                [order_id, product_id]
            );
            if (existing.length > 0) {
                await connection.query('UPDATE order_items SET quantity = quantity + ?, added_by = ? WHERE id = ?', [quantity, added_by_user, existing[0].id]);
                order_item_id = existing[0].id;
            } else {
                const [ins] = await connection.query(
                    'INSERT INTO order_items (order_id, product_id, quantity, price_at_time, note, added_by) VALUES (?, ?, ?, ?, NULL, ?)',
                    [order_id, product_id, quantity, price_at_time, added_by_user]
                );
                order_item_id = ins.insertId;
            }
        } else {
            // Notlu ürün: her zaman yeni satır
            const [ins] = await connection.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price_at_time, note, added_by) VALUES (?, ?, ?, ?, ?, ?)',
                [order_id, product_id, quantity, price_at_time, itemNote, added_by_user]
            );
            order_item_id = ins.insertId;
        }

        // Toplam tutarı güncelle
        const [totalRes] = await connection.query('SELECT SUM(quantity * price_at_time) as total FROM order_items WHERE order_id = ?', [order_id]);
        const newTotal = totalRes[0].total || 0;
        await connection.query('UPDATE orders SET total_price = ? WHERE id = ?', [newTotal, order_id]);

        // Anlık Kayıt – item_logs (Personel takibi için, ödeme beklemeden)
        await connection.query(
            'INSERT INTO item_logs (order_id, order_item_id, table_id, user_id, product_id, product_name, quantity, price_at_time, note, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [order_id, order_item_id, table_id, added_by_user, product_id, product_name, quantity, price_at_time, itemNote, 'add']
        );
        
        await connection.commit();

        // NOT: Fiş yazdırma artık tek tek değil, toplu olarak /orders/:id/print-slip endpoint'i ile yapılıyor.

        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('[API] POST /orders/.../items hatası:', error.message);
        res.status(500).json({ success: false, error: error.message || 'Veritabanı hatası' });
    } finally {
        connection.release();
    }
});

// Toplu Fiş Yazdırma (Sepetteki tüm ürünler tek fiş)
router.post('/orders/:order_id/print-slip', async (req, res) => {
    try {
        const { order_id } = req.params;
        const { items } = req.body; // [{product_name, quantity, note}]
        const user_id = req.user ? req.user.id : null;

        // Masa ve personel bilgisi
        const [orderRows] = await pool.query('SELECT table_id FROM orders WHERE id = ?', [order_id]);
        if (orderRows.length === 0) return res.json({ success: false, error: 'Sipariş bulunamadı' });
        const table_id = orderRows[0].table_id;

        const [tableRows] = await pool.query('SELECT table_name FROM tables WHERE id = ?', [table_id]);
        const tableName = tableRows.length > 0 ? tableRows[0].table_name : 'Masa ' + table_id;

        let addedByName = 'Sistem';
        if (user_id) {
            const [userRows] = await pool.query('SELECT username FROM users WHERE id = ?', [user_id]);
            if (userRows.length > 0) addedByName = userRows[0].username;
        }

        // Fiş Yazdır (Arka planda)
        const { printOrderSlip } = require('../services/printer');
        printOrderSlip(order_id, tableName, addedByName, items).catch(err => console.error("Arkaplan yazdırma hatası:", err));

        res.json({ success: true });
    } catch (error) {
        console.error('[API] print-slip hatası:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Hesap Pusulası Yazdırma (Ödeme ekranından)
router.post('/orders/:order_id/print-bill', async (req, res) => {
    try {
        const { order_id } = req.params;
        const user_id = req.user ? req.user.id : null;

        // Sipariş ve masa bilgisini çek
        const [orderRows] = await pool.query(`
            SELECT o.*, t.table_name 
            FROM orders o 
            JOIN tables t ON o.table_id = t.id 
            WHERE o.id = ?
        `, [order_id]);
        
        if (orderRows.length === 0) return res.json({ success: false, error: 'Sipariş bulunamadı' });
        
        const order = orderRows[0];
        const tableName = order.table_name;
        
        // Ürünleri çek
        const [items] = await pool.query(`
            SELECT p.product_name, oi.quantity, oi.price_at_time as price
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [order_id]);

        let addedByName = 'Sistem';
        if (user_id) {
            const [userRows] = await pool.query('SELECT username FROM users WHERE id = ?', [user_id]);
            if (userRows.length > 0) addedByName = userRows[0].username;
        }

        const totals = {
            total_price: parseFloat(order.total_price || 0),
            discount: parseFloat(order.discount || 0),
            paid_amount: parseFloat(order.paid_amount || 0)
        };

        // Fiş Yazdır (Arka planda)
        const { printBillSlip } = require('../services/printer');
        printBillSlip(order_id, tableName, addedByName, items, totals).catch(err => console.error("Arkaplan yazdırma hatası:", err));

        res.json({ success: true });
    } catch (error) {
        console.error('[API] print-bill hatası:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Adisyondan ürün sil
router.delete('/orders/:order_id/items/:item_id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { order_id, item_id } = req.params;
        const { quantity } = req.body; // Kaç adet silinecek (opsiyonel, yoksa tamamı)

        await connection.beginTransaction();

        const [items] = await connection.query(
            'SELECT oi.*, p.product_name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.id = ? AND oi.order_id = ?',
            [item_id, order_id]
        );
        if (items.length === 0) throw new Error('Ürün bulunamadı');

        const item = items[0];
        const deleteQty = quantity && parseInt(quantity) > 0 ? parseInt(quantity) : item.quantity;

        if (deleteQty >= item.quantity) {
            // Tamamını sil
            await connection.query('DELETE FROM order_items WHERE id = ?', [item_id]);
        } else {
            // Kısmını sil
            await connection.query('UPDATE order_items SET quantity = quantity - ? WHERE id = ?', [deleteQty, item_id]);
        }

        // Toplam tutarı yeniden hesapla
        const [totalRes] = await connection.query('SELECT SUM(quantity * price_at_time) as total FROM order_items WHERE order_id = ?', [order_id]);
        const newTotal = totalRes[0].total || 0;
        await connection.query('UPDATE orders SET total_price = ? WHERE id = ?', [newTotal, order_id]);

        // İptal kaydı – item_logs
        const [orderInfo] = await connection.query('SELECT table_id FROM orders WHERE id = ?', [order_id]);
        if(orderInfo.length > 0) {
            const cancelled_by = req.user ? req.user.id : null;
            await connection.query(
                'INSERT INTO item_logs (order_id, table_id, user_id, product_id, product_name, quantity, price_at_time, note, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [order_id, orderInfo[0].table_id, cancelled_by, item.product_id, item.product_name || '?', deleteQty, item.price_at_time, item.note || null, 'cancel']
            );
        }

        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, error: error.message || 'Silme başarısız' });
    } finally {
        connection.release();
    }
});

// İskonto Uygulama (İndirim)
router.post('/orders/:order_id/discount', async (req, res) => {
    try {
        let { discount } = req.body;
        // Virgüllü girişi noktaya çevir
        if (typeof discount === 'string') discount = discount.replace(',', '.');
        const dsc = parseFloat(discount) || 0;
        const order_id = req.params.order_id;

        console.log(`[API] İskonto Uygulanıyor: Sipariş #${order_id}, Tutar: ${dsc}`);

        // 1. İskontoyu mutlaka kaydet
        await pool.query('UPDATE orders SET discount = ? WHERE id = ?', [dsc, order_id]);

        // 2. Log kaydını ayrı bir blokta yap (hata alsa bile üstteki işlemi bozmasın)
        try {
            const [orderRows] = await pool.query('SELECT table_id FROM orders WHERE id = ?', [order_id]);
            if (orderRows.length > 0) {
                const table_id = orderRows[0].table_id;
                const user_id = req.user ? req.user.id : null;
                await pool.query(
                    'INSERT INTO item_logs (order_id, table_id, user_id, product_id, product_name, quantity, price_at_time, note, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [order_id, table_id, user_id, 0, 'İSKONTO', 1, -dsc, `Adisyon #${order_id} için ₺${dsc.toFixed(2)} iskonto uygulandı`, 'discount']
                );
            }
        } catch (logErr) {
            console.error('[API] İskonto logu kaydedilemedi (ama iskonto uygulandı):', logErr.message);
        }

        res.json({ success: true, discount: dsc });
    } catch(err) {
        console.error('[API] İskonto hatası:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Siparişi Öde / Kapat (GELİŞMİŞ PARÇALI ÖDEME TAAHHÜDÜ)
router.post('/orders/:order_id/pay', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { order_id } = req.params;
        const { amount, payment_method, customer_id, paid_items } = req.body;
        
        const payAmount = parseFloat(amount);
        if(!payAmount || payAmount <= 0) throw new Error("Geçersiz ödeme tutarı");
        if(!payment_method) throw new Error("Ödeme yöntemi seçilmedi");
        
        await connection.beginTransaction();
        
        const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [order_id]);
        if (orders.length === 0) throw new Error("Sipariş bulunamadı");
        const order = orders[0];
        const table_id = order.table_id;
        
        // 1. Ödeme kaydını ekle
        await connection.query('INSERT INTO payments (order_id, amount, payment_method, customer_id) VALUES (?, ?, ?, ?)',
            [order_id, payAmount, payment_method, customer_id || null]);
            
        // 2. Eğer kısmi ürünler tıklandıysa paid_quantity güncelle
        if (paid_items && Array.isArray(paid_items) && paid_items.length > 0) {
            for (let item of paid_items) {
                await connection.query('UPDATE order_items SET paid_quantity = paid_quantity + ? WHERE id = ?', [item.paid_qty, item.id]);
            }
        }
        
        // 3. Veresiye ise müşteriye borç yaz
        if (payment_method === 'veresiye') {
            if (!customer_id) throw new Error('Veresiye işlemleri için müşteri seçilmesi zorunludur.');
            await connection.query('UPDATE customers SET balance = balance + ? WHERE id = ?', [payAmount, customer_id]);
            
            let fullDesc = `Adisyon #${order_id}`;
            
            if (paid_items && Array.isArray(paid_items) && paid_items.length > 0) {
                const itemDescs = [];
                for (let item of paid_items) {
                    const [pNameRow] = await connection.query('SELECT p.product_name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.id = ?', [item.id]);
                    if (pNameRow.length > 0) {
                        itemDescs.push(`${pNameRow[0].product_name} (x${item.paid_qty})`);
                    }
                }
                if (itemDescs.length > 0) fullDesc += `: ${itemDescs.join(', ')}`;
            } else {
                const [itemRows] = await connection.query(`
                    SELECT p.product_name, (oi.quantity - oi.paid_quantity) as remaining_qty
                    FROM order_items oi 
                    JOIN products p ON oi.product_id = p.id 
                    WHERE oi.order_id = ? AND (oi.quantity - oi.paid_quantity) > 0
                `, [order_id]);
                
                if (itemRows.length > 0) {
                    const itemsDesc = itemRows.map(row => `${row.product_name} (x${row.remaining_qty})`).join(', ');
                    fullDesc += `: ${itemsDesc}`;
                }
            }
            
            if(fullDesc.length > 250) fullDesc = fullDesc.substring(0, 247) + '...';

            await connection.query('INSERT INTO customer_transactions (customer_id, type, amount, description) VALUES (?, "debt", ?, ?)',
                [customer_id, payAmount, fullDesc]);
        }
        
        // 4. Kalan borcu hesapla
        // Tüm geçmiş ödemeleri topla
        const [payRes] = await connection.query('SELECT SUM(amount) as total_paid FROM payments WHERE order_id = ?', [order_id]);
        const total_paid = payRes[0].total_paid || 0;
        
        const remaining = (order.total_price - order.discount) - total_paid;
        
        // 5. Sipariş bitti mi?
        if (remaining <= 0.01) { // Floating point toleransı
            await connection.query('UPDATE orders SET status = ?, closed_at = NOW(), paid_amount = ? WHERE id = ?', [
                (payment_method === 'veresiye' ? 'credit' : 'paid'), 
                total_paid, 
                order_id
            ]);
            await connection.query('UPDATE tables SET status = "empty" WHERE id = ?', [table_id]);
            await connection.commit();
            res.json({ success: true, closed: true, total_paid, remaining: 0 });
        } else {
            // Sadece ödemeyi işle, masa açık kalır
            await connection.query('UPDATE orders SET paid_amount = ? WHERE id = ?', [total_paid, order_id]);
            await connection.commit();
            res.json({ success: true, closed: false, total_paid, remaining });
        }
    } catch (error) {
        await connection.rollback();
        console.error('[API] POST /orders/.../pay hatası:', error.message);
        res.status(500).json({ success: false, error: error.message || 'Veritabanı hatası' });
    } finally {
        connection.release();
    }
});

// Yanlışlıkla açılan boş masayı kapatma
router.delete('/orders/:order_id/cancel-empty', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { order_id } = req.params;
        await connection.beginTransaction();

        // Ürün veya ödeme var mı kontrol et
        const [items] = await connection.query('SELECT count(*) as c FROM order_items WHERE order_id = ?', [order_id]);
        const [payments] = await connection.query('SELECT count(*) as c FROM payments WHERE order_id = ?', [order_id]);

        if (items[0].c > 0 || payments[0].c > 0) {
            throw new Error("Masa boş değil, ürün veya ödeme içeriyor.");
        }

        const [order] = await connection.query('SELECT table_id FROM orders WHERE id = ?', [order_id]);
        if (order.length > 0) {
            await connection.query('DELETE FROM orders WHERE id = ?', [order_id]);
            await connection.query('UPDATE tables SET status = "empty" WHERE id = ?', [order[0].table_id]);
        }

        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('[API] /cancel-empty hatası:', error.message);
        res.status(400).json({ success: false, error: error.message || 'Masa kapatılamadı' });
    } finally {
        connection.release();
    }
});

// Masa Taşıma (Table Transfer)
router.post('/orders/:order_id/transfer', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { order_id } = req.params;
        const { target_table_id } = req.body;
        
        await connection.beginTransaction();
        
        const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [order_id]);
        if (orders.length === 0) throw new Error("Sipariş bulunamadı");
        
        const old_table_id = orders[0].table_id;
        
        // Hedef masa kontrolü
        const [targetTableInfo] = await connection.query('SELECT status FROM tables WHERE id = ?', [target_table_id]);
        if(targetTableInfo.length === 0) throw new Error("Hedef masa bulunamadı");
        if(targetTableInfo[0].status !== 'empty') throw new Error("Hedef masa dolu. Sadece boş masalara taşıma yapılabilir.");
        
        // 1. Yeni masayı 'occupied' yap
        await connection.query('UPDATE tables SET status = "occupied" WHERE id = ?', [target_table_id]);
        // 2. Siparişi yeni masaya geçir
        await connection.query('UPDATE orders SET table_id = ? WHERE id = ?', [target_table_id, order_id]);
        // 3. Eski masayı 'empty' yap
        await connection.query('UPDATE tables SET status = "empty" WHERE id = ?', [old_table_id]);
        
        await connection.commit();
        res.json({ success: true, message: 'Masa başarıyla taşındı' });
    } catch (error) {
        await connection.rollback();
        console.error('[API] POST /orders/transfer hatası:', error.message);
        res.status(500).json({ success: false, error: error.message || 'Veritabanı hatası' });
    } finally {
        connection.release();
    }
});

// Masalar Arası Ürün Taşıma (Item Transfer)
router.post('/orders/:order_id/items/transfer', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { order_id } = req.params;
        const { target_table_id, items_to_transfer } = req.body;
        
        await connection.beginTransaction();
        
        // 1. Orijinal siparişi al
        const [sourceOrders] = await connection.query('SELECT * FROM orders WHERE id = ? AND status = "open"', [order_id]);
        if (sourceOrders.length === 0) throw new Error("Açık kaynak siparişi bulunamadı");
        const sourceOrder = sourceOrders[0];

        // Gelen öğeleri ID bazında grupla (UI unstacked olduğu için birden fazla qty=1 gelebilir)
        const transferGroups = {};
        for(let item of items_to_transfer) {
            if(!transferGroups[item.id]) transferGroups[item.id] = {id: item.id, qty: 0};
            transferGroups[item.id].qty += item.paid_qty;
        }

        // 2. Hedef masada açık sipariş var mı kontrol et, yoksa oluştur
        let target_order_id = null;
        const [targetOrders] = await connection.query('SELECT id FROM orders WHERE table_id = ? AND status = "open"', [target_table_id]);
        
        if (targetOrders.length > 0) {
            target_order_id = targetOrders[0].id;
        } else {
            const [newOrder] = await connection.query('INSERT INTO orders (table_id, user_id, total_price) VALUES (?, ?, 0)', [target_table_id, req.user.id]);
            target_order_id = newOrder.insertId;
            await connection.query('UPDATE tables SET status = "occupied" WHERE id = ?', [target_table_id]);
        }

        let totalTransferValue = 0;

        // 3. Ürünleri taşı
        for (let itemId in transferGroups) {
            const { id: source_item_id, qty: transfer_qty } = transferGroups[itemId];
            
            // Kaynak order_item'ı bul
            const [srcItems] = await connection.query('SELECT * FROM order_items WHERE id = ? AND order_id = ?', [source_item_id, order_id]);
            if(srcItems.length === 0) continue;
            const srcItem = srcItems[0];
            
            if (srcItem.quantity < transfer_qty) throw new Error("Taşınmak istenen miktar stoktan fazla");

            const itemTransferValue = transfer_qty * srcItem.price_at_time;
            totalTransferValue += itemTransferValue;

            // Kaynak item miktarını azalt
            if (srcItem.quantity === transfer_qty) {
                // Tamamı taşınıyor, sil
                await connection.query('DELETE FROM order_items WHERE id = ?', [source_item_id]);
            } else {
                // Kısmi taşıma
                await connection.query('UPDATE order_items SET quantity = quantity - ? WHERE id = ?', [transfer_qty, source_item_id]);
            }

            // Hedef siparişe item ekle (Aynı product ve price_at_time varsa birleştirilebilir, ama basitlik için yeni insert)
            // Var mı kontrol edelim:
            const [existingTargetItems] = await connection.query('SELECT id FROM order_items WHERE order_id = ? AND product_id = ? AND price_at_time = ?', [target_order_id, srcItem.product_id, srcItem.price_at_time]);
            if (existingTargetItems.length > 0) {
                await connection.query('UPDATE order_items SET quantity = quantity + ? WHERE id = ?', [transfer_qty, existingTargetItems[0].id]);
            } else {
                await connection.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)', [target_order_id, srcItem.product_id, transfer_qty, srcItem.price_at_time]);
            }
        }

        // 4. Sipariş Total Fiyatlarını Güncelle
        await connection.query('UPDATE orders SET total_price = total_price - ? WHERE id = ?', [totalTransferValue, order_id]);
        await connection.query('UPDATE orders SET total_price = total_price + ? WHERE id = ?', [totalTransferValue, target_order_id]);

        // 5. Kaynak siparişin içi tamamen boşaldıysa eski siparişi kapat & masayı empty yap
        const [remainingItems] = await connection.query('SELECT SUM(quantity) as t_qty FROM order_items WHERE order_id = ?', [order_id]);
        if (!remainingItems[0].t_qty || remainingItems[0].t_qty <= 0) {
            await connection.query('UPDATE orders SET status = "paid", closed_at = NOW() WHERE id = ?', [order_id]);
            await connection.query('UPDATE tables SET status = "empty" WHERE id = ?', [sourceOrder.table_id]);
        }

        await connection.commit();
        res.json({ success: true, message: 'Ürünler başarıyla taşındı' });
    } catch (error) {
        await connection.rollback();
        console.error('[API] POST /items/transfer hatası:', error.message);
        res.status(500).json({ success: false, error: error.message || 'Veritabanı hatası' });
    } finally {
        connection.release();
    }
});

// =======================
// MÜŞTERİ (CARİ) TAKİP API
// =======================

router.get('/customers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Müşteriler çekilemedi' });
    }
});

router.post('/customers', async (req, res) => {
    try {
        const { name, phone } = req.body;
        if(!name) return res.status(400).json({success: false, error: 'İsim gerekli'});
        await pool.query('INSERT INTO customers (name, phone) VALUES (?, ?)', [name, phone]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Müşteri eklenemedi' });
    }
});

// Borç TahsilEtme (Ödeme Alma)
router.post('/customers/:id/pay', async (req, res) => {
    try {
        const { amount } = req.body; // Alınan para
        const amountNum = parseFloat(amount);
        if(!amountNum || amountNum <= 0) throw new Error('Geçersiz tahsilat tutarı');
        
        // Bakiyeden düş
        await pool.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [amountNum, req.params.id]);
        
        // İşlem geçmişine (log) kaydet
        await pool.query('INSERT INTO customer_transactions (customer_id, type, amount, description) VALUES (?, "payment", ?, "Tahsilat Alındı (Nakit/Kart)")', [req.params.id, amountNum]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Tahsilat başarısız' });
    }
});

// Müşteri İşlem Geçmişi (Cari Logları)
router.get('/customers/:id/transactions', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'İşlem geçmişi çekilemedi' });
    }
});

module.exports = router;
