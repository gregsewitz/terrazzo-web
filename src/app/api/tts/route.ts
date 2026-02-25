import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, ttsSchema } from '@/lib/api-validation';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();
  try {
    const validation = await validateBody(req, ttsSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { text, voice } = validation.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voice || 'nova',
        input: text,
        speed: 1.12,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI TTS error:', response.status, errorText);
      return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: unknown) {
    console.error('TTS error:', err);
    const message = err instanceof Error ? err.message : 'TTS generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
