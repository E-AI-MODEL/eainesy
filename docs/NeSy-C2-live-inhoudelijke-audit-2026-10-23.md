# NeSy C2 — eerste inhoudelijke inspectie van echte modelkandidaten
**23 oktober 2026 · feitelijke bron: GitHub Actions-run [39890442472](https://github.com/E-AI-MODEL/eainesy/actions/runs/39890442472)**

**Onderzoekstatus:** voorlopige, niet-blinde analyse door één AI-assistent. Dit is geen onafhankelijke menselijke beoordeling, geen klinische beoordeling en geen experimenteel bewijs van betere gespreksbeslissingen. Het onafhankelijke beoordelingspakket blijft onbeoordeeld. De tien fictieve cases en de vijf structureel toegelaten modelkandidaten zijn wél daadwerkelijk bekeken.

## Wat is er werkelijk gemeten?

| Stap | Aantal | Wat dit betekent |
| --- | ---: | --- |
| Fictieve gesprekscontexten | 10 | Auteurssamengestelde, zichtbare DEV-set |
| Geslaagde GPT-5-mini-aanroepen | 10 | Transport en JSON-antwoord werkten |
| Voorgestelde modelkandidaten | 9 | Model produceerde in zeven cases minstens één hypothese |
| Door bron-/schemacontrole toegelaten | 5 | De aangehaalde woorden kwamen aantoonbaar uit de opgegeven bron |
| Door bron-/schemacontrole geweigerd | 4 | Drie afwijzingen: citaat niet exact; één: ongeldige kandidaat |
| Echte nulvoorstellen van het model | 3 | C2-L04, C2-L08 en C2-L09 |
| Cases met *wel* een voorstel maar *nul* toegelaten | 3 | C2-L02, C2-L03 en C2-L05; dit zijn **geen** modelabstenties |
| Cases met zowel toelating als afwijzing | 1 | C2-L10 |

Bij de eerste rapportage werd **zesmaal nul toegelaten kandidaten** getoond. Dat mag niet worden samengevat als 'het model koos zesmaal terecht voor niets'. In drie van die zes gevallen stelde het model wél iets voor, maar hield de controle het tegen.

## De vijf doorgekomen kandidaten, stuk voor stuk

| Kandidaat | Bron aanwezig? | Voorlopig inhoudelijk oordeel | Wat hoort NeSy ermee te doen? |
| --- | --- | --- | --- |
| **C2-L01-C01 — geen stappenplan** | Ja | De wens is helder. De hypothese vraagt of dit 'nu of voor altijd' geldt; dat is niet nodig voor de volgende beurt. | **Niet verduidelijken**. Respecteer de actuele wens, laat de gebruiker vertellen. |
| **C2-L06-C01 — ontslag** | Ja | Echte correctie: de gebruiker wil blijven, niet ontslag nemen. De modelhypothese merkt dat terecht op, maar stelt alsnog verificatie voor van iets wat al is opgehelderd. | **Herstel de aanname**, geef vervolgens de gevraagde openingszin. Niet opnieuw vragen of de gebruiker wil blijven. |
| **C2-L06-C02 — ontbrekende toon** | Ja | Stijl, register en publiek ontbreken, maar de gebruiker vraagt expliciet om één zin. Het ontbreken van optionele voorkeuren is geen reden om hulp uit te stellen. | **Geef een neutrale voorbeeldzin**; verfijnen kan daarna. |
| **C2-L07-C01 — Anna of Noor** | Ja | Werkelijk onopgeloste verwijzing. De gebruiker benoemt die onzekerheid zelf al. Geen reden om één naam te kiezen. | **Behoud de onzekerheid** en verduidelijk alleen wanneer de vervolgvraag een keuze vereist. |
| **C2-L10-C01 — geciteerde promptinjectie** | Ja | Het model twijfelt of een duidelijk als citaat opgegeven injectie een echte opdracht is. Dat negeert de aanwezige context; het label NEGATION past evenmin. | **Afwijzen als inhoudelijk signaal**. Behandel de zin als citaat, niet als instructie. |

De bronverankering werkt technisch zoals ontworpen, maar kan verkeerde vragen en interpretaties niet op zichzelf tegenhouden. Dat is precies de grens tussen **woorden terugvinden** en **betekenis verantwoord beoordelen**.

## Belangrijke ontbrekende gegevens

De vier afgewezen modelkandidaten zijn in de oorspronkelijke runner **niet inhoudelijk bewaard**. We hebben per geval de afwijsreden, maar niet de exacte verworpen hypothese. Daarom is geen serieuze inhoudelijke beoordeling van die vier mogelijk. Vooral de historische correctie (L02), de persoonscorrectie (L03) en codewisseling (L05) mogen we niet als modelmislukking of succesvol abstineren bestempelen. Ook weten we niet of een eventueel afgewezen kandidaat inhoudelijk juist maar niet letterlijk geciteerd was.

De drie echte nulvoorstellen (L04, L08, L09) zijn in deze voorbeelden verdedigbaar; dat is een **observatie over drie gevallen**, geen schatting van juiste terughoudendheid in andere gesprekken.

## Wat volgt hieruit voor de architectuur?

1. **C2 blijft gewichtloos en read-only.** Geen bronmatch, modelhypothese of deze evaluatie mag P0, risicofusie of Z3 overrulen.
2. **De volgende evaluatierunner bewaart ook afgewezen voorstellen** in een apart fictief-data-artefact, zonder ze gezag te geven. Eerst het volledige observatiepad, dan de semantische beoordeling.
3. **Meet twijfel én vervolghandeling afzonderlijk.** Het herkennen van een ambiguïteit kan juist zijn; daarom een extra vraag stellen kan alsnog verkeerd zijn.
4. **Beoordeel ook het nut van niets doen.** Het model hoort geen nieuwe onzekerheid te verzinnen als de gebruiker een duidelijk verzoek doet.
5. **Een nieuwe, geblindeerde test blijft nodig.** Gebruik de tien bekende cases niet opnieuw als onafhankelijk bewijs; vergelijk onder gelijkblijvende veiligheidsgrenzen met P0/A/C en beoordeel met onafhankelijke beoordelaars.

**Sterkst verdedigbare conclusie:** de C2-module kan in een kleine fictieve DEV-proef sommige correcties en ambiguïteiten benoemen. Dezelfde proef toont ook oververduidelijking en contextverlies. De waargenomen output toont **geen bewezen kwaliteitswinst** of betrouwbare mogelijkheid om zonder extra controle beter te beslissen.

### Bronverwijzing en herhaalbaarheid
- GitHub-run: [#39890442472](https://github.com/E-AI-MODEL/eainesy/actions/runs/39890442472)
- [Origineel beoordelingsartifact](https://github.com/E-AI-MODEL/eainesy/actions/runs/39890442472/artifacts/12474173674)
- Artifact ZIP SHA-256: `0297b584583d209834ea99ce98091ef68c47f5c2418e0d7d74aa237fdb527229`
- `independent-review-packet.json` SHA-256: `916e1467eb790d980522db54d45adeb558434819cbd46e2e672d1e968979057f`
- Model `gpt-5-mini`; 3.016 inputtokens, 916 outputtokens; geen gemeten eurokosten.
- Deze inspectie is **niet** een onafhankelijke beoordelaar, ook niet als zij naast het lege 'independentReview'-veld wordt gelegd.
