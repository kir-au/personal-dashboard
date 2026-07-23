import fsp from 'fs/promises';
import os from 'os';
import path from 'path';

const vaultRoot = path.join(os.homedir(), 'personal-vault');
const healthRoot = path.join(vaultRoot, 'structured', 'health');
const outputPath = path.join(vaultRoot, 'indexes', 'health-exercise-library-gaps.json');

const entries = await fsp.readdir(healthRoot, { withFileTypes: true });
const planFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('-plan.json'))
  .map((entry) => path.join(healthRoot, entry.name));
const libraryFiles = [
  path.join(healthRoot, 'shoulder-rehab-exercises.json'),
  path.join(healthRoot, 'exercise-library.json'),
];

const referenced = new Map();
for (const file of planFiles) {
  const plan = JSON.parse(await fsp.readFile(file, 'utf-8'));
  for (const item of plan.exerciseKey || []) {
    referenced.set(item.code, {
      code: item.code,
      label: item.label,
      sourcePlan: path.relative(vaultRoot, file),
    });
  }
  for (const session of plan.sessions || []) {
    for (const exercise of session.exercises || []) {
      referenced.set(exercise.code, {
        code: exercise.code,
        label: exercise.name || exercise.code,
        sourcePlan: path.relative(vaultRoot, file),
      });
    }
  }
}

const catalogCodes = new Set();
const catalogEntries = new Map();
for (const file of libraryFiles) {
  try {
    const library = JSON.parse(await fsp.readFile(file, 'utf-8'));
    for (const exercise of library.exercises || []) {
      catalogCodes.add(exercise.code);
      catalogEntries.set(exercise.code, exercise);
    }
  } catch {
    // Missing optional catalog files are reported through the resulting gaps.
  }
}

const missing = [...referenced.values()]
  .filter((exercise) => !catalogCodes.has(exercise.code))
  .sort((a, b) => a.code.localeCompare(b.code));
const requiredFields = ['name', 'dose', 'why', 'how', 'avoid', 'source'];
const incomplete = [...referenced.values()]
  .filter((exercise) => catalogCodes.has(exercise.code))
  .map((exercise) => {
    const entry = catalogEntries.get(exercise.code) || {};
    const missingFields = requiredFields.filter((field) => !entry[field]);
    if (
      entry.reviewStatus !== 'needs-visual-confirmation'
      && !entry.image
      && !(Array.isArray(entry.images) && entry.images.length)
    ) {
      missingFields.push('image');
    }
    return missingFields.length ? { ...exercise, missingFields } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.code.localeCompare(b.code));
const needsReview = [...referenced.values()]
  .filter((exercise) => catalogEntries.get(exercise.code)?.reviewStatus === 'needs-visual-confirmation')
  .map((exercise) => ({
    ...exercise,
    reason: 'The movement name is ambiguous and its starting position or movement path needs user confirmation.',
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

await fsp.mkdir(path.dirname(outputPath), { recursive: true });
await fsp.writeFile(outputPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  status: missing.length || incomplete.length || needsReview.length ? 'review-required' : 'complete',
  missing,
  incomplete,
  needsReview,
}, null, 2)}\n`, 'utf-8');

console.log(`Exercise library audit: ${missing.length} missing code(s).`);
if (missing.length) {
  for (const exercise of missing) console.log(`- ${exercise.code}: ${exercise.label}`);
}
console.log(`Exercise library audit: ${incomplete.length} incomplete card(s).`);
console.log(`Exercise library audit: ${needsReview.length} card(s) need user confirmation.`);
