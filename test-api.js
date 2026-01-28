// Quick test script for the API
const testUrl = 'https://blog.gtowizard.com/the-science-of-poker-performance/';

console.log('Testing API with URL:', testUrl);
console.log('Starting request...\n');

fetch('http://localhost:3002/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url: testUrl }),
})
  .then((res) => {
    console.log('Response status:', res.status);
    return res.json();
  })
  .then((data) => {
    console.log('\n=== RESPONSE ===');
    if (data.success) {
      console.log('✓ Success!');
      console.log('Generation time:', data.generationTime, 'ms');
      console.log('Markdown length:', data.markdown?.length, 'chars');
      console.log('\nFirst 500 chars of markdown:');
      console.log(data.markdown?.substring(0, 500));
    } else {
      console.log('✗ Error:', data.error);
    }
  })
  .catch((error) => {
    console.error('✗ Request failed:', error.message);
  });

console.log('Request sent, waiting for response...');
