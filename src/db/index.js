const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cafepos',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log(`[DB] Başarıyla MySQL veritabanına bağlanıldı (${process.env.DB_NAME})`);
        connection.release();
    } catch (error) {
        console.error('[DB] VERİTABANI BAĞLANTI HATASI:', error.message);
        console.error('[DB] Lütfen MySQL sunucusunun çalıştığından emin olun.');
    }
}

testDbConnection();

module.exports = pool;
