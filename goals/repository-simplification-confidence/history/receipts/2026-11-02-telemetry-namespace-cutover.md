# Dated telemetry namespace cutover — 2026-11-02

Refs #1865 (F-H3-NAMESPACE). Operator ruling 2026-11-02: a single global telemetry
projection with a dated cutover; owned projection file under `~/.cache/beep/telemetry/`,
backed up before the apply, join tested against both salts; no other home path touched.
Reverse: restore the backup; the old salts remain readable.

This supersedes the launcher-pair contract of
[2026-10-23](../../../repository-simplification-residue/history/receipts/2026-10-23-telemetry-namespace-contract.md),
which was never applied: the ruling names one owned file and no launcher writes.

## Contract

The hook-pulse salt chain gains a rung. Writer (`.claude/hooks/hook-pulse.sh`, shared by
the Codex and Cursor adapters) and reader (`hookPulseNamespace` in
`@beep/repo-ai-metrics`) both resolve, in order:

1. `BEEP_HOOK_PULSE_HASH_SALT` (explicit per-instrument override);
2. the owned projection file
   `${BEEP_HOOK_PULSE_NAMESPACE_PROJECTION:-${XDG_CACHE_HOME:-$HOME/.cache}/beep/telemetry/namespace-projection.json}`,
   JSON `{version: 1, cutoverUtc, hashSalt, previousRegime}`;
3. `BEEP_AI_METRICS_HASH_SALT` (the repo-wide variable);
4. the library default `AI_METRICS_LOCAL_INSECURE_HASH_SALT`.

The projection outranks the repo-wide variable on purpose: it is this instrument's
global projection, so a desktop-launched harness child (whose launcher exports no
salt) and a shell-launched one now write into one namespace. A projection that exists
but is a symlink, unreadable, not `version` 1 or blank-salted fails closed on both
halves: the writer refuses the row with the new payload-free reason
`namespace-projection-invalid`; the reader fails with `HookPulseNamespaceError`.

Readers join under every regime: `hookPulseNamespaceSalts` lists the current salt and,
when a projection is applied, the `previousRegime` salt (`library-default`).
`harness-ledger reconcile` hashes each transcript under both, reports
`hookedToolEventsByRegime: { current, previous }`, `namespaceProjection` and
`namespaceCutover`; `prune-proposals` excludes every session that began before
`cutoverUtc` from the current window and counts it in `sessionsSkippedPreCutover`, so
old observations are never folded into a zero-use window. Historical rows are not
rewritten.

Tests (all passing at this head): `hook-pulse-namespace.test.ts` (rung order, blank
override, both-salt listing, malformed/blank/version/symlink refusals, round trip);
`hook-pulse-writer.test.ts` (real writer under a fixture projection reproduces the
TypeScript digests above the ai-metrics rung and below the instrument override; four
invalid projections each yield one `namespace-projection-invalid` refusal and no row);
`harness-ledger.test.ts` (reconcile joins one transcript per regime and reports
`{current: 1, previous: 1}` under a projection, `{current: 1, previous: 0}` without one;
the prune window observes 1 of 2 active sessions under a projection and skips the
pre-cutover one).

## Apply

Script: [`ops/2026-11-02-telemetry-namespace-projection.py`](../../ops/2026-11-02-telemetry-namespace-projection.py)
(`--status` default, `--apply`, `--rollback`). It reads the salt from the workstation's
existing `~/.config/beep/ai-metrics.env` (`BEEP_AI_METRICS_HASH_SALT`, the value the
forwarder already uses) and writes only under `~/.cache/beep/telemetry/`. Fixture runs
under isolated `HOME`s passed first: absent → apply → repeat apply retains the original
cutover; rollback refuses on byte drift and restores or removes exactly; a salt change
backs up the prior bytes and rollback restores them; a live but invalid projection
refuses apply; symlinked ancestry refuses everything.

```
$ python3 goals/repository-simplification-confidence/ops/2026-11-02-telemetry-namespace-projection.py --apply
applied: ~/.cache/beep/telemetry/namespace-projection.json
cutoverUtc: 2026-11-02T03:47:34.927Z
backup: ~/.cache/beep/telemetry/backups/20261102T034734.927158Z
rollback: rm -- ~/.cache/beep/telemetry/namespace-projection.json
```

- Owned file: `~/.cache/beep/telemetry/namespace-projection.json`, mode 0600,
  `previousRegime: library-default`. The salt value never reached stdout, argv or the
  journal (the journal stores its SHA-256 only).
- Backup: `~/.cache/beep/telemetry/backups/20261102T034734.927158Z/` with
  `original-state` = `absent` and `journal.json` (apply time, owned digest, restore
  command).
- Restore: `rm -- ~/.cache/beep/telemetry/namespace-projection.json`, or
  `python3 … --rollback` (drift-fenced). Rows written after the cutover were hashed
  with the same salt the shell sessions already used, so they stay readable after a
  rollback too; only desktop-launched children would fall back to the library default.
- No other home path was written. `~/.config/beep/ai-metrics.env` was read only.
  `~/.claude/settings.json`, `~/.codex/config.toml` and the Cursor config were not touched.

## Live join against both salts

Live writer proof, isolated evidence root, `instrumentClass=spike`, real `HOME`:

| Writer environment | Row digest |
| --- | --- |
| Both salt variables unset | `sessionId` and `cwd` equal the projection-salt digests; not the library-default digests. |
| `BEEP_AI_METRICS_HASH_SALT` exported (ordinary shell) | Same digests: one namespace either way. |
| `BEEP_HOOK_PULSE_NAMESPACE_PROJECTION` pointing at `{bad` | No row; one refusal `{"reason":"namespace-projection-invalid"}`. |

Live reconcile at 2026-11-02T03:48:20Z, projection present (`beep harness-ledger
reconcile --state-dir ~/.local/state/beep/agent-evidence/hook-events --transcript-dir
~/.claude/projects --agent-kind claude-code`, 53 s):

| Field | Value |
| --- | --- |
| transcriptFiles | 6677 |
| transcriptToolEvents | 377464 |
| hookedToolEvents | 278294 (ratio 0.737) |
| hookedToolEventsByRegime | current 278273, previous 21 |
| sessionsWithoutHooks | 236 |
| undecodableLines | 78 |
| namespaceProjection / namespaceCutover | present / 2026-11-02T03:47:34.927Z |

Both regimes join: 21 hooked tool events were pseudonymized under the library default
(sessions that exported no salt) and are reached only through the previous-regime salt;
the rest sit under the salt the projection now fixes globally. `qualifiedForNonUse`
stays false (advisory basis unchanged).

Live `prune-proposals --agent-kind claude-code --json` at 03:49:14Z: `shardsRead` 7722,
`sessionsSkippedPreCutover` 2414 (every session on disk began before the cutover),
`sessionsObserved` 0, `namespaceCutover` 2026-11-02T03:47:34.927Z, no proposals,
`written: false`. The current window starts empty at the cutover by design; the 74
undecodable historical rows and the refusal/role skips are unchanged from the H3
baseline.

## Not claimed

- No new qualifying sessions exist yet; the window fills from live sessions after the
  cutover. Codex and Cursor children route through the same writer and gain the rung,
  but their native trust/attribution gates from F-H3-QUALIFY are untouched.
- The forwarder's session-identity hashing still resolves the two-rung `Config`
  (`hookPulseHashSalt`); on this workstation its unit exports the same salt, so the
  namespaces coincide. Switching it to `hookPulseNamespace` is a separate change.
- Historical rows under the library default (the 21 above and any pre-2026-10 rows) are
  not migrated; they remain readable through the previous-regime join only.
