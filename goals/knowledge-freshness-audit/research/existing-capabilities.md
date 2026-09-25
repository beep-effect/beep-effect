# Existing capabilities and gaps

Observed at b007ddd5a0df7fab0c9fbabc4c9f1b434b5f6a98 on 2026-09-24.
Recheck capabilities before implementation; planned behavior is not deployed
merely because a schema or roadmap names it.

## Knowledge and deterministic proof

The [Knowledge command group](../../../packages/tooling/tool/cli/src/commands/Knowledge/)
already provides reference census and semantic-delta analysis.
Knowledge.schemas.ts owns finding contracts; Knowledge.refs.ts owns tracked-tree
reference work; Knowledge.service.ts compares paired Git archives and
introduced/inherited/resolved findings. Existing checks include tracked paths,
assertions, CLI parser probes, and index drift. They do not establish arbitrary
prose truth or persistent fleet-wide claim identity.

```sh
bun run beep knowledge refs --tree HEAD --json
bun run beep knowledge semantic-delta --base origin/main --json
```

The reference check's live-host-path gate excludes documented archival/convention
classes. Passing it is not a certificate that all references are valid.

The package script policy and JSDoc inventory offer specialized deterministic
evidence. The JSDoc inventory checks structure, tags, examples, and annotations;
truth of prose needs further evidence. Workspace scripts remain generated.
Whole-repo standard snapshots follow their dedicated-refresh policy.

## Skills and agents

The root [skills lock](../../../skills-lock.json) is version 1 with 35 skills.
Six known remote sources cover ADHD, grill-me, teach, portless, shadcn, and
turborepo; the remaining 29 are labeled repo-local. Floating main refs and
content hashes are not an immutable imported-base record.

The [Skills command group](../../../packages/tooling/tool/cli/src/commands/Skills/)
has a newer version-2 provenance model with source revision, tree/file hashes,
license, provenance confidence, ordered local patches, and effective installs.
Its live provenance service is a Shadcn-only report pilot. It does not perform
a broad lock migration or reconcile every skill.

```sh
bun run beep skills provenance shadcn --json
bun run beep skills update --skill shadcn --dry-run
```

The updater's write path can replace differing content and reevaluate the lock,
Codex skill table, and mirror. Selecting one remote does not isolate every
side effect. Do not use it to preserve undocumented customization.

Other distributions include .github skills, local plugins, package-owned judge
skills, and seven Markdown/TOML agent pairs. Harness equivalence is a semantic
check; making unlike formats byte-identical is not the goal.

## Representative leads, not accepted repairs

| Observation | What remains to verify |
| --- | --- |
| Graft skill describes build as an LLM-layer action while root instructions call exact build structural/no-key | Installed implementation and applicable rule before rewriting either source |
| Parent README phase prose lags its manifest; the SPEC contains an older no-bootstrap statement | Scope the statement historically versus misleading present guidance; the live command is plan-only |
| Impeccable declares 4.1.2 in Claude and 4.1.1 in GitHub distributions | Upstream ancestry and intentional harness differences before reconciliation |
| Notion plugin lock has draft integrity placeholders | Verify whole pinned bundle and license before treating integrity as established |
| Some repo-local lock entries resemble upstream-derived skills | Resolve ancestry with history and whole-bundle evidence; labels are not authorship proof |

These are suitable pilot cases. No live upstream freshness census or fleet
remediation was performed during packet research.

## Packet creation and docs-only delivery

The existing plan compiler emits complete seed payloads but has no supported
writer. The manual template convention remains appropriate for this packet.

```sh
bun run beep goals bootstrap --slug knowledge-freshness-audit --title "Repository freshness audit" --mission "Audit repository claims against explicit authority and evidence, reconcile customized upstream skills, and verify targeted repairs." --archetype report-first --today 2026-09-24 --plan --json
```

The [heavy admission policy](../../../packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts)
accepts Markdown and the goal manifest, but not arbitrary goal research JSONL,
JSON fixtures, or .gitkeep files. The planning PR therefore contains authored
Markdown contracts/specimens; full ledgers belong to implementation. Do not
relocate them to the nightly research corpus to evade classification.

The parent owns the broader knowledge infrastructure. The epistemic product
slice is design prior art only until a legal dependency/reuse analysis proves
otherwise. This campaign should not create a new graph or memory service.
