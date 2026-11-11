// The box label and its GS1 barcode content (node --test test/). No printer needed: the labels are checked as bytes, and the
// service is run against a pretend printer on the loopback.
const test = require('node:test')
const assert = require('node:assert')
const net = require('net')
const http = require('http')
const { spawn } = require('child_process')
const path = require('path')
const gs1 = require('../lib/gs1')
const labels = require('../lib/labels')

test('the SKU is spelled as the Shelfbot server spells it', () => {
  assert.strictEqual(gs1.skuId('Bolt  M10 16hxt'), 'BOLT_M10_16HXT')
  assert.strictEqual(gs1.skuId('BOLT_M10_16HXT'), 'BOLT_M10_16HXT')
})

test('SKU and quantity: (91) then (37), FNC1 between them', () => {
  const els = gs1.elements({ sku: 'BOLT M10 16HXT', qty: 1000 })
  assert.strictEqual(gs1.text(els), '(91)BOLT_M10_16HXT(37)1000')
  assert.strictEqual(gs1.data(els), '91BOLT_M10_16HXT\x8637' + '1000')
})

test('batch and expiry follow when a part has them', () => {
  const els = gs1.elements({ sku: 'GLOVE M', qty: 20, batch: 'LOT42A', expiry: '2027-12-31' })
  assert.strictEqual(gs1.text(els), '(91)GLOVE_M(37)20(10)LOT42A(17)271231')
  assert.strictEqual(gs1.data(els), '91GLOVE_M\x8637' + '20\x8610LOT42A\x8617' + '271231')
  // expiry with no batch: the quantity is closed with FNC1, the fixed-length expiry needs none after it
  assert.strictEqual(gs1.data(gs1.elements({ sku: 'GLOVE M', qty: 20, expiry: '271231' })), '91GLOVE_M\x8637' + '20\x8617' + '271231')
})

test('what cannot go in the barcode is refused', () => {
  assert.throws(() => gs1.elements({ sku: '', qty: 1 }), /sku is required/)
  assert.throws(() => gs1.elements({ sku: 'A#B', qty: 1 }), /cannot go in a GS1 barcode/)
  assert.throws(() => gs1.elements({ sku: 'A(B)', qty: 1 }), /cannot go in a GS1 barcode/)
  assert.throws(() => gs1.elements({ sku: 'A', qty: 0 }), /qty must be/)
  assert.throws(() => gs1.elements({ sku: 'A', qty: 1.5 }), /qty must be/)
  assert.throws(() => gs1.elements({ sku: 'A', qty: 1, expiry: '31/12/2027' }), /expiry must be/)
  assert.throws(() => gs1.data(gs1.elements({ sku: 'A'.repeat(30), qty: 12345678, batch: 'B'.repeat(20), expiry: '271231' })), /the printer takes 64/)
})

test('the box label: small and portrait, the SKU, QTY, the order, and a QR code with the SKU and the quantity', () => {
  // the description and the date may still be sent; the label does not print them (Rob, 11 Nov 2026)
  const buf = labels.box({ sku: 'BOLT M10 16HXT', name: 'Hex bolt M10 x 16', qty: 1000, ref: 'ORDER 57', date: '11/11/26' })
  const s = buf.toString('latin1')
  assert.ok(s.startsWith('\x1bia\x00\x1b@\x1biL\x00'), 'ESC/P mode, initialise, portrait')
  assert.ok(!s.includes('\x1b(C'), 'no page length: the label is as long as what is on it')
  // the QR command: ESC i Q, cell 6, model 2, error level M, automatic input, the content, three backslashes
  const qr = '\x1biQ\x06\x02\x00\x00\x00\x00\x02\x00(91)BOLT_M10_16HXT(37)1000\\\\\\'
  assert.ok(s.includes(qr), 'the QR code and its content')
  // the words are the SKU as SBS names it, with spaces; the underscores are in the QR only (Rob, 11 Nov 2026)
  for (const words of ['BOLT M10 16HXT', 'QTY 1000', 'ORDER 57']) assert.ok(s.includes(words), words)
  for (const gone of ['Hex bolt', '11/11/26', '\x1bitb']) assert.ok(!s.includes(gone), `not on the label: ${gone}`)
  assert.strictEqual(s.split('BOLT_M10_16HXT').length - 1, 1, 'the underscored SKU appears once, inside the QR')
  assert.ok(s.indexOf('BOLT M10 16HXT') < s.indexOf('QTY 1000') && s.indexOf('QTY 1000') < s.indexOf('ORDER 57') && s.indexOf('ORDER 57') < s.indexOf('\x1biQ'), 'SKU, quantity, order, then the QR')
  assert.ok(s.endsWith('\x0c'), 'the form feed prints it')
  assert.ok(s.includes('\x1biC\x01'), 'cut after the label')
})

