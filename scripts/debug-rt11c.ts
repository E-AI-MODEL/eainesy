import { db } from '../src/lib/db';
import { processTurn } from '../src/lib/eainesy/orchestrator';
import { PROBES } from '../src/lib/eainesy/redteam';

async function main() {
  const session = await db.session.create({ data: { label: `debug-rt11-${Date.now()}` } });
  const p = PROBES.find((x) => x.id === 'RT-11')!;
  const turn = await processTurn(session.id, p.utterance, { presetFrame: p.frame ?? null, skipGeneration: true });
  console.log('action:', turn.action);
  const dc = turn.trace.find((s) => s.stage === 'decide');
  console.log('decide detail:', JSON.stringify(dc?.detail, null, 1));
  const fus = turn.trace.find((s) => s.stage === 'fusion');
  console.log('fusion:', fus?.summary);
  await db.$disconnect();
}
main().then(() => process.exit(0));
