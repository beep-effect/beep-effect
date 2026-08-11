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
