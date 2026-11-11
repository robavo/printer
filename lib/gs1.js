// GS1 element strings for the box label (design-system, 11 Nov 2026; Rob: a box label with the SKU and the quantity in the
// barcode other warehouses use, like Linfox's cartons: a GS1-128 with the product, the quantity, and batch and expiry when
// there are any).
//
// What the barcode holds, in this order:
//   (91) the SKU as the Shelfbot server spells it: capitals, underscores for spaces. Our own parts have no GTIN; 91 is the
//        field GS1 keeps for a company's own use. A client's goods carry (01) or (02) with a GTIN instead, on their own labels.
//   (37) the count in the box.
//   (10) the batch or lot, when the part has one.
//   (17) the expiry date as YYMMDD, when the part has one.
// A variable-length field that is not the last one is closed with FNC1 (the reader sees a GS character there).
// On the Brother printers FNC1 inside CODE128 or GS1-128 data is the byte 86h (ESC/P Command Reference, ESC i B).

const FNC1 = '\x86'
const SET82 = /^[A-Za-z0-9!"%&'*+,\-./:;<=>?_]+$/   // GS1's character set 82 without the parentheses, which the printer may strip
const MAX_DATA = 64                                   // the printer takes 1 to 64 characters of GS1-128 data

// The SKU as the Shelfbot server spells it (the hub's normal_name): one name whatever the spacing or case.
function skuId(name) {
  return String(name == null ? '' : name).trim().replace(/[\s_]+/g, '_').toUpperCase()
}

function yymmdd(expiry) {
  const s = String(expiry).trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) return m[1].slice(2) + m[2] + m[3]
  m = /^(\d{2})(\d{2})(\d{2})$/.exec(s)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) <= 31) return s
  throw new Error('expiry must be YYYY-MM-DD or YYMMDD')
}

// The fields of one box: [{ ai, value, variable }], checked.
function elements({ sku, qty, batch, expiry }) {
  const id = skuId(sku)
  if (!id) throw new Error('sku is required')
  if (id.length > 30 || !SET82.test(id)) throw new Error(`sku cannot go in a GS1 barcode: ${id}`)
  const n = Number(qty)
  if (!Number.isInteger(n) || n < 1 || n > 99999999) throw new Error('qty must be a whole number from 1 to 99999999')
  const out = [{ ai: '91', value: id, variable: true }, { ai: '37', value: String(n), variable: true }]
  if (batch != null && String(batch).trim() !== '') {
    const b = String(batch).trim()
    if (b.length > 20 || !SET82.test(b)) throw new Error(`batch cannot go in a GS1 barcode: ${b}`)
    out.push({ ai: '10', value: b, variable: true })
  }
  if (expiry != null && String(expiry).trim() !== '') out.push({ ai: '17', value: yymmdd(expiry), variable: false })
  return out
}

// The data for the printer's GS1-128 barcode: the fields end to end, FNC1 after a variable-length field that has another after it.
function data(els) {
  let s = ''
  els.forEach((el, i) => {
    s += el.ai + el.value
    if (el.variable && i < els.length - 1) s += FNC1
  })
  if (s.length > MAX_DATA) throw new Error(`the barcode data is ${s.length} characters, the printer takes ${MAX_DATA}`)
  return s
}

// The same fields for a person: (91)BOLT_M10_16HXT(37)1000
function text(els) {
  return els.map((el) => `(${el.ai})${el.value}`).join('')
}

module.exports = { FNC1, skuId, elements, data, text }
