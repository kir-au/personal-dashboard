import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VAULT_PATH = path.join(process.env.HOME || '', 'personal-vault');
const REVIEW_INDEX_PATH = path.join(VAULT_PATH, 'indexes', 'vault-review.json');
const TRASH_PATH = path.join(VAULT_PATH, '.trash');

interface ReviewEntry {
  important?: boolean;
  reviewLater?: boolean;
  relevant?: boolean;
  note?: string;
  updatedAt: string;
  deletedAt?: string;
  trashPath?: string;
}

type ReviewIndex = Record<string, ReviewEntry>;

function safeJoinVault(relativePath: string) {
  const normalized = path.normalize(relativePath || '').replace(/^(\.\.(\/|\\|$))+/, '');
  const targetPath = path.join(VAULT_PATH, normalized);
  if (!targetPath.startsWith(VAULT_PATH)) {
    throw new Error('Access denied');
  }
  return { targetPath, relativePath: path.relative(VAULT_PATH, targetPath) };
}

async function readReviewIndex(): Promise<ReviewIndex> {
  try {
    const content = await fs.readFile(REVIEW_INDEX_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeReviewIndex(index: ReviewIndex) {
  await fs.mkdir(path.dirname(REVIEW_INDEX_PATH), { recursive: true });
  await fs.writeFile(REVIEW_INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
}

export async function GET() {
  try {
    const index = await readReviewIndex();
    return NextResponse.json({ entries: index });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to read vault review index',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const filePath = String(body.path || '');
    const { relativePath } = safeJoinVault(filePath);
    const index = await readReviewIndex();
    const current = index[relativePath] || {};

    index[relativePath] = {
      ...current,
      ...(typeof body.important === 'boolean' ? { important: body.important } : {}),
      ...(typeof body.reviewLater === 'boolean' ? { reviewLater: body.reviewLater } : {}),
      ...(typeof body.relevant === 'boolean' ? { relevant: body.relevant } : {}),
      ...(typeof body.note === 'string' ? { note: body.note } : {}),
      updatedAt: new Date().toISOString(),
    };

    await writeReviewIndex(index);
    return NextResponse.json({ path: relativePath, review: index[relativePath] });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to update vault review metadata',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const filePath = String(body.path || '');
    const { targetPath, relativePath } = safeJoinVault(filePath);

    const stats = await fs.stat(targetPath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Only files can be moved to trash' }, { status: 400 });
    }

    const now = new Date();
    const dateFolder = now.toISOString().slice(0, 10);
    const trashDir = path.join(TRASH_PATH, dateFolder, path.dirname(relativePath));
    await fs.mkdir(trashDir, { recursive: true });

    const trashName = `${now.toISOString().replace(/[:.]/g, '-')}-${path.basename(relativePath)}`;
    const trashFullPath = path.join(trashDir, trashName);
    await fs.rename(targetPath, trashFullPath);

    const trashRelativePath = path.relative(VAULT_PATH, trashFullPath);
    const index = await readReviewIndex();
    index[relativePath] = {
      ...(index[relativePath] || {}),
      relevant: false,
      updatedAt: now.toISOString(),
      deletedAt: now.toISOString(),
      trashPath: trashRelativePath,
    };
    await writeReviewIndex(index);

    return NextResponse.json({ path: relativePath, trashPath: trashRelativePath });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to move file to trash',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
