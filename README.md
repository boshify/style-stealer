# Style Stealer

**Automatically generate comprehensive style guides from any website using AI**

Style Stealer analyzes any website's design system and generates a professional Markdown style guide covering colors, typography, layout, spacing, and visual patterns.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)

## Features

- ✨ **Automatic Style Extraction** - Analyzes HTML & CSS to extract design tokens
- 🎨 **Comprehensive Analysis** - Colors, typography, layout, spacing, and visual patterns
- 🤖 **AI-Powered** - Uses Claude AI to generate human-readable style guides
- ⚡ **Fast & Efficient** - Hybrid scraping strategy (Cheerio + Playwright fallback)
- 📱 **Universal** - Works with any public website (static or JavaScript-heavy)
- 💾 **Export Ready** - Download style guides as Markdown files

## Quick Start

### Prerequisites

- Node.js 18+ or Node.js 22 LTS (recommended)
- npm or pnpm
- Anthropic API key ([Get one here](https://console.anthropic.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd style-stealer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:
   ```bash
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

   Get your API key from [Anthropic Console](https://console.anthropic.com/)

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter any website URL in the input field
2. Click "Generate Style Guide"
3. Wait 10-30 seconds while the app:
   - Scrapes the website
   - Analyzes design patterns
   - Generates a professional style guide
4. Copy or download the Markdown output

### Example URLs to Try

- `https://stripe.com`
- `https://github.com`
- `https://airbnb.com`
- `https://tailwindcss.com`

## How It Works

```
User Input (URL)
      ↓
┌─────────────────────────┐
│  1. Scraping Service    │
│  - Try Cheerio (fast)   │
│  - Fallback: Playwright │
└─────────────────────────┘
      ↓
┌─────────────────────────┐
│  2. Parser Service      │
│  - Extract colors       │
│  - Extract typography   │
│  - Extract layout       │
│  - Extract spacing      │
│  - Extract visuals      │
└─────────────────────────┘
      ↓
┌─────────────────────────┐
│  3. AI Service          │
│  - Claude 3.5 Haiku     │
│  - Generate Markdown    │
└─────────────────────────┘
      ↓
   Style Guide (Markdown)
```

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

### Backend
- **Cheerio** - Fast HTML parsing
- **Playwright** - Browser automation (fallback)
- **Lightning CSS** - CSS parsing
- **Anthropic SDK** - Claude AI integration
- **Zod** - Input validation

## Project Structure

```
style-stealer/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts       # API endpoint
│   ├── page.tsx               # Main UI page
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
├── lib/
│   ├── types.ts               # TypeScript types
│   ├── utils.ts               # Utility functions
│   ├── scraper.ts             # Web scraping service
│   ├── parser.ts              # CSS parsing service
│   └── ai.ts                  # Claude AI integration
├── components/                # (empty - inline components)
├── .env.local                 # Environment variables
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## API Reference

### POST /api/generate

Generate a style guide from a website URL.

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "markdown": "# Style Guide: Example...",
  "tokens": { ... },
  "generationTime": 15234
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "generationTime": 5000
}
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key for Claude | Yes |

### Scraping Options

Edit `lib/scraper.ts` to customize:
- `timeout` - Request timeout (default: 30000ms)
- `userAgent` - Custom user agent string
- `forcePlaywright` - Skip Cheerio, use Playwright directly

### Parser Options

Edit `lib/parser.ts` to customize:
- `minColorFrequency` - Minimum color occurrences to include (default: 2)
- `groupSimilarColors` - Group similar colors (default: true)
- `colorSimilarityThreshold` - Color grouping threshold (default: 20)

## Cost Estimation

Approximate costs per generation (using Claude 3.5 Haiku):

- **Simple website**: $0.01 - $0.02
- **Medium website**: $0.02 - $0.05
- **Complex website**: $0.05 - $0.10

### Cost Optimization Tips

1. Use Claude 3.5 Haiku (default) - most cost-efficient
2. Enable color grouping to reduce token count
3. Limit extracted values (edit parser settings)
4. Consider batch processing for multiple sites

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel Dashboard](https://vercel.com)
3. Add `ANTHROPIC_API_KEY` environment variable
4. Deploy

### Other Platforms

The app can be deployed to:
- **Netlify** - Add build command: `npm run build`
- **AWS Amplify** - Configure Next.js SSR
- **Cloudflare Pages** - Use Node.js compatibility mode
- **Railway** - Add environment variables in dashboard

## Troubleshooting

### "API key not configured"
- Ensure `.env.local` exists and contains `ANTHROPIC_API_KEY`
- Restart the development server after adding environment variables

### "Request timeout"
- Some websites are slow to respond
- Try increasing timeout in `lib/scraper.ts`
- Use `forcePlaywright: true` option

### "Insufficient CSS detected"
- Website may be JavaScript-heavy
- Playwright fallback will activate automatically
- Check console logs for scraping method used

### "Rate limit exceeded"
- Default: 10 requests per hour per IP
- Edit rate limiting in `app/api/generate/route.ts`
- Consider implementing Redis-based rate limiting for production

## Development

### Run in Development Mode
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm run start
```

### Type Check
```bash
npx tsc --noEmit
```

### Lint
```bash
npm run lint
```

## Roadmap

- [ ] Add markdown rendering preview (not just plain text)
- [ ] Export to JSON design tokens
- [ ] Export to Figma tokens format
- [ ] Dark mode detection
- [ ] Component library recognition (Bootstrap, Material UI, etc.)
- [ ] Screenshot comparison tool
- [ ] Accessibility audit (WCAG contrast ratios)
- [ ] Batch processing for multiple URLs
- [ ] User accounts and saved style guides
- [ ] Browser extension for one-click generation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- AI powered by [Anthropic Claude](https://www.anthropic.com/)
- Web scraping with [Cheerio](https://cheerio.js.org/) and [Playwright](https://playwright.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: [your-email@example.com]

---

Made with ❤️ by the Style Stealer team
