# H3 telemetry qualification

Status: repository repair implemented; external qualification prerequisites remain. No non-use retirement is supported by this receipt.

## baseline

At the initial lane head, the hook census returned:

| Client | Rows | Sessions | SessionStart sessions | Stamped sessions | Surface rows | Distinct stamps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Claude | 564057 | 1819 | 191 | 191 | 1397 | 116 |
| Codex | 422540 | 1501 | 3 | 0 | 0 | 0 |
| Cursor | 2403 | 28 | 0 | 0 | 0 | 0 |

The payload-free census had zero invalid JSON lines. The baseline dry run
`bun run beep harness-ledger prune-proposals --json` observed 0 current-regime
sessions, skipped 191 other/mixed sessions and 3144 unstamped sessions, read
3866 shards, counted 74 schema-undecodable rows, and wrote nothing.
Counts are a dated snapshot, not a promise about the growing store.

## fingerprint-v2

The session stamp uses the versioned `harness-hash-v2` preimage. Git checkouts
include indexed configuration and `.claude/settings.local.json`; non-git
fixtures use the bounded filesystem walk. Added roots: `.cursor`, `.agents`,
`.junie`, `.grok`; `.mcp.json` is session configuration. Ignored state is excluded.
An indexed Git parity fixture covers nested guidance, symlinked CLAUDE.md,
all existing config roots, and unrelated quoted names. Model/effort overrides are session attributes; model defaults in configuration
remain fingerprint inputs. Global projection is separately owned by F and is
not silently inferred from this repository snapshot.

## codex

Codex delegates to the shared writer and registers SessionStart. Synthetic
SessionStart wrote one stamped row. The installed CLI is 0.162.0; its binary
exposes no `PostToolUseFailure` name. Unmatched Pre events are therefore
`failed-or-interrupted`, not proven drops. Four isolated native Codex reproductions succeeded in running their tool, across
primary and linked fixtures with `danger-full-access` and `workspace-write`, but
emitted zero hook rows. The fixture explicitly enabled hooks and had project trust
and registrations. This does not establish a sandbox cause or repair native trust.
F owns native re-trust. Rollout filenames do not establish root/fork ancestry;
unknown roles are excluded until a tested native signal exists.

## cursor

Synthetic `sessionStart` produced one stamped row and `{}` protocol output.
Measured stamp latency: Claude 0.844 s; Codex 0.522 s; Cursor 0.511 s. Cursor's
3 s cap is retained; timeout refusals are recorded. Native Cursor emitted one SessionStart and one SessionEnd with a stamp. Its
Opus tool workflow was rejected by the existing subscription limit. Native hook
latency was not measured; the 0.511 s result is isolated adapter latency only.

## window

Windows are keyed by client plus session/transcript identity. Root qualification requires an observed `startup` at its earliest timestamp,
plus at least one verified-primary user turn and tool event; a later transcript under
the same parent contributes touches only with verified role metadata, without
becoming another qualifying root. Each activity row must itself be verified primary.
Mixed stamps and disarm intervals are excluded. Shared `.agents/skills`
candidates cannot write proposals until every loading client has a complete
window. `nonUseQualified` stays false without independent reconciliation.
No synthetic fixture contributes to the live 30-session window. Automatic
`--write` remains advisory even with a full window: aggregate ratios cannot
establish per-tool identity or surface collection. Manual ledger decisions remain
available. The unknown-restart counter includes roots without an observed fresh opening.
Unknown current collection capability is null; only a proven current
sentinel reports disabled. An unknown-start disarm interval excludes sessions
only through its known re-arm time.

## drops

Writer refusals have only UTC time, normalized client, and a closed reason.
Switch transitions are durable, payload-free rows beside the existing disarm
windows. Storage failure can still prevent the refusal itself from being
persisted; transcript reconciliation remains necessary.

## otel

Forwarder source/session rows retain optional session-time harness stamps
beside ingest-time `config_snapshot_id`. Unknown and mixed stamps stay absent. A reused transcript path with multiple
production session identities is ambiguous and receives no stamp; unsupported
OpenClaw sources never join the Codex hook namespace.
Codex sessions are not countable from native metrics. Cursor, Junie, and Grok
remain unsupported native-OTel transcript sources. Forwarder cadence is on demand.

Remote current queries are blocked: the existing SSH multiplex socket was
absent and a bounded BatchMode connection timed out. No credential was requested
or copied; no remote state was changed. Prometheus and recent Phoenix results
remain unknown for this lane. The legacy archive-key secret reference cannot
resolve through the agent account. One `op-doctor` diagnosis confirmed the
service-account route; the failing secret operation was stopped. F must provide
a current lane-scoped secret reference. No forwarder run or new timer was started;
restored export is not claimed.

## reconciliation

`bun run beep harness-ledger reconcile --state-dir <hook-events> --transcript-dir
<transcripts> --agent-kind <kind>` reads structural transcript metadata and emits
counts only. It includes nested children, resolves relative roots, and prevents
symlink-directory revisits. Unreadable entries are counted and skipped. Non-production hooks are excluded. Aggregate ratios
remain advisory and `qualifiedForNonUse` stays false; genuine non-use still needs
at least 0.98 collection coverage for the affected harness plus per-tool and
surface attribution. Codex exec wrappers are reported as failed-or-interrupted;
Cursor transcript format is unsupported by this reconciler.

