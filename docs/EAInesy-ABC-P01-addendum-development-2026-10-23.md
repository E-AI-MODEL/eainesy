# P01 addendum: verkennende bouw vóór onafhankelijke DATA-LOCK

**Datum:** 23 oktober 2026  
**Protocol:** EAINESY-ABC-2026-10-23-P01  
**Status:** prospectief ontwikkel-addendum, voorafgaand aan A/B/C-code of -metingen.

De P01-protocoltekst vraagt een DATA-LOCK vóór kandidaatbouw. De gebruiker heeft nu expliciet gevraagd om de architectuuronderdelen alvast te bouwen. Om geen schijn van een volledig prospectief experiment te wekken, leggen we de afwijking vooraf vast:

1. De researchbranch mag **uitsluitend op de 24 reeds openbare DEV-casussen** en nieuw expliciet als DEV gemarkeerde fictieve unitgevallen worden gebruikt voor de technische implementatie en ontwikkeltests van P0/A/B/C. Al deze resultaten zijn *exploratoir*, tellen **niet** als bewijs voor een architectuurwinnaar.
2. De 300 nieuwe, onafhankelijke confirmatoire casussen worden **niet** tijdens deze ontwikkelronde door kandidaatbouwers geschreven, bekeken of geoptimaliseerd. Een onafhankelijke auteur/beheerder moet ze na de codefreeze en vóór éénmalige vergelijkingsrun maken, labelen, exact hashen en afschermen. De hoofdvragen, aantallen, rubrics, veiligheidsdrempels en beslisregels in P01 blijven ongewijzigd.
3. Omdat dit de oorspronkelijke tijdsvolgorde uit P01 wijzigt, wordt de latere toets alleen als *prospectieve confirmatoire hold-out-evaluatie volgens P01 + dit addendum* beschreven, **niet** als 'volledig gepregistreerd vóór implementatie'. Voor een strikt voor-implementatie bevestigende toets is een nieuwe onderzoeksronde vereist. Maak dit verschil expliciet in alle rapporten.
4. Productiekern, main en PR #5 blijven ongewijzigd. Nieuwe architecturen worden in zelfstandige researchmodules met opt-in testharnas gebouwd, zonder automatische externe modelcalls, geen telefoontjes, geen contact met hulpdiensten, geen menselijke deelnemers en geen release.
5. Tijdens de ontwikkeling mogen uitsluitend de **gedeelde interfaces**, het **veiligheidsbehoud**, de **functionaliteit** en **diagnostiek** worden gedebugd. Het P01-scoreboek of de selectiecriteria worden niet met terugwerkende kracht gewijzigd. Ieder nieuw wijzigingsverzoek krijgt een volgend, gedateerd addendum.
6. Maak onderscheid tussen *architectuur gebouwd*, *synthetisch/offline getest*, *end-to-end live model geëvalueerd*, *menselijk blind beoordeeld* en *veiligheid voor echte gebruikers*. Alleen de eerste twee zijn het huidige werkdoel.

**Geen statusclaim van DATA-LOCK of evaluatieresultaat.**