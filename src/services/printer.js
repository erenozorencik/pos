const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

/**
 * Yeni bir fiş çıktısı gönderir.
 * @param {string} orderId - Adisyon/Sipariş No
 * @param {string} tableName - Masa Adı
 * @param {string} addedBy - Ekleyen Personel Adı
 * @param {Array} items - Eklenen ürünlerin dizisi (örn: [{quantity: 1, product_name: 'ÇAY'}])
 */
async function printOrderSlip(orderId, tableName, addedBy, items) {
    if (!process.env.PRINTER_IP || process.env.PRINTER_IP === '192.168.1.100') {
        console.warn('[YAZICI] Printer IP ayarlanmamış veya varsayılan (192.168.1.100). Fiş basılamadı.');
        return false;
    }

    try {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,      // Genelde piyasadaki Possify, Xprinter vb. cihazlar EPSON/ESC-POS kullanır
            interface: `tcp://${process.env.PRINTER_IP}:${process.env.PRINTER_PORT || 9100}`,
            characterSet: 'PC857_TURKISH', // Türkçe karakter desteği
            removeSpecialCharacters: false,
            lineCharacter: "-",
        });

        // Bağlantı kontrolü (Opsiyonel ama hızlı patlamayı önler)
        let isConnected = await printer.isPrinterConnected();
        if (!isConnected) {
            console.error('[YAZICI] Yazıcıya bağlanılamadı. IP adresini ve bağlantısını kontrol edin:', process.env.PRINTER_IP);
            return false;
        }

        printer.alignCenter();
        printer.bold(true);
        printer.println("YENI SIPARIS");
        printer.bold(false);
        printer.drawLine();

        printer.alignLeft();
        printer.tableCustom([
            { text: "Adisyon", align: "LEFT", width: 0.3 },
            { text: ": " + orderId, align: "LEFT", width: 0.7 }
        ]);
        printer.tableCustom([
            { text: "Masa Adi", align: "LEFT", width: 0.3 },
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
            { text: "Gonderen", align: "LEFT", width: 0.3 },
            { text: ": " + (addedBy || 'Sistem'), align: "LEFT", width: 0.7 }
        ]);
        
        printer.drawLine();
        
        // Ürün listesi
        printer.alignLeft();
        for (let item of items) {
            let itemText = `${item.quantity} x    ${item.product_name}`;
            printer.println(itemText);
            if (item.note) {
                printer.println(`  * Not: ${item.note}`);
            }
        }

        printer.drawLine();
        
        // Alt Kısımda Büyük Harflerle Masa Adı
        printer.alignCenter();
        printer.setTextSize(1, 1); // Yazı tipini büyüt
        printer.bold(true);
        printer.println(tableName.toUpperCase());
        printer.setTextNormal(); // Normal boyuta dön
        
        // Boşluk bırakıp kes
        printer.newLine();
        printer.newLine();
        printer.newLine();
        printer.cut();

        // Yazıcıya gönder
        await printer.execute();
        console.log(`[YAZICI] Fiş başarıyla basıldı -> Masa: ${tableName}, Adisyon: ${orderId}`);
        return true;
    } catch (error) {
        console.error('[YAZICI] Fiş basılırken hata oluştu:', error.message);
        return false;
    }
}

module.exports = { printOrderSlip };
