#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) continue;
  const next = process.argv[index + 1];
  if (next && !next.startsWith('--')) {
    args.set(arg, next);
    index += 1;
  } else {
    args.set(arg, true);
  }
}

const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const vaultDir = args.get('--vault') || process.env.PERSONAL_VAULT_DIR || path.join(homeDir, 'personal-vault');
const sourceDir = args.get('--source') || process.env.HEALTH_CONNECT_EXPORT_DIR || path.join(vaultDir, 'incoming', 'health-connect');
const dryRun = args.has('--dry-run') || !args.has('--write');
const INDEX_PATH = path.join(vaultDir, 'indexes', 'health-connect-imports.jsonl');
const CAPTURES_INDEX_PATH = path.join(vaultDir, 'indexes', 'captures.jsonl');
const MAX_TEXT_ASSET_BYTES = 1_000_000;
const HEALTH_CONNECT_PARSER_VERSION = 1;

const EXERCISE_TYPES = new Map([
  [5, 'Stationary biking'],
  [11, 'Exercise class'],
  [33, 'Running'],
  [34, 'Treadmill running'],
  [52, 'Volleyball'],
  [53, 'Walking'],
  [58, 'Other workout'],
]);

function usage() {
  console.log(`Usage:
  node scripts/import-health-connect-export.mjs [--source <directory>] [--vault <personal-vault-dir>] [--dry-run|--write]

The source directory contains Health Connect ZIP exports synced locally from Google Drive.
Dry-run is the default. The importer preserves readable data only: a Markdown import record and text/JSON/CSV/XML assets beside it.
It never automatically updates health totals, calories, or dashboard activity.`);
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}

function getSydneyDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'health-connect-export';
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readImportStates() {
  const states = new Map();
  if (!fs.existsSync(INDEX_PATH)) return states;
  for (const line of fs.readFileSync(INDEX_PATH, 'utf8').split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line);
      if (entry?.sha256) states.set(entry.sha256, entry);
    } catch {
      // Ignore malformed historical index rows and continue with readable entries.
    }
  }
  return states;
}

function listArchiveEntries(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !entry.endsWith('/'));
}

function isReadableEntry(entry) {
  return /\.(?:json|jsonl|csv|tsv|xml|txt|md)$/i.test(entry);
}

function isSqliteEntry(entry) {
  return /\.(?:db|sqlite|sqlite3)$/i.test(entry);
}

