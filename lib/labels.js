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

// BOX label: Brother QL-810W, 38mm continuous tape, portrait like the SKU label (design-system, 11 Nov 2026).
// Fields: sku, qty, ref (the order it came on), batch and expiry (both optional).
// A box of one SKU from a purchase order. Rob, on the first one printed (a long landscape label with the description and
// a GS1-128 strip): "we don't need the description ... it should be SKU quantity order and the QR code ... it needs to be
// smaller". So: the SKU, QTY n, the order, and a small QR code holding the SKU and the quantity, so the handheld reads
// the quantity off the box. The QR's content is the box's fields in GS1's bracketed form (lib/gs1.js text()), for
// example (91)PLC_SAFETY_SPC(37)1: plain characters that any scanner passes through.
// The SKU goes on one line when it fits the tape, else on two, split at an underscore. Measured off the first print:
// the characters advance about 21 dots whatever their height, so about 19 fit across the tape's 413 printable dots.
// (That first print also settled the GS1-128 strip, should a client's label ever want one: the printer's "small" width
// is 4 dots a narrow bar, and a strip of 20 characters ran 83 mm.)
const BOX_LINE = 18            // characters of SKU on one line of the 38 mm tape
function skuLines(id) {
  if (id.length <= BOX_LINE) return [id]
  const cuts = [...id].map((c, i) => (c === '_' ? i : -1)).filter((i) => i > 0)
  if (!cuts.length) return [id.slice(0, BOX_LINE), id.slice(BOX_LINE)]
  const mid = id.length / 2
  const cut = cuts.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a))
  return [id.slice(0, cut), id.slice(cut + 1)]
}
function box({ sku: skuCode, qty, ref, batch, expiry }) {
  const els = gs1.elements({ sku: skuCode, qty, batch, expiry })
  const shown = gs1.skuId(skuCode)
  return Buffer.concat([
    // Header, as the SKU label (portrait, double strike, bold, center)
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

    e.charSize(48),
    ...skuLines(shown).flatMap((line) => [e.text(line), e.newline()]),

    e.charSize(56),
    e.text(`QTY ${Number(qty)}`),
    e.newline(),

    ...(ref ? [e.bold(false), e.charSize(36), e.text(String(ref).slice(0, 20)), e.newline()] : []),
    e.newline(),

    e.bold(false),
    e.qrCode(gs1.text(els), 6, 2),
    e.newline(),

    e.formFeed(),
  ])
}

module.exports = { asset, sku, kit, sscc, box, skuLines }
