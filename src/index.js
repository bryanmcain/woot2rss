const server = require('./server');
const db = require('./db');

// Migrate data from legacy table to new category-specific tables (if needed)
try {
  console.log('Checking for legacy data migration needs...');
  db.migrateFromLegacyTable();
} catch (error) {
  console.error('Error during database migration check:', error);
}

// This file just imports and runs the server
// This structure makes it easier to test the server separately