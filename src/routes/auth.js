const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { activeSessions, requireAuth } = require('../middleware/authMiddleware');

// Sabit şifreleme tuz değeri (Basit projeler için yeterlidir)
const SCYPT_SALT = 'CafePosSecureSaltXYZ';

function hashPassword(password) {
    return crypto.scryptSync(password, SCYPT_SALT, 64).toString('hex');
}

// Güvenli rastgele Session Token oluşturucu
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 1. GİRİŞ YAP (Login)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Kullanıcı adı ve şifre zorunludur.' });
        }

        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Kullanıcı adı hatalı.' });
        }

        const user = users[0];
        const attemptHash = hashPassword(password);
        
        // --- GEÇİCİ BİR İLK KURULUM KOLAYLIĞI ---
        // Eğer veritabanındaki şifre "1234" veya "hashed_password_..." kalıntısı ise onu hashleyelim.
        if ((user.password === '1234' || user.password === 'hashed_password_buraya_gelecek') && password === '1234') {
            await pool.query('UPDATE users SET password = ? WHERE id = ?', [attemptHash, user.id]);
        } else if (user.password !== attemptHash) {
            return res.status(401).json({ success: false, error: 'Şifre hatalı.' });
        }
        // ----------------------------------------

        // Giriş geçerli, Token oluştur
        const token = generateToken();
        
        const sessionData = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        
        // RAM'de oturumu kaydet
        activeSessions.set(token, sessionData);

        res.json({
            success: true,
            message: 'Giriş başarılı',
            token: token,
            user: sessionData
        });

    } catch (error) {
        console.error('[API] /login Hatası:', error.message);
        res.status(500).json({ success: false, error: 'Giriş yapılırken sunucu hatası oluştu.' });
    }
});

// 2. ÇIKIŞ YAP (Logout)
router.post('/logout', requireAuth, (req, res) => {
    // Gelen token'ı bulup RAM'den siliyoruz
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        activeSessions.delete(token);
    }
    
    res.json({ success: true, message: 'Çıkış yapıldı' });
});

// 3. Personel Listesini Getir (Hızlı Geçiş İçin)
router.get('/quick-users', requireAuth, async (req, res) => {
    try {
        // Sadece admin olmayan personelleri getir
        const [users] = await pool.query('SELECT id, username, role FROM users WHERE role != "admin"');
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('[API] /quick-users Hatası:', error.message);
        res.status(500).json({ success: false, error: 'Personel listesi alınamadı.' });
    }
});

// 4. Hızlı Personel Geçişi (Şifresiz, sadece önceden giriş yapılmışsa)
router.post('/quick-login', requireAuth, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ success: false, error: 'Kullanıcı adı zorunludur.' });
        }

        // Sadece admin olmayan kullanıcılar hızlı giriş yapabilir
        const [users] = await pool.query('SELECT * FROM users WHERE username = ? AND role != "admin"', [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Geçersiz personel.' });
        }

        const user = users[0];

        // Giriş geçerli, Token oluştur
        const token = generateToken();
        
        const sessionData = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        
        // RAM'de oturumu kaydet
        activeSessions.set(token, sessionData);

        res.json({
            success: true,
            message: 'Hızlı giriş başarılı',
            token: token,
            user: sessionData
        });

    } catch (error) {
        console.error('[API] /quick-login Hatası:', error.message);
        res.status(500).json({ success: false, error: 'Giriş yapılırken sunucu hatası oluştu.' });
    }
});

module.exports = { router, hashPassword };