## validation

All instrument fixtures use isolated `BEEP_AGENT_EVIDENCE_ROOT` directories.
They establish execution behavior and never fill the live window.

| Workflow | Result | Boundary | UTC date |
| --- | --- | --- | --- |
| Claude primary and linked checkout | Each: 1 fresh startup, 1 prompt, 2 Pre, 2 Post, 1 Stop; one stamp and one skill surface | Native Opus workflow; identical indexed fixture heads produced equal stamps | 2026-10-09T20:49:39.102Z primary; 20:49:43.183Z linked |
| Claude project Skill, MCP and Read | 1 Skill, 1 MCP tool, 1 Read; 3 surface rows; one start stamp | Existing hook pipeline; local constant-response MCP fixture | 2026-10-09 |
| Claude fan-out | 1 parent SessionStart; 2 Agent calls and 2 Bash posts; no extra qualifying roots | Both children pinned to Opus; parent payload namespace observed | 2026-10-09 |
| Codex primary/linked, two sandbox modes | 4 tool workflows succeeded; zero native hook rows | Native collection remains unknown; no home trust state changed | 2026-10-09 |
| Cursor native session | 1 stamped start and 1 end | Tool workflow rejected by subscription quota; no billing/model substitution | 2026-10-09 |
| Direct Claude/Codex/Cursor adapters | Each writes 1 stamp; schema and shell/TS parity fixtures | Synthetic; excluded from live observations | 2026-10-09 |
| Arm/disarm | 2 transitions, 1 disabled refusal, 1 closed gap, sentinel re-armed | Disposable evidence root | 2026-10-09 |
| Remote Prometheus/Phoenix | Unknown: bounded SSH connection timed out | No remote write; current metrics/page not verified | 2026-10-09 |

Interactive permission behavior and actual desktop/proxy attribution remain
unverified. F owns those home fields and native launcher verification.

The five coverage buckets are applied to the relevant collection surface; unknown
is retained rather than forced into a bucket:

| Client | Stamped | Unstamped by design | Unsupported | Not configured | Disabled | Current live qualification |
| --- | --- | --- | --- | --- | --- | --- |
| Claude | Isolated native workflows proven | None asserted | None asserted for hooks | Unknown globally | Not asserted | Incomplete; no non-use |
| Codex | Direct adapter proven | Native metrics cannot count sessions | None asserted for hook adapter | Native trust/config state unknown | Not asserted | Native hooks and root ancestry unqualified |
| Cursor | Native SessionStart proven | None asserted | Native OTel transcript source and reconciliation format | Tool coverage unknown | Not asserted | Tool workflow unqualified |
| Junie | None asserted | None asserted | Hook/forwarder client unsupported | No supported adapter | Not asserted | Unsupported; no non-use |
| Grok | None asserted | None asserted | Hook/forwarder client unsupported | No supported adapter | Not asserted | Unsupported; no non-use |

The configuration version is `harness-hash-v2`; actual salts, session identities
and fingerprint values are private. Partial or failed collection retains every
candidate on demand. No capability is classified genuinely unused.

## proof

Known same-client or unknown-client event-loss refusals conservatively exclude overlapping sessions through `sessionsSkippedRefused`. Forwarder stamps are withheld for overlapping refusal/disarm gaps and malformed gap evidence. Stamp-only failures remain diagnostics; a later event-loss refusal affects an open session until its durable SessionEnd. Refusal uncertainty covers the entire recorded second. A refusal can coexist a durable row; the exclusion records collection uncertainty. Claude path conventions infer ancestry only for Claude; Codex/Cursor filename spelling alone cannot qualify a root.

Publication cheap gates rejected introduced test-lint and Fallow findings before any push. Source repairs consolidate failure handling, count an aliased unreadable entry once, scope resource-bearing tests, and simplify writer setup. No generated baseline was changed.

Final package/parity results and final-head live census are recorded below when
the admitted jobs complete. Coverage was read from the existing regression
baseline for 10 touched source files; this is a baseline read, not current
coverage measurement. No baseline row was changed.

Independent reviews use separate read-only sessions: Claude Opus 5.5 medium and
Codex GPT-6.1-Sol medium. Earlier actionable findings are retained and repaired,
including lower-severity disarm, refusal, role, join and traversal defects.

## recovery

Revert the H3 PR. Additive refusal/transition/stamp fields and historical v1 rows
remain readable; v1 observations stay outside the v2 regime. F rolls home changes
back through its backups. This lane made no home configuration change, scheduled
no timer and performed no remote mutation.

Graft queries saved approximately 217,311 source tokens across this lane's work.

Current-source qualification repair (`5537f21e30`): corrupt hook evidence excludes non-use windows without erasing positive touches; shared capability counts require 30 sessions per loading harness independent of display window; canonical aliases retain all observed path hooks and conflicting identities remain unmatched. Forwarder stamps require valid ordered transcript bounds and durable terminal hooks to bound event-loss refusals. Snapshot budgets reserve root guidance/MCP files and exclude nested checkout paths before stat. Independent review and final admitted package proof remain pending; these statements are implementation evidence, not proof of a complete live window.
