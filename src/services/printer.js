const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

/**
 * Yeni siparis fisi - TUM urunler tek fiste basilir.
 * Kalin yazi + bip sesi destegi.
 */
async function printOrderSlip(orderId, tableName, addedBy, items) {
    if (!process.env.PRINTER_IP || process.env.PRINTER_IP === '192.168.1.100') {
        console.warn('[YAZICI] Printer IP ayarlanmamis veya varsayilan. Fis basilamadi.');
        return false;
    }

    try {
        var printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: 'tcp://' + process.env.PRINTER_IP + ':' + (process.env.PRINTER_PORT || 9100),
            characterSet: 'PC857_TURKISH',
            removeSpecialCharacters: false,
            lineCharacter: '=',
        });

        var isConnected = await printer.isPrinterConnected();
        if (!isConnected) {
            console.error('[YAZICI] Yaziciya baglanilamadi. IP:', process.env.PRINTER_IP);
            return false;
        }

        // === BIP SESI (ESC/POS Buzzer komutu) ===
        printer.append(Buffer.from([0x1B, 0x42, 0x03, 0x02]));

        // === BASLIK ===
        printer.alignCenter();
        printer.setTextSize(1, 1);
        printer.bold(true);
        printer.println('** YENI SIPARIS **');
        printer.setTextNormal();
        printer.bold(false);
        printer.drawLine();

        // === BILGILER ===
        printer.alignLeft();
        printer.bold(true);
        printer.tableCustom([
            { text: 'Adisyon', align: 'LEFT', width: 0.3 },
            { text: ': #' + orderId, align: 'LEFT', width: 0.7 }
        ]);
        printer.tableCustom([
            { text: 'Masa', align: 'LEFT', width: 0.3 },
            { text: ': ' + tableName, align: 'LEFT', width: 0.7 }
        ]);

        var now = new Date();
        var formattedDate = now.getDate().toString().padStart(2, '0') + '.' +
            (now.getMonth() + 1).toString().padStart(2, '0') + '.' +
            now.getFullYear() + ' ' +
            now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0');

        printer.tableCustom([
            { text: 'Zaman', align: 'LEFT', width: 0.3 },
            { text: ': ' + formattedDate, align: 'LEFT', width: 0.7 }
        ]);
        printer.tableCustom([
            { text: 'Garson', align: 'LEFT', width: 0.3 },
            { text: ': ' + (addedBy || 'Sistem'), align: 'LEFT', width: 0.7 }
        ]);
        printer.bold(false);

        printer.drawLine();

        // === URUN LISTESI (Kalin ve buyuk) ===
        printer.alignLeft();
        printer.bold(true);
        printer.setTextSize(0, 1); // Yuksekligi 2x (daha okunabilir)

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            printer.println(item.quantity + ' x  ' + item.product_name);
            if (item.note) {
                printer.setTextNormal();
                printer.println('   * ' + item.note);
                printer.bold(true);
                printer.setTextSize(0, 1);
            }
        }

        printer.setTextNormal();
        printer.drawLine();

        // === ALT KISIM: BUYUK MASA ADI ===
        printer.alignCenter();
        printer.setTextSize(1, 1); // 2x2 buyuk
        printer.bold(true);
        printer.println(tableName.toUpperCase());
        printer.setTextNormal();

        // Toplam urun sayisi
        var totalQty = 0;
        for (var j = 0; j < items.length; j++) {
            totalQty += (parseInt(items[j].quantity) || 1);
        }
        printer.println('Toplam: ' + totalQty + ' kalem');

        // Bosluk birakip kes
        printer.newLine();
        printer.newLine();
        printer.newLine();
        printer.cut();

        // Yaziciya gonder
        await printer.execute();
        console.log('[YAZICI] Fis basildi -> Masa: ' + tableName + ', Adisyon: #' + orderId + ', ' + items.length + ' kalem');
        return true;
    } catch (error) {
        console.error('[YAZICI] Fis basilirken hata:', error.message);
        return false;
    }
}

module.exports = { printOrderSlip };
