/**
 * Safe Node-only P0/A/B/C DEV replay for integration on main.
 *
 * No app imports. No providers, DB, model calls, Z3 or draft delivery.
 * A separate branch (#6) retains the full processTurn integration suite,
 * which depends on yet-unmerged PR #5 provider/schema changes.
 *
 * Here we verify four arm configurations remain side-by-side, exercise
 * 24 known fictional DEV cases, and save transparent diagnostic reports.
 * Deliberately NOT an independent model-quality or clinical evaluation.
 */
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {ARMS,selectArchitecture} from "../research/nesy-abc/architecture-lab.mjs";
const read=(name)=>readFileSync(new URL("../research/nesy-abc/"+name,import.meta.url));
const devBytes=read("dev-pilot-p01.json");
const claimBytes=read("dev-scripted-dialogue-observations.json");
const dev=JSON.parse(devBytes.toString("utf8"));
const claims=JSON.parse(claimBytes.toString("utf8"));
const sha=(v)=>createHash("sha256").update(v).digest("hex");
const check=(ok,msg)=>{if(!ok)throw Error("ABC main-only DEV replay: "+msg);};
check(dev.status==="DEV_ONLY_NOT_HOLDOUT","wrong data label");
check(claims.status==="DEV_SCRIPTED_MODEL_CLAIMS_NOT_LLM_MEASUREMENTS","wrong claims label");
check(dev.protocol===claims.protocol,"mismatched protocols");
check(dev.cases?.length===24,"expected 24 fictional DEV cases");
check(Object.keys(claims.cases||{}).length===24,"expected 24 scripted entries");
check(ARMS.join("/") ==="P0/A/B/C","must preserve all four arms");
check(new Set(dev.cases.map(x=>x.id)).size===24,"duplicate case ID");

