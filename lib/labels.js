const e = require('./escp')

// ASSET label — Brother P-900W, 36mm tape
// Fields: serial, name, date
function asset({ serial, name, date }) {
  return Buffer.concat([
    e.init(),
    e.landscape(),
    e.cut(),

    // Title
    e.align(1),
    e.font(0),
    e.bold(),
    e.charSize(42),
    e.text('ASSET'),
    e.newline(),

    // Serial
    e.charSize(32),
    e.text(serial),
    e.newline(),

    // Name
    e.bold(false),
    e.charSize(24),
    e.text(name),
    e.newline(),

    // Date
    e.charSize(20),
    e.text(date),
    e.newline(),
    e.newline(),

    // QR code with serial
    e.align(1),
    e.qrCode(serial, 3, 2),
    e.newline(),

    e.formFeed(),
  ])
}

// SKU label — Brother QL-810W, 62mm x 100mm
// Fields: sku, name
function sku({ sku: skuCode, name }) {
  return Buffer.concat([
    e.init(),
    e.landscape(),
    e.cut(),

    // Title
    e.align(1),
    e.font(0),
    e.bold(),
    e.charSize(60),
    e.text('SKU'),
    e.newline(),

    // SKU code
    e.charSize(48),
    e.text(skuCode),
    e.newline(),

    // Name
    e.bold(false),
    e.charSize(32),
    e.text(name),
    e.newline(),
    e.newline(),

    // QR code with SKU
    e.align(1),
    e.qrCode(skuCode, 5, 2),
    e.newline(),

    e.formFeed(),
  ])
}

// KIT label — Brother QL-810W, 62mm x 100mm
// Fields: sku, name, date, who
function kit({ sku: skuCode, name, date, who }) {
  return Buffer.concat([
    e.init(),
    e.landscape(),
    e.cut(),

    // Title
    e.align(1),
    e.font(0),
    e.bold(),
    e.charSize(60),
    e.text('KIT'),
    e.newline(),

    // SKU + Name
    e.charSize(40),
    e.text(skuCode),
    e.newline(),
    e.bold(false),
    e.charSize(32),
    e.text(name),
    e.newline(),

    // Date + Who
    e.charSize(24),
    e.text(`${date}  ${who}`),
    e.newline(),
    e.newline(),

    // Assembled checkbox
    e.align(0),
    e.bold(),
    e.charSize(28),
    e.text('[ ] ASSEMBLED'),
    e.newline(),
    e.newline(),

    // QR code
    e.align(1),
    e.bold(false),
    e.qrCode(skuCode, 5, 2),
    e.newline(),

    e.formFeed(),
  ])
}

module.exports = { asset, sku, kit }
