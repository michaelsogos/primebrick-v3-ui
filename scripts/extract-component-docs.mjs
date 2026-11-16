#!/usr/bin/env node
/**
 * Extract documentation data from Svelte 5 components using sveld.
 * sveld bundles its own Svelte 5 compiler — no TypeScript version dependency.
 *
 * Usage: node scripts/extract-component-docs.mjs
 * Output: docs/dev-guide/_extracted/components.json
 */
import { readdirSync, writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const LIB_DIR = join(projectRoot, 'src', 'lib');
const OUTPUT_DIR = join(projectRoot, 'docs', 'dev-guide', '_extracted');
const OUTPUT_FILE = join(OUTPUT_DIR, 'components.json');

function findSvelteFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) findSvelteFiles(fullPath, files);
    else if (entry.endsWith('.svelte')) files.push(fullPath);
  }
  return files;
}

async function main() {
  console.log('=== Svelte component docs extraction (sveld) ===');

  let ComponentParser;
  try {
    const sveld = await import('sveld');
    ComponentParser = sveld.ComponentParser;
  } catch (err) {
    console.error('Failed to import sveld. Is it installed?');
    console.error('Run: pnpm add -D sveld@0.36.0');
    console.error('Error:', err.message);
    process.exit(1);
  }

  // readdirSync order is filesystem-dependent (NTFS sorts, ext4 doesn't) —
  // sort so the emitted array order is deterministic cross-platform.
  const svelteFiles = findSvelteFiles(LIB_DIR).sort();
  console.log(`Found ${svelteFiles.length} .svelte files in src/lib/`);

  const results = [];

  for (const filePath of svelteFiles) {
    const relPath = relative(projectRoot, filePath).replace(/\\/g, '/');
    const componentName = relPath.split('/').pop().replace('.svelte', '');
    try {
      const source = readFileSync(filePath, 'utf-8');
      const parser = new ComponentParser();
      const documented = parser.parseSvelteComponent(source, { filePath: relPath });
      results.push({ file: relPath, component: componentName, data: documented });
    } catch (err) {
      console.warn(`  Warning: failed to parse ${relPath}: ${err.message}`);
      results.push({ file: relPath, component: componentName, error: err.message });
    }
  }

  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;

  // TSDoc/docstring text captures the source files' line endings — \r\n on
  // Windows checkouts vs \n on CI, which makes the committed extraction
  // permanently "stale" on the other platform. Normalize to \n so the
  // artifact is byte-identical cross-platform.
  const normalizeEol = (value) => {
    if (typeof value === 'string') return value.replace(/\r\n?/g, '\n');
    if (Array.isArray(value)) return value.map(normalizeEol);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeEol(v)]));
    }
    return value;
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(normalizeEol(results), null, 2) + '\n', 'utf-8');
  console.log(`\nExtracted: ${successCount} success, ${errorCount} errors out of ${results.length} components`);
  console.log(`Wrote to ${relative(projectRoot, OUTPUT_FILE)}`);
  console.log('=== Extraction complete ===');
}

main().catch((err) => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
