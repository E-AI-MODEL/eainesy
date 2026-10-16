/**
 * EAInesy-logo — de officiële merkassets van de identity board, als componenten.
 * De mark is gevectoriseerd uit het identiteitsbord (scripts/task25-vectorize-logo.py)
 * en leeft als /logo-mark.svg; het wordmark volgt de officiële driekleur
 * (EAI = navy, nes = blauw, y = violet).
 */

export function EainesyMark({ className = 'h-8 w-8' }: { className?: string }) {
  return <img src="/logo-mark.svg" alt="" aria-hidden className={`shrink-0 ${className}`} />;
}

export function EainesyWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`} aria-label="EAInesy">
      <span className="text-[#0b1238]">EAI</span>
      <span className="text-[#0d6ff5]">nes</span>
      <span className="text-[#7c3af5]">y</span>
    </span>
  );
}

/** Merkconstanten — één bron voor de EAI-identiteit in de UI. */
export const EAI = {
  navy: '#0b1238',
  blue: '#0d6ff5',
  cyan: '#22d3ee',
  violet: '#7c3af5',
} as const;
