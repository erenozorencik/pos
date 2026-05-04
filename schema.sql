CREATE DATABASE IF NOT EXISTS cafepos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafepos;

-- Sistemi tamamen temizle (Yeni kurulum için)
DROP TABLE IF EXISTS item_logs;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS customer_transactions;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS customers;

-- 1. Kullanıcılar (Personel ve Admin)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Varsayılan Admin Hesabını OLuştur (İlk Giriş Şifresi 1234)
INSERT IGNORE INTO users (username, password, role) VALUES ('admin', '1234', 'admin');

-- 2. Müşteriler (Cari/Veresiye Takibi İçin YENİ)
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.5 Müşteri İşlem Geçmişi (Cari Logları)
CREATE TABLE customer_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    type ENUM('debt', 'payment') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 3. Masalar
CREATE TABLE tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL UNIQUE,
    status ENUM('empty', 'occupied', 'bill_requested') DEFAULT 'empty'
);

-- 4. Ürün Kategorileri
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL
);

-- 5. Ürünler
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    product_name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 6. Adisyonlar (Siparişler - GÜNCELLENDİ)
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    user_id INT NOT NULL,
    customer_id INT NULL, 
    total_price DECIMAL(10,2) DEFAULT 0.00, -- İndirimsiz tam fiyat
    discount DECIMAL(10,2) DEFAULT 0.00,
    paid_amount DECIMAL(10,2) DEFAULT 0.00, -- Alınan paraların toplam değeri
    status ENUM('open', 'paid', 'credit') DEFAULT 'open', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 7. Adisyon Kalemleri (GÜNCELLENDİ: paid_quantity, note, added_by EKLENDİ)
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    paid_quantity INT DEFAULT 0,
    price_at_time DECIMAL(10,2) NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    added_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 8. Kısmi Ödemeler Tablosu
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'credit_card', 'meal_card', 'veresiye', 'discount') NOT NULL,
    customer_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 9. Anlık Ürün Ekleme Logları (Personel Takibi)
CREATE TABLE item_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    order_item_id INT NULL,
    table_id INT NOT NULL,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price_at_time DECIMAL(10,2) NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    action ENUM('add', 'cancel', 'discount') DEFAULT 'add',
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

-- ============================================================
-- SEED DATA (Demo Verileri)
-- ============================================================

-- Personel (Şifreler: 1234)
INSERT INTO users (username, password, role) VALUES
    ('garson1', '1234', 'staff'),
    ('garson2', '1234', 'staff'),
    ('kasiyer', '1234', 'staff');

-- Masalar
INSERT INTO tables (table_name, status) VALUES
    ('Masa 1',  'empty'),
    ('Masa 2',  'empty'),
    ('Masa 3',  'empty'),
    ('Masa 4',  'empty'),
    ('Masa 5',  'empty'),
    ('Masa 6',  'empty'),
    ('Masa 7',  'empty'),
    ('Masa 8',  'empty'),
    ('Bahçe 1', 'empty'),
    ('Bahçe 2', 'empty'),
    ('Bahçe 3', 'empty'),
    ('Bar 1',   'empty'),
    ('Bar 2',   'empty'),
    ('Teras 1', 'empty'),
    ('Teras 2', 'empty');

-- Kategoriler
INSERT INTO categories (category_name) VALUES
    ('☕ Sıcak İçecekler'),
    ('🥤 Soğuk İçecekler'),
    ('🍺 Alkolsüz İçecekler'),
    ('🥐 Kahvaltı & Atıştırmalık'),
    ('🍕 Ana Yemekler'),
    ('🍰 Tatlılar');

-- Ürünler
-- ☕ Sıcak İçecekler (category_id = 1)
INSERT INTO products (category_id, product_name, price) VALUES
    (1, 'Türk Kahvesi',        18.00),
    (1, 'Filtre Kahve',        22.00),
    (1, 'Americano',           30.00),
    (1, 'Latte',               38.00),
    (1, 'Cappuccino',          38.00),
    (1, 'Espresso',            26.00),
    (1, 'Sütlü Çay (Demlik)',  20.00),
    (1, 'Çay (Bardak)',        10.00),
    (1, 'Bitki Çayı',          22.00),
    (1, 'Sahlep',              28.00),
    (1, 'Sıcak Çikolata',      35.00);

-- 🥤 Soğuk İçecekler (category_id = 2)
INSERT INTO products (category_id, product_name, price) VALUES
    (2, 'Soğuk Kahve',         40.00),
    (2, 'Iced Latte',          42.00),
    (2, 'Frappé',              45.00),
    (2, 'Limonata',            30.00),
    (2, 'Vişneli Limonata',    33.00),
    (2, 'Buzlu Çay',           22.00),
    (2, 'Taze Portakal Suyu',  40.00),
    (2, 'Milkshake',           45.00);

-- 🍺 Alkolsüz İçecekler (category_id = 3)
INSERT INTO products (category_id, product_name, price) VALUES
    (3, 'Kola (Küçük)',        18.00),
    (3, 'Kola (Büyük)',        28.00),
    (3, 'Fanta',               18.00),
    (3, 'Sprite',              18.00),
    (3, 'Su (Küçük)',           8.00),
    (3, 'Su (Büyük)',          12.00),
    (3, 'Maden Suyu',          15.00),
    (3, 'Ayran',               15.00),
    (3, 'Şalgam',              18.00);

-- 🥐 Kahvaltı & Atıştırmalık (category_id = 4)
INSERT INTO products (category_id, product_name, price) VALUES
    (4, 'Croissant',           35.00),
    (4, 'Tost (Klasik)',       45.00),
    (4, 'Tost (Kaşarlı Sucuklu)', 55.00),
    (4, 'Poğaça',              20.00),
    (4, 'Kek Dilimi',          30.00),
    (4, 'Kurabiye (3 Adet)',   25.00),
    (4, 'Sigara Böreği',       18.00),
    (4, 'Simit + Çay',         20.00);

-- 🍕 Ana Yemekler (category_id = 5)
INSERT INTO products (category_id, product_name, price) VALUES
    (5, 'Clubhouse Sandwich',  95.00),
    (5, 'Izgara Köfte (Porsiyon)', 120.00),
    (5, 'Tavuk Wrap',          85.00),
    (5, 'Caesar Salata',       75.00),
    (5, 'Karışık Salata',      65.00),
    (5, 'Mercimek Çorbası',    55.00),
    (5, 'Domates Çorbası',     55.00),
    (5, 'Patates Kızartması',  45.00);

-- 🍰 Tatlılar (category_id = 6)
INSERT INTO products (category_id, product_name, price) VALUES
    (6, 'Cheesecake',          65.00),
    (6, 'Tiramisu',            70.00),
    (6, 'Brownie + Dondurma',  60.00),
    (6, 'Fıstıklı Baklava',    50.00),
    (6, 'Sütlaç',              40.00),
    (6, 'Waffle',              65.00),
    (6, 'Profiterol',          55.00);

-- Örnek Müşteriler (Cari/Veresiye)
INSERT INTO customers (name, phone, balance) VALUES
    ('Ahmet Yılmaz',  '0532 111 2233', 0.00),
    ('Fatma Kaya',    '0545 222 3344', 150.00),
    ('Mehmet Demir',  '0555 333 4455', 0.00),
    ('Zeynep Şahin',  '0533 444 5566', 75.50);
