import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const HEALTH_ROOT = path.join(VAULT_ROOT, 'structured', 'health');
const EXERCISE_FILES = [
  'shoulder-rehab-exercises.json',
  'exercise-library.json',
];

export async function GET() {
  try {
    const catalog = new Map<string, Record<string, unknown>>();
    const loadedSources: string[] = [];

    for (const filename of EXERCISE_FILES) {
      try {
        const raw = await fsp.readFile(path.join(HEALTH_ROOT, filename), 'utf-8');
        const parsed = JSON.parse(raw);
        for (const exercise of parsed.exercises || []) {
          if (exercise?.code) catalog.set(exercise.code, exercise);
        }
        loadedSources.push(`structured/health/${filename}`);
      } catch {
        // A catalog is optional; return every readable source that is available.
      }
    }

    return NextResponse.json({
      exercises: [...catalog.values()],
      sources: loadedSources,
    });
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
