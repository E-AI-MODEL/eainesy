#!/usr/bin/env node
/**
 * Format validator for the O1/O2 study (docs/protocol-ontkenning-en-derde-persoon-2026-10-25.md).
 * Checks corpus and label files and prints their SHA-256. It does NOT measure
 * anything: no lexicon, controller or variant is imported here (protocol §9).
 *
 *   node research/nesy-o1o2/validate.mjs <file.json> [--corpus <corpus.json>]
 */
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const STRATA={"C-O1":["S1","S2","S3","S4","S5","S6"],"C-O2":["T1","T2","T3","T4"]};
STRATA.PROEF=[...STRATA["C-O1"],...STRATA["C-O2"]];
const SIZES={"C-O1":{S1:25,S2:25,S3:20,S4:15,S5:20,S6:15},"C-O2":{T1:30,T2:30,T3:20,T4:20}};
const O1_RISK=["none","unsure","elevated","acute"];
const O1_RESPONSE=["ordinary","safety_113","crisis_protocol"];
const O2_TARGET=["writer","other","both","nobody","unclear"];
const O2_WRITER=["none","safety_113","crisis_protocol"];
const RESOLUTION=["agree","adjudicated","strictest_default"];
const HEX64=/^[0-9a-f]{64}$/;

export const sha256=(bytes)=>createHash("sha256").update(bytes).digest("hex");

/** Returns a list of problems; empty means valid. */
export function validateCorpus(doc){
  const errs=[];
  if(doc?.protocol!=="nesy-o1o2-v1")errs.push("protocol");
  if(doc?.kind!=="corpus")errs.push("kind");
  const strata=STRATA[doc?.corpus];
  if(!strata)return [...errs,"corpus"];
  if(!Array.isArray(doc.cases)||doc.cases.length===0)return [...errs,"cases"];
  const ids=new Set();
  const counts={};
  for(const c of doc.cases){
    const where=`case ${c?.id}`;
    if(typeof c?.id!=="string"||ids.has(c.id))errs.push(`${where}: missing or duplicate id`);
    ids.add(c?.id);
    if(!strata.includes(c?.stratum))errs.push(`${where}: stratum`);
    counts[c?.stratum]=(counts[c?.stratum]||0)+1;
    if(!["nl","en"].includes(c?.lang))errs.push(`${where}: lang`);
    const turns=c?.turns;
    const maxTurns=c?.stratum==="S5"?2:1;
    if(!Array.isArray(turns)||turns.length<1||turns.length>maxTurns)errs.push(`${where}: turns`);
    else if(c.stratum==="S5"&&turns.length!==2)errs.push(`${where}: S5 needs two turns`);
    for(const t of turns??[]){
      if(t?.role!=="user"||typeof t?.text!=="string"||t.text.length<10||t.text.length>500)errs.push(`${where}: turn`);
    }
  }
  // Frozen measurement corpora must match the preregistered strata sizes.
  if(SIZES[doc.corpus]&&!/^TEMPLATE/.test(doc.status??"")){
    for(const [s,n] of Object.entries(SIZES[doc.corpus]))if(counts[s]!==n)errs.push(`stratum ${s}: ${counts[s]||0} != ${n}`);
  }
  return errs;
}

function validateLabel(l,corpus){
  const where=`label ${l?.id}`;
  const errs=[];
  const isO1=corpus==="C-O1"||(corpus==="PROEF"&&/^P-O1-/.test(l?.id));
  if(isO1){
    if(!O1_RISK.includes(l?.o1_risk))errs.push(`${where}: o1_risk`);
    if(!O1_RESPONSE.includes(l?.o1_response))errs.push(`${where}: o1_response`);
  }else{
    if(!O2_TARGET.includes(l?.o2_target))errs.push(`${where}: o2_target`);
    if(!O2_WRITER.includes(l?.o2_writer_need))errs.push(`${where}: o2_writer_need`);
    if(typeof l?.o2_other_need!=="boolean")errs.push(`${where}: o2_other_need`);
  }
  if(l?.note!==undefined&&typeof l.note!=="string")errs.push(`${where}: note`);
  return errs;
}

/** Raw (one rater) or final (adjudicated) labels; optionally cross-checked against the corpus bytes. */
export function validateLabels(doc,corpusBytes){
  const errs=[];
  if(doc?.protocol!=="nesy-o1o2-v1")errs.push("protocol");
  if(!["labels_raw","labels_final"].includes(doc?.kind))return [...errs,"kind"];
  if(!STRATA[doc.corpus])return [...errs,"corpus"];
  if(!HEX64.test(doc.corpusSha256??""))errs.push("corpusSha256");
  if(doc.kind==="labels_raw"&&(typeof doc.rater!=="string"||!doc.rater))errs.push("rater");
  if(doc.kind==="labels_final"){
    const raw=doc.rawLabelSha256s;
    // at least two independent raters: two distinct raw-label files
    if(!raw||!Object.values(raw).every(h=>HEX64.test(h))||new Set(Object.values(raw)).size<2)errs.push("rawLabelSha256s");
  }
  if(!Array.isArray(doc.labels)||doc.labels.length===0)return [...errs,"labels"];
  const ids=new Set();
  for(const l of doc.labels){
    if(ids.has(l?.id))errs.push(`label ${l?.id}: duplicate`);
    ids.add(l?.id);
    errs.push(...validateLabel(l,doc.corpus));
    if(doc.kind==="labels_final"&&!RESOLUTION.includes(l?.resolution))errs.push(`label ${l?.id}: resolution`);
  }
  if(corpusBytes){
    if(sha256(corpusBytes)!==doc.corpusSha256)errs.push("corpusSha256 does not match the corpus file");
    const corpus=JSON.parse(corpusBytes.toString("utf8"));
    const corpusErrs=validateCorpus(corpus);
    if(corpusErrs.length)return [...errs,...corpusErrs.map(e=>"corpus file: "+e)];
    if(corpus.protocol!==doc.protocol||corpus.corpus!==doc.corpus)errs.push(`corpus file is ${corpus.corpus}, labels are for ${doc.corpus}`);
    const want=new Set(corpus.cases.map(c=>c.id));
    for(const id of want)if(!ids.has(id))errs.push(`missing label for ${id}`);
    for(const id of ids)if(!want.has(id))errs.push(`label for unknown case ${id}`);
  }
  return errs;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [file,flag,corpusFile]=process.argv.slice(2);
  if(!file||(flag!==undefined&&(flag!=="--corpus"||!corpusFile)))throw Error("usage: validate.mjs <file.json> [--corpus <corpus.json>]");
  const bytes=readFileSync(file);
  const doc=JSON.parse(bytes.toString("utf8"));
  const errs=doc.kind==="corpus"?validateCorpus(doc):validateLabels(doc,corpusFile?readFileSync(corpusFile):undefined);
  console.log(`${errs.length?"FAIL":"PASS"} ${file} kind=${doc.kind} corpus=${doc.corpus} sha256=${sha256(bytes)}`);
  for(const e of errs)console.log("  - "+e);
  process.exit(errs.length?1:0);
}
