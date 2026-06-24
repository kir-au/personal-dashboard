import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const EXERCISES_PATH = path.join(VAULT_ROOT, 'structured', 'health', 'shoulder-rehab-exercises.json');

export async function GET() {
  try {
    const raw = await fsp.readFile(EXERCISES_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Exercise library not available',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 404 }
    );
  }
}
