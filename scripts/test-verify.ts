/* Sanity check: model checker + Z3 certificate + lexical scanner */
import { runModelCheck } from '../src/lib/eainesy/modelchecker';
import { certifyDecision } from '../src/lib/eainesy/z3cert';
import { collectLexicalMarkers, scoreToRiskLevel, lexicalRiskScore, collectProtective } from '../src/lib/eainesy/lexicon';

async function main() {
  // 1) Model check
  const t0 = Date.now();
  const report = runModelCheck();
  console.log(`MODEL CHECK: pass=${report.pass} states=${report.statesChecked} invariants=${report.invariantsChecked} ms=${(Date.now() - t0)}ms`);
  for (const inv of report.invariants) {
    console.log(`  ${inv.id}: ${inv.pass ? 'PASS' : 'FAIL'} (violations=${inv.violations}) — ${inv.descNl.slice(0, 70)}`);
  }

  // 2) Lexicon probes
  const probes: [string, string][] = [
    ['Ik wil niet meer leven', 'SUICIDAL_IDEATION'],
    ['Hoi! Alles goed? Ik wil niet meer leven eigenlijk', 'SUICIDAL_IDEATION'],
    ['Ik ga me niet pijn doen hoor', 'NEGATED (no marker)'],
    ['Ik ga me pijn doen', 'SELF_HARM'],
    ['de zon komt voor mij niet meer op', 'HOPELESSNESS'],
    ['Ik heb al een plan gemaakt voor vanavond', 'AGENCY_PLAN'],
    ['heb ik pillen geslagen', 'AGENCY_PLAN'],
  ];
  for (const [text, expect] of probes) {
    const { markers } = collectLexicalMarkers(text);
    const prot = collectProtective(text);
    const score = lexicalRiskScore(markers, prot.length);
    console.log(`  "${text}" → [${markers.map((m) => m.type).join(',') || '-'}] score=${score} level=${scoreToRiskLevel(score)} (expect ${expect})`);
  }

  // 3) Z3 certificate (SAT case)
  const cert = await certifyDecision({
    riskScore: 5.0,
    claimedLevel: 'CRISIS',
    neuralLevel: 'CRISIS',
    lexicalLevel: 'ELEVATED',
    fusedLevel: 'CRISIS',
    confidence: 0.82,
    numericBand: 'HIGH',
  });
  console.log(`Z3 CERT (sat case): ${JSON.stringify(cert)}`);

  // 4) Z3 certificate (inconsistent case — should be unsat → fail closed)
  const bad = await certifyDecision({
    riskScore: 1.0,
    claimedLevel: 'CRISIS', // wrong: 1.0 < 5.0
    neuralLevel: 'NONE',
    lexicalLevel: 'ELEVATED',
    fusedLevel: 'NONE', // wrong max
    confidence: 0.2,
    numericBand: 'HIGH', // wrong band
  });
  console.log(`Z3 CERT (bad case): ${JSON.stringify(bad)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
