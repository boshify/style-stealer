const testUrl = 'https://blog.gtowizard.com/the-science-of-poker-performance/';

fetch('http://localhost:3002/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: testUrl }),
})
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      console.log('=== FULL MARKDOWN OUTPUT ===\n');
      console.log(data.markdown);
      console.log('\n=== END ===');
      
      // Check for image-related keywords
      const keywords = ['illustration', 'professional', 'visual style', 'imagery', 'image'];
      console.log('\n=== KEYWORD CHECK ===');
      keywords.forEach(kw => {
        if (data.markdown.toLowerCase().includes(kw)) {
          console.log(`✓ Found: ${kw}`);
        }
      });
    }
  });
