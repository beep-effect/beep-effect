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

## 2026-08-11 — sandboxed `bun install` needs temp/scripts workarounds

- **Doing:** P1 job AE enrolling the new workspace member from a sandboxed
  agent session (writable repo, read-only `.git` and home caches).
- **Evidence:** plain `bun install` failed with "Unexpected accessing
  temporary directory"; with writable `BUN_TMPDIR`/`BUN_INSTALL` it resolved
  packages but the Lefthook postinstall failed removing the read-only
  `.git/hooks/commit-msg`; `--ignore-scripts` completed the install. npm's
  pack probe likewise needed a writable `npm_config_cache`.
- **Prevented by:** an install path that tolerates read-only `.git`
  (Lefthook sync as a separate opt-in step), or a documented sandbox recipe
  in the agent guides so each session does not rediscover the overrides.

## 2026-08-11 — tstyche 7.2.2 cannot target TypeScript 7

- **Doing:** building the member tstyche lane with the multi-TS peer matrix
  (SPEC constraint 8) aiming at 5.9 / 6.0 / 7.0 targets.
- **Evidence:** `Error: The TypeScript version '7.0.2' is not supported.`;
  `tstyche --list` caps stable targets at 6.0.3 (7.0.1 only as `rc`). The
  lane pins `5.9.3 || 6.0.3`; TS 7 coverage comes from the repo's native
  compiler compiling `tsconfig.test.json` clean (exit 0), which is compile
  proof, not a tstyche assertion run.
- **Prevented by:** nothing local — upstream tstyche target support. Track
  its releases and widen the target matrix when a stable 7.x target lands.

## 2026-08-11 — `bunx --bun vitest` shadows `node` for child processes

- **Doing:** running the moved SQLite live suite; drizzle-kit push spawns
  `node` and needs Node's CJS loader.
- **Evidence:** under `bunx --bun vitest`, child commands named `node`
  (including `/usr/bin/env node`) resolve to Bun's shim and drizzle-kit
  fails; recurrence of the openclaw-P1 node-shim class. The harness now
  probes PATH for a real Node (`process.isBun` probe, `BEEP_NODE_BIN`
  override) instead of hardcoding a host path.
- **Prevented by:** a shared test-kit helper for real-node resolution so
  each harness does not reimplement the probe; candidate for promotion when
  a second consumer appears.

## 2026-08-11 — family enrollment auto-extends laws keyed off the family kit

- **Doing:** adding `"ecosystem"` to `BeepPackageFamily` so generators could
  decode the member manifest.
