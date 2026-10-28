# Exact optional schema keys Spec

## Objective

Migrate S.optional, S.withDecodingDefault and S.OptionFromOptional fields to their exact *Key siblings with a tested codemod, and guard it with an EF-40 GritQL law

## Non-Goals

- `.repos/**` reference checkouts and generated `dist/**` output.
- `S.UndefinedOr`, `S.NullOr`, `S.NullishOr` and their `Option*` decoders: explicit unions stay legal.
- Non-schema `optional` helpers (`Flag.optional`, `Config.option`, ...).
- Upstreaming anything to Effect.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Every Biome-linted TypeScript file (src, tests, fixtures, `scratchpad/`) that references
  `S.optional`, `S.withDecodingDefault` or `S.OptionFromOptional` (any `effect/Schema` alias).
- `packages/tooling/tool/cli/src/commands/Lint/internal/` — new `exact-optional-keys` rule in
  the SchemaParityCodemod engine, plus tests.
- `packages/tooling/policy-pack/lint-rules/rules/prefer-exact-optional-key.grit`, its tests,
  and its `biome.json` plugin registration.
- `standards/effect-first-development.md` (new EF-40, EF-2/EF-17 amendments),
  `.claude/skills/schema-first-development/**`, `.patterns/**` where they cite the banned forms.

## Constraints

- Detection is by reference, not by context: any member reference to the banned
  `effect/Schema` exports (call, pipe argument, `Struct.map` argument, tuple element,
  hoisted field object, type position) is a hit. Exhaustiveness proof = the codemod's
  type-resolved census, the rg census and the Biome rule's hits all agree, before
  (N) and after (0, except ledgered `UndefinedOr` exceptions which do not match).
- Codemod output: `optional`→`optionalKey`, `withDecodingDefault`→`withDecodingDefaultKey`,
  `OptionFromOptional`→`OptionFromOptionalKey`, in value and type positions, plus
  `| undefined` removal from the paired hand-written `declare namespace X { Encoded }` member.
  Unpaired residue is reported, never silently skipped.
- Genuine undefined producers (third-party objects) become `S.optionalKey(S.UndefinedOr(X))`
  by hand, each with evidence in `research/classification-ledger.md`.
- Construction sites broken by the stricter types follow the governing EF-2 /
  EF-40 idiom `O.getSomesStruct({ x: O.fromUndefinedOr(x) })`, which omits absent
  keys. No `as` casts and no `biome-ignore` of the new rule.
- All affected packages are `private: true` and changesets skip private packages: no changeset.

## Acceptance Criteria

