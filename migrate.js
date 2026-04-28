const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306,
            database: process.env.DB_NAME || 'cafepos',
            multipleStatements: true
        });

        console.log('✅ Veritabanına bağlanıldı.');

        // order_items tablosuna not ve added_by kolonları ekle (varsa eklemez)
        const [cols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME IN ('note','added_by')
        `);
        const existingCols = cols.map(c => c.COLUMN_NAME);

        if (!existingCols.includes('note')) {
            await connection.query(`ALTER TABLE order_items ADD COLUMN note VARCHAR(255) DEFAULT NULL AFTER price_at_time`);
            console.log('✅ order_items.note kolonu eklendi.');
        } else {
            console.log('ℹ️  order_items.note zaten mevcut, atlandı.');
        }

        if (!existingCols.includes('added_by')) {
            await connection.query(`ALTER TABLE order_items ADD COLUMN added_by INT NULL AFTER note, ADD CONSTRAINT fk_oi_added_by FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL`);
            console.log('✅ order_items.added_by kolonu eklendi.');
        } else {
            console.log('ℹ️  order_items.added_by zaten mevcut, atlandı.');
        }

        // item_logs tablosu (Anlık ürün ekleme kayıtları)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS item_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_item_id INT NULL,
                table_id INT NOT NULL,
                user_id INT NOT NULL,
                product_id INT NULL,
                product_name VARCHAR(100) NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                price_at_time DECIMAL(10,2) NOT NULL,
                note VARCHAR(255) DEFAULT NULL,
                action ENUM('add', 'cancel', 'discount') DEFAULT 'add',
                logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4;
        `);

        // Eğer tablo varsa ama action kolonu yoksa veya eksikse düzelt
        const [logCols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_logs' AND COLUMN_NAME = 'action'
        `);
        
        if (logCols.length === 0) {
            await connection.query(`ALTER TABLE item_logs ADD COLUMN action ENUM('add', 'cancel', 'discount') DEFAULT 'add' AFTER note`);
            console.log('✅ item_logs.action kolonu eklendi.');
        } else {
            // Kolon var ama enum eksik olabilir diye güncelle
            await connection.query(`ALTER TABLE item_logs MODIFY COLUMN action ENUM('add', 'cancel', 'discount') DEFAULT 'add'`);
            console.log('✅ item_logs.action kolonu güncellendi.');
        }

        // product_id'yi NULL yapılabilir hale getir
        await connection.query(`ALTER TABLE item_logs MODIFY COLUMN product_id INT NULL`);
        
        console.log('✅ item_logs tablosu hazır.');

        console.log('\n🎉 Migrasyon tamamlandı! Sunucuyu yeniden başlatın: npm start');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration hatası:', err.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
