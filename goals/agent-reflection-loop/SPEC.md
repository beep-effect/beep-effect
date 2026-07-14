# Agent Reflection Loop Spec

## Mission

Make agent **reflection** a first-class, schema-validated, enforced part of the
goal-packet lifecycle: agents reflect at P3 Close (and on demand) on the repo's
tooling, the implementation they produced, and the goal/prompt they were given,
persisting structured artifacts that compound into durable, reusable knowledge.

## Scope

- In:
  - `goals/_template/**` and `goals/README.md` — the reflection topology + convention.
  - `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts` — the
    `ReflectionFrontmatter` schema model + `bun run beep lint reflection-artifacts`.
  - `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`,
    `commands/Quality/Tasks.ts`, `bin-main.ts` — command registration + routing.
  - `.claude/skills/reflect/**` — the on-demand `/reflect` skill.
  - `standards/architecture/GLOSSARY.md` — canonical "reflection" vocabulary.
- Out (descoped): the Yeet self-healing reflection loop (P2) and memory
  consolidation (P3). Both are won't-do until a packet closes without usable
  reflections.

## Decisions

1. **Two reflection types.** Episodic goal-closeout retro (P1) vs Yeet-grounded
   self-healing failure→reflect→repair (P2). Built separately.
2. **Substrate = convention + skill, not a hook.** Mandatory trigger is the
   manifest **P3 Close** step; a Stop hook over-fires and is harness-specific.
3. **Governance schema, governance home.** `ReflectionFrontmatter` lives with the
   CLI lint tooling (mirroring `QualityIssueIndex` / `SchemaFirst`), reusing
   `@beep/schema` `LiteralKit` + `decodeYamlTextAs`.
4. **Per-session immutable files** `history/reflections/<YYYY-MM-DD>-<agent>.md`,
   not a rolling log (append-only ⇒ conflict-free).
5. **Opt-in enforcement.** Packets with `reflectionRequired: true` (the `_template`
   default) are **blocked** at completion without a valid reflection; legacy
   completed goals surface non-fatal advisories.
6. **Information-rich, confidence-tiered content** (grounded in the cited research:
   TACL 2024 `2406.01297`, Renze & Guven `2405.06682`, ExpeL `2308.10144`).

## Acceptance

- `bun run beep lint reflection-artifacts` runs, routes correctly, and reports
  `blocking_findings=0` on the current tree (advisories allowed).
- A reflection whose frontmatter validates against `ReflectionFrontmatter` clears
  the gate for a `reflectionRequired: true` packet.
- The `_template` ships `history/reflections/_TEMPLATE.md`; `goals/README.md`
  documents the convention; `/reflect` skill exists.
- `bunx tsgo -b packages/tooling/tool/cli/tsconfig.json` and the reflection lint
  test pass.

## Stop Conditions

See `ops/manifest.json`. Enforcement stays **advisory for legacy goals** and must
not change existing public wire formats, migrations, auth, infra, security,
generated drivers, or dependencies.
