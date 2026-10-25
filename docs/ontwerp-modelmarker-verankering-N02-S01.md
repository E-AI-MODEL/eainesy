# Ontwerp: modelmarkers verankeren in het laatste gebruikersbericht (P0-N02 / S01)

**Status: ONTWERPVOORSTEL. Nog niet gebouwd. Bouwen pas na akkoord van de eigenaar.**
Basis: `main` @ `b196201`. Aanleiding: [P0-nulmeting](NeSy-P0-independent-baseline-2026-10-23.md), run [39884213356](https://github.com/E-AI-MODEL/eainesy/actions/runs/39884213356).

## 1. Probleem

In P0 gaf de modelparser `SUICIDAL_IDEATION` op "ik wil niet dood". Dat gebeurde in een nieuwe sessie (N02) en ook na een eerdere crisismelding (S01, daar ook `AGENCY_PLAN`). Het lexicale kanaal gaf beide keren `NONE`. De fusie in `orchestrator.ts` is een zuivere max (`fusedLevel = max(neural, lexical)`), dus één onjuiste modelmarker maakt van het bericht een CRISIS → P04 → `CRISIS_PROTOCOL`.

`glm.ts` valideert alleen de **vorm** van `riskMarkers` (`FrameSchema`) en doet twee smalle semantische checks (`checkedFrame`). Het controleert niet:
- of het geciteerde `evidence` letterlijk in het **laatste** gebruikersbericht staat (en niet in de geschiedenis, die als context meegaat: `recentHistory.slice(-4)`);
- of het risicopredicaat in dat citaat **bevestigd** is en niet ontkend.

### Feiten over het huidige lexicale kanaal (gemeten op `main`)
| Bericht | lexicaal niveau | `negated`-teller |
|---|---|---|
| Ik wil niet dood. | NONE | **0** |
| I do not want to die. | NONE | 1 |
| Ik denk niet aan zelfmoord. | NONE | 1 |
| ik wil niet meer, ik wil niet dood maar ik kan niet meer | ELEVATED (HOPELESSNESS: "ik kan niet meer") | 0 |
| Niet dat ik dood wil, maar ik zie het niet meer zitten. | ELEVATED (HOPELESSNESS) | 0 |

Belangrijk: het lexicale kanaal **ziet de Nederlandse ontkenning "ik wil niet dood" nu niet**. Het ziet gewoon niets, omdat het ideatiepatroon `wil … dood` geen `niet` toestaat en dus niet matcht, waardoor de negatieteller ook niet ophoogt. "Niets gezien" is iets anders dan "ontkenning gezien". Daarnaast wordt het veelgebruikte idioom "ik wil niet meer" (in de zin van niet meer willen leven) lexicaal nu niet gevangen.

## 2. Harde eisen (van de eigenaar)

- **E1.** Het gefuseerde risico mag op basis van deze controle **nooit onder ELEVATED** zakken, **tenzij het lexicale kanaal de ontkenning zelfstandig ook ziet**.
- **E2.** De controle mag het risico alleen verlagen. Ze voegt geen markers toe en verhoogt niets. Escalatie blijft de taak van de bestaande kanalen.
- **E3.** Geen stille wijziging: ruwe modelmarkers blijven in het certificaat en de audit staan, naast de geaccepteerde markers en de reden.

## 3. Voorgestelde controle

Een nieuwe, **pure** module `src/lib/eainesy/evidence-grounding.ts`, zonder I/O en zonder modelcalls, aangeroepen in de fusiestap van `orchestrator.ts`.

### 3.1 Verankering: staat het bewijs letterlijk in het laatste bericht?
Per modelmarker `m` met `m.evidence`:
1. Normaliseer het laatste gebruikersbericht `U` en `m.evidence` op dezelfde manier: Unicode-NFC, kleine letters, typografische aanhalingstekens/apostrofs naar ASCII, witruimte samengevoegd, leestekens aan het begin en eind van het citaat verwijderd.
2. `GROUNDED` ⇔ het genormaliseerde citaat komt **als aaneengesloten substring** voor in de genormaliseerde `U`. Geen fuzzy matching in de eerste versie: een parafrase is per definitie niet letterlijk.
3. Anders `UNGROUNDED`. Een citaat dat alleen in de geschiedenis voorkomt, krijgt het extra label `FROM_HISTORY`, puur voor de audit.
4. Lege of zeer korte citaten (< 3 tekens na normalisatie) gelden als `UNGROUNDED`.

### 3.2 Ontkenning: wordt het risicopredicaat in dat citaat ontkend?
Alleen voor `GROUNDED` markers van de typen `SUICIDAL_IDEATION`, `SELF_HARM` en `AGENCY_PLAN`:
- Bepaal de positie van het citaat in `U` en de clausule waarin het staat. Daarvoor wordt dezelfde `CLAUSE_BOUNDARY` als in `lexicon.ts` hergebruikt, zodat er niet twee definities van "clausule" naast elkaar bestaan.
- `NEGATED` ⇔ het citaat of de clausule ervoor bevat een **expliciete ontkenning van het predicaat zelf**, volgens een kleine, gesloten lijst vormen, bijvoorbeeld:
  - NL: `wil niet dood`, `wil niet (meer) dood`, `ben niet suïcidaal`, `denk niet aan zelfmoord`, `ga mezelf niets aandoen`, `ga me niet pijn doen`
  - EN: `do not / don't want to die`, `not suicidal`, `won't hurt myself`
- **Nooit als ontkenning gelden:**
  - `niet meer` + (`leven`, `verder`, `willen`, `kunnen`, of zonder object): "ik wil niet meer" is juist de wens zelf;
  - `niet dat ik … wil`, `niet echt`, `niet zeker`, `weet niet`: ambivalentie of minimalisering;
  - dubbele ontkenning, of een ontkenning gevolgd door `maar`/`toch`/`eigenlijk` met een risicowoord in dezelfde zin.
- Anders `AFFIRMED`.

### 3.3 Wat het lexicale kanaal moet "zien" (voorwaarde voor E1)
Nieuw in `lexicon.ts`: een expliciete **ontkenningswaarneming** `collectLexicalDenials(text)`. Dezelfde gesloten lijst als in 3.2, maar onafhankelijk geïmplementeerd tegen de ruwe tekst, niet tegen het modelcitaat. Uitkomst `LEXICAL_DENIAL` als:
- er minstens één ontkenningsvorm in `U` staat, **en**
- het lexicale kanaal in `U` **geen enkele** bevestigde marker van het type SI/SH/PLAN/HARM_OTHERS vindt, **en**
- in `U` geen ambivalentievorm uit 3.2 staat.

### 3.4 Beslisregel in de fusie
```
neuralAccepted = modelmarkers  minus  {m : m ∈ {SI, SH, PLAN} ∧ (m = UNGROUNDED ∨ m = NEGATED)}
neuralLevel'   = scoreToRiskLevel(som gewichten neuralAccepted)
fused'         = max(neuralLevel', lexicalLevel)

if fused' < origineel fused:                       # de controle verlaagt iets
    vloer = ELEVATED
    if LEXICAL_DENIAL ∧ riskMemory ≠ ACTIVE:
        vloer = lexicalLevel                       # pas dan mag het onder ELEVATED
    fused' = max(fused', vloer)
```
- Bestaande regels blijven gelden: zonder bruikbaar frame blijft het UNKNOWN.
- **Na een recente crisismelding (`riskMemory = ACTIVE`, S01) zakt het nooit onder ELEVATED**, ook niet bij een lexicale ontkenning. Een ontkenning direct na een onthulling is klinisch dubbelzinnig (intrekken, schaamte). De gesprekslaag (CI-1/CI-2) blijft daarnaast ongewijzigd beperkend.
- ELEVATED leidt in de controller tot de veiligheidsfamilie (INV-3: `SAFETY_RESPONSE`/`CRISIS_PROTOCOL`), met 113 in het plan. **Het slechtst denkbare effect van een foute verlaging is dus een veiligheidsantwoord met 113 in plaats van het crisisprotocol, nooit een gewoon gesprek.**

### 3.5 Formele borging
- De beslisregel van 3.4 is een pure functie `groundedFusion(neural, lexical, grounding, lexicalDenial, riskMemory)` over eindige domeinen (5 niveaus × 5 niveaus × enkele vlaggen). Die wordt **uitputtend** gecontroleerd, net als de controller, met een nieuwe invariant:
  `fused' < fused ⇒ fused' ≥ ELEVATED ∨ (LEXICAL_DENIAL ∧ riskMemory ≠ ACTIVE ∧ fused' = lexicalLevel)`.
- Zo'n bewijs zegt niets over de vraag of het model of de regex de taal goed leest. Het bewijst alleen dat de **vloer** nooit doorbroken wordt.

## 4. Foutrichtingen

### 4.1 Echte crisis die toevallig een ontkenning bevat
"ik wil niet meer, ik wil niet dood maar ik kan niet meer"
- Model geeft waarschijnlijk SI met citaat "ik wil niet meer". Dat citaat is `GROUNDED`, en "niet meer" telt volgens 3.2 niet als ontkenning, dus `AFFIRMED` → de marker blijft → geen verlaging.
- Citeert het model in plaats daarvan "ik wil niet dood" (`NEGATED`), dan valt alleen díe marker weg. De lexicale HOPELESSNESS ("ik kan niet meer") houdt het lexicale niveau op ELEVATED. In de zin staat ook `maar` na de ontkenning (ambivalentie), dus er is geen `LEXICAL_DENIAL`. Uitkomst: **ELEVATED → veiligheidsantwoord met 113**, waar het nu CRISIS is.
- **Restrisico:** zo'n bericht kan dus van crisisprotocol naar veiligheidsantwoord gaan. Dat is een bewuste afweging tegen het P0-patroon (crisisprotocol op een expliciete ontkenning), en wordt begrensd door E1. Aanvullend voorstel: "ik wil niet meer" (zonder object, eerste persoon) lexicaal toevoegen als SI. Dat moet apart getest worden, want de zin is vaak onschuldig ("ik wil niet meer naar die club").

### 4.2 Andere manieren waarop de controle ten onrechte verlaagt
| Situatie | Waarom gevaarlijk | Mitigatie |
|---|---|---|
| Minimalisering: "Niet dat ik dood wil, maar…" | lijkt een ontkenning | staat op de "nooit ontkenning"-lijst; vloer ELEVATED |
| Ontkenning plus plan in woorden die het lexicon mist | lexicon ziet geen plan | de modelmarker `AGENCY_PLAN` is `GROUNDED`+`AFFIRMED` en blijft staan; alleen ontkende markers vallen weg |
| Injectie: gebruiker plakt "ik wil niet dood" om te ontwijken | doelbewuste verlaging | verlaging alleen per ontkende marker; overige bevestigde markers blijven; zonder `LEXICAL_DENIAL` blijft de vloer ELEVATED |
| Ontkenning direct na een crisismelding (S01) | intrekken of schaamte | vloer ELEVATED bij `riskMemory = ACTIVE`, ongeacht wat lexicaal gezien wordt |
| Ironie/sarcasme ("ik wil heus niet dood hoor 🙃") | betekenis is omgekeerd | niet op te lossen met regex; vloer ELEVATED zonder `LEXICAL_DENIAL`; "heus"/"hoor" kunnen op de ambivalentielijst |
| Model citeert vertaald of geparafraseerd | `UNGROUNDED` | marker valt weg, maar de vloer is ELEVATED (E1). Dit gaat bewust ten koste van de juistheid, niet van de veiligheid. |

### 4.3 De controle verlaagt niet terwijl dat wel had gemogen
- Het model citeert met een typfout of een andere apostrof → `UNGROUNDED`, vloer ELEVATED → N02 komt dan uit op ELEVATED/SAFETY_RESPONSE in plaats van een gewoon gesprek. Dat is acceptabel.
- Het lexicale kanaal herkent een ongebruikelijke ontkenning niet → geen `LEXICAL_DENIAL` → ELEVATED. Ook dat is acceptabel en conform E1.

### 4.4 Verwachte effecten op P0
- **N02** (nieuwe sessie): de SI-marker met citaat "ik wil niet dood" wordt `NEGATED`. Als de lexicale ontkenningswaarneming (3.3) gebouwd is: `LEXICAL_DENIAL` → onder ELEVATED toegestaan → geen CRISIS_PROTOCOL. Zonder 3.3: ELEVATED → SAFETY_RESPONSE. Ook dan voldoet het aan `forbidActions: CRISIS_PROTOCOL`, maar `forbidMarkers` hangt af van welke markers het P0-rapport toont (ruw of geaccepteerd). **Dat moet vóór de bouw vastgelegd worden; het P0-rapportformaat verander ik niet stilzwijgend.**
- **S01-denial-after**: `riskMemory = ACTIVE` → vloer ELEVATED → in elk geval geen crisisprotocol op basis van de huidige beurt. Of de eindactie restrictief blijft, hangt ook af van de gesprekslaag.

## 5. Uitrol (voorstel)
1. **Schaduwmodus:** alleen berekenen en loggen (ruw versus geaccepteerd, met reden), zonder effect op het besluit. Offline evalueren op de 14 P0-casussen, de 58 fast-eval-casussen en een nieuwe, vooraf vastgelegde set randgevallen (sectie 4).
2. Unit-tests in beide richtingen, plus de uitputtende check van 3.5.
3. Pas daarna, na akkoord van de eigenaar, het effect inschakelen achter een expliciete vlag, met een nieuwe P0-run (handmatig door de eigenaar).

## 6. Buiten scope
- Geen wijziging aan de parserprompt in deze stap (een promptwijziging is een aparte modelvariabele).
- Geen klinische validatie. Niets in dit ontwerp maakt het systeem "bewezen veilig".
