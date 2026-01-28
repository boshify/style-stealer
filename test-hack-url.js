// Test the hack URL that returns instant dummy data
const testUrl = 'https://website.com/test';

console.log('Testing hack URL:', testUrl);
console.log('Should return instantly with dummy data...\n');

const startTime = Date.now();

fetch('http://localhost:3002/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url: testUrl }),
})
  .then((res) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);
    console.log(`Response received in ${elapsed}s`);
    console.log('Response status:', res.status);
    return res.json();
  })
  .then((data) => {
    console.log('\n=== RESPONSE ===');

    if (data.success) {
      console.log('✓ Success!');
      console.log('Generation time:', data.generationTime, 'ms');
      console.log('Pages analyzed:', data.pagesAnalyzed);
      console.log('Markdown length:', data.markdown?.length, 'chars');

      console.log('\nFirst 500 chars:');
      console.log(data.markdown?.substring(0, 500));
      console.log('\n...\n');

      if (data.markdown?.includes('test style guide')) {
        console.log('✓ Dummy data detected!');
      }
    } else {
      console.log('✗ Error:', data.error);
    }
  })
  .catch((error) => {
    console.error('✗ Request failed:', error.message);
  });

console.log('Request sent...');