function researchInput(c,observation){
  return {
    userText:c.userText,history:c.history,lexicalMarkers:[],
    frame:{intent:"GENERAL_VENT",riskMarkers:[],paraphrase:"",parseConfidence:0.5},
    dialogueObservation:observation,
    // Deliberately NO actual draft. B's post-draft review is separately tested
    // using injected synthetic completions in content-supervisor.test.mjs.
    draft:"",
    base:{move:"QUESTION"},
    // Explicitly unverified. This runner MUST never approve a proposal
    // or invoke the B/C model callbacks.
    safety:{action:"THERAPEUTIC_DIALOG",riskAssessment:"NONE",
      verification:"skipped",modelCheckPass:false,
      outputPolicyAllowed:false,riskMemory:"UNKNOWN"}
  };
}
async function compare(c){
  const observation=claims.cases[c.id];
  check(observation?.origin==="model_claim"&&Array.isArray(observation.acts),
    "invalid scripted claim "+c.id);
  for(const act of observation.acts){
    check(typeof act.evidence==="string"&&c.userText.includes(act.evidence),
      "scripted evidence missing from current user message "+c.id);
  }
  const output={id:c.id,suite:c.suite,language:c.language,stratum:c.stratum,
    claimCount:observation.acts.length,arms:{},modelCalls:0};
  for(const [mode,data] of [["neutral",null],["scripted",observation]]){
    const result={};
    for(const arm of ARMS){
      const decision=await selectArchitecture(researchInput(c,data),arm);
      check(decision.arm===arm,"wrong arm "+c.id);
      check(decision.accepted===false,"unverified proposal approved "+c.id);
      check(decision.selectedMove==="QUESTION","P0 safety gate bypass "+c.id);
      check(decision.extraCalls===0,"unexpected review call "+c.id);
      check(decision.candidateDraft===null,"unexpected generated draft "+c.id);
      result[arm]={
        proposed:decision.proposedMove,selected:decision.selectedMove,
        triggers:decision.triggers,allowed:decision.accepted,
        extraCalls:decision.extraCalls
      };
    }
    output.arms[mode]=result;
  }
  return output;
}
const rows=[],errors=[];
for(const c of dev.cases){
  try{rows.push(await compare(c));}
  catch(e){errors.push({id:c.id,reason:e?.message||"unknown"});}
}
const changed=Object.fromEntries(ARMS.map(arm=>[
  arm,rows.filter(r=>r.arms.neutral[arm].proposed!==r.arms.scripted[arm].proposed).length
]));
const count=rows.reduce((acc,row)=>acc+row.claimCount,0);
const status=rows.length===24&&errors.length===0?"PASS_ISOLATED_DEV":"FAIL_ISOLATED_DEV";
const result={
  schema:"eainesy-abc-main-parallel-dev-v1",status,
  protocol:dev.protocol,
  sourceCommit:process.env.GITHUB_SHA||"local",
  devCorpusSha256:sha(devBytes),
  scriptedClaimSha256:sha(claimBytes),
  liveNeSyInvoked:false,realModelInvoked:false,realZ3Invoked:false,
  verifiedSafety:false,semanticQualityMeasured:false,independentReview:false,
  outcomes:{cases:rows.length,scriptedClaims:count,
    changedProposals:changed,externalCalls:0,errors:errors.length},
  cases:rows,errors
};
const dir=resolve(process.env.NESY_ABC_REPORT_DIR||".research-output/nesy-abc-main");
mkdirSync(dir,{recursive:true});
writeFileSync(resolve(dir,"main-dev-report.json"),JSON.stringify(result,null,2)+"\n");
const markdown=[
  "# NeSy — P0, A, B en C naast elkaar op main","",
  "Status: "+status,
  "Commit: "+result.sourceCommit,
  "DEV SHA-256: "+result.devCorpusSha256,
  "Scripted observations SHA-256: "+result.scriptedClaimSha256,"",
  "**Uitsluitend Node-isolatietest, niet de live NeSy-keten.**",
  "De echte processTurn-run met gesimuleerde Z3 blijft op de afzonderlijke PR #6.",
  "Geen semantische kwaliteitsmeting, geen modelcalls, geen erkende veiligheidsgate.",
  "De ontwikkeling gebruikt uitsluitend openbare fictieve casussen.","",
  "| Controle | Resultaat |","| --- | ---: |",
  "| Verwerkte gevallen | "+rows.length+"/24 |",
  "| Vooraf geschreven observaties | "+count+" |",
  "| A afwijkende voorstellen | "+changed.A+" |",
  "| B afwijkende voorstellen | "+changed.B+" |",
  "| C afwijkende voorstellen | "+changed.C+" |",
  "| Externe calls | 0 |",
  "| Fouten | "+errors.length+" |","",
  "| Casus | P0 | A neutraal | A scripted | B neutraal | B scripted | C neutraal | C scripted |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map(r=>[
    "| "+r.id,r.arms.neutral.P0.proposed,r.arms.neutral.A.proposed,
    r.arms.scripted.A.proposed,r.arms.neutral.B.proposed,r.arms.scripted.B.proposed,
    r.arms.neutral.C.proposed,r.arms.scripted.C.proposed+" |"
  ].join(" | ")),
  "",
  "**Interpretatie:** verschillen in voorgestelde bewegingen bewijzen geen betere respons.",
  ...errors.map(e=>"- Fout "+e.id+": "+e.reason),""
].join("\n");
writeFileSync(resolve(dir,"main-dev-report.md"),markdown);
if(process.env.GITHUB_STEP_SUMMARY){
  writeFileSync(process.env.GITHUB_STEP_SUMMARY,[
    "## NeSy P0/A/B/C — main research-only",
    "",
    "| Controle | Waarde |","| --- | ---: |",
    "| Isolatiecases | "+rows.length+"/24 |",
    "| 4 onafhankelijke armen | P0 / A / B / C |",
    "| Nieuwe modelaanroepen | 0 |",
    "| Geaccepteerde modelbeslissingen | 0 |",
    "| A/B/C afwijkende ruwe voorstellen | "+changed.A+"/"+changed.B+"/"+changed.C+" |",
    "| Uitvoeringsfouten | "+errors.length+" |",
    "",
    "Dit is uitsluitend een offline DEV-controle. Productiegedrag blijft ongewijzigd.",
    ""
  ].join("\n"),{flag:"a"});
}
console.log("NeSy ABC main isolated DEV: "+rows.length+"/24, changes A/B/C="+
  changed.A+"/"+changed.B+"/"+changed.C+", errors="+errors.length);
if(status!=="PASS_ISOLATED_DEV")process.exitCode=1;
