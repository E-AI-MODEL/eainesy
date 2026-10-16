import { NextResponse } from 'next/server';
import { runModelCheck, getModelCheckReport } from '@/lib/eainesy/modelchecker';
import { DECISION_RULES, FAMILIES } from '@/lib/eainesy/controller';
import { RISK_THRESHOLDS } from '@/lib/eainesy/lexicon';
import { CONFIDENCE_BAND_THRESHOLDS } from '@/lib/eainesy/z3cert';
import { CONFORMAL_EPSILON, totalCalibrationSize } from '@/lib/eainesy/conformal';
import { CHAIN_RULES } from '@/lib/eainesy/kg';
import { OUTPUT_POLICY_RULE_COUNT } from '@/lib/eainesy/outputpolicy';
import { LATTICE_STATES } from '@/lib/eainesy/types';
import { CONVERSATION_RULES } from '@/lib/eainesy/conversation';
import supportCore from '@/lib/eainesy/core/eainesy_support_core_v1.0.0.json';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1';
  const report = refresh ? runModelCheck() : getModelCheckReport(refresh);
  return NextResponse.json({
    modelCheck: report,
    policy: {
      rules: DECISION_RULES.map((r) => ({
        id: r.id,
        family: r.family,
        action: r.action,
        hitl: r.hitl === true,
        tone: r.plan.tone,
        maxSentences: r.plan.maxSentences,
        /** Plain-language description, NL + EN. */
        desc: r.desc,
        /** Technical one-liner (expert view). */
        description: r.description,
      })),
      families: FAMILIES,
      riskThresholds: RISK_THRESHOLDS,
      confidenceBands: CONFIDENCE_BAND_THRESHOLDS,
      conformal: { epsilon: CONFORMAL_EPSILON, calibrationSize: totalCalibrationSize() },
      fusion: 'max(neural, lexical) — the safer of the two risk assessments always wins',
      outputPolicyRules: OUTPUT_POLICY_RULE_COUNT,
      latticeStates: LATTICE_STATES,
      chainRules: CHAIN_RULES.map((c) => ({ id: c.id, desc: c.desc, derived: c.derived })),
      conversationRules: CONVERSATION_RULES.map((r) => ({ id: r.id, desc: r.desc })),
    },
    core: {
      id: supportCore.id,
      version: supportCore.version,
      instrumentStatus: supportCore.claim_status.instrument_status,
      notEstablished: supportCore.claim_status.not_established,
      systemProfile: supportCore.system_profile,
      sources: supportCore.research_basis.sources.map((s) => ({ id: s.id, citation: s.citation, url: (s as { url?: string }).url ?? null })),
      claims: supportCore.research_basis.claims.map((c) => ({
        id: c.id, statement: c.statement, strength: c.strength, supports: c.supports, relation: c.relation,
        status: (c as { status?: string }).status ?? 'implemented', backlogReason: (c as { backlog_reason?: string }).backlog_reason ?? null,
        implementedBy: c.implemented_by,
      })),
    },
  });
}
