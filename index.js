const https = require('https')
const http = require('http')
const net = require('net')
const fs = require('fs')
const path = require('path')
const url = require('url')
const labels = require('./lib/labels')

const PORT = process.env.PORT || 3000
const PRINTER_QL = process.env.PRINTER_QL  // QL-810W for sku/kit
const PRINTER_PT = process.env.PRINTER_PT  // P-900W for asset

// TLS certs from mkcert (look in ./certs/ or use TLS_KEY/TLS_CERT env vars)
const certDir = path.join(__dirname, 'certs')
const tlsOpts = (() => {
  try {
    return {
      key: fs.readFileSync(process.env.TLS_KEY || path.join(certDir, '192.168.4.10-key.pem')),
      cert: fs.readFileSync(process.env.TLS_CERT || path.join(certDir, '192.168.4.10.pem')),
    }
  } catch {
    return null
  }
})()

function sendToPrinter(ip, buffer) {
  return new Promise((resolve, reject) => {
    const stream = net.connect(9100, ip, () => {
      stream.write(buffer, () => {
        stream.end()
      })
    })
    stream.on('end', () => resolve())
    stream.on('error', (err) => reject(err))
    stream.setTimeout(10000, () => {
      stream.destroy(new Error('connection timeout'))
    })
  })
}

const handler = async (req, res) => {
  const route = url.parse(req.url).pathname

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && route === '/print') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        if (!data.type || !data.printer) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'type and printer are required' }))
          return
        }

        let buffer
        switch (data.type) {
          case 'asset':
            if (!data.serial) throw new Error('serial is required for asset')
            buffer = labels.asset(data)
            break
          case 'sku':
            if (!data.sku) throw new Error('sku is required for sku')
            buffer = labels.sku(data)
            break
          case 'kit':
            if (!data.sku) throw new Error('sku is required for kit')
            buffer = labels.kit(data)
            break
          default:
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `unknown type: ${data.type}` }))
            return
        }

        console.log(`>> PRINT ${data.type} -> ${data.printer}`)
        await sendToPrinter(data.printer, buffer)
        console.log(`== PRINTED ${data.type}`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, type: data.type, printer: data.printer }))
      } catch (err) {
        console.log(`!! ERROR ${err.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
  } else if (req.method === 'GET' && (route === '/' || route === '/index.html')) {
    const file = path.join(__dirname, 'html', 'index.html')
    fs.readFile(file, (err, content) => {
      if (err) {
        res.writeHead(500)
        res.end('error reading index.html')
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(content)
    })
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  }
}

const server = tlsOpts
  ? https.createServer(tlsOpts, handler)
  : http.createServer(handler)

const proto = tlsOpts ? 'https' : 'http'
server.listen(PORT, () => {
  console.log(`PRINTER SERVICE running on ${proto}://localhost:${PORT}`)
  if (!tlsOpts) console.log('== No TLS certs found, running HTTP (set TLS_KEY/TLS_CERT or install mkcert)')
  // printSamples()
})

async function printSamples() {
  const samples = []

  if (PRINTER_PT) {
    samples.push({ label: 'asset', printer: PRINTER_PT, buf: labels.asset({ serial: 'SB-0001', name: 'Robot Arm A', date: '2026-03-30' }) })
  }

  if (PRINTER_QL) {
    samples.push({ label: 'sku', printer: PRINTER_QL, buf: labels.sku({ sku: 'WH-100', name: 'Widget Handle' }) })
    samples.push({ label: 'kit', printer: PRINTER_QL, buf: labels.kit({ sku: 'KT-200', name: 'Assembly Kit', date: '2026-03-30', who: 'Rob', assembly: true }) })
  }

  if (samples.length === 0) {
    console.log('== No PRINTER_QL or PRINTER_PT env var set, skipping sample prints')
    return
  }

  for (const s of samples) {
    try {
      console.log(`>> SAMPLE ${s.label} -> ${s.printer}`)
      await sendToPrinter(s.printer, s.buf)
      console.log(`== SAMPLE ${s.label} printed`)
    } catch (err) {
      console.log(`!! SAMPLE ${s.label} failed: ${err.message}`)
    }
  }
}
