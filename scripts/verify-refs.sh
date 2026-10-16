#!/bin/bash
# Verify scientific/technical references for the EAInesy "Bronnen" section.
# Each query saves top results to JSON; a node pass prints name|url lines.
set -u
OUT=/home/z/my-project/scripts/ref-results
mkdir -p "$OUT"

declare -A QUERIES=(
  [garcez]="Neurosymbolic AI The 3rd Wave Garcez Lamb Artificial Intelligence Review 2023"
  [angelopoulos]="A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification Angelopoulos Bates arXiv"
  [nemo]="NeMo Guardrails controllable safe LLM applications programmable rails arXiv Rebedea"
  [stade]="Large language models could change the future of behavioral healthcare Stade npj Mental Health Research"
  [cssrs]="Columbia Suicide Severity Rating Scale Posner 2011 American Journal of Psychiatry validity internal consistency"
  [richtlijn]="Multidisciplinaire richtlijn diagnostiek behandeling suïcidaal gedrag Trimbos"
  [bower]="Bower Gilbody stepped care psychological therapies access effectiveness efficiency British Journal of Psychiatry"
  [kautz]="Kautz Third AI Summer AAAI Engelmore lecture"
  [woebot]="Fitzpatrick Darcy Vierhile Woebot randomized controlled trial JMIR Mental Health 2017"
  [constai]="Constitutional AI Harmlessness from AI Feedback Bai arXiv 2212"
  [z3]="Z3 An Efficient SMT Solver de Moura Bjorner TACAS 2008"
  [zou]="Universal and Transferable Adversarial Attacks on Aligned Language Models arXiv Zou"
)

for key in "${!QUERIES[@]}"; do
  q="${QUERIES[$key]}"
  z-ai function -n web_search -a "{\"query\": \"$q\", \"num\": 4}" -o "$OUT/$key.json" 2>/dev/null
done

node -e '
const fs = require("fs");
const dir = "/home/z/my-project/scripts/ref-results";
for (const f of fs.readdirSync(dir).sort()) {
  try {
    const data = JSON.parse(fs.readFileSync(dir + "/" + f, "utf8"));
    const items = Array.isArray(data) ? data : (data.results || []);
    console.log("=== " + f.replace(".json", ""));
    for (const it of items.slice(0, 3)) {
      console.log("  - " + (it.name || "").slice(0, 110));
      console.log("    " + (it.url || ""));
    }
  } catch (e) { console.log("=== " + f + " PARSE-FAIL"); }
}
'
