# O1/O2: bestandsformaten

Hoort bij `docs/protocol-ontkenning-en-derde-persoon-2026-10-25.md` en `docs/labelinstructie-O1-O2-2026-10-25.md`.

| Bestand | Doel |
|---|---|
| `corpus-template.json` | Vorm van een corpus (`kind: corpus`, `corpus: C-O1 \| C-O2`). Het is een sjabloon en geen meetcorpus. |
| `labels-template.json` | Vorm van de ruwe labels van één beoordelaar (`kind: labels_raw`). Voorbeeld voor O1, met daaronder een voorbeeldregel voor O2. |
| `proef-10.json` | 10 fictieve proefberichten om de labelinstructie te testen. **Geen meetcorpus**: deze berichten zijn geschreven door de auteur van het lexicon en zijn daarom uitgesloten van elke meting. |
| `validate.mjs` | Controleert de vorm en print de SHA-256. Het meet niets en importeert geen lexicon- of controllercode. |

Definitieve labels (`kind: labels_final`) hebben daarnaast `rawLabelSha256s` (minstens twee beoordelaars) en per label een `resolution`: `agree`, `adjudicated` of `strictest_default`.

```bash
node research/nesy-o1o2/validate.mjs <corpus.json>
node research/nesy-o1o2/validate.mjs <labels.json> --corpus <corpus.json>
node --test research/nesy-o1o2/*.test.mjs
```

Een meetcorpus moet exact de strata-aantallen uit protocol §3 hebben (C-O1: 25/25/20/15/20/15; C-O2: 30/30/20/20). Sjablonen (`status` begint met `TEMPLATE`) en de proefset (corpus `PROEF`) zijn daarvan vrijgesteld.
