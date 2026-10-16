import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ChatRequestSchema } from '@/lib/eainesy/types';
import { processTurn } from '@/lib/eainesy/orchestrator';

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
