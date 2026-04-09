#!/usr/bin/env node

import { promises as fs } from 'fs'
import { join } from 'path'

const BUILD_DIR = 'dist'
const SRC_DIR = 'src'

async function build() {
  console.log('🚀 Starting build process...')
  
  try {
    // Clean build directory
    console.log('🧹 Cleaning build directory...')
    await fs.rm(BUILD_DIR, { recursive: true, force: true })
    await fs.mkdir(BUILD_DIR, { recursive: true })
    
    // Copy source files
    console.log('📦 Copying source files...')
    const srcFiles = await fs.readdir(SRC_DIR)
    
    for (const file of srcFiles) {
      const srcPath = join(SRC_DIR, file)
      const destPath = join(BUILD_DIR, file)
      
      const stats = await fs.stat(srcPath)
      if (stats.isFile()) {
        await fs.copyFile(srcPath, destPath)
        console.log(`  ✅ Copied ${file}`)
      }
    }
    
    // Copy package.json (excluding dev dependencies)
    console.log('📄 Creating production package.json...')
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'))
    
    const prodPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      type: packageJson.type,
      main: 'lambda.js', // Updated for production build
      dependencies: packageJson.dependencies,
      keywords: packageJson.keywords,
      author: packageJson.author,
      license: packageJson.license
    }
    
    await fs.writeFile(
      join(BUILD_DIR, 'package.json'),
      JSON.stringify(prodPackageJson, null, 2)
    )
    
    console.log('✅ Build complete!')
    console.log(`📁 Build output: ${BUILD_DIR}/`)

    // Copy marked.min.js browser bundle into site/ so help pages can use it
    console.log('📦 Copying marked.min.js to site/...')
    await fs.copyFile(
      join('node_modules', 'marked', 'marked.min.js'),
      join('site', 'marked.min.js')
    )
    console.log('  ✅ Copied marked.min.js')

  } catch (error) {
    console.error('❌ Build failed:', error.message)
    process.exit(1)
  }
}

build()
