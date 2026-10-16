import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ChatRequestSchema } from '@/lib/eainesy/types';
import { processTurn } from '@/lib/eainesy/orchestrator';
import { VerificationHalt } from '@/lib/eainesy/verification-gate';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: unknown;
  let parsed: ReturnType<typeof ChatRequestSchema.safeParse> | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    let sessionId = parsed.data.sessionId;
    if (!sessionId) {
      const session = await db.session.create({ data: { label: `chat-${Date.now()}` } });
      sessionId = session.id;
    } else {
      const exists = await db.session.findUnique({ where: { id: sessionId }, select: { id: true } });
      if (!exists) {
        const session = await db.session.create({ data: { id: sessionId, label: `chat-${Date.now()}` } });
        sessionId = session.id;
      }
    }
    const result = await processTurn(sessionId, parsed.data.message, { steer: parsed.data.steer });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VerificationHalt) {
      console.warn('[chat] verification blocked', { reason: err.reason, z3: err.z3?.result });
      const en = parsed?.success && parsed.data.uiLang === 'en';
      return NextResponse.json({
        error: 'Verification incomplete', failClosed: true, action: 'ABSTAIN_HITL',
        reply: en
          ? 'Automated verification could not be completed. EAInesy is withholding the answer; this demonstration is not a professional service.'
          : 'De automatische verificatie kon niet worden afgerond. EAInesy geeft daarom geen inhoudelijk antwoord. Deze demonstratie is geen professionele hulpdienst.',
        verification: { status: 'blocked', reason: err.reason, modelCheckPass: err.modelCheckPass,
          z3: err.z3 ? { available: err.z3.available, result: err.z3.result, ms: err.z3.ms, detail: err.z3.detail } : null,
          humanReviewQueued: false },
      }, { status: 200 });
    }
    console.error('[chat] error:', err);
    const en = parsed?.success && parsed.data.uiLang === 'en';
    return NextResponse.json(
      {
        error: 'Pipeline failure',
        reply: en
          ? 'The verified pipeline could not finish just now, so the answer is safely withheld as a precaution (fail-closed). Feel free to try again — this is a demo environment.'
          : 'De geverifieerde pipeline kon zojuist niet afronden, dus laat ik het antwoord uit voorzorg veilig leeg (fail-closed). Probeer het gerust nog een keer — dit is een demo-omgeving.',
        failClosed: true,
      },
      { status: 200 },
    );
  }
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  const turns = await db.turn.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userText: true, replyText: true, action: true, riskLevel: true, confidence: true, latencyMs: true, certificate: true, createdAt: true },
  });
  return NextResponse.json({ sessionId, turns });
}
