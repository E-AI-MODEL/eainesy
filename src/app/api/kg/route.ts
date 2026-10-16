import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const nodes = await db.kGNode.findMany({ orderBy: [{ type: 'asc' }, { key: 'asc' }] });
  const edges = await db.kGEdge.findMany();
  return NextResponse.json({
    nodes: nodes.map((n) => ({ key: n.key, type: n.type, labelNl: n.labelNl, labelEn: n.labelEn, data: JSON.parse(n.data) })),
    edges: edges.map((e) => ({ from: e.fromKey, to: e.toKey, rel: e.rel, weight: e.weight })),
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      byType: nodes.reduce<Record<string, number>>((acc, n) => ({ ...acc, [n.type]: (acc[n.type] ?? 0) + 1 }), {}),
    },
  });
}
