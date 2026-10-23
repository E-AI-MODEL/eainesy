/**
 * CI contract: GitHub Environment and Secret are both named nesy.
 * Walk every tracked repository file for obsolete sandbox API key names.
 * Do not read or display any secret value.
 */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

const canonical="nesy";
const obsoleteNames=[
  ["NESY","OPENAI","API","KEY"].join("_"),
  ["NESY","OPENAI","SANDBOX","API","KEY"].join("_")
];
const paths=execFileSync("git",["ls-files","-z"],{encoding:"buffer"})
  .toString("utf8").split("\0").filter(Boolean);
assert.ok(paths.length>100,"expected full tracked repository checkout");
const obsolete=[];
for(const path of paths){
  const bytes=readFileSync(path);
  if(bytes.includes(0))continue;
  const content=bytes.toString("utf8");
  for(const name of obsoleteNames){
    if(content.includes(name))obsolete.push(path);
  }
}
assert.deepEqual([...new Set(obsolete)],[],
  "obsolete sandbox API key name found in: "+obsolete.join(", "));

const workflow=readFileSync(".github/workflows/nesy-openai-sandbox.yml","utf8");
const sandbox=readFileSync("scripts/run-nesy-openai-sandbox.mjs","utf8");
const guide=readFileSync("docs/EAInesy-OpenAI-API-sandbox.md","utf8");
const expression="          "+canonical+": $"+"{{ secrets."+canonical+" }}";
assert.ok(workflow.includes("    environment:\n      name: "+canonical+"\n"),
  "workflow must target GitHub Environment nesy");
assert.ok(workflow.includes(expression),
  "workflow must read the nesy environment secret into nesy");
assert.ok(workflow.includes('if [ -z "$'+canonical+'" ]; then'),
  "preflight must verify the nesy runtime variable");
assert.ok(workflow.includes("GitHub environment secret nesy is missing from nesy."),
  "missing-secret message must identify both names");
assert.ok(sandbox.includes("process.env."+canonical),
  "sandbox must read only the nesy runtime variable");
for(const oldName of obsoleteNames)
  assert.ok(!sandbox.includes("process.env."+oldName),
    "obsolete runtime variable in sandbox");
assert.ok(guide.includes("environment = nesy;"),
  "guide must name the nesy environment");
assert.ok(guide.includes("   nesy\n"),
  "guide must name the nesy environment secret");
console.log("PASS NeSy sandbox naming contract: environment=nesy secret=nesy; "+
  paths.length+" tracked files scanned; no obsolete aliases.");
