import { serve } from '@hono/node-server'
import { createApp } from './api.js'

const app = createApp()

const port = process.env.PORT || 3001
console.log(`Server is running on port ${port}`)

// Create server instance
const server = serve({
  fetch: app.fetch,
  port
})

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`)
  
  if (server && server.close) {
    server.close(() => {
      console.log('Server closed.')
      process.exit(0)
    })
    
    // Force close after 5 seconds
    setTimeout(() => {
      console.log('Forcing server shutdown...')
      process.exit(1)
    }, 5000)
  } else {
    console.log('Server shutdown completed.')
    process.exit(0)
  }
}

// Handle various shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  gracefulShutdown('UNCAUGHT_EXCEPTION')
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  gracefulShutdown('UNHANDLED_REJECTION')
})

console.log('Press Ctrl+C to stop the server')
