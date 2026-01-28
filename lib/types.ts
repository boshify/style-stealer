/**
 * TypeScript type definitions for Style Stealer
 */

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Scraped website data containing HTML and CSS
 */
export interface ScrapedData {
  html: string;
  css: string;
  url: string;
  title: string;
  method: 'cheerio' | 'playwright';
}

/**
 * Complete design tokens extracted from a website
 */
export interface DesignTokens {
  colors: ColorToken[];
  typography: TypographyTokens;
  layout: LayoutTokens;
  spacing: SpacingTokens;
  visual: VisualTokens;
  imagery: ImageryTokens;
  metadata: Metadata;
}

// ============================================================================
// Color Types
// ============================================================================

/**
 * Individual color token with usage context
 */
export interface ColorToken {
  value: string;           // hex, rgb, or rgba
  name?: string;          // human-readable name (e.g., "Navy Blue")
  frequency: number;      // number of occurrences in CSS
  contexts: string[];     // usage contexts (e.g., ["background", "button"])
  type?: ColorType;       // semantic type
}

export type ColorType =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'text'
  | 'background'
  | 'border'
  | 'neutral';

// ============================================================================
// Typography Types
// ============================================================================

/**
 * Typography design tokens
 */
export interface TypographyTokens {
  fontFamilies: FontFamily[];
  fontSizes: FontSize[];
  fontWeights: number[];
  lineHeights: number[];
  letterSpacings: string[];
  headingSizes: Record<string, string>;  // h1: "48px", h2: "36px", etc.
}

export interface FontFamily {
  name: string;
  stack: string;          // full font-family declaration
  usage: 'heading' | 'body' | 'monospace' | 'display' | 'unknown';
  frequency: number;
}

export interface FontSize {
  value: string;          // e.g., "16px", "1rem"
  pxValue: number;        // normalized to pixels
  frequency: number;
  contexts: string[];     // where it's used
}

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Layout and grid system tokens
 */
export interface LayoutTokens {
  usesGrid: boolean;
  usesFlex: boolean;
  maxWidth?: string;
  containerWidths: string[];
  breakpoints: Breakpoint[];
  gridColumns?: number;
}

export interface Breakpoint {
  name: string;           // e.g., "mobile", "tablet", "desktop"
  value: string;          // e.g., "768px"
  pxValue: number;
}

// ============================================================================
// Spacing Types
// ============================================================================

/**
 * Spacing scale and patterns
 */
export interface SpacingTokens {
  baseUnit?: number;      // detected base unit (e.g., 4, 8)
  scale: string[];        // spacing values (e.g., ["4px", "8px", "16px"])
  commonValues: SpacingValue[];
}

export interface SpacingValue {
  value: string;
  pxValue: number;
  frequency: number;
  type: 'margin' | 'padding' | 'gap';
}

// ============================================================================
// Visual Pattern Types
// ============================================================================

/**
 * Visual styling patterns
 */
export interface VisualTokens {
  borderRadius: string[];
  boxShadows: BoxShadow[];
  transitions: string[];
  animations: string[];
  gradients: string[];
}

export interface BoxShadow {
  value: string;
  frequency: number;
}

// ============================================================================
// Imagery Types
// ============================================================================

/**
 * Logo variant type
 */
export interface LogoVariant {
  type: 'regular' | 'dark' | 'light' | 'icon' | 'favicon' | 'mobile' | 'other';
  url: string;
  description?: string; // e.g., "Dark logo for light backgrounds"
}

/**
 * Image and icon patterns
 */
export interface ImageryTokens {
  imageUrls: string[];
  iconPattern?: 'svg' | 'font' | 'raster' | 'mixed';
  logos: LogoVariant[]; // Multiple logo variants
  heroImageUrl?: string;
  backgroundImages: string[];
  analysis?: ImageAnalysis; // AI-powered image analysis
}

/**
 * AI analysis of website imagery with vivid, detailed descriptions
 */
export interface ImageAnalysis {
  logos?: Array<{             // Logos detected by AI
    url: string;              // Image URL
    type: 'regular' | 'dark' | 'light' | 'icon' | 'favicon' | 'mobile' | 'other';
    description?: string;     // e.g., "Dark logo for light backgrounds"
  }>;
  imageTypes?: Array<{        // Detailed breakdown by image type
    type: string;             // e.g., "Featured Images", "Charts", "Screenshots"
    count: number;
    description: string;      // Vivid, detailed description for AI image generation
  }>;
  style: string;              // e.g., "photography", "illustration", "mixed"
  tone: string;               // e.g., "professional", "playful", "minimal"
  dominantColors: string[];   // Colors found in images
  subjects: string[];         // What the images depict
  quality: string;            // e.g., "high-resolution", "stock photos", "custom"
  consistency: string;        // How consistent the imagery is
  technicalDetails?: {        // Technical details about the imagery
    compositionStyle?: string;
    lightingStyle?: string;
    renderingStyle?: string;
  };
}

// ============================================================================
// Metadata
// ============================================================================

/**
 * Metadata about the analyzed website
 */
export interface Metadata {
  url: string;
  title: string;
  timestamp: string;
  generationTime?: number; // milliseconds
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Request body for style guide generation
 */
export interface GenerateRequest {
  url: string;
  webhook_url?: string;  // Optional webhook URL to post results to
  projectId?: string;    // Optional project ID to track requests
  async?: boolean;       // Optional flag to enable async processing
}

/**
 * Response from style guide generation API
 */
export interface GenerateResponse {
  success: boolean;
  markdown?: string;
  error?: string;
  tokens?: DesignTokens;
  generationTime?: number;
}

// ============================================================================
// Parser Types
// ============================================================================

/**
 * Options for the CSS parser
 */
export interface ParserOptions {
  extractColors?: boolean;
  extractTypography?: boolean;
  extractLayout?: boolean;
  extractSpacing?: boolean;
  extractVisual?: boolean;
  minColorFrequency?: number;  // ignore colors appearing less than N times
  groupSimilarColors?: boolean; // group similar colors together
  colorSimilarityThreshold?: number; // 0-100, for grouping
}

/**
 * Options for the scraper
 */
export interface ScraperOptions {
  timeout?: number;               // milliseconds
  userAgent?: string;
  forcePlaywright?: boolean;      // skip Cheerio, use Playwright directly
  waitForNetwork?: boolean;       // wait for network idle (Playwright only)
  screenshotPath?: string;        // path to save screenshot (optional)
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * CSS property with value
 */
export interface CSSProperty {
  property: string;
  value: string;
  selector?: string;
}

/**
 * Parsed color value
 */
export interface ParsedColor {
  original: string;       // original CSS value
  hex?: string;           // converted to hex if possible
  rgb?: [number, number, number];
  alpha?: number;
}
