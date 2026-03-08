import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/email/webhooks/register
 *
 * Registers the Nylas webhook for real-time email notifications.
 * Call this ONCE to set up the webhook. Nylas will verify the endpoint
 * by sending a GET request with a challenge parameter.
 *
 * Protected by PIPELINE_WEBHOOK_SECRET (admin-only).
 *
 * Supports:
 *   - POST (no body) → create webhook
 *   - POST { action: "list" } → list existing webhooks
 *   - POST { action: "delete", webhookId: "..." } → delete webhook
 */
export async function POST(request: NextRequest) {
  // Admin auth
  const webhookSecret = process.env.PIPELINE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const nylasApiKey = process.env.NYLAS_API_KEY;
  if (!nylasApiKey) {
    return NextResponse.json({ error: 'NYLAS_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action || 'create';

  const baseUrl = 'https://api.us.nylas.com/v3/webhooks';
  const headers = {
    Authorization: `Bearer ${nylasApiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // ── List existing webhooks ────────────────────────────────────────────────
  if (action === 'list') {
    const res = await fetch(baseUrl, { method: 'GET', headers });
    const data = await res.json();
    return NextResponse.json(data);
  }

  // ── Delete a webhook ──────────────────────────────────────────────────────
  if (action === 'delete') {
    const webhookId = body.webhookId;
    if (!webhookId) {
      return NextResponse.json({ error: 'webhookId required' }, { status: 400 });
    }
    const res = await fetch(`${baseUrl}/${webhookId}`, { method: 'DELETE', headers });
    if (res.ok) {
      return NextResponse.json({ status: 'deleted', webhookId });
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ error: 'Failed to delete', details: data }, { status: res.status });
  }

  // ── Create webhook ────────────────────────────────────────────────────────
  const webhookUrl = body.webhookUrl || 'https://www.terrazzo.travel/api/email/webhooks/nylas';

  const createPayload = {
    description: 'Terrazzo real-time email reservation detection',
    webhook_url: webhookUrl,
    trigger_types: [
      'message.created',
      'message.created.truncated',
    ],
    // Requesting only the fields we need reduces payload size
    notification_email_addresses: [],
  };

  console.log('[webhook-register] Creating Nylas webhook:', JSON.stringify(createPayload, null, 2));

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(createPayload),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[webhook-register] Failed to create webhook:', data);
    return NextResponse.json(
      { error: 'Failed to register webhook with Nylas', details: data },
      { status: res.status }
    );
  }

  // IMPORTANT: The response contains webhook_secret — store it!
  const webhookSecretFromNylas = data.data?.webhook_secret || data.webhook_secret;

  console.log('[webhook-register] ✓ Webhook created successfully');
  if (webhookSecretFromNylas) {
    console.log('[webhook-register] ⚠️  SAVE THIS WEBHOOK SECRET as NYLAS_WEBHOOK_SECRET env var:');
    console.log(`[webhook-register] ${webhookSecretFromNylas}`);
  }

  return NextResponse.json({
    status: 'created',
    webhookId: data.data?.id || data.id,
    webhookSecret: webhookSecretFromNylas,
    message: 'Save the webhook_secret as NYLAS_WEBHOOK_SECRET in your environment variables!',
    fullResponse: data,
  });
}
