// Bellekte tutulacak geçici oturumlar (RAM dostu, JWT kullanmaya gerek yok)
// Key: Token String, Value: { id, username, role }
const activeSessions = new Map();

// Token kontrolü yapan ana ara yazılım(middleware)
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Oturum açmanız gerekiyor.' });
    }

    const token = authHeader.split(' ')[1]; // "Bearer TOKEN" formatında gelir
    const userSession = activeSessions.get(token);

    if (!userSession) {
        return res.status(403).json({ success: false, error: 'Oturumunuzun süresi dolmuş veya geçersiz jeton.' });
    }

    // İsteği yapan kullanıcıyı sonraki middleware'lere taşıyalım
    req.user = userSession;
    next();
}

// Sadece yöneticilerin geçebildiği kilit ara yazılım
function requireAdmin(req, res, next) {
    // Önce login olmuş mu kontrol et, olduysa role bak
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Oturum yok.' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Bu işlem için Yönetici(Admin) yetkisi gereklidir.' });
    }

    next();
}

module.exports = {
    activeSessions,
    requireAuth,
    requireAdmin
};
