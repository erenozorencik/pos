const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
    try {
        console.log("🛠️ Veritabanı kurulumu başlatılıyor...");
        
        // Veritabanı adı olmadan sadece sunucuya bağlanıyoruz (Çünkü henüz cafepos db'si yok)
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306,
            multipleStatements: true // Birden fazla SQL komutunu aynı anda çalıştırabilmek için
        });
        
        console.log("✅ MySQL Sunucusuna bağlanıldı.");
        
        const schemaPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        
        console.log("⏳ schema.sql içeriği yükleniyor, lütfen bekleyin...");
        
        // SQL dosyasını çalıştır
        await connection.query(sql);
        
        console.log("🎉 HARİKA! Veritabanı ve tüm tablolar başarıyla oluşturuldu.");
        
        await connection.end();
        console.log("👉 Artık sunucuyu başlatmak için şu komutu rastgelebilirsiniz: npm start");
        process.exit(0);
        
    } catch (error) {
        console.error("❌ HATA OLUŞTU:", error.message);
        console.log("Not: Lütfen DBngin'de Start butonuna basıp veritabanının çalıştığından emin olun.");
        process.exit(1);
    }
}

setup();
