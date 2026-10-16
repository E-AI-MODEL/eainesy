/**
 * Steer-test — verifieert dat bijsturing (strengheid/stijl/taal) doordraait
 * tot in het certificaat en dat de pipeline fail-closed blijft werken.
 * Run: bunx tsx scripts/test-steer.ts
 */
import { processTurn } from '../src/lib/eainesy/orchestrator';
import type { Frame } from '../src/lib/eainesy/types';

const SESSION = `steer-test-${Date.now()}`;

const DIALOG_FRAME: Frame = {
  intent: 'WORK_STRESS',
  emotions: ['moe', 'gespannen'],
  topics: ['werk', 'slaap'],
  riskMarkers: [],
  language: 'nl',
  paraphrase: 'De gebruiker ligt wakker van werkstress.',
  parseConfidence: 0.88,
};

async function run(label: string, steer: unknown, frame: Frame | null) {
  const r = await processTurn(SESSION, 'Ik lig elke nacht wakker over mijn werk.', {
    presetFrame: frame,
    skipGeneration: true,
    steer,
  });
  const c = r.certificate;
  console.log(`\n=== ${label} ===`);
  console.log(`action=${r.action} band=${c.confidenceBand} conf=${c.confidence.toFixed(2)}`);
  console.log(`conformal: ε=${c.conformal.epsilon} abstained=${c.conformal.abstained}`);
  console.log(`steer: strictness=${c.steer?.strictness} style=${c.steer?.style} replyLang=${c.steer?.replyLang}`);
  const steerStage = r.trace.find((s) => s.stage === 'steer');
  console.log(`trace-stage: ${steerStage ? steerStage.label : '(geen — standaard)'}`);
  console.log(`reply[0..60]: ${r.reply.slice(0, 60).replace(/\n/g, ' ')}…`);
  return r;
}

async function main() {
  const { db } = await import('../src/lib/db');
  await db.session.create({ data: { id: SESSION, label: 'steer-test' } }).catch(() => null);

  const mc = (await import('../src/lib/eainesy/modelchecker')).runModelCheck();
  console.log(`MODEL CHECK: ${mc.pass ? 'PASS' : 'FAIL'} · ${mc.statesChecked} states × ${mc.invariantsChecked} invariants · ${mc.ms.toFixed(1)}ms`);

  await run('standaard (geen sturing)', undefined, DIALOG_FRAME);
  await run('streng (ε=0.30)', { strictness: 'strict' }, DIALOG_FRAME);
  await run('ontspannen (ε=0.06)', { strictness: 'relaxed' }, DIALOG_FRAME);
  await run('engels + beknopt', { replyLang: 'en', style: 'concise' }, DIALOG_FRAME);
  await run('kapotte invoer + streng', { strictness: 'strict' }, null);

  const zwakFrame: Frame = { ...DIALOG_FRAME, parseConfidence: 0.5 };
  const zwak = await run('lage zekerheid + streng (verwacht downgrade)', { strictness: 'strict' }, zwakFrame);
  console.log(`\nlage-zekerheid streng: band=${zwak.certificate.confidenceBand} (origineel HIGH/MEDIUM claim wordt terugggezet als p<0.30)`);

  // ε-differentiatie: composed≈0.46 (p≈0.105 voor MEDIUM) → streng (0.30) downgradet, ontspannen (0.06) niet
  const grensFrame: Frame = { ...DIALOG_FRAME, parseConfidence: 0.17 };
  const streng = await run('grensgeval streng', { strictness: 'strict' }, grensFrame);
  const ontspannen = await run('grensgeval ontspannen', { strictness: 'relaxed' }, grensFrame);
  console.log(`\nε-differentiatie: streng band=${streng.certificate.confidenceBand} (verwacht LOW) · ontspannen band=${ontspannen.certificate.confidenceBand} (verwacht MEDIUM)`);

  console.log('\nDONE');
  process.exit(0);
}

void main();
