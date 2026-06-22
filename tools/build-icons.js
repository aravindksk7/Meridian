#!/usr/bin/env node
// tools/build-icons.js
// Reads icons-data/*.json and injects generated CLOUD_ICONS + ICONIFY_OVERRIDES
// into meridian.html between sentinel comments.
//
// Usage: node tools/build-icons.js [--dry-run]

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const ICONS_DIR   = path.join(ROOT, 'icons-data');
const TARGET_FILE = path.join(ROOT, 'meridian.html');
const DRY_RUN     = process.argv.includes('--dry-run');

const SENTINEL_BEGIN = '// @@BEGIN_CLOUD_ICONS_GENERATED@@';
const SENTINEL_END   = '// @@END_CLOUD_ICONS_GENERATED@@';

const PROVIDERS = ['aws', 'gcp', 'azure', 'general', 'ai'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugIconName(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'icon';
}

function iconKey(provider, label) {
  return `${provider}-${slugIconName(label)}`;
}

// ─── Validation ─────────────────────────────────────────────────────────────

const VALID_TYPES = new Set([
  'env','app','db','server','instance','interface','config','batch','watcher','ftp','net','domain',
  // Flowchart shapes
  'process','decision','terminal','io','document','predefined','connector',
]);

function validateEntry(entry, provider, idx) {
  const errors = [];
  if (!entry.label || typeof entry.label !== 'string')
    errors.push(`[${provider}][${idx}] missing or invalid "label"`);
  if (!entry.emoji || typeof entry.emoji !== 'string')
    errors.push(`[${provider}][${idx}] missing or invalid "emoji"`);
  if (!entry.prefix || typeof entry.prefix !== 'string')
    errors.push(`[${provider}][${idx}] missing or invalid "prefix"`);
  if (!entry.subcategory || typeof entry.subcategory !== 'string')
    errors.push(`[${provider}][${idx}] missing or invalid "subcategory"`);

  if (entry.prefix) {
    const colon = entry.prefix.indexOf(':');
    if (colon === -1) {
      errors.push(`[${provider}][${idx}] "prefix" must contain a colon: ${entry.prefix}`);
    } else {
      const type = entry.prefix.slice(0, colon);
      if (!VALID_TYPES.has(type))
        errors.push(`[${provider}][${idx}] unknown type "${type}" in prefix "${entry.prefix}"`);
    }
  }

  if (entry.iconifyRef !== null && entry.iconifyRef !== undefined) {
    if (typeof entry.iconifyRef !== 'string' || !/^[a-z0-9-]+:[a-z0-9._-]+$/.test(entry.iconifyRef))
      errors.push(`[${provider}][${idx}] invalid iconifyRef "${entry.iconifyRef}" (expected "set:icon")`);
  }

  return errors;
}

// ─── Code generation ────────────────────────────────────────────────────────

function jsStringLiteral(s) {
  // Wrap in single quotes, escaping backslashes, single quotes, and backticks.
  // Emoji are passed through as-is (they are valid in JS string literals).
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function buildCloudIconsBlock(allProviders) {
  const lines = ['const CLOUD_ICONS = {'];

  for (const [provider, entries] of Object.entries(allProviders)) {
    lines.push(`  ${provider}: [`);

    // Group by subcategory for readable output
    let lastSub = null;
    for (const e of entries) {
      if (e.subcategory !== lastSub) {
        lines.push(`    // ${e.subcategory}`);
        lastSub = e.subcategory;
      }
      const emoji  = jsStringLiteral(e.emoji);
      const label  = jsStringLiteral(e.label);
      const prefix = jsStringLiteral(e.prefix);
      const subcat = jsStringLiteral(e.subcategory);
      // Pad for alignment (cosmetic)
      const labelPadded  = label.padEnd(28);
      const prefixPadded = prefix.padEnd(26);
      lines.push(`    [${emoji},${labelPadded},${prefixPadded},${subcat}],`);
    }

    lines.push('  ],');
  }

  lines.push('};');
  return lines.join('\n');
}

function buildIconifyOverridesBlock(allProviders) {
  const lines = ['const ICONIFY_OVERRIDES = {'];

  for (const [provider, entries] of Object.entries(allProviders)) {
    const withRef = entries.filter(e => e.iconifyRef);
    if (withRef.length === 0) continue;

    lines.push(`  // ${provider}`);
    for (const e of withRef) {
      const key = iconKey(provider, e.label);
      const keyPadded = jsStringLiteral(key).padEnd(40);
      lines.push(`  ${keyPadded}: ${jsStringLiteral(e.iconifyRef)},`);
    }
  }

  lines.push('};');
  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

let totalErrors = 0;
const allProviders = {};
const stats = {};

for (const provider of PROVIDERS) {
  const filePath = path.join(ICONS_DIR, `${provider}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: missing source file: ${filePath}`);
    process.exit(1);
  }

  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`ERROR: failed to parse ${filePath}: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(entries)) {
    console.error(`ERROR: ${filePath} must be a JSON array`);
    process.exit(1);
  }

  // Validate
  const errors = [];
  const seenLabels = new Set();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    errors.push(...validateEntry(e, provider, i));
    if (e.label) {
      if (seenLabels.has(e.label))
        errors.push(`[${provider}][${i}] duplicate label "${e.label}"`);
      seenLabels.add(e.label);
    }
  }

  if (errors.length > 0) {
    errors.forEach(err => console.error(`VALIDATION ERROR: ${err}`));
    totalErrors += errors.length;
  }

  allProviders[provider] = entries;
  stats[provider] = entries.length;
}

if (totalErrors > 0) {
  console.error(`\nAborted: ${totalErrors} validation error(s). Fix the source JSON files and retry.`);
  process.exit(1);
}

// Generate JS blocks
const cloudIconsBlock      = buildCloudIconsBlock(allProviders);
const iconifyOverridesBlock = buildIconifyOverridesBlock(allProviders);
const generatedBlock =
  `${SENTINEL_BEGIN}\n` +
  `${cloudIconsBlock}\n\n` +
  `${iconifyOverridesBlock}\n` +
  `${SENTINEL_END}`;

// Read target file
if (!fs.existsSync(TARGET_FILE)) {
  console.error(`ERROR: target file not found: ${TARGET_FILE}`);
  process.exit(1);
}
const html = fs.readFileSync(TARGET_FILE, 'utf8');

// Locate sentinels
const beginIdx = html.indexOf(SENTINEL_BEGIN);
const endIdx   = html.indexOf(SENTINEL_END);

if (beginIdx === -1 || endIdx === -1) {
  console.error('ERROR: sentinel comments not found in meridian.html.');
  console.error(`  Expected: ${SENTINEL_BEGIN}`);
  console.error(`  Expected: ${SENTINEL_END}`);
  console.error('  Add these comments around the CLOUD_ICONS + ICONIFY_OVERRIDES block.');
  process.exit(1);
}

if (beginIdx >= endIdx) {
  console.error('ERROR: BEGIN sentinel appears after END sentinel.');
  process.exit(1);
}

// Replace the block (inclusive of sentinels)
const newHtml = html.slice(0, beginIdx) + generatedBlock + html.slice(endIdx + SENTINEL_END.length);

if (DRY_RUN) {
  console.log('[dry-run] Would write', TARGET_FILE);
  console.log('[dry-run] Generated block preview (first 20 lines):');
  generatedBlock.split('\n').slice(0, 20).forEach(l => console.log('  ' + l));
  console.log('  ...');
} else {
  fs.writeFileSync(TARGET_FILE, newHtml, 'utf8');
  console.log(`Written: ${TARGET_FILE}`);
}

// Summary
const totalIcons = Object.values(stats).reduce((a, b) => a + b, 0);
console.log('\nIcon counts:');
for (const [p, n] of Object.entries(stats))
  console.log(`  ${p.padEnd(8)} ${n}`);
console.log(`  ${'TOTAL'.padEnd(8)} ${totalIcons}`);
console.log('\nDone.');
