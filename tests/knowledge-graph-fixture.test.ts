/** Test fixture must mirror the versioned source definitions, not an external SQLite snapshot. */
import { describe, expect, test } from 'bun:test';
import { KG_NODES, KG_EDGES } from '../src/lib/eainesy/kg-data';
import { createFakeDb } from './support/fake-db';

describe('database-free knowledge graph fixture', () => {
  test('every versioned node and relation is available', async () => {
    const db = createFakeDb();
    const nodes = await db.kGNode.findMany();
    const edges = await db.kGEdge.findMany();
    expect(KG_NODES.length).toBeGreaterThan(0);
    expect(KG_EDGES.length).toBeGreaterThan(0);
    expect(nodes.length).toBe(KG_NODES.length);
    expect(edges.length).toBe(KG_EDGES.length);
    expect(new Set(nodes.map((n) => n.key)).size).toBe(KG_NODES.length);
    expect(nodes.find((n) => n.key === KG_NODES[0].key)?.data).toBe(JSON.stringify(KG_NODES[0].data));
    expect(edges[0]?.fromKey).toBe(KG_EDGES[0].from);
    expect(edges[0]?.toKey).toBe(KG_EDGES[0].to);
  });

  test('reset preserves reference graph while clearing conversation state', async () => {
    const db = createFakeDb();
    await db.session.create({ data: { label: 'Synthetic test session' } });
    db.__reset();
    expect(await db.session.count()).toBe(0);
    expect(await db.kGNode.count()).toBe(KG_NODES.length);
    expect(await db.kGEdge.count()).toBe(KG_EDGES.length);
  });
});
