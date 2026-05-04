const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { hashPassword } = require('./auth');

// !!ÖNEMLİ!!
// Bu routera bağlı TÜM linklerin YETKİ ve ADMİN kontrolünden geçmesini sağlıyoruz
router.use(requireAuth); // Token'dan kullanıcıyı çıkar (req.user)
router.use(requireAdmin); // Çıkan kullanıcının 'admin' olup olmadığını denetle

// =======================
// PERSONEL (USERS) YÖNETİMİ
// =======================

router.get('/users', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Veritabanı hatası' });
    }
});

router.post('/users', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if(!username || !password || !role) return res.status(400).json({success: false, error: 'Eksik bilgi'});
        
        const hashedPw = hashPassword(password);
        await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPw, role]);
        res.json({ success: true });
    } catch (error) {
        if(error.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, error: 'Kullanıcı adı zaten var'});
        res.status(500).json({ success: false, error: 'Kayıt başarısız' });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        if (req.params.id == req.user.id) {
            return res.status(400).json({ success: false, error: 'Kendinizi silemezsiniz.' });
        }
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Silme başarısız' });
    }
});

// =======================
// MASA (TABLES) YÖNETİMİ
// =======================
router.post('/tables', async (req, res) => {
    try {
        const { table_name } = req.body;
        await pool.query('INSERT INTO tables (table_name) VALUES (?)', [table_name]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Masa eklenemedi' });
    }
});

router.delete('/tables/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM tables WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Masa silinemedi (Masada açık hesap olabilir)' });
    }
});

// =======================
// KATEGORİ VE ÜRÜNLER (MENU) YÖNETİMİ
// =======================
router.post('/categories', async (req, res) => {
    try {
        await pool.query('INSERT INTO categories (category_name) VALUES (?)', [req.body.category_name]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Kategori eklenemedi' });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        // Not: Eğer kategoride ürün varsa MySQL foreign key hatası verebilir (veya biz ürünleri de silmeliyiz)
        // Kullanıcı tüm kategoriyi silmek istiyorsa muhtemelen içindeki ürünleri de silmek istiyordur.
        // Ama raporlarda kullanılan ürünler varsa hata alabiliriz.
        await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Kategori silinemedi (Kategoriye bağlı ürünler veya eski satışlar olabilir)' });
    }
});

router.post('/products', async (req, res) => {
    try {
        const { category_id, product_name, price } = req.body;
        await pool.query('INSERT INTO products (category_id, product_name, price) VALUES (?, ?, ?)', [category_id, product_name, price]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ürün eklenemedi' });
    }
});

router.delete('/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ürün silinemedi (Eski raporlarda bulunuyor)' });
    }
});

router.put('/products/:id', async (req, res) => {
    try {
        const { product_name, price } = req.body;
        if (!product_name || !price) return res.status(400).json({ success: false, error: 'Eksik bilgi' });
        await pool.query('UPDATE products SET product_name = ?, price = ? WHERE id = ?', [product_name, parseFloat(price), req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ürün güncellenemedi' });
    }
});

// =======================
// RAPORLAR (REPORTS)
// =======================

router.get('/reports/staff', async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.username, 
                   COUNT(o.id) as order_count, 
                   SUM(o.total_price) as total_earned 
            FROM users u 
            LEFT JOIN orders o ON u.id = o.user_id AND o.status = "paid"
            WHERE u.role = 'staff' OR u.role = 'admin'
            GROUP BY u.id, u.username
            ORDER BY total_earned DESC
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Rapor alınamadı' });
    }
});

// Anlık Ürün Ekleme Logları (item_logs)
router.get('/reports/item-logs', async (req, res) => {
    try {
        const { start, end } = req.query;
        let startDate = start ? new Date(start) : new Date(new Date().setHours(0,0,0,0));
        let endDate = end ? new Date(end) : new Date(new Date().setHours(23,59,59,999));

        const [rows] = await pool.query(`
            SELECT 
                il.id,
                il.order_id as adisyon_no,
                t.table_name as masa,
                u.username as personel,
                il.product_name as urun,
                il.quantity as adet,
                il.price_at_time as fiyat,
                (il.quantity * il.price_at_time) as toplam,
                il.note as not_var,
                il.action as eylem,
                il.logged_at as tarih
            FROM item_logs il
            JOIN users u ON il.user_id = u.id
            JOIN tables t ON il.table_id = t.id
            WHERE il.logged_at BETWEEN ? AND ?
            ORDER BY il.logged_at DESC
        `, [startDate, endDate]);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Loglar alınamadı' });
    }
});

