const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

/**
 * Yeni bir fiş çıktısı gönderir — TÜM ürünler tek fişte basılır.
 * @param {string} orderId - Adisyon/Sipariş No
 * @param {string} tableName - Masa Adı
 * @param {string} addedBy - Ekleyen Personel Adı
 * @param {Array} items - Eklenen ürünlerin dizisi (örn: [{quantity: 2, product_name: 'ÇAY', note: ''}])
 */
async function printOrderSlip(orderId, tableName, addedBy, items) {
    if (!process.env.PRINTER_IP || process.env.PRINTER_IP === '192.168.1.100') {
        console.warn('[YAZICI] Printer IP ayarlanmamış veya varsayılan (192.168.1.100). Fiş basılamadı.');
        return false;
    }

    try {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,      // Possify, Xprinter vb. cihazlar EPSON/ESC-POS kullanır
            interface: `tcp://${process.env.PRINTER_IP}:${process.env.PRINTER_PORT || 9100}`,
            characterSet: 'PC857_TURKISH', // Türkçe karakter desteği
            removeSpecialCharacters: false,
            lineCharacter: "=",
        });

        // Bağlantı kontrolü
        let isConnected = await printer.isPrinterConnected();
        if (!isConnected) {
            console.error('[YAZICI] Yazıcıya bağlanılamadı. IP:', process.env.PRINTER_IP);
            return false;
        }

        // === BİP SESİ (ESC/POS Buzzer komutu) ===
        // ESC (BEL) - Çoğu ESC/POS yazıcıda çalışır
        printer.append(Buffer.from([0x1B, 0x42, 0x03, 0x02])); // 3 kez, her biri 200ms

        // === BAŞLIK ===
        printer.alignCenter();
        printer.setTextSize(1, 1); // 2x büyük yazı
        printer.bold(true);
        printer.println("** YENI SIPARIS **");
        printer.setTextNormal();
        printer.bold(false);
        printer.drawLine();

        // === BİLGİLER ===
        printer.alignLeft();
        printer.bold(true);
        printer.tableCustom([
            { text: "Adisyon", align: "LEFT", width: 0.3, bold: true },
            { text: ": #" + orderId, align: "LEFT", width: 0.7 }
        ]);
        printer.tableCustom([
            { text: "Masa", align: "LEFT", width: 0.3, bold: true },
            { text: ": " + tableName, align: "LEFT", width: 0.7 }
        ]);
        
        // Tarih formatlama
        const now = new Date();
        const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth()+1).toString().padStart(2, '0')}.${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        printer.tableCustom([
            { text: "Zaman", align: "LEFT", width: 0.3 },
            { text: ": " + formattedDate, align: "LEFT", width: 0.7 }
        ]);
        printer.tableCustom([
            { text: "Garson", align: "LEFT", width: 0.3 },
            { text: ": " + (addedBy || 'Sistem'), align: "LEFT", width: 0.7 }
        ]);
        printer.bold(false);
        
        printer.drawLine();
        
        // === ÜRÜN LİSTESİ (Kalın ve büyük) ===
        printer.alignLeft();
        printer.bold(true);
        printer.setTextSize(0, 1); // Yüksekliği 2x (daha okunabilir)
        
        for (let item of items) {
            let itemText = `${item.quantity} x  ${item.product_name}`;
            printer.println(itemText);
            if (item.note) {
                printer.setTextNormal();
                printer.println(`   * ${item.note}`);
                printer.bold(true);
                printer.setTextSize(0, 1);
            }
        }
        
        printer.setTextNormal();
        printer.drawLine();
        
        // === ALT KISIM: BÜYÜK MASA ADI ===
        printer.alignCenter();
        printer.setTextSize(1, 1); // 2x2 büyük
        printer.bold(true);
        printer.println(tableName.toUpperCase());
        printer.setTextNormal();
        
        // Toplam ürün sayısı
        const totalQty = items.reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0);
        printer.println(`Toplam: ${totalQty} kalem`);
        
        // Boşluk bırakıp kes
        printer.newLine();
        printer.newLine();
        printer.newLine();
        printer.cut();

        // Yazıcıya gönder
        await printer.execute();
        console.log(`[YAZICI] Fiş basıldı -> Masa: ${tableName}, Adisyon: #${orderId}, ${items.length} kalem`);
        return true;
    } catch (error) {
        console.error('[YAZICI] Fiş basılırken hata:', error.message);
        return false;
    }
}

module.exports = { printOrderSlip };
