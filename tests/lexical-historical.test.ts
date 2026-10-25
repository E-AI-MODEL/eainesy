/**
 * P0 deviation N03: a resolved historical mention of suicidal ideation is not
 * a current CRISIS — but any sign of recurrence keeps it one. Deterministic
 * lexical scores on fictional text, NOT proof of live GLM semantics.
 */
import { describe, expect, test } from 'bun:test';
import { collectLexicalMarkers, lexicalRiskScore, scoreToRiskLevel } from '../src/lib/eainesy/lexicon';

function observed(text: string) {
  const { markers } = collectLexicalMarkers(text);
  return { types: markers.map((m) => m.type), level: scoreToRiskLevel(lexicalRiskScore(markers, 0)) };
}

describe('resolved history (years ago, explicitly closed) does not escalate', () => {
  for (const text of [
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij.',
    // frozen P0 case N03, verbatim
    'Fictieve casus: twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Ik wil nu niet dood en voel me veilig.',
    'Jaren geleden had ik suïcidale gedachten, maar die zijn al lang voorbij.',
    'Vroeger had ik suïcidale gedachten, maar die zijn verdwenen.',
    // recovery wording and a return to a place are not recurrence
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Ik voel me weer goed.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij en ik ben terug op school.',
  ]) {
    test(text, () => {
      const r = observed(text);
      expect(r.types).not.toContain('SUICIDAL_IDEATION');
      expect(r.level).not.toBe('CRISIS');
    });
  }
});

describe('current or recurrent ideation keeps escalating to CRISIS', () => {
  for (const text of [
    'Twee jaar geleden had ik suïcidale gedachten, maar ze zijn terug.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die komen terug.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die waren voorbij, en nu weer.',
    'Twee jaar geleden had ik suïcidale gedachten en nu weer.',
    'Vroeger had ik suïcidale gedachten, en sinds vorige week opnieuw.',
    'Vroeger had ik suïcidale gedachten, maar die waren voorbij; sinds vorige week opnieuw.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Nu heb ik weer suïcidale gedachten.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Nu wil ik dood.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Ik wil niet meer leven.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Vandaag denk ik weer aan zelfmoord.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Nu gaat het niet goed, ik denk weer aan de dood.',
    // pronominal recurrence (review #38)
    'Twee jaar geleden had ik suïcidale gedachten, maar die waren voorbij. Sinds gisteren heb ik ze weer.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Sinds gisteren zijn ze er weer.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Nu keren ze terug.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Ze zijn er sinds vorige week weer.',
    'Twee jaar geleden had ik suïcidale gedachten, maar die zijn voorbij. Ik voel me weer goed, maar sinds gisteren zijn ze er weer.',
  ]) {
    test(text, () => {
      const r = observed(text);
      expect(r.types).toContain('SUICIDAL_IDEATION');
      expect(r.level).toBe('CRISIS');
    });
  }
});

describe('the exception stays narrow', () => {
  for (const text of [
    // recent episodes (weeks/months) are deliberately not "history"
    'Twee weken geleden had ik suïcidale gedachten, maar die zijn voorbij.',
    'Drie maanden geleden had ik suïcidale gedachten, maar die zijn voorbij.',
    // a time anchor without an explicit closure is not resolved
    'Twee jaar geleden had ik suïcidale gedachten.',
    // a closure without a past time anchor is not history
    'Ik heb suïcidale gedachten, maar die zijn voorbij over een jaar.',
  ]) {
    test(text, () => {
      expect(observed(text).level).toBe('CRISIS');
    });
  }
});
