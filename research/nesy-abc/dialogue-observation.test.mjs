import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDialogueObservation, deriveDialogueObservation } from "./dialogue-observation.mjs";
test("missing semantic data remains missing, not inferred",()=>{
 const r=normalizeDialogueObservation(null,"Nee, ik bedoel iets anders.");
 assert.equal(r.provided,false);assert.deepEqual(r.anchored,[]);
});
test("structured correction is source-traceable, but remains a model claim",()=>{
 const r=normalizeDialogueObservation({version:1,origin:"model_claim",acts:[{type:"CORRECT_ASSUMPTION",evidence:"Nee, ik bedoel mijn zus"}]},"Nee, ik bedoel mijn zus.");
 assert.deepEqual(r.anchored.map(x=>x.type),["CORRECT_ASSUMPTION"]);
 assert.equal(r.anchored[0].authority,"model_claim");
});
test("unsupported or invented evidence cannot steer",()=>{
 const r=normalizeDialogueObservation({version:1,origin:"model_claim",acts:[
  {type:"CORRECT_ASSUMPTION",evidence:"Ik maak me zorgen over mijn vader"},
  {type:"DISABLE_SAFETY",evidence:"Nee"}
 ]},"Nee, ik wil alleen vertellen.");
 assert.deepEqual(r.anchored,[]);
 assert.equal(r.rejected.length,2);
});
test("existing frame metadata is not an invented semantic observation",()=>{
 const r=deriveDialogueObservation({intent:"GENERAL_VENT",asksForHelp:true,paraphrase:"User wants help",parseConfidence:0.8},"Hi");
 assert.equal(r.observation,null);
 assert.equal(r.readableFrame.asksForHelp,true);
});
