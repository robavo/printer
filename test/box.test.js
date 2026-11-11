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

test('the box label: landscape, a page long enough for the barcode, a GS1-128 with the content, the words', () => {
  const buf = labels.box({ sku: 'BOLT M10 16HXT', name: 'Hex bolt M10 x 16', qty: 1000, ref: 'ORDER 57', date: '11/11/26' })
  const s = buf.toString('latin1')
  assert.ok(s.startsWith('\x1bia\x00\x1b@\x1biL\x01'), 'ESC/P mode, initialise, landscape')
  const at = s.indexOf('\x1b(C\x02\x00')
  assert.ok(at > 0, 'the page length is set')
  const length = buf[at + 5] + buf[at + 6] * 256
  assert.strictEqual(length, labels.boxLength('91BOLT_M10_16HXT\x8637' + '1000'))
  assert.ok(length >= 900 && length <= 3000)
  // the barcode command: ESC i, type b (GS1-128), no characters under it, height 100, width small, B, the data, three backslashes
  const bar = '\x1bitbr0h\x64\x00w1B91BOLT_M10_16HXT\x8637' + '1000\\\\\\'
  assert.ok(s.includes(bar), 'the GS1-128 command and its data')
  for (const words of ['BOLT_M10_16HXT', 'Hex bolt M10 x 16', 'QTY 1000', 'ORDER 57  11/11/26', '(91)BOLT_M10_16HXT(37)1000']) assert.ok(s.includes(words), words)
  assert.ok(s.endsWith('\x0c'), 'the form feed prints it')
  assert.ok(s.includes('\x1biC\x01'), 'cut after the label')
})

test('a longer barcode gets a longer label', () => {
  const short = labels.boxLength('91A\x8637' + '1')
  const long = labels.boxLength('91' + 'A'.repeat(30) + '\x8637' + '12345678' + '\x8610' + 'B'.repeat(18))
  assert.strictEqual(short, 900)
  assert.ok(long > short && long <= 3000)
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
    assert.ok(printer.jobs[0].toString('latin1').includes('91BOLT_M10_16HXT\x8637' + '500'))
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
