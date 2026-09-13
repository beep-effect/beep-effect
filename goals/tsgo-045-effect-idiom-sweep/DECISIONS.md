# Decisions — tsgo 0.45 Effect idiom sweep

Locked with Benjamin on 2026-09-12 in a grill-with-docs session. Facts came
from the live checkout at main `23f3919`, the effect clone at `4.0.0-rc.115`
(`$HOME/YeeBois/dev/effect`, head `51d4a2f08a`), and the tsgo clone at
`0.45.0` (`$HOME/YeeBois/dev/effect-tsgo`, head `223f9fa4`). Each entry
records the question, the answer, the rationale, and the rejected options.

## Premise corrections that reshaped the original prompt

| Original premise | What the repo says | Consequence |
| --- | --- | --- |
| Directives are everywhere; one research agent per diagnostic | 44 code files, 87 directives, 4 rule kinds in `scratchpad/`, 6 by-construction skip-files in the root Bun shim, 2 in `vitest.shared.ts`, 1 D14 exception | Sweep is a gate-widening job (D1) |
| tsgo config lacks explicit handling of new diagnostics | `beep quality tsgo-rules` already verifies all 103 installed rules at `error`; the gap is the version (0.39.1 vs 0.45.0, +13 rules) and ten unset config keys | Bump plus key parity (D2, D3) |
| The `$I` equivalence fix is "something Effect shipped" | Upstream `84864bc30c` "Fix Schema class equivalence derivation, closes #7450" landed 2026-08-25 and is in rc.113; `makeClass` installs `toEquivalence: ([from]) => from` | Retire `adoptDeclaredFieldsEquivalence` (D4) |
| Match rewrites were forced by rc.113 | The Match contextual-typing fix (`8d1e97a`, 2026-08-26) was already in snapshot `c8349ed`; PR #1060 still replaced 96 exhaustive maps with chains | Agent regression; needs a law (D5) |

## D1 — Directive exemptions: exactly two, declared

**Question.** The gate rejects every directive under apps, packages, tooling
and infra except one hard-coded string. scratchpad and the root vitest files
are outside its scanned roots. What survives once the gate scans everything?

**Answer.** Two schema-validated exemptions, declared in gate configuration
rather than a hard-coded string comparison:

1. `vitest.setup.ts` root Bun-compat shim (6 skip-files: nodeBuiltinImport,
   asyncFunction, newPromise, processEnv, globalTimers, globalRandom). It runs
   before any Effect runtime exists and implements `Bun.*` over node builtins.
2. `packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts`
   `strictEffectProvide:skip-file`, the effect-vitest-canon D14 provide-rule
   exception.

Everything else is fixed: 78 scratchpad directives and the 2
`nodeBuiltinImport:off` lines in `vitest.shared.ts`.

**Rationale.** "100% compliant" with two named, reasoned, machine-checked
exceptions is honest; rewriting the pre-Effect shim Effect-native would cost a
design cycle for no runtime benefit.

**Rejected.** Zero exemptions (shim rewrite). Scratchpad out of scope (leaves
the bulk of the inventory).

## D2 — tsgo 0.45.0, all 13 new rules at error, tests included

**Question.** `schemaSync` alone flags roughly 1,890 src and 1,020 test sites.
Does the "every rule is an error" doctrine hold for it?

**Answer.** Yes. Every TypeScript source in packages, apps, scratchpad and root
that the compiler reaches errors on every installed rule, tests included. No
severity below `error`, no ratchet mode, no test carve-out. schemaSync becomes
the largest remediation lane, sharded by package family (D8).

**Rationale.** The 2026-08 tsgo 0.33 campaign already settled "fix everything,
no parking" and the gate encodes it. Test files migrate to the effect-vitest
canon shapes (`it.effect` plus `Schema.decodeUnknownEffect`), which that
packet already ratified.

**Rejected.** Test-glob exemption. Staged severity.

## D3 — Config keys: explicit, and the gate verifies key-set parity

**Question.** The 0.45 plugin reads `allowedDuplicatedPackages`,
`barrelImportPackages`, `extendedKeyDetection`, `keyPatterns`,
`layerGraphFollowDepth`, `noExternal`, `pipeableMinArgCount`,
`topLevelNamedReexports`, `strings`, `overrides`, and more. The repo sets
none of them.

