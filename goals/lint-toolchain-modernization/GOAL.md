# GOAL: modernize the lint toolchain (Biome GritQL + effect-smol alignment + oxlint lane)

Repo: `beep-effect` (this checkout).

Outcome: faster, effect-smol-aligned quality enforcement — syntactic CLI checks moved
to Biome GritQL rules, `biome.jsonc` lint rules aligned to effect-smol (formatting
kept), a `@beep/lint-rules` package, an oxlint lint-only lane for the t3code rules — all
violations remediated and merged to `main` via `/yeet`.

This is a compact `/goal` launcher. The packet files are the detailed contract:

- `goals/lint-toolchain-modernization/README.md`
- `goals/lint-toolchain-modernization/SPEC.md` (normative)
- `goals/lint-toolchain-modernization/PLAN.md`
- `goals/lint-toolchain-modernization/ops/manifest.json`
- `goals/lint-toolchain-modernization/research/{recon-2026-06-20,rule-inventory}.md`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by `SPEC.md`
(`standards/ARCHITECTURE.md`, `architecture/07-non-slice-families.md`,
`effect-laws-v1.md`). Higher-priority repo standards outrank packet prose.

Scope:

- In: `biome.jsonc`; new `packages/tooling/policy-pack/lint-rules` (`@beep/lint-rules`);
  migrated commands in `packages/tooling/tool/cli` + lint aggregators; `turbo.json` and
  `.github/workflows/check.yml` lint lanes; new `STYLE.md`; `.oxlintrc.json` (P3 only).
- Out: replacing Biome with oxlint; changing Biome **formatting** (semicolons / ES5
  trailing commas stay); adding dprint; migrating type-aware/graph checks off `ts-morph`
  (`dual-arity`, `terse-effect`, `schema-first` inventory, `circular`, `allowlist`,
  `turbo-config-proof`, `changeset-graph`, `jsdoc-inventory`).

Workflow (5 phases; 2 config→remediate waves — see `PLAN.md`):

1. P0 Spike: prove GritQL plugin resolution in Biome on a fixture; baseline runtimes.
2. P1 Configure: build `@beep/lint-rules`; author GritQL rules; align `biome.jsonc`
   lint rules; write `STYLE.md`; wire CI advisory; deprecate migrated CLI commands.
3. P2 Remediate: fix all violations (Biome safe-fix / `ts-morph --write` / agent edits);
   flip rules mandatory; `/yeet` to merged PR(s).
4. P3 oxlint lane: add oxlint lint-only; port the 4 t3code rules + stateful rules;
   advisory→mandatory; remediate; `/yeet` to merged PR.
5. P4 Close: closeout reflection + status updates.

Rules:

- GritQL is diagnostics-only — never silent mass rewrites; remediate via Biome safe-fix,
  existing `ts-morph --write` codemods (e.g. `laws effect-imports --write`), or edits.
- Remove a CLI check only after its GritQL replacement proves parity (fixtures +
  baseline diff on the current tree).
- Each code-changing phase ends green via `bun run beep yeet verify` before its PR merges.
- Keep decisions tied to evidence from files, tests, docs, or command output.
- At P4 Close, write a closeout reflection to
  `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
  `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] `bun run lint` and `bun run beep yeet verify` are green; PR(s) merged, CI green.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/lint-toolchain-modernization/GOAL.md)" -le 4000
jq . goals/lint-toolchain-modernization/ops/manifest.json
git diff --check -- goals/lint-toolchain-modernization
bun run lint
bun run beep yeet verify
bun run beep lint reflection-artifacts
```

Stop and report before changing Biome formatting, public API, schema, data migration,
auth, infra, dependencies, lockfiles, or generated files unless `SPEC.md` requires it.

Done only when acceptance passes and verification is complete, or when a blocker is
reported with file/command evidence.
