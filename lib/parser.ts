/**
 * CSS Parser - Extracts design tokens from HTML and CSS
 */

import type {
  DesignTokens,
  ColorToken,
  TypographyTokens,
  FontFamily,
  FontSize,
  LayoutTokens,
  Breakpoint,
  SpacingTokens,
  SpacingValue,
  VisualTokens,
  BoxShadow,
  ImageryTokens,
  ParserOptions,
  ScrapedData,
} from './types';
import {
  parseColor,
  colorDistance,
  getColorName,
  toPx,
  gcdArray,
  frequency,
  unique,
  sortByFrequency,
  getDomain,
} from './utils';

const DEFAULT_OPTIONS: Required<ParserOptions> = {
  extractColors: true,
  extractTypography: true,
  extractLayout: true,
  extractSpacing: true,
  extractVisual: true,
  minColorFrequency: 2,
  groupSimilarColors: true,
  colorSimilarityThreshold: 20,
};

/**
 * Main parsing function - extracts all design tokens
 */
export function parseStyles(
  data: ScrapedData,
  options: ParserOptions = {}
): DesignTokens {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { html, css, url, title } = data;

  console.log('[Parser] Extracting design tokens...');
  console.log('[Parser] CSS length:', css.length, 'chars');
  console.log('[Parser] HTML length:', html.length, 'chars');

  const tokens: DesignTokens = {
    colors: [],
    typography: getEmptyTypography(),
    layout: getEmptyLayout(),
    spacing: getEmptySpacing(),
    visual: getEmptyVisual(),
    imagery: { imageUrls: [], iconPattern: undefined, backgroundImages: [] },
    metadata: {
      url,
      title,
      timestamp: new Date().toISOString(),
    },
  };

  try {
    if (opts.extractColors) {
      console.log('[Parser] Extracting colors...');
      tokens.colors = extractColors(css, opts);
      console.log('[Parser] ✓ Colors extracted:', tokens.colors.length);
    }

    if (opts.extractTypography) {
      console.log('[Parser] Extracting typography...');
      tokens.typography = extractTypography(css);
      console.log('[Parser] ✓ Typography extracted');
    }

    if (opts.extractLayout) {
      console.log('[Parser] Extracting layout...');
      tokens.layout = extractLayout(css);
      console.log('[Parser] ✓ Layout extracted');
    }

    if (opts.extractSpacing) {
      console.log('[Parser] Extracting spacing...');
      tokens.spacing = extractSpacing(css);
      console.log('[Parser] ✓ Spacing extracted');
    }

    if (opts.extractVisual) {
      console.log('[Parser] Extracting visual patterns...');
      tokens.visual = extractVisual(css);
      console.log('[Parser] ✓ Visual patterns extracted');
    }

    console.log('[Parser] Extracting imagery...');
    tokens.imagery = extractImagery(html, url);
    console.log('[Parser] ✓ Imagery extracted');

    console.log('[Parser] Extraction complete');
    console.log(`  - Colors: ${tokens.colors.length}`);
    console.log(`  - Font families: ${tokens.typography.fontFamilies.length}`);
    console.log(`  - Font sizes: ${tokens.typography.fontSizes.length}`);
    console.log(`  - Spacing values: ${tokens.spacing.commonValues.length}`);

    return tokens;
  } catch (error) {
    console.error('[Parser] ERROR during extraction:', error);
    throw error;
  }
}

// ============================================================================
// Color Extraction
// ============================================================================

