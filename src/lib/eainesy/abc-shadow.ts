/**
 * Optional A/B/C shadow observation of an already completed NeSy turn.
 *
 * OFF by default. EAINESY_ABC_SHADOW_ENABLED=true is the only activation
 * switch; no user-facing flag, provider or extra model call is exposed.
 *
 * This code NEVER changes a response, plan, state, risk decision, certificate
 * or output policy. It reads the already-persisted turn and existing history.
 * Results are metadata-only audit entries, never raw chat text or model drafts.
 *
 * A/B/C remain separate research hypotheses; a proposal is NOT a validated
 * decision. B's content supervisor and C's optional reviewer are deliberately
 * NOT called in shadow mode. No automatic external requests.
 */
import { appendAudit } from './audit';
import type { Certificate, TraceStage } from './types';

type HistoryMessage = { role: 'user' | 'assistant'; content: string };
export interface ABCShadowTurn {
  id: string;
  sessionId: string;
  userText: string;
  replyText: string;
  frame: string;
  plan: string;
  certificate: string;
  trace: string;
}
export interface ABCShadowInput {
  turn: ABCShadowTurn;
  certificate: Certificate;
  trace: TraceStage[];
  history: HistoryMessage[];
  origin: 'live' | 'eval' | 'scenario';
}
export type ABCShadowStatus = 'disabled' | 'skipped-eval' | 'recorded' | 'failed';

/**
 * Non-authoritative, non-blocking instrumentation. The production turn has
 * already passed the real safety gates and been persisted by processTurn.
 *
 * On any instrumentation failure, keep the original response untouched. A
 * generic audit failure entry contains neither conversation text nor error
 * messages. Absence of shadow metadata is never a reason to relax safety.
 */
export async function maybeRecordABCShadow(input: ABCShadowInput): Promise<ABCShadowStatus> {
  if (process.env.EAINESY_ABC_SHADOW_ENABLED !== 'true') return 'disabled';
  // Existing evaluation suites keep deterministic historical audit counts.
  if (input.origin === 'eval') return 'skipped-eval';

  const started = performance.now();
  try {
    // Import is conditional: disabled production requests do not load or run
    // the research modules. Only the already-present, offline A/B/C selector
    // is used, with NO supervisor or orchestrator model callbacks.
    const { compareVerifiedTurn } = await import('../../../research/nesy-abc/kernel-bridge.mjs');
    const result = await compareVerifiedTurn({
      turnRecord: input.turn,
      turnResult: {
        turnId: input.turn.id,
        sessionId: input.turn.sessionId,
        reply: input.turn.replyText,
        action: input.certificate.action,
        certificate: input.certificate,
        trace: input.trace,
      },
      history: input.history,
    });

    const arms = ['P0', 'A', 'B', 'C'] as const;
    if (result.baselineAction !== input.certificate.action ||
        arms.some((arm) => !result.arms[arm] || result.arms[arm].extraCalls !== 0)) {
      throw new Error('ABC shadow invariant failed');
    }

    const baseline = result.arms.P0.baseMove;
    const proposed = Object.fromEntries(arms.map((arm) => [
      arm, {
        proposedMove: result.arms[arm].proposedMove,
        differsFromP0: result.arms[arm].proposedMove !== baseline,
        applied: false,
      },
    ]));

    // Audit metadata contains only fixed enum labels / Boolean flags /
    // bounded trigger codes. It contains NO messages, quotes, session ID,
    // drafted content, model responses, or credentials.
    await appendAudit('turn.abc_shadow', input.turn.id, {
      schema: 'nesy-abc-shadow-v1',
      mode: 'read_only_post_response',
      origin: input.origin,
      variants: arms,
      sourceCertificate: {
        z3: input.certificate.z3.result,
        modelCheckPass: input.certificate.modelCheck.pass,
        outputPolicyPass: input.certificate.outputPolicy.pass,
      },
      sourceVerified: result.verified,
      baselineAction: result.baselineAction,
      baselineMove: baseline,
      proposed,
      cTriggerCodes: result.arms.C.triggers,
      extraModelCalls: 0,
      reviewModelUsed: false,
      outputChanged: false,
      latencyMs: Math.round(performance.now() - started),
      answerQualityValidated: false,
    });
    return 'recorded';
  } catch {
    // Shadow instrumentation must never break an already-approved turn.
    try {
      await appendAudit('turn.abc_shadow_error', input.turn.id, {
        schema: 'nesy-abc-shadow-v1',
        mode: 'read_only_post_response',
        reason: 'non_authoritative_observer_failed',
        outputChanged: false,
      });
    } catch { /* Nothing in optional telemetry may block an answer. */ }
    return 'failed';
  }
}
