import test from "node:test";
import assert from "node:assert/strict";
import {createContentReviewers,buildReviewRequest,validateContentReview} from "./content-supervisor.mjs";
import {selectArchitecture} from "./architecture-lab.mjs";

function input(user="Nee, het gaat over mijn zus.",move="QUESTION",draft="Het gaat dus om jouw relatie.") {
  return {
    userText:user,
    draft,
    history:[
      {role:"user",content:"Mijn zus is overstuur."},
      {role:"assistant",content:"Je relatie staat onder druk, begrijp ik."},
    ],
    frame:{intent:"GENERAL_VENT",paraphrase:"",riskMarkers:[]},
    dialogueObservation:{version:1,origin:"model_claim",acts:[
      {type:"CORRECT_ASSUMPTION",evidence:"het gaat over mijn zus"}
    ]},
    lexicalMarkers:[],
    base:{move},
    // Synthetic SAT is allowed for unit testing only, NEVER treated as real Z3.
    safety:{action:"THERAPEUTIC_DIALOG",riskAssessment:"NONE",
      verification:"sat",modelCheckPass:true,outputPolicyAllowed:true,riskMemory:"NONE"},
  };
}

test("B reviews P0 draft and returns in-call revised candidate, never certified",async()=>{
  let calls=0;
  const complete=async({system,user,temperature,maxOutputTokens})=>{
    calls++;
    assert.match(system,/post-draft/);
    const req=JSON.parse(user);
    assert.equal(req.phase,"post-concept");
    assert.equal(req.draftText,"Het gaat dus om jouw relatie.");
    assert.equal(req.history.length,2);
    assert.equal(req.parserActs[0].type,"CORRECT_ASSUMPTION");
    assert.equal(req.parserActs[0].authority,"unverified_model_claim");
    assert.equal(req.safetySnapshot.verification,"sat");
    assert.equal(temperature,0);assert.equal(maxOutputTokens,650);
    return JSON.stringify({
      decision:"REVISE",issue:"PERSON_ATTRIBUTION",
      userEvidence:"het gaat over mijn zus",
      draftEvidence:"jouw relatie",
      move:"REPAIR",reason:"Prior draft assigns the problem to the wrong person.",
      revisedDraft:"Ik trok de verkeerde conclusie: je hebt het over je zus."
    });
  };
  const reviewers=createContentReviewers({complete});
  const result=await selectArchitecture(input(),"B",{supervisor:reviewers.supervisor});
  assert.equal(calls,1);assert.equal(reviewers.getCallCount(),1);
  assert.equal(result.extraCalls,1);assert.equal(result.selectedMove,"REPAIR");
  assert.equal(result.candidateDraft,"Ik trok de verkeerde conclusie: je hebt het over je zus.");
  assert.equal(result.candidateDraftCertified,false);
  assert.equal(result.supervisorOutcome.candidateRequiresOutputPolicy,true);
  assert.equal(result.supervisorOutcome.issue,"PERSON_ATTRIBUTION");
});
test("B has no extra call if draft is missing",async()=>{
  let calls=0;
  const reviewers=createContentReviewers({complete:async()=>{calls++;return "{}";}});
  const r=await selectArchitecture(input("Nee, het gaat over mijn zus.","QUESTION",""),"B",{supervisor:reviewers.supervisor});
  assert.equal(r.extraCalls,0);assert.equal(calls,0);
});
test("B rejects unsupported source evidence and keeps P0",async()=>{
  const reviewers=createContentReviewers({complete:async()=>JSON.stringify({
    decision:"REVISE",issue:"MISSED_CORRECTION",userEvidence:"Niet gezegd",
    draftEvidence:"jouw relatie",move:"REPAIR",reason:"fake evidence",
    revisedDraft:"Plausible sounding but ungrounded."
  })});
  const result=await selectArchitecture(input(),"B",{supervisor:reviewers.supervisor});
  assert.equal(result.selectedMove,"QUESTION");
  assert.equal(result.supervisorOutcome.status,"rejected");
  assert.equal(result.supervisorOutcome.rejection,"unanchored_user_evidence");
});
test("B rejects changed draft without exact source text from original concept",async()=>{
  const reviewers=createContentReviewers({complete:async()=>JSON.stringify({
    decision:"REVISE",issue:"PERSON_ATTRIBUTION",userEvidence:"het gaat over mijn zus",
    draftEvidence:"Niet in het concept",move:"REPAIR",
    reason:"no draft provenance",revisedDraft:"Ik corrigeer me."
  })});
  const result=await selectArchitecture(input(),"B",{supervisor:reviewers.supervisor});
  assert.equal(result.selectedMove,"QUESTION");
  assert.equal(result.supervisorOutcome.rejection,"unanchored_draft_evidence");
});
test("B requires single-call replacement draft; no implicit extra generation",async()=>{
  const reviewers=createContentReviewers({complete:async()=>JSON.stringify({
    decision:"REVISE",issue:"PERSON_ATTRIBUTION",userEvidence:"het gaat over mijn zus",
    draftEvidence:"jouw relatie",move:"REPAIR",reason:"wrong person"
  })});
  const r=await selectArchitecture(input(),"B",{supervisor:reviewers.supervisor});
  assert.equal(r.supervisorOutcome.rejection,"missing_one_call_revision");
  assert.equal(r.extraCalls,1);
  assert.equal(r.candidateDraft,null);
});
test("C invokes same reviewer once on true correction and never returns a revised draft",async()=>{
  let count=0;
  const reviewers=createContentReviewers({complete:async({user})=>{
    count++; const req=JSON.parse(user);
    assert.equal(req.phase,"pre-answer");
    assert.equal(req.draftText,"");
    assert.equal(req.history.length,2);
    assert.deepEqual(req.triggerCodes,["T2"]);
    return JSON.stringify({
      decision:"REVISE",issue:"MISSED_CORRECTION",
      userEvidence:"het gaat over mijn zus",draftEvidence:"",
      move:"REPAIR",reason:"Previous attribution was corrected.",revisedDraft:""
    });
  }});
  const r=await selectArchitecture(input(),"C",{orchestrator:reviewers.orchestrator});
  assert.equal(count,1);assert.equal(r.extraCalls,1);
  assert.equal(r.selectedMove,"REPAIR");
  assert.deepEqual(r.triggers,["T2"]);
  assert.equal(r.candidateDraft,null);
});
test("C remains free of content reviewer calls on ordinary neutral turn",async()=>{
  let count=0;
  const reviewers=createContentReviewers({complete:async()=>{count++;throw Error("must not run");}});
  const quiet=input("Het was een gewone dag.","QUESTION");
  quiet.dialogueObservation=null;
  const r=await selectArchitecture(quiet,"C",{orchestrator:reviewers.orchestrator});
  assert.equal(count,0);assert.equal(r.extraCalls,0);assert.equal(r.triggered,false);
});
test("C refuses unexpected reply generation in pre-answer review",async()=>{
  const reviewers=createContentReviewers({complete:async()=>JSON.stringify({
    decision:"REVISE",issue:"MISSED_CORRECTION",
    userEvidence:"het gaat over mijn zus",move:"REPAIR",
    reason:"correction",revisedDraft:"Unexpected new reply."
  })});
  const r=await selectArchitecture(input(),"C",{orchestrator:reviewers.orchestrator});
  assert.equal(r.supervisorOutcome.rejection,"c_cannot_generate_draft");
  assert.equal(r.selectedMove,"REPAIR"); // Deterministic A proposal, NOT a model approval.
  assert.equal(r.candidateDraft,null);
});
test("B and C cannot call model when safety gate is blocked, even with source anchors",async()=>{
  const reviewers=createContentReviewers({complete:async()=>{throw Error("must not call");}});
  for(const verification of ["skipped","unknown","unsat","missing"]){
    const i=input();
    i.safety.verification=verification;
    for(const arm of ["B","C"]){
      const r=await selectArchitecture(i,arm,{
        supervisor:reviewers.supervisor,orchestrator:reviewers.orchestrator});
      assert.equal(r.extraCalls,0);assert.equal(r.accepted,false);
      assert.equal(r.selectedMove,"QUESTION");
    }
  }
  assert.equal(reviewers.getCallCount(),0);
});
test("unexpected reviewer JSON and illegal safety move never grant authority",()=>{
  const args={phase:"post-concept",userText:"Nee, het gaat over mijn zus.",
    draftText:"Het gaat dus om jouw relatie.",baseMove:"QUESTION"};
  const a=validateContentReview("{broken",args);
  const b=validateContentReview(JSON.stringify({
    decision:"REVISE",issue:"PERSON_ATTRIBUTION",userEvidence:"het gaat over mijn zus",
    draftEvidence:"jouw relatie",move:"SAFETY",reason:"bad",revisedDraft:"unsafe"
  }),args);
  assert.equal(a.kind,"keep");assert.equal(b.kind,"keep");
  assert.equal(b.rejection,"invalid_move");
});
test("direct request can be reviewed without asking a redundant question",async()=>{
  const req="Kun je één concrete openingszin geven?";
  const base={
    ...input(req,"QUESTION","Waar wil je beginnen?"),
    dialogueObservation:{version:1,origin:"model_claim",acts:[
      {type:"REQUEST_ANSWER",evidence:"één concrete openingszin"}
    ]}
  };
  const reviewers=createContentReviewers({complete:async()=>JSON.stringify({
    decision:"REVISE",issue:"MISSED_DIRECT_REQUEST",
    userEvidence:"één concrete openingszin",draftEvidence:"Waar wil je beginnen?",
    move:"INFORMATION",reason:"User explicitly requested a concrete example.",
    revisedDraft:"Je kunt beginnen met: ik wil iets bespreken zonder verwijten."
  })});
  const r=await selectArchitecture(base,"B",{supervisor:reviewers.supervisor});
  assert.equal(r.selectedMove,"INFORMATION");
  assert.equal(r.candidateDraftCertified,false);
});
test("review request exposes neither a fake user identity nor transport credentials",()=>{
  const user=input();
  const request=buildReviewRequest("post-concept",{
    workspace:{userText:user.userText,history:user.history,evidence:[],
      dialogueObservation:{anchored:[]},baseMove:"QUESTION",safety:user.safety,triggerCodes:["T2"]},
    input:user,proposal:{move:"QUESTION"}
  });
  assert.equal(request.userText,user.userText);
  assert.equal(request.history.length,2);
  assert.equal(request.draftText,user.draft);
  assert.equal("apiKey" in request,false);
  assert.equal("endpoint" in request,false);
});
