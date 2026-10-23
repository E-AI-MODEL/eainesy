import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const corpus=JSON.parse(readFileSync(new URL("./s1s2-real-p02-corpus.json",import.meta.url),"utf8"));

test("P02 locks ten genuinely distinct visible case ids and four research trigger opportunities",()=>{
 assert.equal(corpus.protocol,"EAINESY-S1S2-P02-GPT5-2026-10-23");
 assert.match(corpus.status,/BEFORE_MODEL_CALLS/);
 assert.equal(corpus.model,"gpt-5");
 assert.equal(corpus.cases.length,10);
 assert.equal(new Set(corpus.cases.map(c=>c.id)).size,10);
 assert.equal(corpus.cases.filter(c=>c.expectedTriggered===true).length,4);
 for(const c of corpus.cases){
   assert.equal(c.task.source,"synthetic_annotation");
   assert(c.userText.includes(c.task.evidence));
   assert.equal(c.history.length%2,0);
   assert(c.c2Claims.every(x=>x.source==="current_user"&&c.userText.includes(x.evidence)));
 }
});

test("corpus declares P0 actual output separate from matched S1/S2 unverified suggestions",()=>{
 assert.match(corpus.comparison.baseline,/real P0/);
 assert.match(corpus.comparison.S1,/symbolic/);
 assert.match(corpus.comparison.S2,/recheck/);
 assert.match(corpus.comparison.scoring,/not independent humans/i);
});
