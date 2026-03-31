const e = require('./escp')

// ASSET label — Brother P-900W, 36mm yellow tape
// Layout: QR code then text (sequential, no absolute positioning)
function asset({ serial, name, date }) {
  return Buffer.concat([
    e.init(),
    e.landscape(),
    e.cut(),

    // Text
    e.align(1),
    e.font(0),
    e.bold(),
    e.charSize(20),
    e.text('SHELFBOT'),
    e.newline(),

    e.charSize(20),
    e.text(`ASSET: ${serial}`),
    e.newline(),

    e.bold(false),
    e.charSize(20),
    e.text(name),
    e.newline(),

    e.charSize(20),
    e.text(date),
    e.newline(),
    e.newline(),

    // QR code after text (cell size 3 — fits 24mm tape)
    e.align(1),
    e.qrCode(serial, 10, 2),
    e.newline(),

    e.formFeed(),
  ])
}

// SKU label — Brother QL-810W, 38mm continuous tape
// Fields: sku, name
function sku({ sku: skuCode, name }) {
  return Buffer.concat([
    // Header — matches old working QL code (portrait, double strike, bold, center)
    Buffer.from([
      0x1B, 0x69, 0x61, 0x00,  // ESC/P mode
      0x1B, 0x40,               // Initialize
      0x1B, 0x69, 0x4C, 0x00,  // Portrait
      0x1B, 0x6C, 0x00,        // Left margin 0
      0x1B, 0x47,               // Double strike
      0x1B, 0x69, 0x58, 0x6B, 0x32, 0x01, 0x00, 0x09, // Set font
      0x1B, 0x45,               // Bold
      0x1B, 0x61, 0x01,        // Center
    ]),
    e.cut(),

    // Text
    e.charSize(48),
    e.text('SHELFBOT PART'),
    e.newline(),

    e.charSize(48),
    ...skuCode.split(/[_ ]+/).flatMap(word => [e.text(word), e.newline()]),

    ...(name && name !== skuCode ? [
      e.bold(false),
      e.charSize(48),
      ...name.split(/[_ ]+/).flatMap(word => [e.text(word), e.newline()]),
    ] : []),
    e.newline(),

    // QR code
    e.bold(false),
    e.qrCode(skuCode, 10, 2),
    e.newline(),

    e.formFeed(),
  ])
}

// KIT label — Brother QL-810W, 38mm continuous tape
// Fields: sku, name, date, who, assembly (optional)
function kit({ sku: skuCode, name, date, who, assembly }) {
  const parts = [
    // Header — matches old working QL code (portrait, double strike, bold, center)
    Buffer.from([
      0x1B, 0x69, 0x61, 0x00,  // ESC/P mode
      0x1B, 0x40,               // Initialize
      0x1B, 0x69, 0x4C, 0x00,  // Portrait
      0x1B, 0x6C, 0x00,        // Left margin 0
      0x1B, 0x47,               // Double strike
      0x1B, 0x69, 0x58, 0x6B, 0x32, 0x01, 0x00, 0x09, // Set font
      0x1B, 0x45,               // Bold
      0x1B, 0x61, 0x01,        // Center
    ]),
    e.cut(),

    // Text
    e.charSize(48),
    e.text('SHELFBOT KIT'),
    e.newline(),

    e.charSize(48),
    e.text(skuCode),
    e.newline(),

    e.bold(false),
    e.charSize(48),
    e.text(name),
    e.newline(),

    e.charSize(48),
    e.text(`${date}  ${who}`),
    e.newline(),
  ]

  if (assembly) {
    parts.push(
      e.newline(),
      e.bold(),
      e.charSize(48),
      e.text('[ ] ASSEMBLED'),
      e.newline(),
      e.newline(),
      e.bold(false),
      e.charSize(48),
      e.text('_______________'),
      e.newline(),
    )
  }

  parts.push(
    e.newline(),
    e.qrCode(skuCode, 10, 2),
    e.newline(),
    e.formFeed(),
  )

  return Buffer.concat(parts)
}

module.exports = { asset, sku, kit }
