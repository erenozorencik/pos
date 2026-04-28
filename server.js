require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Minimal middleware'ler
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = require('./src/db');

// Global Exception Handler (Çökmeleri engellemek için)
process.on('uncaughtException', (err) => {
    console.error('[PM2/CRASH] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[PM2/CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
});


// Routers
const authRouter = require('./src/routes/auth').router;
const adminRoutes = require('./src/routes/admin');
const apiRoutes = require('./src/routes/api');

// API Yönlendirmeleri
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);

// Sağlık kontrolü (Sunucu ve DB)
app.get('/api/health', async (req, res) => {
    try {
         await pool.query('SELECT 1');
         res.json({ status: 'ok', message: 'Sistem sağlıklı, DB bağlı.' });
    } catch (error) {
         res.status(500).json({ status: 'error', message: 'Sunucu çalışıyor ama DB bağlantısı yok.', error: error.message });
    }
});

// Sunucuyu 0.0.0.0 (Tüm ağ arayüzlerinde) başlatıyoruz ki LAN'daki diğer (garson) cihazlar erişebilsin
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log(`🚀 Cafe POS Server Başlatıldı`);
    console.log(`🌐 Dinlenen Ağ: 0.0.0.0 (Tüm yerel IP'ler)`);
    console.log(`🎯 Port: ${PORT}`);
    console.log('='.repeat(50));
});

module.exports = app;
