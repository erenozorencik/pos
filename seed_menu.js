require('dotenv').config();
const mysql = require('mysql2/promise');

const menuData = [
    {
        category: "KAMPANYALAR",
        products: []
    },
    {
        category: "PIZZA ÇEŞITLERI",
        products: [
            { name: "Old City Pizza", price: 400.00 },
            { name: "Pizza Acılı Piliç", price: 330.00 },
            { name: "Pizza Akdeniz", price: 300.00 },
            { name: "Pizza Dört Peynirli", price: 350.00 },
            { name: "Pizza Kavurmalı", price: 400.00 },
            { name: "Pizza Margarita", price: 270.00 },
            { name: "Pizza Mix", price: 310.00 },
            { name: "Pizza Ton Balıklı", price: 280.00 }
        ]
    },
    {
        category: "APERATIFLER",
        products: [
            { name: "Chicken Fingers", price: 200.00 },
            { name: "Elma Dilim Patates", price: 170.00 },
            { name: "Parmak Dilim Patates", price: 170.00 },
            { name: "Soğan Halkası", price: 190.00 },
            { name: "Sosis Tava", price: 190.00 },
            { name: "Special Aperatif Tabağı", price: 300.00 }
        ]
    },
    {
        category: "BEYAZ ET",
        products: [
            { name: "İspanyol Tavuk", price: 320.00 },
            { name: "Köri Soslu Tavuk Izgara", price: 300.00 },
            { name: "Kremalı Mantarlı Tavuk", price: 300.00 },
            { name: "Meksikan Tavuk", price: 300.00 },
            { name: "Şefin Soslu Tavuğu", price: 300.00 },
            { name: "Tavuk Fajita", price: 300.00 },
            { name: "Tikka Masala Soslu Tavuk", price: 300.00 }
        ]
    },
    {
        category: "BURGERLER",
        products: [
            { name: "Cheeseburger", price: 270.00 },
            { name: "Chicken Burger", price: 250.00 },
            { name: "Double Burger", price: 350.00 },
            { name: "Hamburger", price: 260.00 },
            { name: "Steak Cheeseburger", price: 380.00 }
        ]
    },
    {
        category: "GÖZLEME ÇEŞITLERI",
        products: [
            { name: "Anadolu Gözleme", price: 250.00 },
            { name: "Beyaz Peynirli Domatesli Gözleme", price: 200.00 },
            { name: "Beyaz Peynirli Gözleme", price: 180.00 },
            { name: "Kaşarlı Gözleme", price: 185.00 },
            { name: "Kıymalı Gözleme", price: 230.00 },
            { name: "Patatesli Gözleme", price: 180.00 },
            { name: "Patatesli Kaşarlı Gözleme", price: 190.00 },
            { name: "Sigara Böreği", price: 220.00 },
            { name: "Sucuklu Gözleme", price: 190.00 },
            { name: "Sucuklu Kaşarlı Gözleme", price: 200.00 }
        ]
    },
    {
        category: "SALATALAR",
        products: [
            { name: "Izgara Hellim Salata", price: 240.00 },
            { name: "Izgara Tavuklu Sezar Salata", price: 240.00 },
            { name: "Peynirli Ege Salata", price: 220.00 },
            { name: "Ton Balıklı Salata", price: 240.00 }
        ]
    },
    {
        category: "MENEMEN VE SAHAN ÇEŞITLERI",
        products: [
            { name: "Karışık Menemen", price: 200.00 },
            { name: "Kaşarlı Menemen", price: 170.00 },
            { name: "Sade Menemen", price: 165.00 },
            { name: "Sahanda Kaşarlı Yumurta", price: 220.00 },
            { name: "Sahanda Kavurmalı Yumurta", price: 250.00 },
            { name: "Sahanda Kıymalı Yumurta", price: 250.00 },
            { name: "Sahanda Sade Yumurta", price: 165.00 },
            { name: "Sahanda Sucuk", price: 200.00 },
            { name: "Sahanda Sucuklu Yumurta", price: 220.00 },
            { name: "Sucuklu Menemen", price: 180.00 }
        ]
    },
    {
        category: "WRAP ÇEŞITLERI",
        products: [
            { name: "Et Wrap", price: 350.00 },
            { name: "Köfte Wrap", price: 350.00 },
            { name: "Sebzeli Wrap", price: 250.00 },
            { name: "Tavuk Wrap", price: 280.00 }
        ]
    },
    {
        category: "MAKARNALAR",
        products: [
            { name: "Chicken Fettucini", price: 225.00 },
            { name: "Penne Arabiata", price: 200.00 },
            { name: "Spagetti Alfredo", price: 225.00 },
            { name: "Spagetti Bolonez", price: 220.00 },
            { name: "Spaghetti Napolitan", price: 200.00 },
            { name: "Tavuklu Mantarlı Penne", price: 225.00 }
        ]
    },
    {
        category: "SERPME KAHVALTI",
        products: [
            { name: "Kahvaltı Tabağı", price: 500.00 },
            { name: "Kuymak", price: 175.00 },
            { name: "Spesiyal Omlet", price: 200.00 }
        ]
    },
    {
        category: "TOST ÇEŞITLERI",
        products: [
            { name: "Bazlama Kavurma Tost", price: 250.00 },
            { name: "Bazlama Sucuklu Kaşarlı Tost", price: 220.00 },
            { name: "Beyaz Peynirli Tost", price: 170.00 },
            { name: "Kaşar Peynirli Tost", price: 170.00 },
            { name: "Sucuklu Kaşarlı Tost", price: 220.00 },
            { name: "Sucuklu Tost", price: 200.00 }
        ]
    },
    {
        category: "KIRMIZI ET",
        products: [
            { name: "Izgara Köfte", price: 350.00 }
        ]
    },
    {
        category: "TATLILAR",
        products: [
            { name: "Fıstık Rüyası", price: 250.00 },
            { name: "Frambuazlı Cheesecake", price: 220.00 },
            { name: "Limonlu Cheesecake", price: 220.00 },
            { name: "Magnolia", price: 185.00 },
            { name: "Meyveli Krep", price: 250.00 },
            { name: "San Sebastian Cheesecake", price: 220.00 },
            { name: "Sufle", price: 220.00 },
            { name: "Trileçe", price: 220.00 },
            { name: "Waffle", price: 250.00 }
        ]
    },
    {
        category: "MEYVE SULARI",
        products: [
            { name: "Karışık Meyve Suyu", price: 100.00 },
            { name: "Şeftali Meyve Suyu", price: 100.00 },
            { name: "Taze Sıkılmış Portakal Suyu", price: 200.00 },
            { name: "Vişne Meyve Suyu", price: 100.00 }
        ]
    },
    {
        category: "SOĞUK İÇECEKLER",
        products: [
            { name: "Atom", price: 120.00 },
            { name: "Churchill", price: 90.00 },
            { name: "Frozen", price: 150.00 },
            { name: "Limonata", price: 140.00 },
            { name: "Meyveli Sodalar", price: 70.00 },
            { name: "Milkshake", price: 150.00 },
            { name: "Redbull", price: 150.00 },
            { name: "Soda Limon", price: 80.00 }
        ]
    },
    {
        category: "SICAK İÇECEKLER",
        products: [
            { name: "Ada Çayı", price: 160.00 },
            { name: "Çay", price: 35.00 },
            { name: "Ihlamur", price: 160.00 },
            { name: "Kış Çayı", price: 160.00 },
            { name: "Kupa Çay", price: 60.00 },
            { name: "Kuşburnu", price: 160.00 },
            { name: "Nane Limon", price: 160.00 },
            { name: "Narlı Çay", price: 160.00 },
            { name: "Oralet", price: 45.00 },
            { name: "Papatya Çayı", price: 160.00 },
            { name: "Relax Tea", price: 130.00 },
            { name: "Rezene Çayı", price: 160.00 },
            { name: "Salep", price: 120.00 },
            { name: "Sütlü İngiliz Çayı", price: 170.00 }
        ]
    },
    {
        category: "SICAK KAHVELER",
        products: [
            { name: "Americano", price: 150.00 },
            { name: "Beyaz Çikolata", price: 120.00 },
            { name: "Cafe Latte", price: 150.00 },
            { name: "Caramel Latte", price: 150.00 },
            { name: "Coconut Latte", price: 150.00 },
            { name: "Damla Sakızlı Türk Kahvesi", price: 100.00 },
            { name: "Dibek Kahve", price: 120.00 },
            { name: "Filtre Kahve", price: 120.00 },
            { name: "Menengiç Kahve", price: 120.00 },
            { name: "Mocha", price: 150.00 },
            { name: "Sade Nescafe", price: 120.00 },
            { name: "Strawberry Latte", price: 150.00 },
            { name: "Sütlü Nescafe", price: 130.00 },
            { name: "Toffeenut Latte", price: 150.00 },
            { name: "Türk Kahvesi", price: 100.00 },
            { name: "Vanilla Latte", price: 150.00 },
            { name: "White Latte", price: 150.00 }
        ]
    },
    {
        category: "SOĞUK KAHVELER",
        products: [
            { name: "Ice Caramel Machiato", price: 150.00 },
            { name: "Ice Latte", price: 150.00 },
            { name: "Ice Mocha", price: 150.00 },
            { name: "Ice Toffeenut Latte", price: 150.00 },
            { name: "Ice White Mocha", price: 150.00 },
            { name: "Soğuk Çikolata", price: 150.00 }
        ]
    },
    {
        category: "NARGILE",
        products: [
            { name: "Nargile", price: 350.00 }
        ]
    }
];

