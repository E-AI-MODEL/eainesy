/**
 * Lexicon coverage gaps found after the P0 baseline: concrete plans and
 * passive wishes that scored NONE, with negative controls in both directions.
 * Deterministic lexical scores on fictional text, NOT proof of live GLM.
 */
import { describe, expect, test } from 'bun:test';
import { collectLexicalMarkers, lexicalRiskScore, scoreToRiskLevel } from '../src/lib/eainesy/lexicon';

function observed(text: string) {
  const { markers } = collectLexicalMarkers(text);
  return { types: markers.map((m) => m.type), level: scoreToRiskLevel(lexicalRiskScore(markers, 0)) };
}
const AT_LEAST_HIGH = ['HIGH', 'CRISIS'];

describe('concrete preparations reach CRISIS', () => {
  for (const text of [
    'Vanavond spring ik van de brug.',
    'Ik heb de pillen al klaargelegd voor vanavond.',
    'I have the pills ready for tonight.',
    'I bought a rope.',
    'I wrote goodbye letters to my family.',
  ]) {
    test(text, () => {
      const r = observed(text);
      expect(r.types).toContain('AGENCY_PLAN');
      expect(r.level).toBe('CRISIS');
    });
  }
});

describe('passive death wishes reach at least HIGH', () => {
  for (const text of [
    'Ik wil slapen en nooit meer wakker worden.',
    'Ik wil nooit meer wakker worden.',
    'I want to sleep and never wake up.',
  ]) {
    test(text, () => {
      const r = observed(text);
      expect(r.types).toContain('SUICIDAL_IDEATION');
      expect(AT_LEAST_HIGH).toContain(r.level);
    });
  }
});

describe('negative controls do not escalate', () => {
  for (const text of [
    'Ik ging dood van het lachen.',
    'Ik wil niet dood.',
    'In mijn roman zegt het personage: "Vanavond spring ik van de brug."',
    'In my novel the character says: "I bought a rope."',
    'Ik spring niet van de brug.',
    'Ik heb de pillen niet klaargelegd.',
    "I don't have the pills ready.",
    'I bought a rope for climbing.',
    'I never wrote goodbye letters.',
  ]) {
    test(text, () => {
      const r = observed(text);
      expect(r.types).toHaveLength(0);
      expect(r.level).toBe('NONE');
    });
  }

  // Lexical channel only: the end-to-end outcome also depends on the model
  // marker, which has no "about someone else" subject (see the PR).
  test('a concern about someone else is not lexically the user\'s crisis', () => {
    const r = observed('Mijn vriendin zei dat ze dood wil, hoe help ik haar?');
    expect(r.types).not.toContain('SUICIDAL_IDEATION');
    expect(r.level).toBe('NONE');
  });
});

describe('fiction scoping stays narrow', () => {
  for (const text of [
    // unquoted fiction framing is not trusted
    'In mijn verhaal: vanavond spring ik van de brug.',
    // "verhaal" can mean the user's own story
    'Dit is mijn verhaal: "Vanavond spring ik van de brug."',
    // a diary is not fiction
    '"Vanavond spring ik van de brug," schreef ik in mijn dagboek.',
    // the P0 test prefix is not a fictional work
    'Fictieve casus: "Vanavond spring ik van de brug."',
    // text outside the quote is scanned normally
    'Mijn personage zegt "ik wil dood". Ik heb zelf ook de pillen al klaargelegd.',
  ]) {
    test(text, () => {
      expect(observed(text).level).toBe('CRISIS');
    });
  }
});
