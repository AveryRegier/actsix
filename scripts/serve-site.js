import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const siteDir = path.join(__dirname, '..', 'site')
const port = process.env.SITE_PORT || 8080

// MIME types for common file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

const server = http.createServer((req, res) => {
  // Parse URL and get file path
  let filePath = req.url === '/' ? '/index.html' : req.url
  filePath = path.join(siteDir, filePath)
  
  // Get file extension
  const ext = path.extname(filePath).toLowerCase()
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File not found, serve 404
      res.writeHead(404, { 'Content-Type': 'text/html' })
      res.end('<h1>404 Not Found</h1><p>The requested file was not found.</p>')
      return
    }
    
    // Read and serve file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end('<h1>500 Internal Server Error</h1>')
        return
      }
      
      // Set content type
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    })
  })
})

server.listen(port, () => {
  console.log(`🌐 Site server running at http://localhost:${port}`)
  console.log(`📁 Serving files from: ${siteDir}`)
  console.log(`🔗 API server should be running at: http://localhost:3001`)
  console.log(`\nTo start both servers:`)
  console.log(`  Terminal 1: npm run start    (API server)`)
  console.log(`  Terminal 2: npm run site     (Site server)`)
})
