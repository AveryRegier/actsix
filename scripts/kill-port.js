#!/usr/bin/env node

import { execSync } from 'child_process'

const appPort = process.env.PORT || 3001
const ports = [...new Set([String(appPort), '3101'])]

ports.forEach(port => {
  try {
    console.log(`🔍 Checking for processes using port ${port}...`)

    // Find processes using the port
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })

    if (result) {
      const lines = result.split('\n').filter(line => line.trim())
      const pids = new Set()

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 5) {
          const pid = parts[parts.length - 1]
          if (pid && pid !== '0') {
            pids.add(pid)
          }
        }
      })

      if (pids.size > 0) {
        console.log(`🔄 Found ${pids.size} process(es) using port ${port}`)
        pids.forEach(pid => {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
            console.log(`✅ Killed process ${pid}`)
          } catch (error) {
            console.log(`⚠️  Could not kill process ${pid}`)
          }
        })
      } else {
        console.log(`✅ No processes found using port ${port}`)
      }
    } else {
      console.log(`✅ Port ${port} is available`)
    }
  } catch (error) {
    console.log(`✅ Port ${port} appears to be available`)
  }
})

console.log(`🚀 Ports ${ports.join(', ')} are ready for use`)
