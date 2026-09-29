# CLI schema and QA assertion migration

The batch covers `qa-command.test.ts`, `yeet-reply-schemas.test.ts` and
`yeet-verdict-json.test.ts`. Fourteen assertions move to canonical assertion
helpers with the same predicates, Option subjects and expected values. Three
explicit `assertDefined` witnesses retain the original optional-index subjects
while narrowing them for the typed Option helpers. Existing whole-object
round-trip assertions and the QA elapsed-time bound remain intact. Test
registration uses the instrumented runner.

All 48 before-change file/title registrations remain and pass on both runtimes,
with no failures or skipped tests. Source hashes were stable during each run.
The intervening main merge did not change these three files; before applying
the draft, their hashes were verified against the preparation receipt.

| Runtime | Before seconds | After seconds | Tests before / after |
| --- | ---: | ---: | ---: |
| Node | 10.5336 | 10.6322 | 48 / 48 |
| Bun | 6.5793 | 5.0732 | 48 / 48 |

These are whole-command observations under recorded workstation load, not a
causal performance claim. Context receipts retain runtime versions, CPU/memory/IO
pressure, load averages and resource limits. No numerical load correction is
applied. The earlier full Yeet proof ran concurrently with some measurements.

The ratchet passes with zero introduced findings and 345 resolved historical
findings. Full CLI package verification passed: audit 772.7 seconds and docgen 27.5
seconds. These package results do not establish final repository proof or goal
completion.

Private receipts: `cli-schema-assertions-proposal.json`,
`cli-schema-assertions-parity.json`, per-runtime before/after JSON reports and
context receipts, and `cli-schema-assertions-ratchet.log`.
