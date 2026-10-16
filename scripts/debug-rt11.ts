import { collectLexicalMarkers, lexicalRiskScore, collectProtective, scoreToRiskLevel } from '../src/lib/eainesy/lexicon';
const text = 'Niemand zou het merken als ik er niet meer was.';
const { markers, negated } = collectLexicalMarkers(text);
console.log('markers:', markers, 'negated:', negated);
const prot = collectProtective(text);
console.log('protective:', prot);
console.log('score:', lexicalRiskScore(markers, prot.length));
