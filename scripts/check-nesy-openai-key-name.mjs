/**
 * CI contract: one OpenAI sandbox environment-secret name, everywhere.
 *
 * Scans the entire tracked repository (not just the three known integration
 * files). The previous key name is assembled from fragments to avoid
 * falsely matching itself. No secret values are ever read or printed.
 *
 * This is safe and free to run on every PR and manual sandbox dry run.
 */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

const canonical="NESY_OPENAI_API_KEY";
const previous=["NESY","OPENAI","SANDBOX","API","KEY"].join("_");
const paths=execFileSync("git",["ls-files","-z"],{encoding:"buffer"})
  .toString("utf8").split("\0").filter(Boolean);

assert.ok(paths.length>100,"expected full tracked repository checkout");
const obsolete=[];
for(const path of paths){
  const bytes=readFileSync(path);
  if(bytes.includes(0))continue; // non-text binary
  const content=bytes.toString("utf8");
  if(content.includes(previous))obsolete.push(path);
}
assert.deepEqual(obsolete,[],"obsolete OpenAI sandbox secret name found in: "+obsolete.join(", "));

const workflow=readFileSync(".github/workflows/nesy-openai-sandbox.yml","utf8");
const sandbox=readFileSync("scripts/run-nesy-openai-sandbox.mjs","utf8");
const guide=readFileSync("docs/EAInesy-OpenAI-API-sandbox.md","utf8");
const expression=canonical+": $"+"{{ secrets."+canonical+" }}";
assert.ok(workflow.includes(expression),"GitHub Actions secret source must use the canonical name");
assert.ok(workflow.includes("    environment:\n      name: nesy\n"),
  "GitHub Actions must target the exact user environment nesy");
assert.ok(workflow.includes("is missing from nesy."),
  "missing-secret preflight must identify the exact environment");
assert.ok(guide.includes("environment = nesy;"),
  "setup guide must match the named GitHub environment");
assert.ok(workflow.includes('if [ -z "$'+canonical+'" ]; then'),
  "sandbox presence check must use the same runtime name");
assert.ok(sandbox.includes("process.env."+canonical),
  "sandbox script must read only the canonical runtime variable");
assert.ok(guide.includes(canonical),"setup guide must name the matching secret");
assert.ok(!sandbox.includes("process.env."+previous),"obsolete runtime variable in sandbox");
console.log("PASS NeSy API sandbox secret-name contract: "+canonical+
  "; "+paths.length+" tracked files scanned; no obsolete aliases.");
