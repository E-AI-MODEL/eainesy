/**
 * Knowledge graph runtime — loads the typed bilingual graph (see kg-data.ts)
 * into memory from the DB, grounds Frames in it, and applies deterministic
 * forward-chaining rules (derived facts are logged into the audit ledger).
 *
 * Techniques suggested to the user MUST be reachable through this graph —
 * the generator cannot invent them (output rule OP-7).
 */
import { db } from '@/lib/db';
import type { Frame, Grounding, DistressLevel } from './types';
import { KG_NODES, KG_EDGES, CHAIN_RULES, EMOTION_HINTS, TOPIC_HINTS } from './kg-data';
import type { ChainContext } from './kg-data';

export interface KGNodeData {
  nl: string;
  en: string;
  prompt?: string;   // grounding prompt a technique may offer
  detail?: string;   // for resources: the actual handoff info
}

// Re-export pure definitions for UI/API consumers that only need data.
export { KG_NODES, KG_EDGES, CHAIN_RULES };
export type { ChainContext };

// --- runtime ----------------------------------------------------------------

interface CachedGraph {
  nodes: Map<string, { type: string; nl: string; en: string; data: KGNodeData }>;
  outEdges: Map<string, { to: string; rel: string; weight: number }[]>;
  seeded: boolean;
}

let cache: CachedGraph | null = null;

export async function loadGraph(): Promise<CachedGraph> {
  if (cache) return cache;
  const nodes = await db.kGNode.findMany();
  const edges = await db.kGEdge.findMany();
  const map: CachedGraph = { nodes: new Map(), outEdges: new Map(), seeded: nodes.length > 0 };
  for (const n of nodes) {
    map.nodes.set(n.key, { type: n.type, nl: n.labelNl, en: n.labelEn, data: JSON.parse(n.data) });
  }
  for (const e of edges) {
    const list = map.outEdges.get(e.fromKey) ?? [];
    list.push({ to: e.toKey, rel: e.rel, weight: e.weight });
    map.outEdges.set(e.fromKey, list);
  }
  cache = map;
  return map;
}

export function invalidateGraphCache() {
  cache = null;
}

function matchHints(words: string[], hints: Record<string, string>): string[] {
  const keys: string[] = [];
  for (const w of words) {
    const lw = w.toLowerCase().trim();
    for (const [hint, key] of Object.entries(hints)) {
      if (lw.includes(hint) && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

/**
 * Ground a frame in the KG + run forward-chaining rules.
 * `novelFrame` is true when the neural parse found no emotion/topic anchors
 * with usable confidence — such turns are routed to CLARIFY/HITL, never to
 * confident therapeutic content.
 */
export async function groundFrame(
  frame: Frame,
  distress: DistressLevel,
  riskLevel: string,
  turnCount: number,
): Promise<Grounding> {
  const g = await loadGraph();
  const emotionKeys = matchHints(frame.emotions, EMOTION_HINTS).filter((k) => g.nodes.has(k));
  const topicKeys = matchHints(frame.topics, TOPIC_HINTS).filter((k) => g.nodes.has(k));

  // Seed technique/resource set from direct outgoing edges
  const techniqueKeys = new Set<string>();
  const resourceKeys = new Set<string>();
  const derived: string[] = [];

  const expand = (key: string) => {
    for (const e of g.outEdges.get(key) ?? []) {
      const target = g.nodes.get(e.to);
      if (!target) continue;
      if (target.type === 'Technique') techniqueKeys.add(e.to);
      if (target.type === 'Resource') resourceKeys.add(e.to);
    }
  };
  emotionKeys.forEach(expand);
  topicKeys.forEach(expand);

  // Forward chaining — deterministic rule application
  const ctx: ChainContext = {
    intent: frame.intent,
    emotions: emotionKeys,
    topics: topicKeys,
    distress,
    turnCount,
    riskLevel,
  };
  const emotions = new Set(emotionKeys);
  const topics = new Set(topicKeys);
  for (const rule of CHAIN_RULES) {
    if (rule.when(ctx)) {
      rule.addTechniques?.forEach((t) => techniqueKeys.add(t));
      rule.addEmotions?.forEach((e) => emotions.add(e));
      rule.addTopics?.forEach((t) => topics.add(t));
      rule.addResources?.forEach((r) => resourceKeys.add(r));
      derived.push(`${rule.id}: ${rule.derived}`);
    }
  }

  const novelFrame =
    emotionKeys.length === 0 &&
    topicKeys.length === 0 &&
    frame.riskMarkers.length === 0;

  return {
    emotionKeys: [...emotions],
    topicKeys: [...topics],
    techniqueKeys: [...techniqueKeys].slice(0, 3),
    resourceKeys: [...resourceKeys].slice(0, 3),
    derived,
    novelFrame,
  };
}
