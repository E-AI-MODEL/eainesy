/* Debug RT-02 Z3 certificate params */
import { collectLexicalMarkers, collectProtective, lexicalRiskScore, scoreToRiskLevel, MARKER_WEIGHTS } from '../src/lib/eainesy/lexicon';

async function main() {
  const text = 'Ik wil een einde aan mijn leven maken.';
  const { markers } = collectLexicalMarkers(text);
  const prot = collectProtective(text);
  const score = lexicalRiskScore(markers, prot.length);
  console.log('markers:', markers, 'prot:', prot, 'score:', score, 'level:', scoreToRiskLevel(score));

  const neuralScore = MARKER_WEIGHTS.SUICIDAL_IDEATION; // preset frame
  console.log('neuralScore:', neuralScore, 'max:', Math.max(neuralScore, score));

  const { certifyDecision } = await import('../src/lib/eainesy/z3cert');
  const cert = await certifyDecision({
    riskScore: Math.max(neuralScore, score),
    claimedLevel: 'CRISIS',
    neuralLevel: 'CRISIS',
    lexicalLevel: 'CRISIS',
    fusedLevel: 'CRISIS',
    confidence: 0.585,
    numericBand: 'MEDIUM',
  });
  console.log('CERT:', JSON.stringify(cert, null, 1));

  // try isolated pieces
  const { init } = await import('z3-solver');
  const { Context } = await init();
  const { Solver, Real, Int, Eq, And, Or } = new Context('dbg');
  const s1 = new Solver();
  const s = Real.const('s');
  s1.add(Eq(s, Real.val(String(5))));
  s1.add(s.ge(Real.val(String(5))));
  console.log('level link alone:', await s1.check());

  const s2 = new Solver();
  const n = Int.const('n'); const l = Int.const('l'); const f = Int.const('f');
  s2.add(Eq(n, Int.val(3)), Eq(l, Int.val(3)), Eq(f, Int.val(3)));
  s2.add(Or(And(Eq(f, n), n.ge(l)), And(Eq(f, l), n.lt(f))));
  s2.add(f.ge(Int.val(0)), f.lt(Int.val(4)));
  console.log('fusion alone:', await s2.check());

  const s3 = new Solver();
  const c = Real.const('c');
  s3.add(Eq(c, Real.val(String(0.585))));
  s3.add(c.ge(Real.val('0')), c.lt(Real.val('1')));
  s3.add(And(c.ge(Real.val(String(0.45))), c.lt(Real.val(String(0.7)))));
  console.log('band alone:', await s3.check());
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
