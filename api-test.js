
// Debug test script for Woot API
const api = require('./src/api');
const category = process.argv[2] || 'Featured';

async function testApi() {
  console.log(`Testing API for category: ${category}`);
  
  try {
    const result = await api.getListings(category);
    console.log('===== TEST COMPLETE =====');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testApi();
