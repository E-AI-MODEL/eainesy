/**
 * Phase B — the support core (src/lib/eainesy/core/*.json) is not decoration.
 *  - every typed reference (rule:, invariant:, conv_rule:, conv_invariant:,
 *    lexicon:, output_rule:, scenario:, code:) resolves to something that
 *    exists in the code — so the document cannot drift from the system;
 *  - every source carries at least one claim; every claim is implemented or
 *    explicitly in the backlog with a reason;
 *  - the dimension states match the enums the code actually uses.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import core from '../src/lib/eainesy/core/eainesy_support_core_v1.0.0.json';
import { DECISION_RULES } from '../src/lib/eainesy/controller';
import { CONVERSATION_RULES, STRATEGY_GUIDE } from '../src/lib/eainesy/conversation';
import { runModelCheck } from '../src/lib/eainesy/modelchecker';
import { LEXICAL_RULE_IDS } from '../src/lib/eainesy/lexicon';
import { OUTPUT_POLICY_RULE_IDS } from '../src/lib/eainesy/outputpolicy';
import { SCENARIOS } from '../src/lib/eainesy/scenarios';
import { CONVERSATION_PHASES, RISK_LEVELS, RISK_MEMORY_STATES, RUPTURE_STATES } from '../src/lib/eainesy/types';

const SRC = join(import.meta.dir, '..', 'src', 'lib', 'eainesy');
const mc = runModelCheck();
const invIds = new Set(mc.invariants.map((i) => i.id));

const resolvers: Record<string, (ref: string) => boolean> = {
  rule: (r) => DECISION_RULES.some((x) => x.id === r),
  invariant: (r) => r.startsWith('INV-') && invIds.has(r),
  conv_rule: (r) => CONVERSATION_RULES.some((x) => x.id === r),
  conv_invariant: (r) => r.startsWith('CI-') && invIds.has(r),
  lexicon: (r) => LEXICAL_RULE_IDS.includes(r),
  output_rule: (r) => OUTPUT_POLICY_RULE_IDS.includes(r),
  scenario: (r) => SCENARIOS.some((s) => s.id === r),
  code: (r) => {
    const [file, symbol] = r.split('#');
    const path = join(SRC, file);
    return existsSync(path) && (!symbol || readFileSync(path, 'utf8').includes(symbol));
  },
};

function collectRefs(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    const m = node.match(/^(rule|invariant|conv_rule|conv_invariant|lexicon|output_rule|scenario|code):(.+)$/);
    if (m) out.push(node);
  } else if (Array.isArray(node)) node.forEach((x) => collectRefs(x, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((x) => collectRefs(x, out));
  return out;
}

describe('support core references resolve', () => {
  const refs = collectRefs(core);
  test('there are many references', () => expect(refs.length).toBeGreaterThan(80));
  for (const ref of [...new Set(refs)]) {
    test(ref, () => {
      const [kind, ...rest] = ref.split(':');
      expect(resolvers[kind](rest.join(':'))).toBe(true);
    });
  }
});

describe('bibliography carries weight', () => {
  const sources = core.research_basis.sources.map((s) => s.id);
  const claims = core.research_basis.claims;
  test('every source supports at least one claim', () => {
    const used = new Set(claims.flatMap((c) => c.supports));
    expect(sources.filter((s) => !used.has(s))).toEqual([]);
  });
  test('every claim cites existing sources', () => {
    expect(claims.flatMap((c) => c.supports).filter((s) => !sources.includes(s))).toEqual([]);
  });
  test('every claim is implemented, or in the backlog with a reason', () => {
    const bad = claims.filter((c) => (c.implemented_by?.length ?? 0) === 0 && !((c as { status?: string }).status === 'backlog' && (c as { backlog_reason?: string }).backlog_reason));
    expect(bad.map((c) => c.id)).toEqual([]);
  });
});

describe('dimension states match the code', () => {
  const dim = (id: string) => core.dimensions.find((d) => d.id === id)!;
  const ids = (id: string) => (dim(id).states ?? []).map((s: { id: string }) => s.id);
  test('PH = conversation phases', () => expect(ids('PH')).toEqual([...CONVERSATION_PHASES]));
  test('RS = ordinal risk levels (+ UNKNOWN outside the scale)', () => {
    expect(ids('RS')).toEqual([...RISK_LEVELS]);
    expect((dim('RS') as { unknown?: { id: string } }).unknown?.id).toBe('UNKNOWN');
  });
  test('RM = risk memory states', () => expect(ids('RM')).toEqual([...RISK_MEMORY_STATES]));
  test('AL = rupture states', () => expect(ids('AL')).toEqual([...RUPTURE_STATES]));
  test('ST covers every dialogue strategy the conversation layer can choose', () => {
    const dialog = Object.keys(STRATEGY_GUIDE).filter((k) => !['SAFETY', 'BOUNDARY', 'REFERRAL', 'CLARIFY'].includes(k));
    expect(ids('ST').sort()).toEqual(dialog.sort());
  });
});
