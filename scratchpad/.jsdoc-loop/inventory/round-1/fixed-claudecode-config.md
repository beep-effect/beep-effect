# Round 1 fix report — claudecode-config

JSDoc-only edits under `scratchpad/claudecode/Frontmatter/**` and
`scratchpad/claudecode/Settings/**`. No runtime changes.

## Changed files

- `scratchpad/claudecode/Frontmatter/Command.ts`
- `scratchpad/claudecode/Frontmatter/OutputStyle.ts`
- `scratchpad/claudecode/Frontmatter/Parser.ts`
- `scratchpad/claudecode/Frontmatter/Skill.ts`
- `scratchpad/claudecode/Frontmatter/Subagent.ts`
- `scratchpad/claudecode/Settings/HooksSection.ts`
- `scratchpad/claudecode/Settings/Loader.ts`
- `scratchpad/claudecode/Settings/Schema.ts`

Unchanged on purpose: `Frontmatter.ts` (barrel already has `@packageDocumentation`);
`Frontmatter/Render.ts` (no accepted findings); `Settings.ts` (0-owning barrel;
census skips it — inventory rejected opening it).

## Items closed

| ID | Status | Fix |
| --- | --- | --- |
| R1-001 | closed | `HooksSection.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-002 | closed | `Loader.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-003 | closed | `Schema.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-004 | closed | `SkillFrontmatter` namespace: titled Encoded Example (`name` + `"allowed-tools"`). |
| R1-005 | closed | `SubagentFrontmatter` namespace: titled Encoded Example (`name` / `description` / `model`). |
| R1-006 | closed | `AgentHookEntry` / `HookMatcherGroup` namespaces: titled Encoded Examples (`prompt`; `hooks.length`). |
| R1-007 | closed | `Marketplace` / `SettingsFile` namespaces: titled Encoded Examples (`source.source`; `model`). |
| R1-008 | closed | Replaced vacuous `accept` identities on `CommandHookEntry`, `HttpHookEntry`, `McpToolHookEntry`, `PromptHookEntry` with Encoded literals + field logs. |
| R1-009 | closed | Replaced 15 namespace `accept` identities with Encoded literals + field logs. Logged discriminants on unused `decodeSync` exports: `McpServerPolicyMatcher`, `MarketplaceSourceSpec`, `Marketplace` class, `SettingsRaw`. Same unused-decode pattern on `MarketplacePolicySourceSpec` (touched-file upgrade). |
| R1-010 | closed | Collapsed unrun `Effect.gen` + unused `program` on `CommandFrontmatter_`, `OutputStyleFrontmatter_`, `SkillFrontmatter` class, `SubagentFrontmatter` class, and `parse` to `Effect.runSync` + existing field logs. |
| R1-011 | closed | `StringOrStringArray`, `EffortLevel`, `FrontmatterShell`, `SubagentColor` type aliases: decoded-value lead, described `@see`, `@category type-level`, dropped `{@inheritDoc}`. |
| R1-012 | closed | Sibling `@see` on both `EffortLevel` value exports: `max` is frontmatter-only (`Settings.EffortLevel` vs `Frontmatter.EffortLevel`). |
| R1-013 | closed | **Gotchas** on `LoadOptions` and `load`: `managedSettingsRoots` replaces the default triple and ignores `managedSettingsRoot`; single-root is used only when roots is absent. Named `/Library/Application Support/ClaudeCode`, `/etc/claude-code`, `C:\Program Files\ClaudeCode`. |

Mechanical census targets (3 modules + 6 namespaces) now have the required tags /
titled Examples. Examples import `effect-claudecode` (value or `import type`).
No `@example`, `@remarks`, `@module`, or `@template` in touched files.

## Residual risk

- `Settings.ts` barrel still has lead + `@since` without `@packageDocumentation`.
  Census only emits module findings when `owningExportCount > 0`; inventory
  rejected opening it.
- `{@link Settings.EffortLevel}` / `{@link Frontmatter.EffortLevel}` are
  cross-barrel names; TSDoc may not resolve them to a page, but the purpose
  phrase is present (census undescribed-see stays closed).
- `Parser.ts` file parsers still use `Effect.runPromise(...).then(...)` (already
  run, not unused `program`). Left as-is; R1-010 named only `parse`.
- Example TypeScript / owning-package `claudecode:check` were not executed in
  this fixer process (no shell tool). Parent should run the commands below
  before treating the pack as merge-ready.

## Commands run

- Static re-application of `scratchpad/.jsdoc-loop/census.ts` rules against the
  owned surface: every exporting module with owning symbols now has
  `@packageDocumentation`; every previously open namespace has `**Example**
  (Title)`; no leftover `const accept =` or unrun `Effect.gen` examples in
  Frontmatter/Settings.
- Not run here (no shell): `bun scratchpad/.jsdoc-loop/census.ts`
- Not run here (no shell): `zsh -ic 'cd scratchpad && bun run ../packages/tooling/tool/docgen/src/bin.ts --config-file docgen.json --include "claudecode/Frontmatter/**/*.ts,claudecode/Settings/**/*.ts"'`
- Not run here (no shell): `zsh -ic 'bun run --cwd scratchpad claudecode:check'`

Expected census after the first command: pack `claudecode-config`
`openModuleCount: 0`, `openOwningExportCount: 0`.

## Symbols not documented

None of the accepted findings were blocked by unclear runtime behavior.
