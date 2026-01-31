/**
 * Test script for page discovery
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

import { discoverPages } from './lib/page-discovery';
import { scrapeWebsite } from './lib/scraper';

async function test() {
  console.log('Testing intelligent page discovery...\n');

  const url = 'https://www.tealhq.com/blog';
  console.log(`Target URL: ${url}\n`);

  // Scrape the page
  console.log('Step 1: Scraping page...');
  const scrapedData = await scrapeWebsite(url, { timeout: 30000 });
  console.log(`✓ Scraped (${scrapedData.html.length} bytes of HTML)\n`);

  // Discover additional pages
  console.log('Step 2: Running intelligent discovery...');
  const additionalPages = await discoverPages(url, scrapedData.html);
  console.log(`\n✓ Discovery complete!`);
  console.log(`Found ${additionalPages.length} additional pages:`);
  additionalPages.forEach((page, i) => {
    console.log(`  ${i + 1}. ${page}`);
  });
}

test().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
