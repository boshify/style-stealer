// Test API with authentication and webhook
const API_URL = 'http://localhost:3002/api/generate';
const API_KEY = process.env.API_KEY || 'sk-stylesstealer-test-key-12345678';

console.log('Testing API with Authentication\n');
console.log('API Key:', API_KEY.substring(0, 15) + '...');
console.log('API URL:', API_URL);
console.log('='.repeat(60), '\n');

// Test 1: Valid request with authentication
async function testValidRequest() {
  console.log('Test 1: Valid authenticated request');
  console.log('-'.repeat(60));

  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        url: 'https://website.com/test', // Use test URL for speed
      }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Time: ${elapsed}s`);

    // Check rate limit headers
    console.log('\nRate Limit Headers:');
    console.log(`  Limit: ${response.headers.get('X-RateLimit-Limit')}`);
    console.log(`  Remaining: ${response.headers.get('X-RateLimit-Remaining')}`);
    console.log(`  Reset: ${response.headers.get('X-RateLimit-Reset')}`);

    const data = await response.json();

    if (data.success) {
      console.log('\n✓ SUCCESS');
      console.log(`  Generation Time: ${data.generationTime}ms`);
      console.log(`  Pages Analyzed: ${data.pagesAnalyzed}`);
      console.log(`  Markdown Length: ${data.markdown?.length} chars`);
    } else {
      console.log('\n✗ FAILED');
      console.log(`  Error: ${data.error}`);
    }
  } catch (error) {
    console.error('\n✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 2: Missing authentication
async function testMissingAuth() {
  console.log('Test 2: Missing authentication');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
      body: JSON.stringify({
        url: 'https://website.com/test',
      }),
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}`);
    console.log(`Expected: 401 (Unauthorized)`);

    if (response.status === 401) {
      console.log('\n✓ CORRECT - Request blocked (unauthorized)');
      console.log(`  Error: ${data.error}`);
    } else {
      console.log('\n✗ WRONG - Should have returned 401');
    }
  } catch (error) {
    console.error('\n✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 3: Invalid API key
async function testInvalidApiKey() {
  console.log('Test 3: Invalid API key');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-key',
      },
      body: JSON.stringify({
        url: 'https://website.com/test',
      }),
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}`);
    console.log(`Expected: 401 (Unauthorized)`);

    if (response.status === 401) {
      console.log('\n✓ CORRECT - Invalid key rejected');
      console.log(`  Error: ${data.error}`);
    } else {
      console.log('\n✗ WRONG - Should have returned 401');
    }
  } catch (error) {
    console.error('\n✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 4: Invalid URL
async function testInvalidUrl() {
  console.log('Test 4: Invalid URL');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        url: 'not-a-valid-url',
      }),
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}`);
    console.log(`Expected: 400 (Bad Request)`);

    if (response.status === 400) {
      console.log('\n✓ CORRECT - Invalid URL rejected');
      console.log(`  Error: ${data.error}`);
    } else {
      console.log('\n✗ WRONG - Should have returned 400');
    }
  } catch (error) {
    console.error('\n✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 5: With webhook URL
async function testWithWebhook() {
  console.log('Test 5: Request with webhook URL');
  console.log('-'.repeat(60));

  const webhookUrl = 'https://webhook.site/unique-id-here';
  console.log(`Webhook URL: ${webhookUrl}`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        url: 'https://website.com/test',
        webhook_url: webhookUrl,
      }),
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}`);

    if (data.success) {
      console.log('\n✓ SUCCESS - Webhook will be called');
      console.log('  Check webhook.site to see the posted data');
    } else {
      console.log('\n✗ FAILED');
      console.log(`  Error: ${data.error}`);
    }
  } catch (error) {
    console.error('\n✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Run all tests
async function runAllTests() {
  await testValidRequest();
  await testMissingAuth();
  await testInvalidApiKey();
  await testInvalidUrl();
  await testWithWebhook();

  console.log('='.repeat(60));
  console.log('All tests completed!');
  console.log('\nNote: Make sure to set up API_KEYS in your .env file');
  console.log('API_KEYS=sk-stylesstealer-test-key-12345678');
}

runAllTests();