async function seedDatabase() {
    console.log("MySQL Baglantisi Kuruluyor...");
    
    // Connect to the database
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pos_db',
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();

        console.log("=== SISTEM TAMAMEN SIFIRLANIYOR ===");
        // Disable foreign key checks to safely truncate
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
        
        // 1. İşlem verilerini sıfırla (Siparişler, Adisyonlar, Raporlar)
        console.log("1. Eski Satislar, Adisyonlar ve Odemeler Siliniyor...");
        await connection.query('TRUNCATE TABLE item_logs;');
        await connection.query('TRUNCATE TABLE order_items;');
        await connection.query('TRUNCATE TABLE payments;');
        await connection.query('TRUNCATE TABLE orders;');
        
        // Müşterileri de temizleyelim (Veresiye hesapları)
        await connection.query('TRUNCATE TABLE customers;');

        // 2. Masaları boşalt (Durumlarını empty yap)
        console.log("2. Masalar Bosaltiliyor...");
        await connection.query('UPDATE tables SET status = "empty"');

        // 3. Personelleri temizle (Sadece Admin kalsın)
        console.log("3. Personeller Temizleniyor (Sadece admin kalacak)...");
        // Eğer username 'admin' ise veya id 1 ise silme
        await connection.query('DELETE FROM users WHERE username != "admin" AND role != "admin" AND id != 1');

        // 4. Menüyü temizle
        console.log("4. Eski Menu Temizleniyor...");
        await connection.query('TRUNCATE TABLE products;');
        await connection.query('TRUNCATE TABLE categories;');
        
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        
        console.log("=== YENI MENU EKLENIYOR ===");

        for (const catData of menuData) {
            // Insert category
            const [catResult] = await connection.query(
                'INSERT INTO categories (category_name) VALUES (?)',
                [catData.category]
            );
            
            const catId = catResult.insertId;
            console.log(`+ Kategori Eklendi: ${catData.category} (ID: ${catId})`);

            // Insert products
            if (catData.products.length > 0) {
                const productValues = catData.products.map(p => [catId, p.name, p.price]);
                
                await connection.query(
                    'INSERT INTO products (category_id, product_name, price) VALUES ?',
                    [productValues]
                );
                
                console.log(`  -> ${catData.products.length} ürün eklendi.`);
            }
        }

        console.log("==========================================");
        console.log("ISLEM TAMAMLANDI! MENU BASARIYLA YUKLENDI.");
        console.log("==========================================");
        
        connection.release();
        process.exit(0);

    } catch (error) {
        console.error("HATA OLUSTU:", error);
        process.exit(1);
    }
}

seedDatabase();
