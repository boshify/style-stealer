/**
 * Webhook posting functionality
 */

export interface WebhookPayload {
  requestId?: string;
  url: string;
  markdown: string;
  generationTime: number;
  pagesAnalyzed?: number;
  projectId?: string;
  timestamp: string;
}

/**
 * Post style guide result to webhook URL
 * Returns true if successful, false otherwise
 */
export async function postToWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<boolean> {
  if (!webhookUrl || webhookUrl.trim() === '') {
    console.log('[Webhook] No webhook URL provided, skipping');
    return false;
  }

  console.log('[Webhook] Posting to:', webhookUrl);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StyleStealer/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error('[Webhook] Failed:', response.status, response.statusText);
      return false;
    }

    console.log('[Webhook] ✓ Successfully posted to webhook');
    return true;
  } catch (error) {
    console.error('[Webhook] Error posting to webhook:', error);
    return false;
  }
}

/**
 * Validate webhook URL format
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be http or https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
