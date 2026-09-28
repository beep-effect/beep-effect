# Repo-utils PublishConfig generation — 2026-09-26

An additive law now generates from the full public production PublishConfig
schema. It retains the existing Option-wrapped encode/decode and complete
Vitest equality oracle with fcRuns(20). The original core law, concrete bin and
exports cases, all other examples and all fourteen prior laws remain unchanged.
No rejection filters, narrower replacement schema or production edits were used.
The obsolete comment claiming no finite recursive generation path is corrected.

A token-preservation receipt restores the original source after removing the
three additive nodes (import, arbitrary binding, registration). Full package
verification exited 0: audit 8.7 seconds and docgen 5.8 seconds. Configured
Node/Vitest CI400 seed 20260708 proof exited 0 in 4.180778848996852 seconds,
with exactly fifteen expected laws passed, zero failed/missing/unexpected and
82 nonselected cases. The configured full package now has 232 cases.

The preceding production-generator diagnostic exercised bin strings/records,
null/string/array/record exports and JSON extra keys; its counts and exact
runtime/reference provenance are in `research/repo-utils-publishconfig-generation.json`.
No production counterexample occurred. Flake controls and observability follow.
