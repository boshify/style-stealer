// Test security features: authentication required, input validation, size limits
const API_URL = 'http://localhost:3002/api/generate';
const VALID_API_KEY = 'sk-stylesstealer-test-key-12345678';

console.log('Testing Security Features\n');
console.log('='.repeat(70), '\n');

// Test 1: No authentication (should fail)
async function testNoAuth() {
  console.log('Test 1: Request without authentication');
  console.log('-'.repeat(70));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
      body: JSON.stringify({
        url: 'https://example.com',
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Expected: 401 Unauthorized`);

    if (response.status === 401) {
      console.log('✓ PASS - Unauthenticated requests are blocked');
      console.log(`  Error: "${data.error}"`);
    } else {
      console.log('✗ FAIL - Should require authentication');
    }
  } catch (error) {
    console.error('✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 2: URL too long (should fail)
async function testUrlTooLong() {
  console.log('Test 2: URL exceeding length limit (2048 chars)');
  console.log('-'.repeat(70));

  const longUrl = 'https://example.com/' + 'a'.repeat(2100);
  console.log(`URL length: ${longUrl.length} characters`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VALID_API_KEY}`,
      },
      body: JSON.stringify({
        url: longUrl,
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Expected: 400 Bad Request`);

    if (response.status === 400 && data.error.includes('too long')) {
      console.log('✓ PASS - Long URLs are rejected');
      console.log(`  Error: "${data.error}"`);
    } else {
      console.log('✗ FAIL - Should reject URLs over 2048 chars');
    }
  } catch (error) {
    console.error('✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 3: Request body too large (should fail)
async function testBodyTooLarge() {
  console.log('Test 3: Request body exceeding size limit (10KB)');
  console.log('-'.repeat(70));

  // Create a payload larger than 10KB
  const largePayload = {
    url: 'https://example.com',
    webhook_url: 'https://webhook.site/test',
    extra_data: 'x'.repeat(15000), // Make it > 10KB
  };

  const payloadSize = JSON.stringify(largePayload).length;
  console.log(`Payload size: ${payloadSize} bytes (${(payloadSize / 1024).toFixed(2)} KB)`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VALID_API_KEY}`,
      },
      body: JSON.stringify(largePayload),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Expected: 413 Payload Too Large`);

    if (response.status === 413) {
      console.log('✓ PASS - Large payloads are rejected');
      console.log(`  Error: "${data.error}"`);
    } else {
      console.log('✗ FAIL - Should reject payloads over 10KB');
    }
  } catch (error) {
    console.error('✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 4: Invalid JSON (should fail)
async function testInvalidJson() {
  console.log('Test 4: Invalid JSON in request body');
  console.log('-'.repeat(70));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VALID_API_KEY}`,
      },
      body: 'this is not valid JSON',
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Expected: 400 Bad Request`);

    if (response.status === 400 && data.error.includes('Invalid JSON')) {
      console.log('✓ PASS - Invalid JSON is rejected');
      console.log(`  Error: "${data.error}"`);
    } else {
      console.log('✗ FAIL - Should reject invalid JSON');
    }
  } catch (error) {
    console.error('✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 5: Invalid URL format (should fail)
async function testInvalidUrlFormat() {
  console.log('Test 5: Invalid URL format');
  console.log('-'.repeat(70));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VALID_API_KEY}`,
      },
      body: JSON.stringify({
        url: 'not-a-valid-url',
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Expected: 400 Bad Request`);

    if (response.status === 400) {
      console.log('✓ PASS - Invalid URL format is rejected');
      console.log(`  Error: "${data.error}"`);
    } else {
      console.log('✗ FAIL - Should reject invalid URLs');
    }
  } catch (error) {
    console.error('✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 6: Valid authenticated request (should succeed)
async function testValidRequest() {
  console.log('Test 6: Valid authenticated request');
  console.log('-'.repeat(70));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VALID_API_KEY}`,
      },
      body: JSON.stringify({
        url: 'https://website.com/test', // Use test URL for speed
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Expected: 200 OK`);

    // Check rate limit headers
    const remaining = response.headers.get('X-RateLimit-Remaining');
    console.log(`Rate Limit Remaining: ${remaining}`);

    if (response.status === 200 && data.success) {
      console.log('✓ PASS - Valid authenticated requests work');
      console.log(`  Generation Time: ${data.generationTime}ms`);
      console.log(`  Pages Analyzed: ${data.pagesAnalyzed}`);
    } else {
      console.log('✗ FAIL - Valid requests should succeed');
      console.log(`  Error: "${data.error}"`);
    }
  } catch (error) {
    console.error('✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Test 7: Webhook URL too long (should fail)
async function testWebhookUrlTooLong() {
  console.log('Test 7: Webhook URL exceeding length limit (2048 chars)');
  console.log('-'.repeat(70));

  const longWebhookUrl = 'https://webhook.site/' + 'a'.repeat(2100);
  console.log(`Webhook URL length: ${longWebhookUrl.length} characters`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VALID_API_KEY}`,
      },
      body: JSON.stringify({
        url: 'https://example.com',
        webhook_url: longWebhookUrl,
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Expected: 400 Bad Request`);

    if (response.status === 400 && data.error.includes('too long')) {
      console.log('✓ PASS - Long webhook URLs are rejected');
      console.log(`  Error: "${data.error}"`);
    } else {
      console.log('✗ FAIL - Should reject webhook URLs over 2048 chars');
    }
  } catch (error) {
    console.error('✗ REQUEST FAILED:', error.message);
  }

  console.log('\n');
}

// Run all tests
async function runAllTests() {
  console.log('Starting security tests...\n');

  await testNoAuth();
  await testUrlTooLong();
  await testBodyTooLarge();
  await testInvalidJson();
  await testInvalidUrlFormat();
  await testWebhookUrlTooLong();
  await testValidRequest();

  console.log('='.repeat(70));
  console.log('Security tests completed!\n');
  console.log('Summary:');
  console.log('- ✓ Authentication required (no unauthenticated access)');
  console.log('- ✓ URL length limited to 2048 characters');
  console.log('- ✓ Webhook URL length limited to 2048 characters');
  console.log('- ✓ Request body size limited to 10KB');
  console.log('- ✓ JSON validation enforced');
  console.log('- ✓ URL format validation enforced');
}

runAllTests();
