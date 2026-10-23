import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {observeC2,summarizeC2} from "./c2-uncertainty.mjs";
const fixture=JSON.parse(readFileSync(new URL("./c2-source-fixtures-v1.json",import.meta.url),"utf8"));
test("fixtures are bounded, unique and correctly identified",()=>{
 assert.equal(fixture.status,"PUBLIC_AUTHOR_GENERATED_ENGINEERING_ONLY");
 assert.equal(fixture.cases.length,12);
 assert.equal(new Set(fixture.cases.map(c=>c.id)).size,fixture.cases.length);
});
for(const c of fixture.cases){
 test(c.id+" "+c.theme,()=>{
  const first=observeC2({userText:c.current,history:c.prior,claims:c.claims});
  const before=JSON.stringify({current:c.current,prior:c.prior,claims:c.claims});
  const second=observeC2({userText:c.current,history:c.prior,claims:c.claims});
  assert.deepEqual(first,second);
  assert.equal(first.candidates.length,c.accepted);
  assert.equal(first.rejected.length,c.rejected);
  for(const v of first.candidates){
   assert.equal(v.weight,0);
   assert.equal(v.authority,false);
   assert.equal(v.status,"unverified_model_claim");
  }
  assert.equal(first.outputChanged,false);
  assert.equal(first.safetyChanged,false);
  assert.equal(first.certified,false);
  assert.equal(first.modelCalls,0);
  assert.equal(summarizeC2(first).candidates,c.accepted);
  assert.equal(JSON.stringify({current:c.current,prior:c.prior,claims:c.claims}),before);
  if(c.warning)assert.match(c.warning,/not validate/);
 });
}
