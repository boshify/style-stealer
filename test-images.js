// Test image analysis feature
const testUrl = 'https://blog.gtowizard.com/the-science-of-poker-performance/';

console.log('Testing image analysis with URL:', testUrl);
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
      console.log('Markdown length:', data.markdown?.length, 'chars');

      // Check if image analysis section is present
      if (data.markdown?.includes('Image Analysis')) {
        console.log('\n✓ Image Analysis section found in output!');

        // Extract and display the image analysis section
        const imageSection = data.markdown.match(/### Image Analysis[\s\S]*?(?=\n##|\n---|\n\n##|$)/);
        if (imageSection) {
          console.log('\n--- IMAGE ANALYSIS ---');
          console.log(imageSection[0]);
          console.log('----------------------\n');
        }
      } else {
        console.log('\n⚠ No Image Analysis section found (images may have been skipped)');
      }

      console.log('\nFirst 800 chars of full markdown:');
      console.log(data.markdown?.substring(0, 800));
    } else {
      console.log('✗ Error:', data.error);
    }
  })
  .catch((error) => {
    console.error('✗ Request failed:', error.message);
  });

console.log('Request sent, waiting for response (this may take 30-60 seconds with image analysis)...');
