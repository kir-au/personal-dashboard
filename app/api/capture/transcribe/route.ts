import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'OPENAI_API_KEY is not configured for transcription.' },
      { status: 501 }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      return NextResponse.json({ ok: false, error: 'Expected multipart/form-data audio upload.' }, { status: 400 });
    }

    const incoming = await req.formData();
    const audio = incoming.get('audio');

    if (!(audio instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing audio file.' }, { status: 400 });
    }

    const form = new FormData();
    form.set('file', audio, audio.name || 'capture.webm');
    form.set('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');

    const language = incoming.get('language');
    if (typeof language === 'string' && language.trim()) {
      form.set('language', language.trim());
    }

    const response = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error?.message || 'Transcription failed.', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      text: data.text || '',
      model: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Transcription failed.' },
      { status: 500 }
    );
  }
}