- [x] `beep lint schema-parity-codemod --rule exact-optional-keys` dry-run reports 0 rewrites and 0 residue on the branch.
- [x] The rg census and the Biome rule both report 0 hits outside ledgered exceptions.
- [x] `prefer-exact-optional-key.grit` runs at severity error and fails on fixtures for every banned form (recall), with no hit on `optionalKey`, `withDecodingDefaultKey`, `OptionFromOptionalKey`, `optionalKey(UndefinedOr(X))` or `Flag.optional` (precision).
- [x] The rule fails the hosted Biome lint job on a planted violation (proved locally via the same command the CI lane runs).
- [x] EF-40 is in `standards/effect-first-development.md` and the schema-first repo-laws; EF-2/EF-17 no longer sanction `OptionFromOptional`.
- [x] Typecheck, tests and package-verify pass for touched packages, or unrelated failures are reproduced and recorded separately under the user goal's explicit allowance; see `research/package-verification-2026-10-28.md`.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/exact-optional-keys/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/exact-optional-keys/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/exact-optional-keys` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-23 | Scope covers `S.optional`, `S.withDecodingDefault` and `S.OptionFromOptional` under one law | Same `\| undefined`-admitting shape; one exhaustive pass (grill R1) | Narrow the grit rule's pattern list and revert the per-form codemod rewrites |
| 2026-10-23 | Exceptions are spelled `S.optionalKey(S.UndefinedOr(X))`; the law bans only the implicit shorthand | Same semantics, explicit and greppable; no suppression comments (grill R1) | Allow `biome-ignore` suppressions on the rule |
| 2026-10-23 | Codemod is a registered rule `exact-optional-keys` in the SchemaParityCodemod ts-morph engine | Consistency with the existing type-directed codemod (dry-run, residue, format) (grill R1) | Delete the rule module and its registry entry |
| 2026-10-23 | Detection bans the reference anywhere; law covers every Biome-linted file incl. tests and scratchpad | Context-free, so hoisted field objects need no binding analysis (grill R1) | Add `includes` exclusions to the plugin registration |
| 2026-10-23 | Codemod always emits the exact form; exceptions are hand-converted with evidence | Removes the anti-pattern instead of renaming it (grill R2) | Re-run with an allowlist emitting `UndefinedOr` |
| 2026-10-23 | Codemod also rewrites paired hand-written `Encoded` namespace members and type-position refs | Declared and derived types must not drift (grill R2) | Restrict the rule to value positions |
| 2026-10-23 | New law EF-40 "Optional fields use exact keys"; grit rule `prefer-exact-optional-key.grit` at error | Distinct from EF-17's Option decoding (grill R2) | Remove EF-40 and the plugin registration |
| 2026-10-23 | One PR from lane `refactor/exact-optional-keys` off origin/main | Operator request: migration + law ship together (grill R2) | Revert the squash commit |
| 2026-10-23 | No changeset | Every affected package is private; `privatePackages.version: false` | Add changesets if a package goes public |
| 2026-10-23 | schema-org drops its documented `Schema.optional` exception | No src caller passes `undefined` to a node (repo-wide typecheck after the rewrite); evidence in `research/classification-ledger.md` | Restore `S.optionalKey(S.UndefinedOr(X))` on `ThingFields` and the README sentence |
| 2026-10-23 | jsonl config and slice keys become exact; D15 recorded as kept deviation 24 | Upstream parity is a choice, not an undefined producer; the operator asked for every instance | Revert to `optionalKey(UndefinedOr(X))` and restore the D15 pins |
| 2026-10-23 | Option-valued exception spelled as an explicit local helper (`OptionFromLexicalUndefinedOr`) | `S.OptionFromOptionalKey(S.UndefinedOr(X))` would decode `undefined` to `Some(undefined)`; the helper mirrors upstream `OptionFromOptional` without the banned symbol | Replace with `S.OptionFromOptional` under a rule exemption |
| 2026-10-23 | `ApiTransportDurationObject` keeps `UndefinedOr` | It mirrors effect's `Duration.DurationObject`, whose members admit `undefined` | Make exact once effect's `DurationObject` does |
| 2026-10-23 | FileDiff's `optionalUndefined` helper deleted | Its only purpose was decoded-side `undefined` | Restore the helper from `9e3aff5de8^` |
| 2026-10-23 | Publish past the cheap-gate `fallow:audit` red; attribute it under S11 | 19 duplication groups are pre-existing clones the codemod rename touched (0 hand-edited files; receipt in `research/OPPORTUNITIES.md`); operator ruling | Add reasoned `fallow-ignore-next-line code-duplication` suppressions, or land the dedupe follow-up first |
| 2026-10-28 | Retain reproduced unrelated verification failures under the active user goal's allowance | 23 package verifiers pass; six CLI ambient-cache assertions pass in an explicit local-only control, and 443 scratchpad docgen diagnostics exactly match clean main | Re-run the default verifiers after their environment/backlog changes; retain the original failed receipts |
| 2026-10-28 | Retain `O.getSomesStruct` construction fixes under EF-2 and EF-40 | The governing standard explicitly requires this absence-preserving idiom and outranks the packet's older conditional-spread example | Restore conditional spreads only if the governing standard changes |
| 2026-10-28 | Inspect import/export source specifiers and lexical scopes | Whole-statement regexes confused exact exports renamed locally with banned exports, and imported namespace names can be shadowed | Revert the source-node and shadowing patterns with their regression fixtures |
| 2026-10-28 | Bind the GritQL namespace reference to an effect/Schema import | Acceptance probe reproduced a missed arbitrary alias and a false positive on a local S object | Revert the import-binding pattern and its regression fixtures |
| 2026-10-28 | Use closeout PR #2316 with its own retained readiness verdict | The original PR is merged and its 17 historical required checks verify, but the declared local verdict was not retained; no historical proof is fabricated | Restore the original declared verdict with independent provenance, then revert the closeout declaration |
| 2026-10-23 | Codemod pairing covers companion interfaces, not only type aliases | Lexical companions are `interface Encoded`; found on the first run, fixed in the rule and re-run from a clean tree | n/a |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
