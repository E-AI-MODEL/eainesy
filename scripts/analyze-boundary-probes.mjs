#!/usr/bin/env node
/**
 * DETERMINISTIC symbolic-layer analysis of the pre-registered boundary probes.
 * Zero model calls: uses the production lexicon and (copied for analysis,
 * source-noted) the semantic backstop regexes from src/lib/eainesy/glm.ts.
 * Purpose: predict, per probe, what the symbolic layers do INDEPENDENTLY of
 * GLM, so live probe results can be attributed to the right layer.
 */
import {collectLexicalMarkers,lexicalRiskScore,scoreToRiskLevel} from '../src/lib/eainesy/lexicon';
import {PROBES} from './live-boundary-probes-cases.mjs';

// Copied verbatim (2026-10-19, glm.ts) for analysis; single source: glm.ts.
const nlCurrent=/\b(?:ik\s+(?:ben|voel\s+me)|ben\s+ik(?:\s+juist)?)\s+(?:al\s+(?:dagen|weken|maanden)\s+)?(?:diep|heel|erg|echt)\s+(?:somber|depressief|uitgeput)\b/i;
const enCurrent=/\bi\s+(?:am|feel|have\s+felt)\s+(?:for\s+(?:days|weeks|months)\s+)?(?:deeply|very|extremely)\s+(?:depressed|hopeless|exhausted)\b/i;
const passiveNL=/\b(?:hoop|wens)\s+ik\s+(?:soms\s+)?dat\s+ik\s+niet\s+(?:meer\s+)?wakker\s+(?:te\s+)?word/i;
const passiveEN=/\b(?:wish|hope)\s+i\s+(?:just\s+)?(?:would\s+not|wouldn't|won't|didn't)\s+wake\s+up/i;

console.log('SYMBOLIC PROBE ANALYSIS (deterministic, 0 model calls)');
console.log('probe-id | lexical markers | lexLevel | distress-backstop | passive-backstop');
for(const p of PROBES){
  const text=p.user;
  const {markers,negated}=collectLexicalMarkers(text);
  const level=scoreToRiskLevel(lexicalRiskScore(markers,0));
  const distressB=nlCurrent.test(text)||enCurrent.test(text);
  const passiveB=passiveNL.test(text)||passiveEN.test(text);
  console.log([p.id,markers.map(m=>m.type).join('+')||'—',level,
    distressB?'HIT':'-',passiveB?'HIT':'-'].join(' | ')
    +(negated?` (negated×${negated})`:''));
}
