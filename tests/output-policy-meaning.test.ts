/**
 * Focused deterministic boundary tests. These checks are not clinical or
 * comprehensive semantic validation; they reject common false PASS cases.
 */
import { describe, expect, test } from 'bun:test';
import { cannedReplyFor, verifyOutput } from '../src/lib/eainesy/outputpolicy';
import type { Plan } from '../src/lib/eainesy/types';

const plan = (
  action: Plan['action'] = 'CRISIS_PROTOCOL',
  language: Plan['language'] = 'nl',
  mustInclude: string[] = ['Bel 113 of 0800-0113'],
): Plan => ({
  action, language, mustInclude, tone: 'calm', allowedMoves: [],
  forbiddenMoves: [], kgCitations: [], crisisResources: [], maxSentences: 15,
});

function failed(text: string, p: Plan): string[] {
  return verifyOutput(text, p).violations.map(v => v.ruleId);
}

describe('actionable helpline referral (not simply digits)', () => {
  test('a bare 113 and incidental question cannot pass crisis guards', () => {
    const v = failed('113 is een nummer. Welke kleur heeft een appel?', plan());
    expect(v).toContain('OP-3');
    expect(v).toContain('OP-15');
    expect(v).toContain('OP-12');
  });

  test('a direct instruction not to call 113 does not count as a referral', () => {
    const v = failed('Bel 113 niet. Hoe gaat het met je?', plan());
    expect(v).toContain('OP-3');
    expect(v).toContain('OP-15');
  });

  test('an actionable Dutch crisis referral with a closing check-in passes', () => {
    expect(failed('Je kunt meteen hulp krijgen: bel 113 of 0800-0113. Ben je veilig?', plan())).toEqual([]);
  });

  test('112 mentioned as trivia does not satisfy a mandatory referral', () => {
    const v = failed('112 is een getal. Bel 113 voor hulp. Ben je veilig?', plan('CRISIS_PROTOCOL', 'nl', ['113', '112']));
    expect(v).toContain('OP-15');
    expect(v).not.toContain('OP-3');
  });

  test('112 and Veilig Thuis must be offered, not merely printed', () => {
    const v = failed('112 en 0800-2000 staan hier als nummers.', plan('REFERRAL', 'nl', ['112', '0800-2000']));
    expect(v).toContain('OP-15');
  });

  test('Dutch resource combination offered as real contacts passes', () => {
    const p = plan('SAFETY_RESPONSE', 'nl', ['113', '112', '0800-2000']);
    const t = 'Bel 112 bij acuut gevaar. Veilig Thuis is bereikbaar via 0800-2000. Bel ook 113 voor hulp. Ben je veilig?';
    expect(failed(t, p)).toEqual([]);
  });


  test('calling 112 while advising against 113 must not satisfy the 113 gate', () => {
    const v = failed('Bel 112, niet 113. Ben je veilig?', plan());
    expect(v).toContain('OP-3');
    expect(v).toContain('OP-15');
  });

  test('an abuse-response fallback offers all required resources', () => {
    for (const language of ['nl', 'en'] as const) {
      const p = plan('SAFETY_RESPONSE', language, ['113', '112', '0800-2000']);
      expect(failed(cannedReplyFor(p), p)).toEqual([]);
    }
  });

  test('English crisis referral with a closing safety check passes', () => {
    expect(failed('You can call 113 for help. Are you safe right now?', plan('CRISIS_PROTOCOL', 'en'))).toEqual([]);
  });

  test('English denial of helpline use fails even when the number appears', () => {
    const v = failed('Do not call 113. Are you safe right now?', plan('CRISIS_PROTOCOL', 'en'));
    expect(v).toContain('OP-3');
  });
});

describe('closing crisis check-in (not merely a question mark)', () => {
  test('check-in at the beginning does not satisfy the closing requirement', () => {
    expect(failed('Hoe gaat het met je? Bel 113.', plan())).toContain('OP-12');
  });

  test('unrelated final question does not count as a safety check-in', () => {
    expect(failed('Bel 113. Hoeveel is twee plus twee?', plan())).toContain('OP-12');
  });

  test('a closing question about immediate support counts', () => {
    expect(failed('Bel 113. Heb je op dit moment iemand in de buurt?', plan())).toEqual([]);
  });

  test('human-written Dutch and English crisis fallbacks satisfy the improved guard', () => {
    for (const action of ['CRISIS_PROTOCOL', 'SAFETY_RESPONSE'] as const) {
      for (const language of ['nl', 'en'] as const) {
        const p = plan(action, language);
        const text = cannedReplyFor(p);
        expect(failed(text, p)).toEqual([]);
      }
    }
  });

  test('rule-specific safety fallbacks preserve the closing check-in', () => {
    for (const ruleId of ['P03', 'P67', 'C02']) {
      for (const language of ['nl', 'en'] as const) {
        const p = {...plan('CRISIS_PROTOCOL', language), ruleId};
        const text = cannedReplyFor(p);
        expect(failed(text, p)).toEqual([]);
      }
    }
  });
});
