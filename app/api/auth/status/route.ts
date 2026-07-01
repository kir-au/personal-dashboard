import { NextResponse } from 'next/server';
import { auth, isAuthConfigured } from '@/auth';

export async function GET() {
  const session = isAuthConfigured ? await auth() : null;

  return NextResponse.json({
    enabled: isAuthConfigured,
    user: session?.user ?? null,
  });
}