function extractColors(css: string, options: Required<ParserOptions>): ColorToken[] {
  // Truncate CSS if too large to prevent regex issues
  const MAX_CSS_LENGTH = 500000; // 500KB
  const safeCss = css.length > MAX_CSS_LENGTH ? css.substring(0, MAX_CSS_LENGTH) : css;

  console.log('[Parser:Colors] Processing CSS length:', safeCss.length);

  const colorPatterns = [
    /#([0-9a-f]{3,6})\b/gi,                          // Hex
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/gi,  // RGB/RGBA
    /hsla?\(\s*(\d+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/gi,  // HSL/HSLA
  ];

  const allColors: string[] = [];

  // Extract all color values
  for (const pattern of colorPatterns) {
    try {
      const matches = safeCss.matchAll(pattern);
      let count = 0;
      for (const match of matches) {
        allColors.push(match[0]);
        count++;
        if (count > 10000) break; // Safety limit
      }
      console.log('[Parser:Colors] Pattern matched:', count, 'colors');
    } catch (error) {
      console.error('[Parser:Colors] Error in pattern matching:', error);
    }
  }

  // Also check for named colors
  const namedColorPattern = /\b(white|black|red|green|blue|yellow|gray|grey|silver|navy|teal|aqua|cyan|magenta|maroon|olive|lime|purple|fuchsia|orange)\b/gi;
  const namedMatches = css.matchAll(namedColorPattern);
  for (const match of namedMatches) {
    allColors.push(match[0]);
  }

  // Count frequencies
  const colorFreq = frequency(allColors);

  // Parse and normalize colors
  const colorMap = new Map<string, { parsed: any; original: string[]; frequency: number }>();

  for (const [color, freq] of colorFreq.entries()) {
    if (freq < options.minColorFrequency) continue;

    const parsed = parseColor(color);
    if (!parsed || !parsed.hex) continue;

    const existing = colorMap.get(parsed.hex);
    if (existing) {
      existing.frequency += freq;
      existing.original.push(color);
    } else {
      colorMap.set(parsed.hex, {
        parsed,
        original: [color],
        frequency: freq,
      });
    }
  }

  // Convert to ColorToken array
  let tokens: ColorToken[] = Array.from(colorMap.entries()).map(([hex, data]) => ({
    value: hex,
    name: getColorName(hex),
    frequency: data.frequency,
    contexts: inferColorContext(css, data.original),
  }));

  // Group similar colors if requested
  if (options.groupSimilarColors) {
    tokens = groupSimilarColors(tokens, options.colorSimilarityThreshold);
  }

  // Sort by frequency (most common first)
  tokens.sort((a, b) => b.frequency - a.frequency);

  // Limit to top 20 colors
  return tokens.slice(0, 20);
}

function inferColorContext(css: string, colorValues: string[]): string[] {
  const contexts = new Set<string>();

  for (const color of colorValues) {
    // Find the property this color is used in
    const escapedColor = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const propertyPattern = new RegExp(`(background|color|border|fill|stroke)(?:-[a-z]+)?\\s*:\\s*[^;]*${escapedColor}`, 'gi');
    const matches = css.matchAll(propertyPattern);

    for (const match of matches) {
      const property = match[1].toLowerCase();
      if (property.includes('background')) contexts.add('background');
      else if (property === 'color') contexts.add('text');
      else if (property.includes('border')) contexts.add('border');
      else if (property === 'fill' || property === 'stroke') contexts.add('icon');
    }
  }

  return Array.from(contexts);
}

function groupSimilarColors(colors: ColorToken[], threshold: number): ColorToken[] {
  const grouped: ColorToken[] = [];
  const used = new Set<number>();

  for (let i = 0; i < colors.length; i++) {
    if (used.has(i)) continue;

    const color1 = parseColor(colors[i].value);
    if (!color1) continue;

    const group: ColorToken[] = [colors[i]];

    for (let j = i + 1; j < colors.length; j++) {
      if (used.has(j)) continue;

      const color2 = parseColor(colors[j].value);
      if (!color2) continue;

      if (colorDistance(color1, color2) < threshold) {
        group.push(colors[j]);
        used.add(j);
      }
    }

    // Merge group into single token (keep most frequent)
    if (group.length > 1) {
      const merged: ColorToken = {
        value: group[0].value,
        name: group[0].name,
        frequency: group.reduce((sum, c) => sum + c.frequency, 0),
        contexts: unique(group.flatMap((c) => c.contexts)),
      };
      grouped.push(merged);
    } else {
      grouped.push(group[0]);
    }

    used.add(i);
  }

  return grouped;
}

// ============================================================================
// Typography Extraction
// ============================================================================

function extractTypography(css: string): TypographyTokens {
  // Truncate CSS if too large
  const MAX_CSS_LENGTH = 500000;
  const safeCss = css.length > MAX_CSS_LENGTH ? css.substring(0, MAX_CSS_LENGTH) : css;

  console.log('[Parser:Typography] Processing CSS length:', safeCss.length);

  // Extract font families
  const fontFamilyPattern = /font-family\s*:\s*([^;]+);/gi;
  const fontFamilies: string[] = [];
  let match;
  let iterations = 0;

  while ((match = fontFamilyPattern.exec(safeCss)) !== null) {
    fontFamilies.push(match[1].trim());
    iterations++;
    if (iterations > 5000) break; // Safety limit
  }
  console.log('[Parser:Typography] Found', fontFamilies.length, 'font-family declarations');

  const familyFreq = frequency(fontFamilies);
  const uniqueFamilies: FontFamily[] = Array.from(familyFreq.entries())
    .map(([stack, freq]) => ({
      name: stack.split(',')[0].replace(/['"]/g, '').trim(),
      stack,
      usage: inferFontUsage(css, stack),
      frequency: freq,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  // Extract font sizes
  const fontSizePattern = /font-size\s*:\s*([^;]+);/gi;
  const fontSizes: string[] = [];

  while ((match = fontSizePattern.exec(css)) !== null) {
    fontSizes.push(match[1].trim());
  }

  const sizeFreq = frequency(fontSizes);
  const uniqueSizes: FontSize[] = Array.from(sizeFreq.entries())
    .map(([value, freq]) => {
      const pxValue = toPx(value) || 0;
      return {
        value,
        pxValue,
        frequency: freq,
        contexts: [],
      };
    })
    .filter((s) => s.pxValue > 0)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  // Extract font weights
  const fontWeightPattern = /font-weight\s*:\s*(\d+|normal|bold|lighter|bolder)/gi;
  const weights: number[] = [];

  while ((match = fontWeightPattern.exec(css)) !== null) {
    const weight = match[1];
    if (!isNaN(Number(weight))) {
      weights.push(Number(weight));
    } else if (weight === 'bold') {
      weights.push(700);
    } else if (weight === 'normal') {
      weights.push(400);
    }
  }

  const uniqueWeights = unique(weights).sort((a, b) => a - b);

  // Extract line heights
  const lineHeightPattern = /line-height\s*:\s*([\d.]+)/gi;
  const lineHeights: number[] = [];

  while ((match = lineHeightPattern.exec(css)) !== null) {
    lineHeights.push(parseFloat(match[1]));
  }

  const uniqueLineHeights = unique(lineHeights).sort((a, b) => a - b).slice(0, 5);

  // Extract heading sizes
  const headingSizes: Record<string, string> = {};
  for (let i = 1; i <= 6; i++) {
    const pattern = new RegExp(`h${i}[^{]*{[^}]*font-size\\s*:\\s*([^;]+);`, 'i');
    const m = css.match(pattern);
    if (m) {
      headingSizes[`h${i}`] = m[1].trim();
    }
  }

  return {
    fontFamilies: uniqueFamilies,
    fontSizes: uniqueSizes,
    fontWeights: uniqueWeights,
    lineHeights: uniqueLineHeights,
    letterSpacings: [],
    headingSizes,
  };
}

function inferFontUsage(css: string, fontStack: string): FontFamily['usage'] {
  const escaped = fontStack.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (/h[1-6]|heading|title/i.test(css.match(new RegExp(`[^{]*font-family\\s*:\\s*[^;]*${escaped}`, 'i'))?.[0] || '')) {
    return 'heading';
  }
  if (/body|p\s*{|text/i.test(css.match(new RegExp(`[^{]*font-family\\s*:\\s*[^;]*${escaped}`, 'i'))?.[0] || '')) {
    return 'body';
  }
  if (/code|mono|pre/i.test(fontStack)) {
    return 'monospace';
  }
  return 'unknown';
}

// ============================================================================
// Layout Extraction
// ============================================================================

function extractLayout(css: string): LayoutTokens {
  const usesGrid = /display\s*:\s*grid/i.test(css);
  const usesFlex = /display\s*:\s*flex/i.test(css);

  // Extract max-width values
  const maxWidthPattern = /max-width\s*:\s*([^;]+);/gi;
  const widths: string[] = [];
  let match;

  while ((match = maxWidthPattern.exec(css)) !== null) {
    widths.push(match[1].trim());
  }

  const containerWidths = sortByFrequency(widths).slice(0, 5);

  // Extract breakpoints from media queries
  const mediaQueryPattern = /@media[^{]*\((?:min|max)-width\s*:\s*(\d+(?:px|em|rem))\)/gi;
  const breakpointValues: string[] = [];

  while ((match = mediaQueryPattern.exec(css)) !== null) {
    breakpointValues.push(match[1]);
  }

  const breakpoints: Breakpoint[] = unique(breakpointValues)
    .map((value) => {
      const pxValue = toPx(value) || 0;
      return {
        name: getBreakpointName(pxValue),
        value,
        pxValue,
      };
    })
    .filter((b) => b.pxValue > 0)
    .sort((a, b) => a.pxValue - b.pxValue);

  // Detect grid columns
  const gridColumnsPattern = /grid-template-columns\s*:\s*repeat\((\d+),/i;
  const gridMatch = css.match(gridColumnsPattern);
  const gridColumns = gridMatch ? parseInt(gridMatch[1]) : undefined;

  return {
    usesGrid,
    usesFlex,
    maxWidth: containerWidths[0],
    containerWidths,
    breakpoints,
    gridColumns,
  };
}

function getBreakpointName(px: number): string {
  if (px < 640) return 'mobile';
  if (px < 768) return 'sm';
  if (px < 1024) return 'md';
  if (px < 1280) return 'lg';
  if (px < 1536) return 'xl';
  return '2xl';
}

// ============================================================================
// Spacing Extraction
// ============================================================================

function extractSpacing(css: string): SpacingTokens {
  const spacingPattern = /(margin|padding|gap)(?:-[a-z]+)?\s*:\s*([^;]+);/gi;
  const values: SpacingValue[] = [];
  let match;

  while ((match = spacingPattern.exec(css)) !== null) {
    const property = match[1];
    const value = match[2].trim();

    // Split multiple values (e.g., "10px 20px")
    const parts = value.split(/\s+/);

    for (const part of parts) {
      const pxValue = toPx(part);
      if (pxValue && pxValue > 0 && pxValue < 1000) {
        values.push({
          value: part,
          pxValue,
          frequency: 1,
          type: property.includes('margin') ? 'margin' : property.includes('padding') ? 'padding' : 'gap',
        });
      }
    }
  }

  // Count frequencies
  const valueMap = new Map<number, SpacingValue>();
  for (const v of values) {
    const existing = valueMap.get(v.pxValue);
    if (existing) {
      existing.frequency++;
    } else {
      valueMap.set(v.pxValue, v);
    }
  }

  const commonValues = Array.from(valueMap.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15);

  // Detect base unit (GCD of common values)
  const pxValues = commonValues.map((v) => v.pxValue).filter((v) => v >= 4);
  const baseUnit = pxValues.length > 0 ? gcdArray(pxValues) : undefined;

  // Generate scale
  const scale = commonValues.map((v) => v.value);

  return {
    baseUnit,
    scale,
    commonValues,
  };
}

// ============================================================================
// Visual Patterns Extraction
// ============================================================================

function extractVisual(css: string): VisualTokens {
  // Truncate CSS if too large
  const MAX_CSS_LENGTH = 500000;
  const safeCss = css.length > MAX_CSS_LENGTH ? css.substring(0, MAX_CSS_LENGTH) : css;

  console.log('[Parser:Visual] Processing CSS length:', safeCss.length);

  // Border radius
  const borderRadiusPattern = /border-radius\s*:\s*([^;]+);/gi;
  const radiusValues: string[] = [];
  let match;
  let iterations = 0;

  while ((match = borderRadiusPattern.exec(safeCss)) !== null) {
    radiusValues.push(match[1].trim());
    iterations++;
    if (iterations > 5000) break;
  }
  console.log('[Parser:Visual] Found', radiusValues.length, 'border-radius values');

  const borderRadius = sortByFrequency(radiusValues).slice(0, 5);

  // Box shadows
  const boxShadowPattern = /box-shadow\s*:\s*([^;]+);/gi;
  const shadows: string[] = [];
  iterations = 0;

  while ((match = boxShadowPattern.exec(safeCss)) !== null) {
    shadows.push(match[1].trim());
    iterations++;
    if (iterations > 5000) break;
  }
  console.log('[Parser:Visual] Found', shadows.length, 'box-shadow values');

  const shadowFreq = frequency(shadows);
  const boxShadows: BoxShadow[] = Array.from(shadowFreq.entries())
    .map(([value, freq]) => ({ value, frequency: freq }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  // Transitions
  const transitionPattern = /transition\s*:\s*([^;]+);/gi;
  const transitions: string[] = [];
  iterations = 0;

  while ((match = transitionPattern.exec(safeCss)) !== null) {
    transitions.push(match[1].trim());
    iterations++;
    if (iterations > 5000) break;
  }
  console.log('[Parser:Visual] Found', transitions.length, 'transition values');

  // Gradients - FIXED: use matchAll correctly
  const gradientPattern = /(?:linear|radial)-gradient\([^)]+\)/gi;
  const gradients: string[] = [];

  try {
    const matches = safeCss.matchAll(gradientPattern);
    for (const m of matches) {
      gradients.push(m[0]);
      if (gradients.length > 1000) break; // Safety limit
    }
  } catch (error) {
    console.error('[Parser:Visual] Error matching gradients:', error);
  }
  console.log('[Parser:Visual] Found', gradients.length, 'gradient values');

  return {
    borderRadius,
    boxShadows,
    transitions: unique(transitions).slice(0, 5),
    animations: [],
    gradients: unique(gradients).slice(0, 5),
  };
}

// ============================================================================
// Imagery Extraction
// ============================================================================

function extractImagery(html: string, baseUrl: string): ImageryTokens {
  const imgPattern = /<img[^>]+src=["']([^"']+)["']/gi;
  const imageUrls: string[] = [];
  let match;

  while ((match = imgPattern.exec(html)) !== null) {
    imageUrls.push(match[1]);
  }

  // Detect icon pattern
  const svgCount = imageUrls.filter((url) => url.endsWith('.svg')).length;
  const totalImages = imageUrls.length;
  const iconPattern: ImageryTokens['iconPattern'] =
    svgCount / totalImages > 0.7 ? 'svg' : svgCount > 0 ? 'mixed' : 'raster';

  // Try to find logo
  const logoPattern = /<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i;
  const logoMatch = html.match(logoPattern);
  const logoUrl = logoMatch ? logoMatch[1] : undefined;

  // Try to find hero image
  const heroPattern = /<img[^>]+(?:class|id)=["'][^"']*(?:hero|banner|featured)[^"']*["'][^>]+src=["']([^"']+)["']/i;
  const heroMatch = html.match(heroPattern);
  const heroImageUrl = heroMatch ? heroMatch[1] : undefined;

  return {
    imageUrls: imageUrls.slice(0, 10),
    iconPattern,
    logoUrl,
    heroImageUrl,
    backgroundImages: [],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEmptyTypography(): TypographyTokens {
  return {
    fontFamilies: [],
    fontSizes: [],
    fontWeights: [],
    lineHeights: [],
    letterSpacings: [],
    headingSizes: {},
  };
}

function getEmptyLayout(): LayoutTokens {
  return {
    usesGrid: false,
    usesFlex: false,
    containerWidths: [],
    breakpoints: [],
  };
}

function getEmptySpacing(): SpacingTokens {
  return {
    scale: [],
    commonValues: [],
  };
}

function getEmptyVisual(): VisualTokens {
  return {
    borderRadius: [],
    boxShadows: [],
    transitions: [],
    animations: [],
    gradients: [],
  };
}
