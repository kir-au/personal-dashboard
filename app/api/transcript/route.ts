import { NextRequest, NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: Array<{ role: string; text: string }> };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: false, error: 'No messages provided' }, { status: 400 });
    }

    // Build date-based path: raw/YYYY/MM/YYYY-MM-DD-vault-chat.md
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const rawDir = path.join(VAULT_ROOT, 'raw', year, month);
    const filePath = path.join(rawDir, `${dateStr}-vault-chat.md`);

    // Ensure directory exists
    await fsp.mkdir(rawDir, { recursive: true });

    // Build transcript block
    const timeStr = now.toISOString();
    const transcriptBlock = [
      '',
      `## ${timeStr}`,
      ...messages.map((m) => {
        const prefix = m.role === 'assistant' ? '**Assistant:**' : '**User:**';
        return `${prefix} ${m.text}`;
      }),
      '',
    ].join('\n');

    // Check if file exists to decide on header
    let header = '';
    try {
      await fsp.access(filePath);
    } catch {
      // File does not exist — write header
      header = [
        '---',
        `title: "Vault Chat — ${dateStr}"`,
        `created: "${dateStr}T00:00:00+10:00"`,
        `updated: "${timeStr}"`,
        'agents: [personal-dashboard]',
        'privacy: private',
        '---',
        '',
        `# Vault Chat — ${dateStr}`,
        '',
        `Raw transcript of check-in and assistant conversations.`,
        '',
      ].join('\n');
    }

    const fullContent = header ? header + transcriptBlock : transcriptBlock;

    // Append to file
    await fsp.appendFile(filePath, fullContent, 'utf-8');

    return NextResponse.json({ ok: true, path: `raw/${year}/${month}/${dateStr}-vault-chat.md` });
  } catch (error) {
    console.error('Vault transcript error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
