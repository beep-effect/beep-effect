# PR 1750 ruleset reconciliation — 2026-10-14

At ba6b80a7d071004f48590e7afb7f3d72fd22db4f, the worker's full serial cheap
tier passed with exact request.head binding. Job
cfe0be2f-d624-4528-96e2-cdb79bee40d7 completed normally in 585,136 ms, exit zero,
with systemd invocation 92cfd396d6fb4d75bf9108dd20f069a2. Cache reuse was allowed.
The private worker archive is ~/.cache/beep/readiness/pr1750/proof-ba6b80a7d0.tar.gz,
SHA-256 7cbdbe6efe6284e76aa556a0221c20339c90da78e5e278fcc88d1f5d49501b73.
This is proof for that source head, not subsequent commits.

Hosted Security job 116076066579 failed its live ruleset check: the external
beep-reviewer GitHub App check was required by ruleset 10240248 but absent from
the repository's expected context names. Keep the live protection intact and
declare the external context explicitly alongside every required workflow lane.
Regression coverage accepts a reordered complete set and rejects a missing
reviewer, a missing Security lane, and an unexpected additional context.
The validator checks names; GitHub retains the existing App integration binding.

Merged origin/main at 061d5a40e425b7c03702a8ca03c4459e31166815, merge commit
13175d5c63e81049e994ca927929099f79c0112f. Main retired Knip in favor of its
transferred Fallow findings. The automatic merge retains the readiness branch's
worker-aware cheap-gate concurrency limit and removes the retired Knip lanes.
No code from the unmerged reviewer App PR 1749 was imported.

The frozen dependency install succeeds. The live read-only ruleset check now
reports declared contexts match GitHub. Governance/model/wave regression files
pass 39 tests; proof-job and quality-task files pass 359 tests. Changed TypeScript
files pass Biome. Old generated dependency declarations require rebuilding after
the main merge; this changes ignored build artifacts, not tracked source.

The earlier Check run 38623101300 lost its Coverage and Lint Policy EC2 Spot
instances with instance-terminated-no-capacity. After verifying both instances
were terminated through the existing read-only AWS credential route, canceled
that obsolete run. GitHub force-cancel released its remaining stuck job and the
new run. Runner capacity, budget and Spot configuration were not changed.

The YubiKey SSH notification/sound wrapper fix is tracked separately in
2026-10-14-yubikey-prompt-ergonomics.md. Privilege and authentication remain on
the canonical hardware-key routes. PR 1750 remains a draft; pending hosted
checks, deployment quota failures and actual review must be assessed separately.

## Proof at 2ffbe50223 and documentation correction

Worker job 90362dfc-91db-496a-8aef-ab70abc2385d settled red normally. Its only
failed lane is quality:jsdoc-ratchet:committed: the new validator example used a
legacy @example carrier. All other cheap lanes passed, including fresh import,
schema-first, Fallow audit, dead-code and health checks. Observed memory peak
7,350,169,600 bytes stayed below the existing worker soft limit. This is a
failed overall proof and must not be recorded as green.

Corrected the example to the titled section required by main's binding
.patterns/jsdoc-documentation.md law, with a Details section for the App-binding
explanation. The local JSDoc ratchet then reports zero legacy findings and no
increased totals. Source behavior and test expectations are unchanged.

## Main advancement during proof

Main advanced to d6040249f034a05b2aee014c60230c68a1ad780f while the corrected
documentation head's proof was running. GitHub reports a merge conflict and
does not create new pull-request workflow runs until it is resolved. The
conflict is SchemaFirstScan.ts: main's branded Opaque policy introduced class
shape checks into the scanner whose memory use this branch had bounded.

Resolve by collecting class-reference names across the full source/test corpus
in the existing syntax-only pass, releasing each file as before. The production
semantic pass retains main's new class-shape checks, excludes test roots, and
releases completed syntax wrappers. Retained class candidates are main's schema
fact values, not compiler nodes. LiteralKit assertion checks remain intact;
arbitrary-test findings are collected once. No policy or inventory is waived.

Five schema/governance files pass 111 tests after resolution. A new command-level
regression separately passes: a production class referenced only by an excluded
test's instanceof expression is retained, while an otherwise plain class is
reported. Main's existing class detector unit tests also pass.

## Policy findings at a1bbdb73ef

The merged-head worker job 43df2bd0-19fa-46c5-949c-73ecd0cf1b77 settled red on
schema-first alone. All other cheap lanes pass. The scan completed in 139,598 ms
with observed peak 7,353,901,056 bytes, below the existing soft memory limit.
It reports four real findings: the readiness observation data class lacks a
brand and should be Opaque; two TaggedError classes inherited from main lack
brands. Migrate ProofJobUnitObservation to branded S.Opaque over its unchanged
fields and add brands to MatterLookupUnreadable and TimerStoreUnreadable.
No finding is waived or admitted to the inventory. Eight recovery/application
test files pass 143 tests after these changes.

Hosted JSDoc Ratchet job 116106919292 uses a freshly generated inventory and
reports no-root-package-import 1345 versus baseline 1343. A fresh private local
inventory reproduces those totals. Comparing finding identities against the
committed inventory locates exactly two additions, both inherited from main:
TierGateVerdict's example and MintFetchableHandle's example. Change their
@beep/mcp-kit root imports to the existing exported TierGate and FieldTier
module paths. Preserve the totals baseline and all other policy protections.
The worker's cheap JSDoc gate reads the committed inventory; its success does
not establish a fresh inventory's compliance. Verify the fresh inventory too.

## Canonical main repair and final-head source proof

Main repair e54795648b (#1773) landed the inherited schema/documentation fixes.
Adopted it at merge e701c49214, choosing main's AI metrics options documentation
in the sole overlap. Both checkouts are synchronized and the eight worker
overlays keep their verified hashes. A fresh documentation inventory at e701
passes the strict ratchet with zero increased totals and zero legacy tags.
Hosted Security and JSDoc Ratchet pass too.

Exact-head worker job 059d3e66-7b8e-4d60-8e79-84adb22c3056 passes the complete
serial cheap tier in 604,984 ms and finalizes normally, exit zero, invocation
ebe3b578a4d141018008aad19857810c. The requested base is e54795648b; Fallow's
origin/main also resolves to e54795648b421369d7ac48e3543483fd8c4b6681. Observed
peak 7,351,812,096 bytes remains below the unchanged soft limit. Cache reuse is
allowed. Private archive SHA-256:
c88dfc8ab79f97a3a374f874d44466254dfd4574d0ad55f46a0449c2115d0fcc.
This qualifies e701's source, not a later test correction.

Hosted Heavy Check job 116118772278 then reports one inherited
strictEffectProvide error at AgentMessage.runtime.test.ts:322. The receiving
grant fixture provided Reactivity.layer inside the test generator. Move that
layer into the existing it.layer entry point and remove the nested provision.
All seven runtime boundary tests pass, and the package-owned test typecheck
receipt records exit zero with no diagnostics. No strict diagnostic is disabled
and the grant checks, expiry scenario and native process ownership stay intact.
