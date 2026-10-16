import { PROBES } from '../src/lib/eainesy/redteam';
import { decide } from '../src/lib/eainesy/controller';
const p = PROBES.find((x) => x.id === 'RT-11')!;
console.log('frame:', JSON.stringify(p.frame));
const score = p.frame!.riskMarkers.reduce((s, m) => s + ({ SELF_HARM: 4, SUICIDAL_IDEATION: 5, HOPELESSNESS: 2.5, ISOLATION: 1.0, SUBSTANCE: 1.5, AGENCY_PLAN: 5 } as Record<string, number>)[m.type], 0);
console.log('neural score:', score);
// simulate controller input for the fast path: confidence HIGH, KNOWN, VALID
const d = decide({ riskLevel: 'ELEVATED', frameValidity: 'VALID', confidenceBand: 'HIGH', distressLevel: 'MODERATE', piiState: 'CLEAN', novelty: 'KNOWN', intent: 'DEPRESSIVE_REPORT' });
console.log('decide(elevated):', d.action, d.ruleId);
