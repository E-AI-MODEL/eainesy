# NeSy P02 — echte GPT-5-proef P0/S1/S2 met begrensde samenwerking

**Datum geregistreerd vóór de eerste live-run:** 23 oktober 2026  
**Protocol:** `EAINESY-S1S2-P02-GPT5-2026-10-23`  
**Basis:** S1/S2-engineering op `main` na PR #30. Dit is een **nieuwe, exploratieve** proef. Verander de bestaande A/B/C-registratie niet achteraf.

## Onderzoeksvraag

Kan één gericht neuraal heronderzoek bij een symbolisch relevant verklaarde onduidelijkheid de volgende gespreksstap verbeteren ten opzichte van S1 zonder een model-call, zonder onnodig doorvragen en zonder inbreuk op bestaande NeSy-veiligheid?

## Identieke vergelijking

- **Tien nieuwe fictieve contexten**, bevroren vóór de modelrun in `research/nesy-cooperative/s1s2-real-p02-corpus.json`. De ontwerper schreef de taken en C2-hypotheses; het zijn géén onafhankelijke interpretatielabels.
- **P0** gebruikt de echte bestaande NeSy `/api/chat`-keten, een voor elke case geïsoleerde tijdelijke database, een GPT-5-parser/generator, de bestaande controller, geïsoleerde Node/Z3 en outputpolicy. Scripted history is niet door Z3 gecertificeerd; de **huidige P0-beurt** wel. P0 wordt niet veranderd.
- **S1** en **S2** krijgen exact dezelfde geëxtraheerde P0-snapshot, auteursannotaties en C2-kandidaten, en maken geen echte gebruikerswijziging. S1 controleert of een onzekerheid volgens zijn vaste logica taakblokkerend is. S2 krijgt uitsluitend dan één gerichte GPT-5-herbeoordeling met broncontrole.
- Alleen na geldige P0-veiligheidsgegevens worden **sandbox-antwoorden** gegenereerd op de research-voorstellen. Hetzelfde GPT-5-model, identieke instructies en identieke context; alleen de voorgestelde `nextMove` verschilt. Als S1 en S2 hetzelfde voorstellen, gebruiken ze exact dezelfde gegenereerde tekst. Hun onderzoeksantwoorden zijn **niet door de productie-outputpolicy gecertificeerd** en worden nooit aan de gebruiker geleverd.
- Het echte, wél door P0 gecontroleerde antwoord blijft afzonderlijk in het analytische artifact zichtbaar. Het is **niet onder precies dezelfde onderzoeksprompt** gemaakt en mag daarom niet als gelijke third-arm antwoordkwaliteitsscore worden gebruikt.

## Prospectief scoringsplan

**Primair, door mensen blind te beoordelen:** is het antwoord passend bij de expliciete vraag en het eerdere gesprek? Beoordeel twee antwoordvarianten met gerandomiseerde A/B-labels, zonder te weten wat S1 of S2 is. Noteer afzonderlijk:
1. opvolging van het werkelijke gebruikersverzoek, en of de gevraagde taak direct is afgehandeld;
2. onnodig verduidelijken of een noodzakelijke verduidelijking missen;
3. juiste toeschrijving van personen/tijd, geen verzonnen informatie;
4. omgaan met ontkenning, eerder gecorrigeerde aanname, gespreksafsluiting en geciteerde instructies.

**Secundair:** netto extra echte S2-calls, daadwerkelijk gebruikte input- en outputtokens, model-/transportfouten en verschillen in voorgestelde vervolgstap. Log technische acceptatie van P0/Z3 afzonderlijk van inhoudelijke kwaliteit.

**Exploratieve machine-inspectie:** een GPT-5-beoordelaar krijgt per case alleen de anonieme antwoorden A/B, zonder armtoewijzing, en scoort per dimensie. Dit is **niet onafhankelijk**: kandidaat en beoordelaar behoren tot dezelfde modelfamilie. Die scores zijn hoogstens een voorlopig onderzoekssignaal. Er vindt in deze run **geen onafhankelijke menselijke blindreview** plaats; het beoordelingspakket blijft OPEN totdat echte onafhankelijke beoordelaars het invullen.

**Geen achteraf gekozen winstcriterium:** deze tien zichtbare auteursscenario's, de labels en de automatische beoordelaar rechtvaardigen geen statistische significantie, geen claim over klinische gesprekskwaliteit en geen automatische keuze voor S2. Een positief signaal leidt alleen tot ontwerp van een externe, geblindeerde toets. Een negatief of nulresultaat blijft zichtbaar.

## Stopcondities en financiële grens

- Uitsluitend nieuwe, fictieve en niet-medische gesprekken; geen echte leerling- of patiëntgegevens.
- Eén vooraf goedgekeurde GitHub Actions-run via het GitHub Environment **`nesy`** en het **bestaande** secret **`nesy`**. De sleutel wordt niet aangepast, niet in code geschreven en niet aan de Next.js-kindprocessen of rapporten doorgegeven.
- Hard maximaal **64 externe GPT-5-aanroepen**, inclusief echte P0-beurten, S2, researchantwoorden en optionele automatische beoordeling; per fase aanvullende lagere limieten. Geen extra toolcalls, streaming, URL-redirects of client-side retries; OpenAI `store:false`.
- Modellimiet per request: maximaal 1.600 gegenereerde tokens voor P0; 900 voor heronderzoek; 1.100 voor researchantwoorden en 1.400 voor de modelbeoordelaar. Het programma registreert echte tokenaantallen, niet het exacte geldbedrag.
- Als P0/Z3 niet slaagt, wordt S1/S2 niet toegepast; ontbrekende resultaten, model-fouten en beperkingen worden expliciet gerapporteerd. Niet aanpassen of herstellen door de corpusinhoud te herschrijven na de modeluitkomst.
- Deze specifieke push-trigger wordt direct na de poging verwijderd. Latere betaalde proeven vereisen afzonderlijke handmatige autorisatie; bestaande workflows voor eerdere onderzoeken blijven ongewijzigd.
- Uitsluitend de geïsoleerde `research/nesy-cooperative`-modules. Geen productiecode, sessies, regelmotor of Z3-policy gewijzigd.

## Gekoppelde, controleerbare output

De nieuwe workflow bewaart een samenvatting met bron- en commit-SHA, fasespecifieke token-/call-metadata, de échte huidige P0-controle en het aantal S1/S2-verschillen. Het blinded artifact bevat alleen fictieve gesprekken en anonieme A/B-antwoorden met lege beoordelingsvelden. Een **afzonderlijk** mappingbestand onthult achteraf welke arm A of B was; niet aan beoordelaars geven vóór beoordeling. De voorlopige modelrating staat apart en krijgt de aanduiding **same-model, not independent**.

De S1/S2-antwoorden tellen niet mee als 'productie-output is goedgekeurd'. De NeSy-architectuur mag niet automatisch veranderen als de CI groen wordt.

## Analysegrens

Modelcalls, geslaagde JSON, SAT, broncitaten en vloeiende antwoorden zijn elk eigen waarnemingen. Geen daarvan bewijst op zichzelf dat de samenwerking tot betere gespreksregie leidt. Een menselijke reviewer moet het inhoudelijke werk beoordelen zonder de onderzoekstoewijzing te zien.

Reproduceerbaar zonder betaalde calls:

`node scripts/nesy-s1s2-real-p02-e2e.mjs --check-cases`

`node --test research/nesy-cooperative/*.test.mjs`

Betaalde poging is éénmalig aan GitHub Actions gekoppeld en later alleen opnieuw via expliciete autorisatie.
