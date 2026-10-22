/**
 * Offline-only P01 DEV pilot integrity validation.
 * No model, network, provider, participant, telephone or external service calls.
 * This validates structure and preregistered pilot allocation, NOT semantic quality.
 *
 * Run: node scripts/validate-nesy-abc-pilot.mjs
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const filename = new URL("../research/nesy-abc/dev-pilot-p01.json", import.meta.url);
const bytes = readFileSync(filename);
const document = JSON.parse(bytes.toString("utf8"));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const cases = document.cases ?? [];
const counts = Object.create(null);
const languages = Object.create(null);
const ids = new Set();

check(document.protocol === "EAINESY-ABC-2026-10-23-P01", "unexpected protocol");
check(document.status === "DEV_ONLY_NOT_HOLDOUT", "pilot must never be presented as a holdout");
check(Array.isArray(cases) && cases.length === 24, "expected exactly 24 DEV cases");

for (const item of cases) {
  check(typeof item.id === "string" && /^DEV-[URD]0[1-8]$/.test(item.id), "invalid pilot ID");
  check(!ids.has(item.id), "duplicate ID " + item.id);
  ids.add(item.id);
  counts[item.suite] = (counts[item.suite] ?? 0) + 1;
  languages[item.language] = (languages[item.language] ?? 0) + 1;
  check(["U","R","D"].includes(item.suite), "unexpected suite " + item.suite);
  check(["nl","en","mixed"].includes(item.language), "unexpected language");
  check(item.id?.startsWith("DEV-" + item.suite), "suite and ID disagree");
  check(Array.isArray(item.history) && item.history.length >= 2 && item.history.length % 2 === 0, "bad history length " + item.id);
  for (let i = 0; i < (item.history?.length ?? 0); i++) {
    const turn = item.history[i];
    check(turn.role === (i % 2 ? "assistant" : "user"), "wrong history ordering " + item.id);
    check(typeof turn.content === "string" && turn.content.trim().length > 0, "empty history turn " + item.id);
  }
  check(typeof item.userText === "string" && item.userText.trim().length > 0, "empty current input " + item.id);
  check(typeof item.stratum === "string" && item.stratum.length > 0, "missing stratum " + item.id);
  check(Array.isArray(item.reference?.must) && item.reference.must.length > 0, "missing DEV criteria " + item.id);
  check(Array.isArray(item.reference?.mustNot) && item.reference.mustNot.length > 0, "missing negative criteria " + item.id);
}
for (const suite of ["U","R","D"]) check(counts[suite] === 8, "expected 8 pilot cases in " + suite);
check(languages.nl === 18 && languages.en === 3 && languages.mixed === 3, "language allocation mismatch");
check(ids.size === 24, "IDs missing");

const report = {
  protocol: document.protocol,
  role: "development only; no holdout or live evaluation",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  pilotCases: cases.length,
  suites: counts,
  languages,
  checks: errors.length === 0 ? "PASS" : "FAIL",
  errors
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (errors.length) process.exitCode = 1;
