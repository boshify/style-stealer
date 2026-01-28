/**
 * AI Service - Claude API integration for style guide generation
 */

import Anthropic from '@anthropic-ai/sdk';
import type { DesignTokens, ImageAnalysis } from './types';
import { getDomain, toAbsoluteUrl } from './utils';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Latest Claude models - https://platform.claude.com/docs/en/about-claude/models/overview
const MODEL = 'claude-3-5-haiku-20241022'; // Cost-efficient for text
const VISION_MODEL = 'claude-3-5-sonnet-20241022'; // Sonnet for vision (best quality)
const MAX_TOKENS = 4096;

/**
 * Generate a markdown style guide from design tokens
 */
export async function generateStyleGuide(tokens: DesignTokens): Promise<string> {
  console.log('[AI] Generating style guide with Claude...');

  const systemPrompt = getSystemPrompt();
  const userPrompt = formatTokensForPrompt(tokens);

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content from response
    const content = message.content[0];
    if (content.type === 'text') {
      const markdown = content.text;
      console.log('[AI] Style guide generated successfully');
      return markdown;
    }

    throw new Error('Unexpected response format from Claude');
  } catch (error) {
    console.error('[AI] Error generating style guide:', error);
    throw new Error('Failed to generate style guide: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * System prompt for Claude
 */
function getSystemPrompt(): string {
  return `You are an expert UI/UX designer and front-end developer creating professional website style guides.

Your task is to analyze design tokens extracted from a website and generate a comprehensive, well-structured style guide in Markdown format.

## Output Format Requirements:

1. **Title**: Use # for the main title in format: "Style Guide: [Website Name]"
2. **Sections**: Use ## for major sections
3. **Subsections**: Use ### for subsections when needed
4. **Lists**: Use bullet points (-) for lists
5. **Tables**: Use Markdown tables for structured data (colors, typography scales)
6. **Code**: Use inline code (\`) for color values, font names, and CSS values
7. **Emphasis**: Use **bold** for important terms

## Required Sections:

1. **Overview** - Brief description of the design aesthetic (2-3 sentences)
2. **Color Palette** - List each color with hex code, name, and usage
3. **Typography** - Font families, sizes, weights, and hierarchy
4. **Layout & Spacing** - Grid system, breakpoints, spacing scale
5. **Visual Style** - Border radius, shadows, and other visual patterns
6. **Imagery** - Notes about images, icons, and visual motifs

## Style Guidelines:

- Be specific and descriptive
- Infer design intent from the data
- Use proper color names (e.g., "Navy Blue #1A3A52" not just "#1A3A52")
- Describe usage patterns (e.g., "Used for primary buttons and headers")
- Keep tone professional but accessible
- Focus on actionable insights for designers and developers
- Do NOT invent or hallucinate information not present in the data
- If certain information is missing or unclear, acknowledge it briefly

## Example Color Entry:
- **Primary Navy** (\`#1A3A52\`) - Used for headers, navigation, and primary buttons. Conveys trust and professionalism.

## Example Typography Entry:
**Body Font**: \`Inter, -apple-system, sans-serif\`
- Base size: 16px
- Line height: 1.6
- Used for all body text, paragraphs, and UI elements

Remember: Your output should be immediately usable as documentation for a design system.`;
}

/**
 * Format design tokens into a prompt for Claude
 */
function formatTokensForPrompt(tokens: DesignTokens): string {
  const { colors, typography, layout, spacing, visual, imagery, metadata } = tokens;
  const domain = getDomain(metadata.url);

  let prompt = `Generate a comprehensive style guide for the following website:\n\n`;
  prompt += `**URL**: ${metadata.url}\n`;
  prompt += `**Domain**: ${domain}\n`;
  prompt += `**Title**: ${metadata.title}\n\n`;
  prompt += `---\n\n`;
  prompt += `## Extracted Design Tokens\n\n`;

  // Colors
  if (colors.length > 0) {
    prompt += `### Colors\n\n`;
    prompt += `Found ${colors.length} distinct colors:\n\n`;
    colors.forEach((color, index) => {
      const contexts = color.contexts.length > 0 ? ` (${color.contexts.join(', ')})` : '';
      prompt += `${index + 1}. \`${color.value}\` - ${color.name || 'Unknown'} - ${color.frequency} occurrences${contexts}\n`;
    });
    prompt += `\n`;
  } else {
    prompt += `### Colors\nNo significant colors detected.\n\n`;
  }

  // Typography
  prompt += `### Typography\n\n`;

  if (typography.fontFamilies.length > 0) {
    prompt += `**Font Families**:\n`;
    typography.fontFamilies.forEach((font) => {
      const usage = font.usage !== 'unknown' ? ` (${font.usage})` : '';
      prompt += `- ${font.name}${usage} - ${font.frequency} occurrences\n`;
      prompt += `  - Full stack: \`${font.stack}\`\n`;
    });
    prompt += `\n`;
  }

  if (typography.fontSizes.length > 0) {
    prompt += `**Font Sizes**:\n`;
    const topSizes = typography.fontSizes.slice(0, 8);
    topSizes.forEach((size) => {
      prompt += `- ${size.value} (${size.pxValue}px) - ${size.frequency} occurrences\n`;
    });
    prompt += `\n`;
  }

  if (typography.fontWeights.length > 0) {
    prompt += `**Font Weights**: ${typography.fontWeights.join(', ')}\n\n`;
  }

  if (typography.lineHeights.length > 0) {
    prompt += `**Line Heights**: ${typography.lineHeights.join(', ')}\n\n`;
  }

  if (Object.keys(typography.headingSizes).length > 0) {
    prompt += `**Heading Sizes**:\n`;
    Object.entries(typography.headingSizes).forEach(([tag, size]) => {
      prompt += `- ${tag}: ${size}\n`;
    });
    prompt += `\n`;
  }

  // Layout
  prompt += `### Layout\n\n`;
  prompt += `- **Uses CSS Grid**: ${layout.usesGrid ? 'Yes' : 'No'}\n`;
  prompt += `- **Uses Flexbox**: ${layout.usesFlex ? 'Yes' : 'No'}\n`;

  if (layout.maxWidth) {
    prompt += `- **Max Content Width**: ${layout.maxWidth}\n`;
  }

  if (layout.gridColumns) {
    prompt += `- **Grid Columns**: ${layout.gridColumns}\n`;
  }

  if (layout.breakpoints.length > 0) {
    prompt += `\n**Breakpoints**:\n`;
    layout.breakpoints.forEach((bp) => {
      prompt += `- ${bp.name}: ${bp.value} (${bp.pxValue}px)\n`;
    });
  }
  prompt += `\n`;

  // Spacing
  prompt += `### Spacing\n\n`;

  if (spacing.baseUnit) {
    prompt += `- **Base Unit**: ${spacing.baseUnit}px\n`;
  }

  if (spacing.scale.length > 0) {
    prompt += `- **Spacing Scale**: ${spacing.scale.slice(0, 10).join(', ')}\n`;
  }

  if (spacing.commonValues.length > 0) {
    prompt += `\n**Most Common Spacing Values**:\n`;
    spacing.commonValues.slice(0, 8).forEach((val) => {
      prompt += `- ${val.value} (${val.pxValue}px) - ${val.type} - ${val.frequency} occurrences\n`;
    });
  }
  prompt += `\n`;

  // Visual Patterns
  prompt += `### Visual Patterns\n\n`;

  if (visual.borderRadius.length > 0) {
    prompt += `- **Border Radius**: ${visual.borderRadius.join(', ')}\n`;
  }

  if (visual.boxShadows.length > 0) {
    prompt += `- **Box Shadows**: ${visual.boxShadows.length} distinct shadows detected\n`;
    visual.boxShadows.slice(0, 3).forEach((shadow) => {
      prompt += `  - \`${shadow.value}\` (${shadow.frequency} uses)\n`;
    });
  } else {
    prompt += `- **Box Shadows**: None or minimal\n`;
  }

  if (visual.gradients.length > 0) {
    prompt += `- **Gradients**: ${visual.gradients.length} gradient(s) detected\n`;
  }

  if (visual.transitions.length > 0) {
    prompt += `- **Transitions**: ${visual.transitions.length} transition pattern(s)\n`;
  }
  prompt += `\n`;

  // Imagery
  prompt += `### Imagery & Icons\n\n`;
  prompt += `- **Total Images**: ${imagery.imageUrls.length}\n`;
  prompt += `- **Icon Pattern**: ${imagery.iconPattern || 'Not detected'}\n`;

  if (imagery.logoUrl) {
    prompt += `- **Logo**: Detected\n`;
  }

  if (imagery.heroImageUrl) {
    prompt += `- **Hero Image**: Detected\n`;
  }

  // Add image analysis if available
  if (imagery.analysis) {
    prompt += `\n**AI-Powered Image Analysis**:\n`;
    prompt += `- Visual Style: ${imagery.analysis.style}\n`;
    prompt += `- Tone: ${imagery.analysis.tone}\n`;
    prompt += `- Quality: ${imagery.analysis.quality}\n`;
    prompt += `- Consistency: ${imagery.analysis.consistency}\n`;
    if (imagery.analysis.dominantColors.length > 0) {
      prompt += `- Dominant Colors in Images: ${imagery.analysis.dominantColors.join(', ')}\n`;
    }
    if (imagery.analysis.subjects.length > 0) {
      prompt += `- Subject Matter: ${imagery.analysis.subjects.join(', ')}\n`;
    }
  }

  prompt += `\n---\n\n`;
  prompt += `Using the above design tokens, create a professional, comprehensive style guide in Markdown format. Follow all format requirements and include all required sections. Be descriptive and insightful about the design choices and patterns.`;

  return prompt;
}

/**
 * Analyze images from the website using Claude's vision capabilities
 * Provides vivid, detailed descriptions suitable for AI image generation
 */
export async function analyzeImages(
  imageUrls: string[],
  baseUrl: string
): Promise<ImageAnalysis | null> {
  if (imageUrls.length === 0) {
    console.log('[AI:Images] No images to analyze');
    return null;
  }

  console.log('[AI:Images] Analyzing', imageUrls.length, 'images...');

  // Select up to 6 representative images (increased for more diverse analysis)
  const selectedImages = selectRepresentativeImages(imageUrls, 6);

  if (selectedImages.length === 0) {
    console.log('[AI:Images] No valid images selected');
    return null;
  }

  console.log('[AI:Images] Selected', selectedImages.length, 'images for analysis');

  try {
    // Fetch images and convert to base64
    const imageData = await Promise.all(
      selectedImages.map(async (url) => {
        try {
          const absoluteUrl = toAbsoluteUrl(url, baseUrl);
          console.log('[AI:Images] Fetching:', absoluteUrl);

          const response = await fetch(absoluteUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          if (!response.ok) {
            console.log('[AI:Images] Failed to fetch:', absoluteUrl, response.status);
            return null;
          }

          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');

          // Detect media type - must be one of the allowed types
          let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('png')) mediaType = 'image/png';
          else if (contentType?.includes('gif')) mediaType = 'image/gif';
          else if (contentType?.includes('webp')) mediaType = 'image/webp';

          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mediaType,
              data: base64,
            },
          };
        } catch (error) {
          console.error('[AI:Images] Error fetching image:', url, error);
          return null;
        }
      })
    );

    // Filter out failed fetches
    const validImages = imageData.filter((img) => img !== null);

    if (validImages.length === 0) {
      console.log('[AI:Images] No images could be fetched');
      return null;
    }

    console.log('[AI:Images] Successfully fetched', validImages.length, 'images');

    // Analyze with Claude vision
    let message;
    try {
      console.log('[AI:Images] Attempting with model:', VISION_MODEL);
      message = await anthropic.messages.create({
        model: VISION_MODEL,
        max_tokens: 2048, // Increased for detailed descriptions
        messages: [
          {
            role: 'user',
            content: [
              ...validImages,
              {
                type: 'text',
                text: `Analyze these images from a website and provide an extremely detailed, vivid analysis of the imagery. Your descriptions should be so detailed that an AI image generator could recreate similar images.

For EACH image, identify its type and provide vivid descriptions:

**Image Types to Identify:**
- Featured Images / Hero Images (large, prominent, attention-grabbing)
- Photos (photography of people, products, places)
- Illustrations (drawn, vector, artistic)
- Screenshots (interface captures, app views)
- Charts / Graphs (data visualizations)
- Tables (structured data displays)
- Icons (small graphical elements)
- Diagrams (technical drawings, flowcharts)

For EACH identified image type, describe in vivid detail:
- Composition (layout, framing, positioning, rule of thirds usage)
- Subject matter (what exactly is depicted, positioning, scale, interactions)
- Color palette (specific colors, hex codes if discernible, color relationships)
- Lighting (direction, quality, hard/soft, mood, shadows, highlights)
- Style (photorealistic, flat design, isometric, hand-drawn, 3D, etc.)
- Texture and detail level (smooth, rough, detailed, minimalist)
- Typography in images (if any - fonts, sizes, weights, colors)
- Background treatment (solid, gradient, pattern, photographic, blurred)
- Visual effects (shadows, glows, borders, overlays, filters)
- Aspect ratio and dimensions (landscape, portrait, square, approximate size)

Return a JSON object with these fields:
- imageTypes: array of objects, each with {type: string, count: number, description: string} where description is EXTREMELY detailed
- style: overall visual style across all images
- tone: emotional tone
- dominantColors: array of 3-5 dominant colors with specific names (e.g., "Deep Navy Blue", "Warm Coral Orange")
- subjects: array of specific subjects depicted
- quality: perceived quality and production value
- consistency: how consistent the imagery is across all images
- technicalDetails: object with {compositionStyle, lightingStyle, renderingStyle}

Make descriptions vivid and specific - suitable for AI image generation prompts. Include details about shadows, highlights, textures, depth, perspective, and any unique visual treatments.

Only return the JSON object, no other text.`,
              },
            ],
          },
        ],
      });
    } catch (error: any) {
      // Fallback to Haiku if Sonnet not available
      if (error?.status === 404) {
        console.log('[AI:Images] Vision model not available, falling back to Haiku');
        message = await anthropic.messages.create({
          model: MODEL, // Use Haiku as fallback
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                ...validImages,
                {
                  type: 'text',
                  text: `Analyze these images from a website and provide an extremely detailed, vivid analysis of the imagery. Your descriptions should be so detailed that an AI image generator could recreate similar images.

For EACH image, identify its type and provide vivid descriptions:

**Image Types to Identify:**
- Featured Images / Hero Images (large, prominent, attention-grabbing)
- Photos (photography of people, products, places)
- Illustrations (drawn, vector, artistic)
- Screenshots (interface captures, app views)
- Charts / Graphs (data visualizations)
- Tables (structured data displays)
- Icons (small graphical elements)
- Diagrams (technical drawings, flowcharts)

For EACH identified image type, describe in vivid detail:
- Composition (layout, framing, positioning, rule of thirds usage)
- Subject matter (what exactly is depicted, positioning, scale, interactions)
- Color palette (specific colors, hex codes if discernible, color relationships)
- Lighting (direction, quality, hard/soft, mood, shadows, highlights)
- Style (photorealistic, flat design, isometric, hand-drawn, 3D, etc.)
- Texture and detail level (smooth, rough, detailed, minimalist)
- Typography in images (if any - fonts, sizes, weights, colors)
- Background treatment (solid, gradient, pattern, photographic, blurred)
- Visual effects (shadows, glows, borders, overlays, filters)
- Aspect ratio and dimensions (landscape, portrait, square, approximate size)

Return a JSON object with these fields:
- imageTypes: array of objects, each with {type: string, count: number, description: string} where description is EXTREMELY detailed
- style: overall visual style across all images
- tone: emotional tone
- dominantColors: array of 3-5 dominant colors with specific names (e.g., "Deep Navy Blue", "Warm Coral Orange")
- subjects: array of specific subjects depicted
- quality: perceived quality and production value
- consistency: how consistent the imagery is across all images
- technicalDetails: object with {compositionStyle, lightingStyle, renderingStyle}

Make descriptions vivid and specific - suitable for AI image generation prompts. Include details about shadows, highlights, textures, depth, perspective, and any unique visual treatments.

Only return the JSON object, no other text.`,
                },
              ],
            },
          ],
        });
      } else {
        throw error;
      }
    }

    const content = message.content[0];
    if (content.type === 'text') {
      // Parse JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as ImageAnalysis;
        console.log('[AI:Images] Analysis complete:', analysis);
        return analysis;
      }
    }

    console.log('[AI:Images] Could not parse analysis response');
    return null;
  } catch (error) {
    console.error('[AI:Images] Error analyzing images:', error);
    return null;
  }
}

