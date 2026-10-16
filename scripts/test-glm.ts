/* GLM SDK smoke test: frame parse + plan-constrained generation */
import { parseFrame, generateReply } from '../src/lib/eainesy/glm';
import type { Plan } from '../src/lib/eainesy/types';

async function main() {
  const t0 = Date.now();
  const frame = await parseFrame('Hoi, alles goed? Eigenlijk... ik wil niet meer leven.', []);
  console.log(`FRAME (${Date.now() - t0}ms):`, JSON.stringify(frame, null, 1));

  const plan: Plan = {
    action: 'CRISIS_PROTOCOL',
    tone: 'calm',
    language: frame?.language ?? 'nl',
    allowedMoves: ['acknowledge the pain', 'hand over resources'],
    forbiddenMoves: ['no technique suggestions', 'no minimizing'],
    kgCitations: ['res:113'],
    crisisResources: ['113 Zelfmoordpreventie: bel 113 of 0800-0113'],
    mustInclude: ['113 Zelfmoordpreventie: bel 113 of 0800-0113'],
    maxSentences: 6,
  };
  const t1 = Date.now();
  const reply = await generateReply({
    plan,
    frame,
    techniqueLines: ['113 Zelfmoordpreventie — bel 113 of 0800-0113 (gratis, dag en nacht)'],
    history: [{ role: 'user', content: 'Hoi, alles goed? Eigenlijk... ik wil niet meer leven.' }],
  });
  console.log(`REPLY (${Date.now() - t1}ms):`, reply);
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
