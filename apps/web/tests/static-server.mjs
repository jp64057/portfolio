// Minimal static file server for the Next.js static export (`out/`), used as
// Playwright's webServer. Serves trailingSlash directories via index.html and
// falls back to 404.html — no extra dependencies.
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../out/', import.meta.url))
const PORT = Number(process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function resolveFile(url) {
  const path = decodeURIComponent(url.split('?')[0])
  let file = join(ROOT, path)
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = join(file, 'index.html')
    return file
  } catch {
    // Extensionless path (e.g. /stats/) → its index.html
    if (!extname(path)) return join(ROOT, path, 'index.html')
    return file
  }
}

const server = http.createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/')
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    try {
      const notFound = await readFile(join(ROOT, '404.html'))
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      res.end(notFound)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
})

server.listen(PORT, () => {
  console.log(`Static server for out/ on http://127.0.0.1:${PORT}`)
})