router.get('/reports/daily-summary', async (req, res) => {
    try {
        const { start, end } = req.query;
        // Eğer start,end yoksa bugünün başına sonuna al
        let startDate = start ? new Date(start) : new Date(new Date().setHours(0,0,0,0));
        let endDate = end ? new Date(end) : new Date(new Date().setHours(23,59,59,999));

        // 1. Ödeme Metodu Özetleri
        const [payments] = await pool.query(`
            SELECT payment_method, SUM(amount) as total 
            FROM payments p
            JOIN orders o ON p.order_id = o.id
            WHERE p.created_at BETWEEN ? AND ?
            GROUP BY payment_method
        `, [startDate, endDate]);

        let paySummary = { cash: 0, credit_card: 0, meal_card: 0, veresiye: 0, discount: 0, total: 0 };
        payments.forEach(p => {
            if(paySummary[p.payment_method] !== undefined) {
                paySummary[p.payment_method] = parseFloat(p.total);
                if(p.payment_method !== 'discount') paySummary.total += parseFloat(p.total);
            }
        });

        // 1b. İskonto tutarını orders tablosundan ayrıca çek
        // (iskontolar payments'a değil, orders.discount sütununa yazılıyor)
        const [discountRes] = await pool.query(`
            SELECT COALESCE(SUM(discount), 0) as total_discount
            FROM orders
            WHERE closed_at BETWEEN ? AND ? AND discount > 0
        `, [startDate, endDate]);
        paySummary.discount = parseFloat(discountRes[0].total_discount) || 0;

        // 2. Ürün Bazlı Satış Logları (hangi personel, ne zaman, hangi ürünü sattı)
        const [itemLogs] = await pool.query(`
            SELECT 
                o.id as adisyon_no,
                t.table_name as masa,
                COALESCE(u_item.username, u_order.username) as operator,
                p.product_name,
                c.category_name,
                oi.quantity,
                oi.price_at_time,
                (oi.quantity * oi.price_at_time) as line_total,
                o.closed_at as kapanis,
                (
                    SELECT GROUP_CONCAT(CONCAT(payment_method, ':', total_amt) SEPARATOR '|') 
                    FROM (
                        SELECT payment_method, SUM(amount) as total_amt, order_id 
                        FROM payments 
                        GROUP BY order_id, payment_method
                    ) p_agg 
                    WHERE p_agg.order_id = o.id
                ) as payment_details
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN tables t ON o.table_id = t.id
            JOIN users u_order ON o.user_id = u_order.id
            LEFT JOIN users u_item ON oi.added_by = u_item.id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE o.closed_at BETWEEN ? AND ?
            ORDER BY o.closed_at DESC, o.id ASC, oi.id ASC
        `, [startDate, endDate]);

        res.json({ success: true, summary: paySummary, orders: itemLogs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Rapor alınamadı' });
    }
});

router.get('/reports/daily-products', async (req, res) => {
    try {
        const { start, end } = req.query;
        let startDate = start ? new Date(start) : new Date(new Date().setHours(0,0,0,0));
        let endDate = end ? new Date(end) : new Date(new Date().setHours(23,59,59,999));

        const query = `
            SELECT c.category_name, p.id, p.product_name, SUM(oi.quantity) as total_quantity, SUM(oi.quantity * oi.price_at_time) as total_price
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE o.closed_at BETWEEN ? AND ?
            GROUP BY p.id, p.product_name, c.category_name
            ORDER BY total_quantity DESC
        `;
        const [rows] = await pool.query(query, [startDate, endDate]);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Rapor alınamadı' });
    }
});

router.get('/reports/revenue-trend', async (req, res) => {
    try {
        const { start, end, period } = req.query; // period: 'daily', 'weekly', 'monthly'
        let startDate = start ? new Date(start) : new Date(new Date().setHours(0,0,0,0));
        let endDate = end ? new Date(end) : new Date(new Date().setHours(23,59,59,999));
        
        let dateFormat = '%Y-%m-%d';
        if(period === 'monthly') dateFormat = '%Y-%m';
        else if(period === 'weekly') dateFormat = '%Y-%u'; // MySQL Year-Week

        const query = `
            SELECT DATE_FORMAT(created_at, ?) as date_label, SUM(amount) as total_revenue
            FROM payments
            WHERE created_at BETWEEN ? AND ? AND payment_method != 'discount'
            GROUP BY date_label
            ORDER BY date_label ASC
        `;
        
        const [rows] = await pool.query(query, [dateFormat, startDate, endDate]);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Trend raporu alınamadı' });
    }
});

module.exports = router;
