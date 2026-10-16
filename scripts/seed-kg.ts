/**
 * Seed: knowledge graph → DB. Wipes edges and re-inserts (definition is the
 * source of truth in src/lib/eainesy/kg-data.ts). Nodes are upserted by key.
 * Run: bunx tsx scripts/seed-kg.ts
 */
import { PrismaClient } from '@prisma/client';
import { KG_NODES, KG_EDGES } from '../src/lib/eainesy/kg-data';

async function main() {
  const db = new PrismaClient();
  for (const n of KG_NODES) {
    await db.kGNode.upsert({
      where: { key: n.key },
      update: { type: n.type, labelNl: n.nl, labelEn: n.en, data: JSON.stringify(n.data) },
      create: { key: n.key, type: n.type, labelNl: n.nl, labelEn: n.en, data: JSON.stringify(n.data) },
    });
  }
  await db.kGEdge.deleteMany();
  for (const e of KG_EDGES) {
    await db.kGEdge.create({ data: { fromKey: e.from, toKey: e.to, rel: e.rel, weight: e.weight ?? 1.0 } });
  }
  const nodes = await db.kGNode.count();
  const edges = await db.kGEdge.count();
  console.log(`KG seeded: ${nodes} nodes, ${edges} edges`);
  await db.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
