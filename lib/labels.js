const e = require('./escp')
const gs1 = require('./gs1')

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

// SSCC carton label — Brother QL-810W, 38mm continuous tape (2026-09-07)
// Fields: code (the ~SSCCnnnn barcode value), sku, name, qty, date (receipt,
// dd/mm/yy). QR first — the proven symbology on this printer, and what the
// handheld reads — then the human text, then a CODE128 strip last so a
// misbehaving 1D command can only garble the tail of the label.
function sscc({ code, sku: skuCode, name, qty, date }) {
  const shown = String(code).replace(/^~/, '')
  const words = (s) => String(s).split(/[_ ]+/).filter(Boolean).flatMap(w => [e.text(w), e.newline()])
  return Buffer.concat([
    // Header — matches the SKU label (portrait, double strike, bold, center)
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

    e.charSize(40),
    e.text('SHELFBOT SSCC'),
    e.newline(),
    e.charSize(64),
    e.text(shown),
    e.newline(),
    e.newline(),

    e.bold(false),
    e.qrCode(String(code), 8, 2),
    e.newline(),
    e.newline(),

    e.bold(),
    e.charSize(48),
    ...words(skuCode),
    ...(name && name !== skuCode ? [e.bold(false), e.charSize(40), ...words(name)] : []),
    e.newline(),
    e.bold(),
    e.charSize(64),
    e.text(`QTY ${qty}`),
    e.newline(),
    e.bold(false),
    e.charSize(40),
    e.text(`RCVD ${date || ''}`),
    e.newline(),
    e.newline(),

    e.barcode(String(code), { type: 'a', height: 110, width: 2, showText: false }),
    e.newline(),

    e.formFeed(),
  ])
}

// BOX label: Brother QL-810W, 38mm continuous tape, LANDSCAPE (design-system, 11 Nov 2026).
// Fields: sku, name, qty, ref (the order it came on), date, batch and expiry (both optional).
// A box of one SKU from a purchase order: the SKU, its name, QTY n, and a GS1-128 barcode holding the SKU and the
// quantity (lib/gs1.js), the kind of barcode a warehouse's cartons carry, so the handheld reads the quantity off the box.
// The barcode is too long for the 35 mm the tape is wide, so the label is laid along the tape: landscape, with the page
// length set to fit the barcode. Five lines within the tape's 413 printable dots: SKU 52, name 32, QTY 60 with the
// reference beside it, the barcode 100, and the barcode's content in characters 24 (the printer's own characters under
// a GS1-128 show FNC1 as a space, so they are switched off and the line is printed as text).
// NOT YET PRINTED ON A REAL PRINTER: the first test print settles BOX_MODULE_DOTS (how many dots the printer gives a
// narrow bar at the "small" width; too small a guess and the barcode runs past the page and is dropped, so the guess is
// generous) and whether the printer's GS1-128 type adds the leading FNC1 itself, as the reference implies.
const BOX_MODULE_DOTS = 4      // dots per narrow bar assumed when sizing the page
const BOX_MIN_LENGTH = 900     // 76 mm
const BOX_MAX_LENGTH = 3000    // 254 mm
function boxLength(bars) {
  const symbols = bars.length + 6                      // start, the leading FNC1, code-set changes, the check character
  const modules = symbols * 11 + 13 + 20               // 11 per symbol, the stop, the quiet zones
  return Math.min(Math.max(modules * BOX_MODULE_DOTS + 120, BOX_MIN_LENGTH), BOX_MAX_LENGTH)
}
function box({ sku: skuCode, name, qty, ref, date, batch, expiry }) {
  const els = gs1.elements({ sku: skuCode, qty, batch, expiry })
  const bars = gs1.data(els)
  const shown = gs1.skuId(skuCode)
  const length = boxLength(bars)
  const fit = (s, size) => String(s || '').slice(0, Math.max(4, Math.floor(length / (0.62 * size))))
  const beside = [ref, date].filter(Boolean).join('  ')
  return Buffer.concat([
    Buffer.from([
      0x1B, 0x69, 0x61, 0x00,  // ESC/P mode
      0x1B, 0x40,               // Initialize
      0x1B, 0x69, 0x4C, 0x01,  // Landscape
    ]),
    e.pageLength(length),
    Buffer.from([
      0x1B, 0x6C, 0x00,        // Left margin 0
      0x1B, 0x47,               // Double strike
      0x1B, 0x69, 0x58, 0x6B, 0x32, 0x01, 0x00, 0x09, // Set font, as the SKU label
      0x1B, 0x61, 0x01,        // Center
    ]),
    e.cut(),

    e.bold(),
    e.charSize(52),
    e.text(fit(shown, 52)),
    e.newline(),

    ...(name && gs1.skuId(name) !== shown ? [e.bold(false), e.charSize(32), e.text(fit(name, 32)), e.newline()] : []),

    e.bold(),
    e.charSize(60),
    e.text(`QTY ${Number(qty)}`),
    ...(beside ? [e.bold(false), e.charSize(32), e.text(`   ${fit(beside, 32)}`)] : []),
    e.newline(),

    e.bold(false),
    e.barcode(bars, { type: 'b', height: 100, width: 1, showText: false }),
    e.newline(),

    e.charSize(24),
    e.text(gs1.text(els)),
    e.newline(),

    e.formFeed(),
  ])
}

module.exports = { asset, sku, kit, sscc, box, boxLength }
