import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-daily-projection.mjs');
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
    });

    return NextResponse.json({
      ok: true,
      stdout,
      stderr,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
