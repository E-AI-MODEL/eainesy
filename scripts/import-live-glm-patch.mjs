#!/usr/bin/env node
/**
 * Reconstruct the exact original 58-case research fixture from GLM Agent's
 * SHA-256 verified 2026-10-17 patch; never execute arbitrary diff content.
 *
 * Usage: node scripts/import-live-glm-patch.mjs /path/to/eainesy-glm-live-integration.patch
 * Writes ONLY .live-eval/fixtures.mjs (gitignored). Requires original patch bytes.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
const EXPECTED = '556ce49f9d0b4608afc87e295df3d0027cf28695baa46ab892fe13d42248902a';
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/import-live-glm-patch.mjs /path/to/eainesy-glm-live-integration.patch');
  process.exit(2);
}
const patch = readFileSync(resolve(arg));
const digest = createHash('sha256').update(patch).digest('hex');
if (digest !== EXPECTED) {
  console.error('Patch SHA-256 mismatch. Refusing to import unverified research data.');
  process.exit(1);
}
const text = patch.toString('utf8').replace(/\r\n/g,'\n');
const begin = 'diff --git a/scripts/live-glm-eval-cases.mjs b/scripts/live-glm-eval-cases.mjs\n';
const start = text.indexOf(begin);
if (start < 0 || text.indexOf(begin,start+1)>=0) throw Error('Expected single fixture diff not found');
const next = text.indexOf('\ndiff --git a/', start+begin.length);
const section = text.slice(start, next < 0 ? undefined : next);
if (!section.includes('new file mode 100644') || !section.includes('+++ b/scripts/live-glm-eval-cases.mjs')) {
  throw Error('Fixture is not a new added source file; import rejected');
}
let inHunk=false, added=[];
for (const line of section.split('\n')){
  if (line.startsWith('@@')){inHunk=true;continue;}
  if (!inHunk) continue;
  if (line.startsWith('+++')) continue;
  if (line.startsWith('+')) added.push(line.slice(1));
  else if (line.startsWith('\\ No newline at end of file')) continue;
  else if (line.startsWith(' ') || line.startsWith('-')) throw Error('Unexpected context or deletion in new fixture');
}
const source=added.join('\n')+'\n';
if (!source.includes('export const PARSE_CASES = [') ||
    !source.includes('export const SEQUENCE_CASES = [') ||
    !source.includes('export const GENERATION_CASES = [') ||
    !source.includes('export const TOTAL_CHECKS =')) {
  throw Error('Fixture missing expected exports');
}
const dir=join(process.cwd(),'.live-eval');
mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,'fixtures.mjs'),source,{mode:0o600});
writeFileSync(join(dir,'fixture-origin.json'),JSON.stringify({
  source:'GLM Agent reconstructed research patch 7058156',
  patchSha256:digest,fixtureSha256:createHash('sha256').update(source).digest('hex'),
},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({imported:'.live-eval/fixtures.mjs',patchSha256:digest,
  fixtureSha256:createHash('sha256').update(source).digest('hex'),bytes:Buffer.byteLength(source)}));
