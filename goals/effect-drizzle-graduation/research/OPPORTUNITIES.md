# Friction Ledger — effect-drizzle-graduation

Receipts recorded at the moment of friction (repo law). Format: what was being
done, the evidence, what would have prevented it.

## 2026-08-10 — `goals index --write` bakes invalid-manifest rows silently

- **Doing:** authoring this packet's P0; ran `bun run beep goals index --write`
  while `ops/manifest.json` still carried `"status": "active"` (not a legal
  `GoalPhaseStatus`), then fixed the manifest.
- **Evidence:** the committed `goals/INDEX.md` kept the baked row
  "`effect-drizzle-graduation` — manifest missing or does not decode" even
  after the manifest was fixed and `goals doctor` went green; two independent
  review lenses (R3-01, R4-01) flagged the stale index because
  `goals index --check` exits 1 while `doctor` exits 0.
- **Prevented by:** `goals index --write` refusing (or loudly warning) when a
  manifest fails to decode instead of rendering an error row into the
  generated artifact; or `goals doctor` including an index-freshness check so
  one gate covers both. Also authoring order: fix the manifest to
  doctor-green BEFORE regenerating the index.

## 2026-08-10 — template phase-status vocabulary is not in the template

- **Doing:** filling `ops/manifest.json` from `goals/_template`; wrote
  `"status": "active"` for the current phase by analogy with the
  `lifecycle`/`initiative.status` fields, which DO accept `active`.
- **Evidence:** `goals doctor` failed with "Expected
  @beep/repo-cli/commands/Goals/Goals.schemas/GoalPhaseStatus at
  [\"phases\"][0][\"status\"]"; the legal literals
  (`pending|in-progress|complete|superseded`) appear nowhere in the template,
  whose example phases are all `pending`.
- **Prevented by:** a comment row in the template manifest naming the
  `GoalPhaseStatus` domain, or the doctor error printing the allowed literals
  alongside the schema path.
