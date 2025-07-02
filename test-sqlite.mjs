import ConfigurationManager from './lib/configuration-manager.js';

console.log('🧪 Testing SQLite integration...');

const config = new ConfigurationManager(process.cwd(), {verbose: true});

console.log('📊 Bundle count:', config.bundleStates.size);
console.log('🗄️ Database info:', config.dbManager.getInfo());

// Test a query
try {
  const results = config.dbManager.query('SELECT name, file_count, size FROM bundles LIMIT 5');
  console.log('📋 Sample bundles:', results);
} catch (error) {
  console.error('❌ Query failed:', error.message);
}

console.log('✅ SQLite test completed');