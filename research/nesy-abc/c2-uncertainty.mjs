/**
 * C2: research-only source-bound semantic uncertainty notebook.
 * No network, model, DB, side effect, Z3 claim, or live authority.
 * An upstream model may suggest candidates, but this module only validates
 * source spans and records untrusted alternatives/questions.
 */
export const C2_VERSION = "nesy-c2-observation-v1";
export const C2_KINDS = Object.freeze([
  "PERSON","TIME","NEGATION","ALTERNATIVE","CONTRADICTION","MISSING_INFORMATION"
]);
const kinds = new Set(C2_KINDS);
const allowedSources = new Set(["current_user","prior_user","prior_assistant"]);
const text = x => typeof x === "string" ? x : "";
const bounded = (s,n=240) => typeof s === "string" && s.trim().length > 0 && s.length <= n;
const historyView = h => (Array.isArray(h) ? h : []).slice(-6).filter(x =>
  (x?.role === "user" || x?.role === "assistant") && typeof x.content === "string"
).map(x=>({role:x.role,content:x.content.slice(0,1500)}));

export function observeC2({userText,history=[],claims=[]}={}) {
  if (!bounded(userText,6000)) throw Error("C2 requires bounded current user text");
  const past = historyView(history);
  if (!Array.isArray(claims) || claims.length > 12) throw Error("C2 max 12 candidates");
  const accepted=[],rejected=[];
  for(let index=0;index<claims.length;index++){
    const c=claims[index];
    if (!c || !kinds.has(c.kind) || !bounded(c.evidence,200) ||
      !bounded(c.hypothesis,300) || (c.question != null && !bounded(c.question,240)) ||
      !allowedSources.has(c.source)){
      rejected.push({index,reason:"invalid_candidate"}); continue;
    }
    const sourceTexts=c.source==="current_user" ? [userText] :
      past.filter(x=>x.role===(c.source==="prior_user"?"user":"assistant")).map(x=>x.content);
    if (!sourceTexts.some(s=>s.includes(c.evidence))){
      rejected.push({index,reason:"unanchored_evidence"});continue;
    }
    const item={kind:c.kind,source:c.source,evidence:c.evidence,
      hypothesis:c.hypothesis,question:c.question??null,
      status:"unverified_model_claim",weight:0,authority:false};
    if(accepted.some(x=>x.kind===item.kind && x.evidence===item.evidence &&
      x.hypothesis===item.hypothesis)){
      rejected.push({index,reason:"duplicate_candidate"});continue;
    }
    accepted.push(Object.freeze(item));
  }
  return Object.freeze({
    version:C2_VERSION,mode:"research_read_only",inputAccepted:true,
    candidates:Object.freeze(accepted),rejected:Object.freeze(rejected),
    authorization:"none",outputChanged:false,safetyChanged:false,
    certified:false,modelCalls:0
  });
}

export function summarizeC2(record) {
  if(record?.version!==C2_VERSION)throw Error("unknown C2 record");
  return Object.freeze({version:C2_VERSION,mode:record.mode,
    candidates:record.candidates.length,rejected:record.rejected.length,
    kinds:[...new Set(record.candidates.map(x=>x.kind))],
    outputChanged:false,safetyChanged:false,certified:false});
}