function safeAssetName(entry, position) {
  const basename = path.basename(entry).replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${String(position).padStart(2, '0')}--${basename || 'health-connect-data.txt'}`;
}

function readArchiveText(zipPath, entry) {
  const data = execFileSync('unzip', ['-p', zipPath, entry]);
  if (data.length > MAX_TEXT_ASSET_BYTES) return null;
  return data.toString('utf8');
}

function round(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function localDateFromEpochDay(epochDay) {
  return new Date(Number(epochDay) * 86_400_000).toISOString().slice(0, 10);
}

function localDateTime(epochMillis, zoneOffsetSeconds = 0) {
  return new Date(Number(epochMillis) + Number(zoneOffsetSeconds || 0) * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
    '',
  ].join('\n');
}

function sourceName(row) {
  return row.app_name || row.package_name || `app-${row.app_info_id ?? 'unknown'}`;
}

function selectByDate(rows, valueKey, rankKey = valueKey) {
  const selected = new Map();
  for (const row of rows) {
    if (!row.date || row[valueKey] === null || row[valueKey] === undefined) continue;
    const current = selected.get(row.date);
    if (!current || Number(row[rankKey]) > Number(current[rankKey])) selected.set(row.date, row);
  }
  return selected;
}

function parseHealthConnectDatabase(zipPath, entry, archiveName) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-connect-import-'));
  const dbPath = path.join(tempDir, path.basename(entry));
  let database;

  try {
    execFileSync('unzip', ['-j', '-o', zipPath, entry, '-d', tempDir], { stdio: 'ignore' });
    database = new DatabaseSync(dbPath, { readOnly: true });
    const tableNames = new Set(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
    );
    const hasTable = (tableName) => tableNames.has(tableName);
    const all = (sql) => database.prepare(sql).all().map((row) => ({ ...row }));
    const countTable = (tableName) => hasTable(tableName)
      ? Number(database.prepare(`SELECT count(*) AS count FROM ${tableName}`).get().count)
      : 0;

    const applications = hasTable('application_info_table')
      ? all(`SELECT row_id, package_name, app_name, record_types_used, device_info_id
             FROM application_info_table ORDER BY row_id`).map((row) => ({
          id: Number(row.row_id),
          packageName: row.package_name || null,
          appName: row.app_name || null,
          recordTypesUsed: row.record_types_used
            ? String(row.record_types_used).split(',').filter(Boolean).map(Number)
            : [],
          deviceInfoId: row.device_info_id === null ? null : Number(row.device_info_id),
        }))
      : [];

    const sourceJoin = `LEFT JOIN application_info_table a ON a.row_id = r.app_info_id`;
    const sourceFields = `r.app_info_id, a.app_name, a.package_name`;
    const steps = hasTable('steps_record_table') && hasTable('application_info_table')
      ? selectByDate(all(`SELECT date(r.local_date * 86400, 'unixepoch') AS date, ${sourceFields},
                          sum(r.count) AS value
                          FROM steps_record_table r ${sourceJoin}
                          GROUP BY r.local_date, r.app_info_id`), 'value')
      : new Map();
    const distance = hasTable('distance_record_table') && hasTable('application_info_table')
      ? selectByDate(all(`SELECT date(r.local_date * 86400, 'unixepoch') AS date, ${sourceFields},
                          sum(r.distance) / 1000.0 AS value
                          FROM distance_record_table r ${sourceJoin}
                          GROUP BY r.local_date, r.app_info_id`), 'value')
      : new Map();
    const calories = hasTable('total_calories_burned_record_table') && hasTable('application_info_table')
      ? selectByDate(all(`SELECT date(r.local_date * 86400, 'unixepoch') AS date, ${sourceFields},
                          sum(r.energy) / 4184.0 AS value
                          FROM total_calories_burned_record_table r ${sourceJoin}
                          GROUP BY r.local_date, r.app_info_id`), 'value')
      : new Map();
    const hrv = hasTable('heart_rate_variability_rmssd_record_table') && hasTable('application_info_table')
      ? selectByDate(all(`SELECT date(r.local_date * 86400, 'unixepoch') AS date, ${sourceFields},
                          avg(r.heart_rate_variability_millis) AS value, count(*) AS samples
                          FROM heart_rate_variability_rmssd_record_table r ${sourceJoin}
                          GROUP BY r.local_date, r.app_info_id`), 'value', 'samples')
      : new Map();
    const sleep = hasTable('sleep_session_record_table') && hasTable('application_info_table')
      ? selectByDate(all(`SELECT date((r.end_time + coalesce(r.end_zone_offset, 0) * 1000) / 1000, 'unixepoch') AS date,
                          ${sourceFields},
                          sum(r.end_time - r.start_time) / 3600000.0 AS value, count(*) AS sessions
                          FROM sleep_session_record_table r ${sourceJoin}
                          GROUP BY date, r.app_info_id`), 'value')
      : new Map();

    const heartRate = hasTable('heart_rate_record_table')
      && hasTable('heart_rate_record_series_table')
      && hasTable('application_info_table')
      ? selectByDate(all(`SELECT date(r.local_date * 86400, 'unixepoch') AS date, ${sourceFields},
                          avg(s.beats_per_minute) AS average, min(s.beats_per_minute) AS minimum,
                          max(s.beats_per_minute) AS maximum, count(*) AS samples
                          FROM heart_rate_record_table r
                          JOIN heart_rate_record_series_table s ON s.parent_key = r.row_id
                          ${sourceJoin}
                          GROUP BY r.local_date, r.app_info_id`), 'average', 'samples')
      : new Map();

    const exerciseSessions = hasTable('exercise_session_record_table') && hasTable('application_info_table')
      ? all(`SELECT r.row_id, r.start_time, r.start_zone_offset, r.end_time, r.end_zone_offset,
                    r.local_date, r.exercise_type, r.title, r.notes, r.app_info_id,
                    a.app_name, a.package_name
             FROM exercise_session_record_table r
             ${sourceJoin}
             ORDER BY r.start_time`).map((row) => ({
          id: Number(row.row_id),
          date: localDateFromEpochDay(row.local_date),
          startLocal: localDateTime(row.start_time, row.start_zone_offset),
          endLocal: localDateTime(row.end_time, row.end_zone_offset),
          durationMinutes: round((Number(row.end_time) - Number(row.start_time)) / 60_000, 1),
          typeCode: Number(row.exercise_type),
          type: EXERCISE_TYPES.get(Number(row.exercise_type)) || `Exercise type ${row.exercise_type}`,
          title: row.title || null,
          notes: row.notes || null,
          source: sourceName(row),
        }))
      : [];

    const exerciseByDate = new Map();
    for (const session of exerciseSessions) {
      const daily = exerciseByDate.get(session.date) || { minutes: 0, sessions: 0, types: new Set() };
      daily.minutes += session.durationMinutes || 0;
      daily.sessions += 1;
      daily.types.add(session.type);
      exerciseByDate.set(session.date, daily);
    }

    const weightRecords = hasTable('weight_record_table') && hasTable('application_info_table')
      ? all(`SELECT r.time, r.zone_offset, r.local_date, r.weight, r.app_info_id,
                    a.app_name, a.package_name
             FROM weight_record_table r
             ${sourceJoin}
             ORDER BY r.time`).map((row) => ({
          date: localDateFromEpochDay(row.local_date),
          measuredLocal: localDateTime(row.time, row.zone_offset),
          kilograms: round(Number(row.weight) / 1000, 2),
          source: sourceName(row),
        }))
      : [];

    const dates = new Set([
      ...steps.keys(), ...distance.keys(), ...calories.keys(), ...heartRate.keys(),
      ...hrv.keys(), ...sleep.keys(), ...exerciseByDate.keys(), ...weightRecords.map((row) => row.date),
    ]);
    const daily = [...dates].sort().map((date) => {
      const stepRow = steps.get(date);
      const distanceRow = distance.get(date);
      const calorieRow = calories.get(date);
      const heartRateRow = heartRate.get(date);
      const hrvRow = hrv.get(date);
      const sleepRow = sleep.get(date);
      const exercise = exerciseByDate.get(date);
      const weight = weightRecords.filter((row) => row.date === date).at(-1);
      return {
        date,
        steps: stepRow ? Math.round(Number(stepRow.value)) : null,
        stepsSource: stepRow ? sourceName(stepRow) : null,
        distanceKm: distanceRow ? round(distanceRow.value, 2) : null,
        distanceSource: distanceRow ? sourceName(distanceRow) : null,
        exportedCaloriesKcal: calorieRow ? round(calorieRow.value, 0) : null,
        caloriesSource: calorieRow ? sourceName(calorieRow) : null,
        heartRateAverageBpm: heartRateRow ? round(heartRateRow.average, 0) : null,
        heartRateMinimumBpm: heartRateRow ? Number(heartRateRow.minimum) : null,
        heartRateMaximumBpm: heartRateRow ? Number(heartRateRow.maximum) : null,
        heartRateSamples: heartRateRow ? Number(heartRateRow.samples) : null,
        heartRateSource: heartRateRow ? sourceName(heartRateRow) : null,
        hrvAverageMs: hrvRow ? round(hrvRow.value, 1) : null,
        hrvSamples: hrvRow ? Number(hrvRow.samples) : null,
        sleepHours: sleepRow ? round(sleepRow.value, 2) : null,
        sleepSource: sleepRow ? sourceName(sleepRow) : null,
        exerciseMinutes: exercise ? round(exercise.minutes, 1) : null,
        exerciseSessions: exercise?.sessions || null,
        exerciseTypes: exercise ? [...exercise.types].sort().join('; ') : null,
        weightKg: weight?.kilograms ?? null,
      };
    });

    const recordTables = [
      'steps_record_table', 'distance_record_table', 'total_calories_burned_record_table',
      'heart_rate_record_table', 'heart_rate_record_series_table',
      'heart_rate_variability_rmssd_record_table', 'sleep_session_record_table',
      'exercise_session_record_table', 'weight_record_table',
    ];
    const recordsByTable = Object.fromEntries(recordTables.map((tableName) => [tableName, countTable(tableName)]));
    const userVersion = Number(database.prepare('SELECT user_version FROM pragma_user_version').get().user_version);
    const summary = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: {
        archive: archiveName,
        databaseEntry: entry,
        sqliteUserVersion: userVersion,
      },
      coverage: {
        firstDate: daily.at(0)?.date || null,
        lastDate: daily.at(-1)?.date || null,
        days: daily.length,
      },
      notes: [
        'This is a readable aggregate of the Health Connect SQLite export, not a replacement for the source archive.',
        'For metrics reported by more than one app on a day, the source with the largest daily value is selected to avoid double counting.',
        'exportedCaloriesKcal is converted from the Health Connect energy field (joules divided by 4184).',
        'No values are automatically promoted into the dashboard or used for medical decisions.',
      ],
      applications,
      recordsByTable,
      daily,
      exerciseSessions,
      weightRecords,
    };

    const csvColumns = [
      'date', 'steps', 'stepsSource', 'distanceKm', 'distanceSource',
      'exportedCaloriesKcal', 'caloriesSource', 'heartRateAverageBpm',
      'heartRateMinimumBpm', 'heartRateMaximumBpm', 'heartRateSamples',
      'heartRateSource', 'hrvAverageMs', 'hrvSamples', 'sleepHours', 'sleepSource',
      'exerciseMinutes', 'exerciseSessions', 'exerciseTypes', 'weightKg',
    ];

    return {
      parser: 'health-connect-sqlite',
      parserVersion: HEALTH_CONNECT_PARSER_VERSION,
      sqliteUserVersion: userVersion,
      coverage: summary.coverage,
      recentDaily: daily.slice(-7).reverse(),
      assets: [
        {
          entry: `${entry} (derived daily CSV)`,
          targetName: 'health-connect-daily.csv',
          text: toCsv(daily, csvColumns),
        },
        {
          entry: `${entry} (derived readable JSON)`,
          targetName: 'health-connect-summary.json',
          text: `${JSON.stringify(summary, null, 2)}\n`,
        },
      ],
    };
  } finally {
    if (database) database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory does not exist: ${sourceDir}`);
  console.error('Create it, or pass --source to the locally synced Google Drive folder.');
  process.exit(1);
}

