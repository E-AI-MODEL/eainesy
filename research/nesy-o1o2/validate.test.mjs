import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {validateCorpus,validateLabels,sha256} from "./validate.mjs";

const read=(name)=>readFileSync(new URL("./"+name,import.meta.url));
const json=(name)=>JSON.parse(read(name).toString("utf8"));

test("trial set is valid, 10 cases, and marked as trial-only",()=>{
  const proef=json("proef-10.json");
  assert.deepEqual(validateCorpus(proef),[]);
  assert.equal(proef.cases.length,10);
  assert.match(proef.status,/^TRIAL_ONLY_NOT_MEASUREMENT_CORPUS$/);
});

test("corpus template is structurally valid but exempt from strata sizes",()=>{
  assert.deepEqual(validateCorpus(json("corpus-template.json")),[]);
});

test("a measurement corpus must match the preregistered strata sizes",()=>{
  const doc={...json("corpus-template.json"),status:"FROZEN"};
  assert.ok(validateCorpus(doc).some(e=>e.startsWith("stratum S1")));
});

test("S5 requires exactly two turns; other strata exactly one",()=>{
  const base=json("corpus-template.json");
  const bad={...base,cases:[{...base.cases[1],turns:[base.cases[1].turns[0]]},{...base.cases[0],id:"x",turns:[...base.cases[1].turns]}]};
  const errs=validateCorpus(bad);
  assert.ok(errs.some(e=>e.includes("S5 needs two turns")));
  assert.ok(errs.some(e=>e.includes("case x: turns")));
});

test("label template is rejected until it carries a real corpus hash",()=>{
  assert.ok(validateLabels(json("labels-template.json")).includes("corpusSha256"));
});

test("raw trial labels validate and are cross-checked against the corpus bytes",()=>{
  const corpusBytes=read("proef-10.json");
  const corpus=JSON.parse(corpusBytes.toString("utf8"));
  const labels=corpus.cases.map(c=>c.id.startsWith("P-O1-")
    ?{id:c.id,o1_risk:"unsure",o1_response:"safety_113"}
    :{id:c.id,o2_target:"unclear",o2_writer_need:"safety_113",o2_other_need:true});
  const doc={protocol:"nesy-o1o2-v1",kind:"labels_raw",corpus:"PROEF",corpusSha256:sha256(corpusBytes),rater:"R1",labels};
  assert.deepEqual(validateLabels(doc,corpusBytes),[]);
  assert.ok(validateLabels({...doc,labels:labels.slice(1)},corpusBytes).some(e=>e.startsWith("missing label")));
  assert.ok(validateLabels({...doc,corpusSha256:"0".repeat(64)},corpusBytes).some(e=>e.includes("does not match")));
  assert.ok(validateLabels({...doc,labels:[{...labels[0],o1_risk:"low"},...labels.slice(1)]},corpusBytes).some(e=>e.includes("o1_risk")));
});

test("labels are rejected against a valid corpus of another kind, even with matching hash and ids",()=>{
  const proef=json("proef-10.json");
  const other={...proef,corpus:"C-O2",status:"TEMPLATE_IDENTITY_TEST",cases:proef.cases.filter(c=>c.id.startsWith("P-O2-"))};
  assert.deepEqual(validateCorpus(other),[]);
  const corpusBytes=Buffer.from(JSON.stringify(other));
  const doc={protocol:"nesy-o1o2-v1",kind:"labels_raw",corpus:"PROEF",corpusSha256:sha256(corpusBytes),rater:"R1",
    labels:other.cases.map(c=>({id:c.id,o2_target:"unclear",o2_writer_need:"safety_113",o2_other_need:true}))};
  assert.deepEqual(validateLabels(doc,corpusBytes),["corpus file is C-O2, labels are for PROEF"]);
});

test("final labels need two raw-label hashes and a resolution per label",()=>{
  const corpusBytes=read("proef-10.json");
  const corpus=JSON.parse(corpusBytes.toString("utf8"));
  const labels=corpus.cases.map(c=>({...(c.id.startsWith("P-O1-")?{o1_risk:"acute",o1_response:"crisis_protocol"}:{o2_target:"both",o2_writer_need:"safety_113",o2_other_need:true}),id:c.id,resolution:"agree"}));
  const doc={protocol:"nesy-o1o2-v1",kind:"labels_final",corpus:"PROEF",corpusSha256:sha256(corpusBytes),rawLabelSha256s:{R1:"a".repeat(64),R2:"b".repeat(64)},labels};
  assert.deepEqual(validateLabels(doc,corpusBytes),[]);
  assert.ok(validateLabels({...doc,rawLabelSha256s:{R1:"a".repeat(64)}}).includes("rawLabelSha256s"));
  assert.ok(validateLabels({...doc,rawLabelSha256s:{R1:"a".repeat(64),R2:"a".repeat(64)}}).includes("rawLabelSha256s"));
  assert.ok(validateLabels({...doc,labels:[{...labels[0],resolution:"vote"},...labels.slice(1)]}).some(e=>e.includes("resolution")));
});

test("the validator imports no lexicon, controller or measurement code",()=>{
  const src=read("validate.mjs").toString("utf8");
  assert.doesNotMatch(src,/from\s+["'][^"']*(lexicon|controller|orchestrator|modelchecker)/);
});

test("CLI refuses --corpus without a file name instead of skipping the cross-check",()=>{
  const r=spawnSync(process.execPath,[new URL("./validate.mjs",import.meta.url).pathname,new URL("./labels-template.json",import.meta.url).pathname,"--corpus"],{encoding:"utf8"});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/usage/);
});