/**
 * Combine multiple style guide reports into a single comprehensive guide
 * Takes reports from multiple pages and synthesizes unique details
 */
export async function combineReports(
  reports: Array<{ url: string; markdown: string }>
): Promise<string> {
  console.log('[AI:Combine] Combining', reports.length, 'style guide reports...');

  if (reports.length === 0) {
    throw new Error('No reports to combine');
  }

  if (reports.length === 1) {
    console.log('[AI:Combine] Only one report, returning as-is');
    return reports[0].markdown;
  }

  try {
    const combinedPrompt = `You are combining multiple style guide reports from different pages of the same website to create one comprehensive, unified style guide.

You have received ${reports.length} style guide reports from these URLs:
${reports.map((r, i) => `${i + 1}. ${r.url}`).join('\n')}

## Your Task:
1. **Identify common patterns** across all reports (colors, fonts, spacing that appear consistently)
2. **Preserve unique details** from each page that reveal additional design insights
3. **Remove redundancy** - don't repeat identical information
4. **Synthesize conflicts** - if reports disagree, note variations (e.g., "Primarily uses X, with Y on blog pages")
5. **Maintain structure** - use the same Markdown structure as individual reports
6. **Be comprehensive** - capture the FULL design system from all pages

## Output Requirements:
- Use the standard style guide format (same sections as individual reports)
- In the Overview, mention that this is based on analysis of multiple pages
- For each design element (colors, typography, etc.), combine data from all reports
- Note when certain styles appear only on specific page types
- Output clean, unescaped Markdown text

---

${reports.map((r, i) => `## Report ${i + 1}: ${r.url}\n\n${r.markdown}`).join('\n\n---\n\n')}

---

Now create a single, comprehensive style guide that combines all unique insights from these reports. Output only the final Markdown style guide.`;

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000, // Allow for longer combined output
      messages: [
        {
          role: 'user',
          content: combinedPrompt,
        },
      ],
      system: getSystemPrompt(),
    });

    const content = message.content[0];
    if (content.type === 'text') {
      const combinedMarkdown = content.text;
      console.log('[AI:Combine] Successfully combined reports');

      // Note: No need to manually escape - Next.js NextResponse.json() handles JSON serialization
      return combinedMarkdown;
    }

    throw new Error('Unexpected response format from Claude');
  } catch (error) {
    console.error('[AI:Combine] Error combining reports:', error);
    throw new Error('Failed to combine reports: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Note: JSON escaping is handled automatically by Next.js NextResponse.json()
// No manual escaping needed for API responses

/**
 * Select representative images for analysis
 * Prioritizes: hero images, large images, diverse URLs
 */
function selectRepresentativeImages(urls: string[], maxCount: number): string[] {
  // Filter out common icons, tiny images, tracking pixels
  const filtered = urls.filter((url) => {
    const lower = url.toLowerCase();

    // Skip tracking pixels and analytics
    if (lower.includes('analytics') || lower.includes('tracking') || lower.includes('pixel')) {
      return false;
    }

    // Skip very small images (likely icons)
    if (lower.match(/\d+x\d+/) && parseInt(lower.match(/(\d+)x/)?.[1] || '0') < 100) {
      return false;
    }

    // Skip common icon/logo patterns
    if (lower.includes('icon') || lower.includes('logo-')) {
      return false;
    }

    // Only include common image formats
    if (!lower.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/)) {
      return false;
    }

    return true;
  });

  // Prioritize hero/featured/banner images
  const prioritized = filtered.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    const aScore =
      (aLower.includes('hero') ? 10 : 0) +
      (aLower.includes('featured') ? 8 : 0) +
      (aLower.includes('banner') ? 7 : 0) +
      (aLower.includes('header') ? 5 : 0) +
      (aLower.match(/\d{3,4}x\d{3,4}/) ? 3 : 0); // Prefer larger dimensions

    const bScore =
      (bLower.includes('hero') ? 10 : 0) +
      (bLower.includes('featured') ? 8 : 0) +
      (bLower.includes('banner') ? 7 : 0) +
      (bLower.includes('header') ? 5 : 0) +
      (bLower.match(/\d{3,4}x\d{3,4}/) ? 3 : 0);

    return bScore - aScore;
  });

  // Return top N diverse images
  return prioritized.slice(0, maxCount);
}
