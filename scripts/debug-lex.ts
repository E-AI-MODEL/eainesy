import { collectLexicalMarkers, lexicalRiskScore, scoreToRiskLevel } from '../src/lib/eainesy/lexicon';
const texts = [
  "I want to end my life. Nobody would even notice.",
  "Honestly, I wouldn't mind if I just didn't wake up tomorrow.",
  'Het gaat de laatste tijd beter, ik sliep gisteren echt de hele nacht.',
  'Therapy is really helping — I actually slept through the night twice this week.',
  'Mijn opa is vorige maand overleden en ik mis hem enorm.',
  'My dog died last week and I keep crying at work.',
  'Het komt zo op, mijn hart bonkt, ik krijg geen lucht — paniekaanval.',
  'Ik lig al weken elke nacht wakker en word uitgeput wakker.',
];
for (const t of texts) {
  const { markers } = collectLexicalMarkers(t);
  const score = lexicalRiskScore(markers, 0);
  console.log(JSON.stringify(t.slice(0, 40)), '→', markers.map(m => m.type).join(',') || '-', 'score', score, scoreToRiskLevel(score));
}
