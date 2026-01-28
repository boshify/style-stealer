/**
 * Utility functions for Style Stealer
 */

import type { ParsedColor } from './types';

// ============================================================================
// URL Utilities
// ============================================================================

/**
 * Normalize and validate a URL
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Add https:// if no protocol
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = 'https://' + normalized;
  }

  try {
    const urlObj = new URL(normalized);
    return urlObj.href;
  } catch {
    throw new Error('Invalid URL format');
  }
}

/**
 * Check if a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    normalizeUrl(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert relative URL to absolute
 */
export function toAbsoluteUrl(relativeUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Convert any color format to hex
 */
export function toHex(color: string): string | null {
  const normalized = color.trim().toLowerCase();

  // Already hex
  if (normalized.match(/^#([0-9a-f]{3}){1,2}$/i)) {
    // Expand shorthand hex
    if (normalized.length === 4) {
      return '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3];
    }
    return normalized;
  }

  // RGB/RGBA
  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  // Named colors
  const namedColors: Record<string, string> = {
    'white': '#ffffff',
    'black': '#000000',
    'red': '#ff0000',
    'green': '#008000',
    'blue': '#0000ff',
    'yellow': '#ffff00',
    'gray': '#808080',
    'grey': '#808080',
    'silver': '#c0c0c0',
    'navy': '#000080',
    'teal': '#008080',
    'aqua': '#00ffff',
    'cyan': '#00ffff',
    'magenta': '#ff00ff',
    'maroon': '#800000',
    'olive': '#808000',
    'lime': '#00ff00',
    'purple': '#800080',
    'fuchsia': '#ff00ff',
    'orange': '#ffa500',
  };

  return namedColors[normalized] || null;
}

/**
 * Parse color string to RGB values
 */
export function parseColor(color: string): ParsedColor | null {
  const hex = toHex(color);
  if (!hex) return null;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Check for alpha in original
  const alphaMatch = color.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
  const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 1;

  return {
    original: color,
    hex,
    rgb: [r, g, b],
    alpha,
  };
}

/**
 * Calculate color distance (perceptual difference)
 */
export function colorDistance(color1: ParsedColor, color2: ParsedColor): number {
  if (!color1.rgb || !color2.rgb) return 100;

  // Simple Euclidean distance in RGB space
  const [r1, g1, b1] = color1.rgb;
  const [r2, g2, b2] = color2.rgb;

  return Math.sqrt(
    Math.pow(r2 - r1, 2) +
    Math.pow(g2 - g1, 2) +
    Math.pow(b2 - b1, 2)
  );
}

/**
 * Get human-readable color name
 */
export function getColorName(hex: string): string {
  const color = parseColor(hex);
  if (!color || !color.rgb) return 'Unknown';

  const [r, g, b] = color.rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  // Grayscale
  if (max - min < 30) {
    if (lightness > 240) return 'White';
    if (lightness < 20) return 'Black';
    if (lightness > 180) return 'Light Gray';
    if (lightness > 100) return 'Gray';
    return 'Dark Gray';
  }

  // Chromatic colors
  const hue = getHue(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;

  let colorName = '';

  // Determine base hue
  if (hue < 15 || hue >= 345) colorName = 'Red';
  else if (hue < 45) colorName = 'Orange';
  else if (hue < 75) colorName = 'Yellow';
  else if (hue < 150) colorName = 'Green';
  else if (hue < 210) colorName = 'Cyan';
  else if (hue < 270) colorName = 'Blue';
  else if (hue < 330) colorName = 'Purple';
  else colorName = 'Pink';

  // Add lightness modifier
  if (lightness > 200) colorName = 'Light ' + colorName;
  else if (lightness < 80) colorName = 'Dark ' + colorName;

  // Add saturation modifier
  if (saturation < 0.3) colorName = 'Muted ' + colorName;

  return colorName;
}

function getHue(r: number, g: number, b: number): number {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  return hue;
}

// ============================================================================
// CSS Value Utilities
// ============================================================================

/**
 * Convert CSS value to pixels
 */
export function toPx(value: string): number | null {
  const match = value.match(/([\d.]+)(px|rem|em|pt|%)?/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = match[2] || 'px';

  switch (unit) {
    case 'px':
      return num;
    case 'rem':
    case 'em':
      return num * 16; // assume 16px base
    case 'pt':
      return num * 1.333;
    case '%':
      return null; // can't convert without context
    default:
      return num;
  }
}

/**
 * Find greatest common divisor
 */
export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Find GCD of array of numbers
 */
export function gcdArray(numbers: number[]): number {
  if (numbers.length === 0) return 1;
  if (numbers.length === 1) return numbers[0];

  return numbers.reduce((acc, val) => gcd(acc, val));
}

/**
 * Round to nearest multiple
 */
export function roundToNearest(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple;
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Extract domain from URL
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown';
  }
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Count frequency of items in array
 */
export function frequency<T>(arr: T[]): Map<T, number> {
  const map = new Map<T, number>();
  for (const item of arr) {
    map.set(item, (map.get(item) || 0) + 1);
  }
  return map;
}

/**
 * Get unique items from array
 */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Sort by frequency (most common first)
 */
export function sortByFrequency<T>(arr: T[]): T[] {
  const freq = frequency(arr);
  return unique(arr).sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0));
}

// ============================================================================
// Number Utilities
// ============================================================================

/**
 * Clamp number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Check if number is within range
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
