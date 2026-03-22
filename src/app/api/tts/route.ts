import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, ttsSchema } from '@/lib/api-validation';

/**
 * TTS endpoint — uses ElevenLabs Flash v2.5 for low-latency, high-quality speech.
 * Falls back to OpenAI TTS if ElevenLabs key is not configured.
 *
 * Returns audio/mpeg stream.
 */

// ElevenLabs voice IDs — these are built-in voices
// See https://elevenlabs.io/docs/voices/premade-voices
const ELEVENLABS_VOICES: Record<string, string> = {
  // Map friendly names to ElevenLabs voice IDs
  nova: 'EXAVITQu4vr4xnSDxMaL',      // "Sarah" — warm, natural female (closest to OpenAI nova)
  alloy: 'onwK4e9ZLuTAKqWW03F9',      // "Daniel" — calm, composed male
  shimmer: 'XB0fDUnXU5powFXDhCwa',    // "Charlotte" — warm, expressive female
  echo: 'IKne3meq5aSn9XLyUdCD',       // "Charlie" — casual male
};

const DEFAULT_ELEVENLABS_VOICE_ID = ELEVENLABS_VOICES.nova;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':tts', { maxRequests: 30, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const validation = await validateBody(req, ttsSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { text, voice } = validation.data;

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (elevenLabsKey) {
      return await elevenLabsTTS(text, voice, elevenLabsKey);
    }

    // Fallback to OpenAI if no ElevenLabs key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: 'No TTS API key configured' }, { status: 500 });
    }
    return await openaiTTS(text, voice, openaiKey);
  } catch (err: unknown) {
    console.error('[tts] Error:', err);
    const message = err instanceof Error ? err.message : 'TTS generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function elevenLabsTTS(text: string, voice: string | undefined, apiKey: string) {
  const voiceId = (voice && ELEVENLABS_VOICES[voice]) || DEFAULT_ELEVENLABS_VOICE_ID;

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: {
        stability: 0.71,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: false,
      },
      output_format: 'mp3_44100_128',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[tts] ElevenLabs error:', response.status, errorText);

    // If ElevenLabs fails, don't fall back — just error
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }

  // Stream the response through to the client
  if (response.body) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Transfer-Encoding': 'chunked',
      },
    });
  }

  // Fallback: buffer the full response
  const audioBuffer = await response.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

async function openaiTTS(text: string, voice: string | undefined, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      voice: voice || 'nova',
      input: text,
      speed: 1.05,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[tts] OpenAI error:', response.status, errorText);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }

  const audioBuffer = await response.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