const importStates = readImportStates();
const archives = fs.readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.zip$/i.test(entry.name))
  .map((entry) => path.join(sourceDir, entry.name))
  .filter((archivePath) => fs.statSync(archivePath).size > 0)
  .sort();

let imported = 0;
for (const archivePath of archives) {
  const digest = sha256(archivePath);
  const existingImport = importStates.get(digest);

  const archiveName = path.basename(archivePath);
  let entries;
  try {
    entries = listArchiveEntries(archivePath);
  } catch (error) {
    console.error(`Skipping unreadable archive ${archiveName}: ${error.message}`);
    continue;
  }

  const readableEntries = entries.filter(isReadableEntry);
  const sqliteEntries = entries.filter(isSqliteEntry);
  const requiresSqliteEnrichment = sqliteEntries.length > 0
    && Number(existingImport?.parserVersion || 0) < HEALTH_CONNECT_PARSER_VERSION;
  if (existingImport && !requiresSqliteEnrichment) continue;

  const date = getSydneyDate();
  const [year, month] = date.split('-');
  const title = `Health Connect export: ${archiveName}`;
  const fileStem = `${date}-health-connect-export-${slugify(path.basename(archiveName, path.extname(archiveName)))}-${digest.slice(0, 12)}`;
  const relativePath = existingImport?.path || path.join('raw', year, month, `${fileStem}.md`);
  const relativeAssetsDir = relativePath.replace(/\.md$/i, '.assets');
  const fullPath = path.join(vaultDir, relativePath);
  const fullAssetsDir = path.join(vaultDir, relativeAssetsDir);

  const extractedAssets = [];
  for (const [position, entry] of readableEntries.entries()) {
    let text;
    try {
      text = readArchiveText(archivePath, entry);
    } catch {
      text = null;
    }
    if (text === null) continue;
    extractedAssets.push({ entry, targetName: safeAssetName(entry, position), text });
  }

  let sqliteSummary = null;
  for (const entry of sqliteEntries) {
    try {
      const parsed = parseHealthConnectDatabase(archivePath, entry, archiveName);
      sqliteSummary = parsed;
      extractedAssets.push(...parsed.assets);
    } catch (error) {
      console.error(`Could not parse Health Connect database ${entry}: ${error.message}`);
    }
  }

  const recentRows = sqliteSummary?.recentDaily || [];
  const recentTable = recentRows.length
    ? [
        '| Date | Steps | Distance | Calories | Sleep | Exercise | Heart rate | HRV |',
        '| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |',
        ...recentRows.map((row) => [
          row.date,
          row.steps ?? '',
          row.distanceKm === null ? '' : `${row.distanceKm} km`,
          row.exportedCaloriesKcal === null ? '' : `${row.exportedCaloriesKcal} kcal`,
          row.sleepHours === null ? '' : `${row.sleepHours} h`,
          row.exerciseMinutes === null ? '' : `${row.exerciseMinutes} min${row.exerciseTypes ? ` (${row.exerciseTypes})` : ''}`,
          row.heartRateAverageBpm === null ? '' : `${row.heartRateAverageBpm} avg (${row.heartRateMinimumBpm}-${row.heartRateMaximumBpm})`,
          row.hrvAverageMs === null ? '' : `${row.hrvAverageMs} ms`,
        ].map((value) => String(value).replaceAll('|', '\\|')).join(' | ').replace(/^/, '| ').replace(/$/, ' |')),
      ]
    : [];

  const created = existingImport?.created || new Date().toISOString();

  const content = [
    '---',
    `title: ${yamlString(title)}`,
    `created: ${yamlString(created)}`,
    'source: "health-connect-export"',
    'capture_intent: "health_data_import"',
    'project: "health"',
    'routing_status: "review_required"',
    'privacy: private',
    `archive_sha256: ${yamlString(digest)}`,
    '---',
    '',
    `# ${title}`,
    '',
    'This is an imported Health Connect export. It is source evidence, not an automatically applied health record.',
    '',
    '## Import Summary',
    '',
    `- Archive: ${archiveName}`,
    `- Archive entries: ${entries.length}`,
    `- Direct readable data entries: ${readableEntries.length}`,
    `- Parsed Health Connect databases: ${sqliteSummary ? 1 : 0}`,
    `- Generated/copied readable assets: ${extractedAssets.length}`,
    ...(sqliteSummary
      ? [
          `- SQLite schema version: ${sqliteSummary.sqliteUserVersion}`,
          `- Data coverage: ${sqliteSummary.coverage.firstDate} to ${sqliteSummary.coverage.lastDate}`,
        ]
      : []),
    '- Structured health/dashboard updates: not applied',
    '',
    ...(recentTable.length ? ['## Latest Seven Days', '', ...recentTable, ''] : []),
    '## Readable Assets',
    '',
    ...(extractedAssets.length
      ? extractedAssets.map((asset) => `- [${asset.entry}](./${path.basename(relativeAssetsDir)}/${asset.targetName})`)
      : ['- No readable data could be generated. Keep the source archive outside the Vault and inspect its format before adding a parser.']),
    '',
    '## Review Prompt',
    '',
    'Review the imported data and decide which summaries, if any, should be promoted into the Health activity log. Preserve device provenance and do not overwrite manually captured activities.',
    '',
  ].join('\n');

  const action = existingImport ? 'enrich' : 'import';
  console.log(`${dryRun ? `Would ${action}` : `${action === 'enrich' ? 'Enriched' : 'Imported'}`} ${archiveName} -> ${relativePath} (${extractedAssets.length} readable assets)`);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    if (extractedAssets.length) fs.mkdirSync(fullAssetsDir, { recursive: true });
    for (const asset of extractedAssets) fs.writeFileSync(path.join(fullAssetsDir, asset.targetName), asset.text, 'utf8');
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    fs.appendFileSync(INDEX_PATH, `${JSON.stringify({
      created: new Date().toISOString(),
      event: existingImport ? 'enriched' : 'imported',
      source: 'health-connect-export',
      sha256: digest,
      archiveName,
      sourceDir,
      path: relativePath,
      readableEntries: extractedAssets.map((asset) => asset.entry),
      status: 'review_required',
      parser: sqliteSummary?.parser || null,
      parserVersion: sqliteSummary?.parserVersion || null,
      coverage: sqliteSummary?.coverage || null,
    })}\n`);
    if (!existingImport) {
      fs.appendFileSync(CAPTURES_INDEX_PATH, `${JSON.stringify({
        created: new Date().toISOString(),
        source: 'health-connect-export',
        intent: 'health_data_import',
        projectId: 'health',
        path: relativePath,
        title,
        metadata: {
          archiveName,
          sha256: digest,
          status: 'review_required',
          readableAssetCount: extractedAssets.length,
          parserVersion: sqliteSummary?.parserVersion || null,
        },
      })}\n`);
    }
  }
  imported += 1;
}

console.log(`${dryRun ? 'Dry run complete' : 'Import complete'}: ${imported} new archive(s).`);
