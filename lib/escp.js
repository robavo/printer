// ESC/P command primitives for Brother QL-810W / P-900W
// Reference: cv_ql820_eng_escp_101.pdf

const escp = {}

// Switch to ESC/P mode + initialize
escp.init = () => Buffer.from([
  0x1B, 0x69, 0x61, 0x00,  // ESC i a 0 — command mode ESC/P
  0x1B, 0x40,               // ESC @   — initialize
])

// Landscape orientation on/off
escp.landscape = (on = true) => Buffer.from([
  0x1B, 0x69, 0x4C, on ? 0x01 : 0x00
])

// Page length in dots (300 dpi: 1 inch = 300 dots)
escp.pageLength = (dots) => {
  const nL = dots & 0xFF
  const nH = (dots >> 8) & 0xFF
  return Buffer.from([0x1B, 0x28, 0x43, 0x02, 0x00, nL, nH])
}

// Select font: 0=Brougham, 1=LetterGothicBold, 9=Brussels, 11=Helsinki
escp.font = (id) => Buffer.from([0x1B, 0x6B, id])

// Character size in dots
escp.charSize = (dots) => {
  const nL = dots & 0xFF
  const nH = (dots >> 8) & 0xFF
  return Buffer.from([0x1B, 0x58, 0x00, nL, nH])
}

// Bold on/off
escp.bold = (on = true) => Buffer.from([0x1B, on ? 0x45 : 0x46])

// Alignment: 0=left, 1=center, 2=right
escp.align = (mode) => Buffer.from([0x1B, 0x61, mode])

// Double-strike (thicker print)
escp.doubleStrike = (on = true) => Buffer.from([0x1B, on ? 0x47 : 0x48])

// Left margin in characters
escp.leftMargin = (n) => Buffer.from([0x1B, 0x6C, n])

// Absolute horizontal position in dots
escp.moveX = (dots) => {
  const nL = dots & 0xFF
  const nH = (dots >> 8) & 0xFF
  return Buffer.from([0x1B, 0x24, nL, nH])
}

// Absolute vertical position in dots (offset of 18 dots applied by printer)
escp.moveY = (dots) => {
  const pos = Math.max(0, dots - 18)
  const nL = pos & 0xFF
  const nH = (pos >> 8) & 0xFF
  return Buffer.from([0x1B, 0x28, 0x56, 0x02, 0x00, nL, nH])
}

// Line feed amount: n/60 inch
escp.lineFeedAmount = (n) => Buffer.from([0x1B, 0x41, n])

// Raw text
escp.text = (str) => Buffer.from(str)

// Newline (CR + LF)
escp.newline = () => Buffer.from([0x0D, 0x0A])

// QR code — Model 2, no partition, auto input
// cellSize: 3,4,5,6,8,10 dots per cell side
// errorLevel: 1=L(7%), 2=M(15%), 3=Q(25%), 4=H(30%)
escp.qrCode = (data, cellSize = 4, errorLevel = 2) => {
  const params = Buffer.from([
    cellSize,   // 1. cell size
    0x02,       // 2. symbol type: Model 2
    0x00,       // 3. structured append: no
    0x00,       // 4. code number (ignored)
    0x00,       // 5. number of partitions (ignored)
    0x00,       // 6. parity data (ignored)
    errorLevel, // 7. error correction level
    0x00,       // 8. data input method: auto
  ])
  const header = Buffer.from([0x1B, 0x69, 0x51])
  const dataBuffer = Buffer.from(data)
  const footer = Buffer.from([0x5C, 0x5C, 0x5C])
  return Buffer.concat([header, params, dataBuffer, footer])
}

// 1D barcode (CODE128)
// width: 0=xs, 1=small, 2=medium, 3=large
escp.barcode = (data, { height = 100, width = 2, showText = true } = {}) => {
  const hL = height & 0xFF
  const hH = (height >> 8) & 0xFF
  const params = `t${0x0A}r${showText ? 1 : 0}h${String.fromCharCode(hL, hH)}w${width}`
  const header = Buffer.from([0x1B, 0x69])
  const paramBuf = Buffer.from(params)
  const bMarker = Buffer.from([0x42])
  const dataBuf = Buffer.from(data)
  const footer = Buffer.from([0x5C, 0x5C, 0x5C]) // CODE128 uses 3 backslashes
  return Buffer.concat([header, paramBuf, bMarker, dataBuf, footer])
}

// Form feed (eject label / trigger print)
escp.formFeed = () => Buffer.from([0x0C])

// Auto-cut after print
escp.cut = (on = true) => Buffer.from([0x1B, 0x69, 0x43, on ? 0x01 : 0x00])

module.exports = escp
