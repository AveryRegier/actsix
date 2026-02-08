#!/usr/bin/env node

/**
 * Migration Script: Populate common_locations collection from JSON file
 * 
 * This script reads the existing site/common-locations.json file and
 * migrates all 27 locations into the common_locations database collection.
 * 
 * Usage:
 *   node scripts/migrate-locations.js
 * 
 * Environment Requirements:
 *   - AWS credentials configured (for S3-based Sengo database)
 *   - GENERATION_API_KEY set (if using API authentication)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../src/util/sengoClient.js';
import { getLogger } from '../src/util/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

async function migrateLocations() {
  try {
    log('\n🚀 Starting Common Locations Migration', colors.bright);
    log('═'.repeat(60));

    // Step 1: Read JSON file
    logInfo('Step 1: Reading site/common-locations.json...');
    const jsonPath = join(__dirname, '..', 'site', 'common-locations.json');
    const fileContent = readFileSync(jsonPath, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    
    if (!jsonData.locations || !Array.isArray(jsonData.locations)) {
      throw new Error('Invalid JSON format: expected { locations: [...] }');
    }

    const locations = jsonData.locations;
    logSuccess(`Found ${locations.length} locations in JSON file`);

    // Step 2: Check if collection already has data
    logInfo('\nStep 2: Checking existing data in common_locations collection...');
    const collection = db.collection('common_locations');
    const existingDocs = await collection.find({}).toArray();
    const existingCount = existingDocs.length;
    
    if (existingCount > 0) {
      logWarning(`Collection already contains ${existingCount} document(s)`);
      log('This script will skip duplicate entries based on name and address.');
    } else {
      logSuccess('Collection is empty, ready to migrate');
    }

    // Step 3: Migrate each location
    logInfo('\nStep 3: Migrating locations...');
    log('─'.repeat(60));

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const num = String(i + 1).padStart(2, '0');
      
      try {
        // Check if location already exists (by name and street address)
        const existing = await collection.findOne({
          name: loc.name,
          'address.street': loc.address.street
        });

        if (existing) {
          log(`${num}. ${loc.name} - ${colors.yellow}SKIPPED (already exists)${colors.reset}`);
          skipped++;
          continue;
        }

        // Prepare document with required fields
        const document = {
          name: loc.name,
          type: loc.type,
          address: {
            street: loc.address.street,
            city: loc.address.city,
            state: loc.address.state,
            zipCode: loc.address.zipCode
          },
          phone: loc.phone || '',
          website: loc.website || '',
          visitingHours: loc.visitingHours || '',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Insert into collection
        const result = await collection.insertOne(document);
        
        if (result.insertedId) {
          log(`${num}. ${loc.name} - ${colors.green}✓ Inserted (ID: ${result.insertedId})${colors.reset}`);
          inserted++;
        } else {
          log(`${num}. ${loc.name} - ${colors.red}✗ Failed${colors.reset}`);
          errors++;
        }

      } catch (error) {
        log(`${num}. ${loc.name} - ${colors.red}✗ Error: ${error.message}${colors.reset}`);
        errors++;
        getLogger().error({ location: loc.name, error }, 'Migration error');
      }
    }

    // Step 4: Summary
    log('\n' + '═'.repeat(60));
    log('📊 Migration Summary', colors.bright);
    log('─'.repeat(60));
    logSuccess(`Inserted: ${inserted}`);
    if (skipped > 0) logWarning(`Skipped:  ${skipped}`);
    if (errors > 0) logError(`Errors:   ${errors}`);
    log('─'.repeat(60));

    // Step 5: Verify final count
    const finalDocs = await collection.find({ isActive: true }).toArray();
    const finalCount = finalDocs.length;
    logInfo(`\nTotal active locations in database: ${finalCount}`);

    // Step 6: Show location breakdown by type
    log('\n📋 Location Breakdown by Type:', colors.bright);
    const types = ['hospital', 'nursing_home', 'assisted_living', 'rehab'];
    for (const type of types) {
      const typeDocs = await collection.find({ type, isActive: true }).toArray();
      const count = typeDocs.length;
      const label = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      log(`   ${label}: ${count}`);
    }

    if (errors === 0) {
      log('\n' + '═'.repeat(60));
      logSuccess('Migration completed successfully! ✨');
      log('═'.repeat(60) + '\n');
      process.exit(0);
    } else {
      log('\n' + '═'.repeat(60));
      logWarning('Migration completed with errors. See logs above.');
      log('═'.repeat(60) + '\n');
      process.exit(1);
    }

  } catch (error) {
    logError(`\nMigration failed: ${error.message}`);
    getLogger().error(error, 'Fatal migration error');
    process.exit(1);
  }
}

// Run migration
migrateLocations().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
