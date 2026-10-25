/**
 * Postbuild depth fix for deep filesystem vendor imports.
 *
 * `svelte-package` maps `src/lib/**` → `dist/**`, dropping one directory
 * level. A vendor file that reaches the package's own node_modules via a
 * filesystem-relative path (the escape hatch used when a package exports
 * only `.` — e.g. bits-ui's deep `dist/bits/.../exports.js`) is correct
 * at `../../../node_modules` from `src/lib/<dir>/` but needs
 * `../../node_modules` from `dist/<dir>/`.
 *
 * This rewrites the specifier in emitted .js/.d.ts files only — authored
 * sources keep the src-relative depth, and `import.meta.glob` literals
 * inside .svelte files are already authored for the dist layout.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const SRC_DEPTH = '../../../node_modules/';
const DIST_DEPTH = '../../node_modules/';

function* walk(dir) {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) yield* walk(p);
		else if (p.endsWith('.js') || p.endsWith('.d.ts')) yield p;
	}
}

let fixed = 0;
for (const file of walk(DIST)) {
	const src = readFileSync(file, 'utf8');
	if (!src.includes(SRC_DEPTH)) continue;
	writeFileSync(file, src.split(SRC_DEPTH).join(DIST_DEPTH));
	fixed++;
}
console.log(`fix-vendor-depth: rewrote ${fixed} file(s)`);