- **Evidence:** the schema-first inventory scan (scoped by `packages/**`
  globs, not by family) immediately flagged 19 type-level interfaces in
  member `src/**` ("Exported pure-data interface should be modeled as an
  annotated schema") — all generic bounds/carrier descriptors the published
  DSL keeps as interfaces by design. Cured by excluding
  `packages/ecosystem/<member>/` in `isSchemaFirstExcludedFile` per doc 14
  style-law scoping.
- **Prevented by:** a family-onboarding checklist naming every law/scan that
  keys off `packages/**` or the family LiteralKit, so scoping decisions are
  made at enrollment rather than discovered as gate failures.

## 2026-08-11 — dead-code tooling entry inventories are not shared

- **Doing:** clearing knip and fallow for the new member's tool-loaded roots
  (tstyche typetests, the drizzle-kit `--schema` module, the perf consumer,
  the `Bun.build` bundle entrypoint).
- **Evidence:** the knip workspace `entry` block made knip green while fallow
  kept reporting the same files and their downstream exports dead until the
  equivalent roots were added to `.fallowrc.jsonc` `entry` — two tools, two
  hand-maintained inventories of the same facts.
- **Prevented by:** one canonical tool-loaded-roots inventory consumed by both
  detectors, or a parity check that diffs the two entry lists.

## 2026-08-11 — whole-package moves read as introduced debt to new-only gates

- **Doing:** running `beep quality fallow audit` after the move; the code was
  already on `main` (merged PR #651 at `scratchpad/bsl`) and reviewed through
  two quality loops.
- **Evidence:** the new-only gate attributed 19 complexity findings and 56
  duplication clone groups as *introduced* because every file path changed;
  none of the flagged function bodies changed in this PR. The sanctioned
  repairs were `thresholdOverrides` attribution-artifact entries (existing
  precedent wording) and mirrored-dialect duplication markers — plus honest
  refactors for the handful of genuinely new over-ceiling functions.
- **Prevented by:** rename/move-aware attribution in the audit lane, or a
  documented move-playbook step that pre-declares the override/marker set
  when a proven tree changes governance scope.

## 2026-08-11 — Bun/Vitest fork workers dead in sandboxed agent sessions

- **Doing:** job-scoped member test runs from a sandboxed agent.
- **Evidence:** every Vitest fork worker timed out pre-import ("no tests",
  `transform 0ms`, 60s duration); the threads-pool diagnostic failed with a
  null worker stdout before tests. The same commands pass in an unsandboxed
  shell (89/89). Node-backed diagnostic runs confirmed the suites themselves
  were healthy.
- **Prevented by:** a preflight that detects unsupported Bun worker
  environments and says so, instead of reporting an empty-but-failing run.

## 2026-08-11 — hosted checks unmasked three locally-green gates

- **Doing:** first hosted run of the P1 PR after six green-converging local
  verify rounds.
- **Evidence:** (1) `check:tsgo:tests` flagged TS377112 in a member test that
  every local lane had passed; (2) the root docgen metadata check reported 189
  member exports missing metadata — locally the member's gitignored
  `.beep/docgen/proof.json` let the check skip raw analysis, and the raw
  parser reads only the second block of the split `/** doc */` +
  `/** @internal */` pattern; (3) the coverage lane runs Vitest on Node, where
  the `Bun.build` bundle-isolation test throws instead of skipping. All three
  were reproduced locally only after deleting the proof manifest / switching
  runtime.
- **Prevented by:** a verify mode that deletes local proof manifests (or a CI
  parity flag) so "green local" can't depend on artifacts CI never sees, and
  runtime guards on Bun-only tests as a default authoring pattern.

## 2026-08-11 — bun global cache corruption spliced foreign bytes into effect

- **Doing:** cold member test typecheck between hosted-failure fixes.
- **Evidence:** `node_modules/effect/dist/Schema.d.ts:9424` contained a
  spliced `"grounding_progress"` string (TS1003 parse error); reinstalling
  relinked the same corrupt bytes from the bun global cache; `bun pm cache rm`
  plus re-fetch restored the true file. CI was unaffected (fresh installs),
  proving local-only corruption.
- **Prevented by:** nothing repo-side — recorded so the failure signature
  (parse errors inside a dependency's dist with nonsense tokens) maps to
  "purge the bun cache" instead of an upstream bug hunt.

## 2026-08-11 — JSDoc lane timeout on a slower host class delayed P1 convergence

- **Doing:** driving the P1 follow-up PR (#667) to merge-ready; every lane but
  JSDoc Ratchet settled green across repeated attempts.
- **Evidence:** the lane runs ~7 minutes on the fleet's intended host class but
  ran past its 30-minute budget on the replacement class the controller was
  provisioning during the incident (three cancelled attempts, one with zero
  failed steps at exactly the timeout). The fleet packet documents the same
  incident family — cache-home placement and host-class anomalies — in
  `goals/ci-fleet-endgame/research/OPPORTUNITIES.md`, and the lane has since
  moved to GitHub-hosted `ubuntu-24.04`.
- **Prevented by:** a declared host-class policy per lane (budget derived from
  the class it actually runs on) plus cache-home parity between classes.

## 2026-08-11 — merging before the reviewer set was terminal cost a follow-up PR

- **Doing:** closing P1; PR #664 was merged while its final review-fix push was
  still in flight.
- **Evidence:** the merge landed at a pre-fix head, stranding five substantive
  Codex findings — including published declarations broken by `stripInternal`
  stripping types still referenced from public signatures. Recovery required a
  dedicated follow-up (PR #667) with its own changeset, a fresh full
  verification cycle, and another hosted-check treadmill through an unrelated
  fleet incident.
- **Prevented by:** treating "phase closed" as: reviewer set terminal AND every
  actionable thread resolved AND the resolving commits present on the head
  being merged — not first-green checks.
