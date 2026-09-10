# P0d verification: pinned primitives graph

P0d is complete. P0e may start. The initiative remains active; no audit,
migration, publication, ratification or merge gate is implied by this phase receipt.

## Delivered contract

The graph contains 85 entries: 75 independently extracted export, namespace,
member, option, utility and README units, plus ten charter declarations.
Its header pins @effect/vitest 4.0.0-rc.112 to tag
@effect/vitest@4.0.0-rc.112 and commit
2600f62f4532026928454dcea8d1c48557b3f942. Portable source fixtures preserve the
exact upstream bytes and license; TypeScript snapshots are text data so package
lint cannot rewrite their provenance. The export-star boundary and inherited
members are represented explicitly without inventing upstream declarations.

The graph decodes through the existing S.Class entry and complete document
schemas. Tests independently derive anchors from source, compile every example,
exercise synchronous FastCheck and effect Schema properties, reject malformed
or incomplete graph data, and prove the installed-version mismatch procedure.
Hints derive from graph replacement edges, including the EV005 Exit migration
and all six EV006 Option/Result/Exit alternatives. The focused primitives
suite passes ten tests.

Semantic review closed property floors, the case-only each callback, shared
TestClock and nested memo-map semantics, live-mode requirements, installed
TestClock preconditions, flaky-test guidance and empty-replacement reasons.
Final graph SHA-256:
1c0a2958bf5a163c032ac62f4f5f2469130690ad140ed5d7fddea88e03aa60c0.

## Authoritative package proof

The exact command ran under command-scoped Bun 1.4.1; Node was v24.20.0.

~~~bash
bun run beep quality package-verify @beep/repo-cli
~~~

Final result: exit 0 in 430.115 seconds, audit 409.9 seconds and docgen
18.5 seconds. All 29 captured source/graph/fixture hashes stayed stable during
verification and after the final scanner commands. The canonical sorted source
hash map has SHA-256:
006996085d2b0b946e806092df076369267268ac834351502e7c409b8484b810.

The first full run failed on nine introduced cwd-dependent graph test reads;
3,198 other tests passed and docgen passed. The two affected files now derive
repository, package and fixture paths from their module URLs. The same 19
focused tests pass from both repository root and package directory; Biome and
the direct Effect compiler pass. The final full command above proves the repair.
The original failed receipt is retained, not relabeled as environment-only.

## Final exact command and artifact proof

~~~bash
bun run beep lint effect-vitest --census --write --rows goals/effect-vitest-canon/ops/inventory/detector
bun run beep lint effect-vitest --census --write --rows goals/effect-vitest-canon/ops/inventory/detector
bun run beep lint effect-vitest
~~~

| Command | Exit | Full process wall | Scan |
| --- | ---: | ---: | ---: |
| Writer 1 | 0 | 8.368 s | 6584.8 ms |
| Writer 2 | 0 | 7.890 s | 6120.9 ms |
| Default ratchet | 0 | 7.607 s | 5736.6 ms |

All 123 generated artifact hashes match across the three commands.
Default ratchet: introduced 0, resolved 0. Earlier slower measurements remain
in the lane evidence; host load alone was not treated as causal proof.

Final census: 1,073 unique paths, comprising 968 tests and 105 support modules,
across 139 owners. Every recorded byte count, physical line count, kind and
registered workspace owner matches an independent check. All 1,072 P0c paths
remain. The sole new path is effect-vitest-primitives.test.ts. Literal D9
generated declarations remain included.

The 121 JSONL files contain exactly the same 5,013 unique rows as the baseline.
Schema-decoded canonical finding keys retain all 5,012 P0c findings without
evidence, severity, classification or other semantic changes. Their guidance
now comes from the graph. The new test adds one EV010 platform-filesystem
judgment row. One existing contract-test import moves from line 15 to 17;
its canonical identity is unchanged. No mechanical finding was added.

## Recovery and receipt chain

The orchestrator inverted an unauthorized detector import-prefilter patch and
verified the restored detector against its completed P0c source SHA. Detector
and Syntax algorithms remained frozen through final proof. The independent
artifact audit initially mistook nested fixture manifests for workspace owners;
the corrected audit derives owners from the root workspace declarations.
Neither recovery changed production behavior or weakened acceptance.

Private reproducible evidence under ~/.cache/beep/effect-vitest-canon:

- p0d-pinned-source-receipt.json, p0d-independent-source-inventory.json,
  p0d-charter-source-proof.json and p0d-independent-example-proof.json.
- p0d-detector-restoration.json and the preserved lane reports/raw output.
- p0d-package-verify-status.json/log: first full run and concrete cwd failure.
- p0d-package-verify-cwd-status.json/log: final successful full proof.
- p0d-final-command-proof.json and its three exact command logs.
- p0d-final-membership-delta.json: actual schema-decoded canonical keys.
- p0d-final-artifact-audit.json: final census and row parity.
- The first artifact audit receipt is retained separately for attribution.

The authored lane report is history/lanes/p0d-primitives.md. Review and friction
are recorded in history/p0d-working-review.md and research/OPPORTUNITIES.md.
