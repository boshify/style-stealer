// Test multi-page analysis feature
const testUrl = 'https://blog.gtowizard.com/the-science-of-poker-performance/';

console.log('Testing multi-page analysis with URL:', testUrl);
console.log('Starting request...\n');

const startTime = Date.now();

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
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== RESPONSE (${elapsed}s) ===`);

    if (data.success) {
      console.log('✓ Success!');
      console.log('Generation time:', data.generationTime, 'ms');
      console.log('Pages analyzed:', data.pagesAnalyzed || 'N/A');
      console.log('Markdown length:', data.markdown?.length, 'chars');

      // Check if overview mentions multiple pages
      if (data.markdown?.includes('multiple pages') || data.markdown?.includes('across pages')) {
        console.log('\n✓ Multi-page analysis detected in output!');
      }

      // Look for image types breakdown
      if (data.markdown?.includes('Featured Images') || data.markdown?.includes('Image Type')) {
        console.log('✓ Detailed image type descriptions found!');
      }

      console.log('\nFirst 1000 chars of markdown:');
      console.log(data.markdown?.substring(0, 1000));
      console.log('\n...\n');

      // Show imagery section
      const imageryMatch = data.markdown?.match(/## Imagery[^#]*(?:###[^#]*)?/s);
      if (imageryMatch) {
        console.log('\n--- IMAGERY SECTION ---');
        console.log(imageryMatch[0].substring(0, 800));
        console.log('----------------------\n');
      }
    } else {
      console.log('✗ Error:', data.error);
    }
  })
  .catch((error) => {
    console.error('✗ Request failed:', error.message);
  });

console.log('Request sent, waiting for response (may take 60-120 seconds with multi-page analysis)...');