**Answer.** Set every key the installed compiler reads in
`tsconfig.base.json`, each with a one-line comment stating the chosen value
and why. Extend `beep quality tsgo-rules` to fail when the configured key set
drifts from the installed compiler, next to the existing severity parity.

**Rationale.** An unset key runs at whatever upstream decides this release,
which is the same silent drift the severity map was built to prevent.
`importFromBarrel` and `duplicatePackage` are inert without their keys.

**Rejected.** Only rule-activating keys. Severities only.

## D4 — annoteError: delete the hook, invert the lint, re-prove

**Question.** `$I.annoteError` installs `toEquivalence:
adoptDeclaredFieldsEquivalence` at 503 call sites (plus `annoteClass`, 4).
Upstream now does this by construction. How far does retirement go?

**Answer.** Delete `adoptDeclaredFieldsEquivalence` and its two uses in
`packages/foundation/modeling/identity/src/Id.ts` (lines 96, 118, 1910 at
main `23f3919`). Invert `SFV4-tagged-error-equivalence` in
`SchemaFirstDetectors.ts` from "must declare fields-only equivalence" to
"must not declare a redundant `toEquivalence` on a Schema class". Re-run the
60-seed decode/encode measurement on `packages/drivers/doc-text` under Bun as
the proof. Zero edits at call sites.

`Schema.Defect` is still `decodeTo<Unknown, Json>` in rc.115, so the
`@beep/schema` `Opaque.Defect` always-true wrapper stays (see D10).

**Rationale.** The hook now encodes a false premise; a lint rule that demands
it will teach agents the wrong thing on every new error class.

**Rejected.** Drop the lint entirely (no guard against re-adding the ritual).
Keep the hook one more RC.

## D5 — Match: whole repo, rule card, and a repo lint law

**Question.** PR #1060 turned 63 `tagsExhaustive`, 33
`discriminatorsExhaustive`, 15 `tags`, 8 `discriminators` into 314 `tag`, 194
`discriminator`, 76 `exhaustive` across 66 files. The repo also has 974
`Match.when` calls. Scope, and how do we stop recurrence?

**Answer.** Audit every Match site in packages, apps and scratchpad against
the Match rule card (`ops/rule-cards/match-combinators.md`). Ship a repo lint
law in the repo-cli `Lint` family that flags chain shapes: consecutive
`Match.tag` calls closed by `Match.exhaustive`, consecutive
`Match.discriminator` calls closed by `Match.exhaustive`, `Match.when` on a
literal `_tag` predicate, and `Match.type<T>()` pipelines that could be
`Match.typeTags`. The law lands in the same PR as the Match lane so main is
never red.

**Rationale.** The regression was behavioral, not a compiler workaround. Only
a gate stops behavior.

**Rejected.** Only the 66 files. Upstream-first diagnostic (kept as a
non-blocking follow-up in D10).

## D6 — PR strategy: remediate first, ratchet last

**Question.** The moment 0.45 lands with 13 new rules at error, main is red
until ~3,000 sites are fixed. How do PRs land?

**Answer.**

1. **PR A, foundations at 0.39.1:** annoteError retirement and inverted lint
   (D4), the declared-exemption allowlist mechanism (D1) with the scanned
   roots unchanged, key-set parity in the gate for the keys 0.39.1 reads (D3),
   packet files. *Amended 2026-09-12 during P1:* widening the scanned roots
   to `scratchpad` and the repository root is owned by the S01 lane PR,
   because `vitest.shared.ts` needs a generated include file rather than a
   directive fix; the ratchet PR only confirms the widened roots.
2. **Lane PRs to main,** each green on today's gate: schemaSync shards by
   family, Match plus its lint law, scratchpad directives, the small-rule
   bundle, `vitest.shared.ts`. Lanes see the new diagnostics through a
   worktree-local `@effect/tsgo@0.45.0` install that is never committed.
3. **Final ratchet PR:** bump `@effect/tsgo` to 0.45.0, add the 13 rule ids at
   `error`, set the remaining config keys, widen scanned roots, regenerate the
   diagnostics inventory. Main is never red.

**Rationale.** Stacked branches skip required checks here; a temporary
allowance count would add a ratchet mode the gate does not have and the
doctrine rejects.

**Rejected.** Integration branch train. Bump-now with temporary allowances.

## D7 — Home: goal packet `tsgo-045-effect-idiom-sweep`