test('a long SKU goes on two lines, split at a space', () => {
  assert.deepStrictEqual(labels.skuLines('PLC SAFETY SPC'), ['PLC SAFETY SPC'])
  assert.deepStrictEqual(labels.skuLines('SENSOR E3FR2 PNP NC'), ['SENSOR E3FR2', 'PNP NC'])
  assert.deepStrictEqual(labels.skuLines('CONNECTOR SOCKET 20A PANEL'), ['CONNECTOR SOCKET', '20A PANEL'])
  assert.deepStrictEqual(labels.skuLines('A'.repeat(24)), ['A'.repeat(18), 'A'.repeat(6)])
  const s = labels.box({ sku: 'SENSOR E3FR2 PNP NC', qty: 2, ref: 'ORDER #150', order: 150 }).toString('latin1')
  assert.ok(s.includes('SENSOR E3FR2\r\nPNP NC\r\n'), 'two lines of words')
  assert.ok(s.includes('(91)SENSOR_E3FR2_PNP_NC(37)2(400)150\\\\\\'), 'the whole SKU, the quantity and the order number in the QR')
  assert.ok(s.includes('ORDER #150'), 'the order as SBS writes it, with its hash')
})

test('the order number is field (400), before batch and expiry', () => {
  const els = gs1.elements({ sku: 'GLOVE M', qty: 20, order: 151, batch: 'LOT42A', expiry: '2027-12-31' })
  assert.strictEqual(gs1.text(els), '(91)GLOVE_M(37)20(400)151(10)LOT42A(17)271231')
  assert.strictEqual(gs1.text(gs1.elements({ sku: 'GLOVE M', qty: 20 })), '(91)GLOVE_M(37)20')
  assert.throws(() => gs1.elements({ sku: 'A', qty: 1, order: 'PO (9)' }), /order cannot go in a GS1 barcode/)
})

function pretendPrinter() {
  return new Promise((resolve) => {
    const jobs = []
    const srv = net.createServer((sock) => {
      const chunks = []
      sock.on('data', (c) => chunks.push(c))
      sock.on('end', () => { jobs.push(Buffer.concat(chunks)); sock.end() })
    })
    srv.listen(0, '127.0.0.1', () => resolve({ srv, jobs, port: srv.address().port }))
  })
}

function post(port, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = http.request({ host: '127.0.0.1', port, path: '/print', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let text = ''
      res.on('data', (c) => { text += c })
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }))
    })
    req.on('error', reject)
    req.end(data)
  })
}

test('the service prints a box label and a SKU label to the printer it is given, and says why when it cannot', async () => {
  const printer = await pretendPrinter()
  const port = 3900 + Math.floor(process.pid % 90)
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', PRINTER_PORT: String(printer.port) }, stdio: 'ignore' })
  try {
    let up = false
    for (let i = 0; i < 50 && !up; i++) {
      await new Promise((r) => setTimeout(r, 100))
      up = await new Promise((resolve) => { http.get({ host: '127.0.0.1', port, path: '/health' }, (res) => { res.resume(); resolve(res.statusCode === 200) }).on('error', () => resolve(false)) })
    }
    assert.ok(up, 'the service answers /health')
    const box = await post(port, { type: 'box', printer: '127.0.0.1', sku: 'BOLT M10 16HXT', name: 'Hex bolt', qty: 500, ref: 'ORDER 57' })
    assert.deepStrictEqual(box, { status: 200, body: { ok: true, type: 'box', printer: '127.0.0.1' } })
    const sku = await post(port, { type: 'sku', printer: '127.0.0.1', sku: 'BOLT_M10_16HXT', name: 'Hex bolt' })
    assert.strictEqual(sku.status, 200)
    assert.strictEqual(printer.jobs.length, 2)
    assert.ok(printer.jobs[0].toString('latin1').includes('(91)BOLT_M10_16HXT(37)500'))
    assert.ok(printer.jobs[1].toString('latin1').includes('SHELFBOT PART'))
    const bad = await post(port, { type: 'box', printer: '127.0.0.1', sku: 'BOLT M10 16HXT' })
    assert.strictEqual(bad.status, 500)
    assert.match(bad.body.error, /qty is required/)
    const nowhere = await post(port, { type: 'sku', printer: '127.0.0.9', sku: 'X' })   // nothing listens there
    assert.strictEqual(nowhere.status, 500)
  } finally {
    child.kill()
    printer.srv.close()
  }
})
