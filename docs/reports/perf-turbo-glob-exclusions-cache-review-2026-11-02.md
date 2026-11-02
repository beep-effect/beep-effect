# Turbo glob exclusions cache review (quality audit M8)

Several Turbo tasks hashed gitignored trees their commands never read: nested
lanes (excluded by `!.claude/worktrees/**`), nested `node_modules`, and Cargo artifacts
(excluded by `!**/src-tauri/target/**`). This change adds exclusions to the input sets only.

Input-set changes in root `turbo.json` (subject `//`):

- `!.claude/worktrees/**` on `//#lint:retired-iri-authorities`,
  `//#lint:markdown-fences`, `//#lint:schema-tag-idioms`, `//#lint:holds` and
  `//#lint:tsgo-rules`. All five list files through `git ls-files`, and
  the root `.gitignore` ignores the nested lane directory.
- `!**/src-tauri/target/**` on `//#lint:retired-effect-paths`,
  `//#lint:retired-iri-authorities`, `//#lint:markdown-fences`,
  `//#lint:schema-tag-idioms` and every `//#fallow:*` task. The Cargo `target` directory
  is ignored by the root `.gitignore`.
- `!**/node_modules/**` and `bun.lock` on every `//#fallow:*` task;
  `!**/node_modules/**` on `//#lint:typos`, which honors the Git ignore.
- `!**/src-tauri/target/**` on the root `coverage` and
  `package-test-typecheck` task definitions. The desktop tests read
  `src-tauri` configuration and source, never build artifacts.

Input-set change in `packages/foundation/modeling/identity/turbo.json`
(subject `@beep/identity`): `!$TURBO_ROOT$/.claude/worktrees/**` on `lint`.
Biome reads the package and the root configuration files, not nested lanes.

After #2559 (merged into this branch) `//#lint:tsgo-rules`,
`//#lint:retired-effect-paths`, `//#lint:retired-iri-authorities`,
`//#lint:markdown-fences`, `//#lint:schema-tag-idioms` and `//#lint:holds` are
cached; the Fallow, typos, `coverage` and `package-test-typecheck` rows and
`@beep/identity#lint` stay uncached. For the cached rows the exclusions remove
only paths their `git ls-files` listing never returns, so a replayed result
cannot depend on a removed input. Commands, outputs, `dependsOn`, cache flags,
qualification scope, profile, epoch and qualification states do not change.
This reviews the declared input-set change only. It is not evidence that any
computation is newly qualified or that a quality gate has passed.

Drifted computations reported by `bun run beep cache audit`:

- `//#lint:tsgo-rules`, `//#lint:retired-effect-paths`,
  `//#lint:retired-iri-authorities`, `//#lint:markdown-fences`,
  `//#lint:schema-tag-idioms`, `//#lint:holds` (configuration-drift)
- configuration sources `turbo.json` and
  `packages/foundation/modeling/identity/turbo.json` (configuration-source-drift)

Subjects re-recorded: `//` plus all 188 workspace packages. Every package
inherits the root `coverage` and `package-test-typecheck` definitions, whose
input lists gained `!**/src-tauri/target/**`; both tasks are uncached, and the
glob matches only the desktop app's Cargo `target` directory, so no other
package's hash changes. `@beep/identity` also carries its overlay change above.

## Reversal

Revert `turbo.json`, `packages/foundation/modeling/identity/turbo.json` and the
test/runbook edits, then re-record the same subjects.