**Answer.** This packet. The WebStorm scratch file is preserved as
`research/origin-prompt-2026-09-12.md`; the improved prompt is
`ops/prompts/00-orchestrator.md`.

**Rejected.** Exploration packet first (scope already crisp). Scratch file
only (no durable record).

## D8 — Worker shape: rule cards once, fixers sharded by package family

**Answer.** Discovery agents author one rule card per diagnostic from the
effect and tsgo clones (idiom, before/after, when not to rewrite, gotchas,
verification). Fixer workers own one shard (`ops/shards.json`) with the
relevant cards injected. Match and annoteError keep single dedicated workers.
Independent verifiers re-run the diagnostics and package verification per
shard.

**Rejected.** One worker per rule repo-wide (schemaSync does not fit a
context window). One worker per package with all rules.

## D9 — Done is gate-defined

**Answer.** Done means: `beep quality tsgo-rules` green at 0.45.0 with widened
roots and the two-entry allowlist; `quality:check` green; the Match shape law
green with an empty baseline; the annoteError proof green; zero
`@effect-diagnostics` directives outside the allowlist. Idioms tsgo cannot
detect go to `research/OPPORTUNITIES.md` as follow-ups, never into fixer
scope.

**Rejected.** One extra idiom-audit lane. Open-ended idiom review.

## D10 — Two non-blocking upstream tasks

**Answer.** (1) An effect issue or PR giving `Schema.Defect` a
`representation` so `causeEquivalence` stops using `Equal.equals` over
payloads. (2) After the repo law proves the pattern, propose the Match
chain-to-`tagsExhaustive` shape to tsgo as a diagnostic. Neither blocks the
sweep or its close.

## D11 — Compute: fan-out runs now; Codex is back as the volume pool

**Answer.** Benjamin holds four Max 20x Anthropic seats, and on 2026-09-12
(mid-grill) added a second ChatGPT subscription, so the Codex pool is
available again (`codex login status` confirms; `$HOME/.codex/config.toml`
defaults to `gpt-6-astra` at `medium`). The Grok build balance remains
exhausted. Lanes run now. The standing routing doctrine applies again:
token-heavy work goes to Codex, judgment stays on Fable.

## D12 — Child model seats

**Answer, as amended after the Codex seat arrived.**

- Orchestrator, judge, git: Fable in this session.
- Fixer shards, rule-card discovery, verifiers: `codex exec` lanes on
  `gpt-6-astra` with `medium` reasoning (repo AGENTS.md default), using the
  proven worktree recipe (`ops/prompts/60-codex-lane.md`).
- Native Workflow children, if any are needed for a seat Codex cannot fill:
  `claude-fable-5-1`. Benjamin authorized Fable children before the Codex
  seat arrived; that authorization stands but is no longer the default.

The 2026-09-03 "never Fable children" feedback therefore stays in force for
routine work. It is relaxed only when no non-Anthropic pool is available.

## D13 — Cursor subscription as an additional child pool

**Question (raised mid-grill).** Benjamin has a lightly used Cursor
subscription and wants it drained by sub-agents.

**Answer.** Cursor is a headless Bash lane, not a proxy provider.
`cursor-agent` (alias `agent`) is installed and logged in; it supports `-p`
print mode, `--output-format stream-json`, `--model`, `--trust`, `--force`,
and `--sandbox`. Its catalog includes `claude-fable-5-thinking-xhigh`,
`claude-opus-5-thinking-*`, `gpt-5.6-sol-xhigh`, `gpt-5.3-codex-xhigh`, and
`cursor-grok-4.6-xhigh`. CLIProxyAPI has no Cursor provider (the only
"cursor" hits in its source are CSS strings), so the proxy route is out.

The recipe lives in `ops/prompts/50-cursor-lane.md`. A P1 smoke test
(write a file, run `bun run beep --help`, prove `git` is never invoked) gates
its use. Once green, Cursor is the second volume pool beside Codex: alternate
shards between `codex exec` (gpt-6-astra medium) and the Cursor lane
(`gpt-5.6-sol-xhigh` or `claude-fable-5-thinking-xhigh`) so both
subscriptions drain. Note the Cursor catalog marks the Fable seats "NO ZDR".

**Rejected.** Adding Cursor to CLIProxyAPI (no upstream provider exists).
