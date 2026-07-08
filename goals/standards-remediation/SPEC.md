# Standards Inventory Zero — SPEC (normative)

This document is normative for the `standards-remediation` initiative and
outranks every prompt in `ops/prompts/` on any conflict. Training-data priors
are Effect **v3**; this repo is Effect **v4** — `.repos/effect-v4` is the only
source of truth for Effect/Schema APIs. Re-`rg` every symbol before applying it.

## Mission

Drive every `standards/*.jsonc` file that enumerates violations to **zero
items**, and tighten the gates so zero stays zero. Per item exactly one of:

1. **Code fix** (default; posture is *convert aggressively*),
2. **Detector fix** — only for outright detector bugs or residue *verified*
   unconvertible by the driver (regression-fixture pair mandatory),
3. **Stale prune** — regeneration handles this automatically.

## Scope (locked)

| File | Baseline (2026-07-07) | Zero means |
|---|---|---|
| `standards/dual-arity.inventory.jsonc` | 107 candidate + 13 exception | `entries: []`, `ENFORCED_ROOTS` → `["apps","packages","infra"]` |
| `standards/schema-first.inventory.jsonc` | 326 exception | `entries: []`, zero-entry regression fixture |
| `standards/jsdoc-documentation.inventory.jsonc` | 78 pkgs needs-remediation; 2,012 missing @example, 91 @category, 91 @since, 71 unsafe, 127 schemaAnnotation, 24 exampleImport, 2 forbidden | all packages `clean`/`no-public-src-surface`; baseline written to zeros; ratchet totals extended |
| `standards/knip.regression-baseline.jsonc` | 73 findings | empty findings baseline |
| `standards/effect-laws.allowlist.jsonc` | 17 entries | empty (verified-irreplaceable residue requires explicit user approval with driver evidence) |

## Locked decisions

- **D-A Aggressive conversion.** Interfaces→`S.Class`, `dual()` wraps, real
  compiling doc examples. Detector-scope changes are the last resort and only
  after the driver has personally verified unconvertibility.
- **D-B One umbrella PR** on branch `standards-remediation`. Waves land as
  commits pushed to the draft PR; merge only at zero.
- **D-C Verdict-challenge rule.** No codex claim of
  "justified/unconvertible/false-positive" is accepted unreviewed: the driver
  reads the code and attempts the conversion or a counter-example personally.
  Only driver-confirmed rulings enter `research/decisions.md`; only locked
  rulings authorize a detector-scope change.
- **D-D One writer per package** at any instant. JSDoc mega-packages shard by
  disjoint file sets; barrels belong to exactly one shard.
- **D-E Driver owns** `standards/*.jsonc`, baselines, inventory regeneration,
  repo-wide proofs, commits, and pushes. Lanes never touch them.

## Fences (hard constraints)

The nine crispening fences apply verbatim
(`goals/repo-crispening-orchestration/ops/prompts/remediation.agent.md`,
"The nine fences") **with one amendment**: fence 1 (service-contract carve-out)
and fence 7 (no native-collection migration) are *suspended where a locked
ruling in `research/decisions.md` says so* — this initiative's P7 explicitly
challenges the native-runtime allowlist, and P2 rulings may authorize
schema-ifying shapes crispening left alone. Absent a locked ruling, the fences
bind.

Additional fences:

10. Lane fixers edit ONLY their assigned package/file-set. They NEVER edit
    `standards/*.jsonc`, any `*.regression-baseline.jsonc`, other packages,
    `.repos/**`, or generated files. (Unlike crispening, inventory bookkeeping
    is driver-owned — do not update ledgers from a lane.)
11. Detector changes (`packages/tooling/tool/cli/**`,
    `packages/tooling/library/repo-utils/src/TSMorph/**`) never mix with mass
    code fixes in one commit, and always ship a regression-fixture pair
    (still-fires case + newly-excluded case).
12. Lanes run package-scoped proofs only. No repo-wide `turbo run`, no
    `yeet`, no inventory regen from a lane (turbo-daemon contention; driver
    serializes global proofs).
13. Never weaken a detector, test, fixture, or gate to make a finding pass.
14. Examples/documentation must be real: compiling `@example` blocks that show
    observable behavior; prose that restates a signature is a defect, and
    deleting a flagged example instead of fixing it is a defect.

## Rule cards

### RC-DUAL — dual-arity fixes

Law EF-18: public 2–3-param reusable helper combinators implement `dual` from
`effect/Function`. Fix table by diagnostic:

- `missing-dual` → wrap with `dual(n, (self, ...) => ...)`; data-first call
  sites keep working (dual adds the data-last overload). Keep pipeable
  first-param names (`self|that|value|input|source|effect|schema|...`).
  Same-package call-site sweep + dtslint/test updates in the same lane.
- `invalid-dual-source`/`invalid-dual-arity` → import `dual` from
  `effect/Function` with the correct arity literal.
- `third-param-not-object-like` → collapse trailing params into an options
  object, or restructure to arity 2. Signature break ⇒ ripple protocol.
- `too-many-positional-params` → options-object redesign. Signature break ⇒
  ripple protocol.
- A candidate whose first param is non-pipeable (`message`/`options`/`config`/
  `status`/`severity`-shaped) or that is a constructor factory → report
  `disposition: detector-bug?` with evidence; do not force a bogus dual.

### RC-SF — schema-first conversions

Doctrine: `.claude/skills/schema-first-development` + crispen ladder. The
entry's recorded exception `reason` is a hypothesis to *invalidate*: convert
the shape so the detector stops seeing it. Known moves: exported pure-data
interface/type-literal → `S.Class`/named schema; extends-repo-local →
`S.Class` field spread or `S.extend`; inline nested `S.Struct` → extracted
named class; dictionaries → `S.Record`; SFV4 advisories → resolve the
underlying issue. Every schema change carries the crispening §5.3 parity
proof: byte-identical encoded/wire snapshot + one `S.toArbitrary` round-trip
law per absorbed invariant. Truly generic/function-member shapes: attempt the
conversion anyway on your assigned entries; if it cannot preserve the public
contract, report `disposition: unconvertible` with the failed-attempt diff as
evidence (driver will challenge it).

### RC-JSDOC — documentation fixes

Required per exported symbol: `@example` (compiling, observable result),
`@category` (reuse the file's existing taxonomy), `@since`. Forbidden:
`@module`, `@template` (use `@packageDocumentation`, `@typeParam`). TSDoc
rules per `.patterns/jsdoc-documentation.md`: no `{type}` blobs; `@param name
- desc` hyphen form; no fake examples on barrels (re-exports are exempt after
P1). Examples: no `any`/type assertions/`declare`; import from the package's
public entrypoint with required namespace aliases; real Effect v4 patterns.
`schemaAnnotationGaps`: add `export type X = typeof X.Type` aliases and
`$I.annote`/`$I.annoteSchema` per the jsdoc-annotation-specialist skill.
Proof per lane: `turbo run docgen --filter={{PACKAGE_NAME}}`.

### RC-KNIP — knip findings

`unused files` → delete (verify nothing imports them, including scripts and
configs); `unused exports/types` → delete the export or wire a real consumer;
`unresolved` → fix the import/path; `dependencies/devDependencies` → remove
from the package manifest (verify no dynamic/config usage first); `binaries`
→ correct the script or add the dependency. "Must keep" claims require
evidence and get driver-challenged.

### RC-ALLOWLIST — native-runtime conversions

Attempt: `new Map/Set` → `MutableHashMap`/`HashMap`/`HashSet`/`MutableHashSet`;
native `Error` subclass → `Data.TaggedError`; `Date.now`/`new Date` →
`Clock`/`DateTime`; object-method escapes → effect helper modules. WeakMap/
WeakSet GC semantics have no effect-native equivalent — if the weak semantics
are load-bearing, prove it (heap-growth or lifecycle argument) and report
`disposition: unconvertible`; the driver verifies and, if confirmed, escalates
to the user before anything remains.

## Verified API Corrections (embed in every fixer lane)

| Claim your training data makes | Verified v4 / repo reality |
|--------------------------------|----------------------------|
| `EffectSchema` is a value/schema | **`EffectSchema` is a FACTORY** — call it to build the schema. |
| `PromiseSchema` is a factory | **`PromiseSchema` is a VALUE.** |
| `.implement` returns a plain function | Use the split: **`.implementSync`** (sync fn), **`.implement`**, **`.implementEffect`** (Effect-returning) — check the signature at the definition, do not assume. |
| LiteralKit and MappedLiteralKit share an API | **API split:** `LiteralKit([...])` → `.Options`/`.Enum`/`.is`/`.$match`/`.toTaggedUnion`; `MappedLiteralKit` → `.From.Enum`/`.To.Enum` reversible code map. Numeric/boolean literal keys are stringified (`.Enum.number1`). |
| `Option.getSomes` exists on `effect/Option` | **It does not.** The struct form is repo-added: `O.getSomesStruct` at `packages/foundation/modeling/utils/src/Option.ts:102` (re-exported via `@beep/utils` aliases). `R.getSomes` (from `effect/Record`) is the homogeneous-dictionary form. |
| `S.TaggedUnion` / `S.toTaggedUnion` interchangeable | **Distinct:** `S.TaggedUnion` constructs; `.toTaggedUnion` derives from a kit. Verify per call site. |
| `annotations` always present on AST nodes | **`annotations` needs `?.`** — optional access. |
| v3 combinators (`Effect.catchAll`, `Schema.decode`, …) | v3 tells. Use v4 forms (`S.decodeUnknownEffect` / `S.decodeEffect`, `Effect.catch`, current error-handling combinators). |

## Lane report contract

Every lane writes
`goals/standards-remediation/ops/reports/{{WAVE_ID}}/{{SANITIZED_LANE}}.md`
(the only permitted write outside its package fence) containing: a per-entry
disposition table (`fixed | unconvertible | blocked | detector-bug?` + reason
+ evidence refs), files touched, commands run with outcomes — and ends its run
by printing a ≤10-line summary. Non-`fixed` dispositions queue for the
driver's verdict-challenge (D-C).

## Verification matrix

| Level | Command(s) | Who | When |
|---|---|---|---|
| Package | `turbo run build check test docgen --filter=<pkg>` + `npx vitest run` inside the package dir (root globs miss depth-4 packages) | lane | before reporting |
| Inventory regen | `beep laws dual-arity --write` / `beep lint schema-first --write` / `beep quality jsdoc-inventory` | driver | after collect, serialized |
| Gates | `beep laws dual-arity --check` · `beep lint schema-first` · `beep quality jsdoc-ratchet` (+ `--write-baseline` when improved) · `beep quality knip` · `beep laws allowlist-check` | driver | per wave |
| Wave proof | `TURBO_FORCE=true turbo run build check test docgen --filter=<touched>...` then `bun run beep ci local --fast` | driver | before commit |
| Full battery | `TURBO_FORCE=1 bun run lint` · full `bun run beep ci local` · `bun run beep yeet verify` | driver | P8 |

Never run manual `turbo`/`docgen`/`vitest` while a background verify/turbo run
is in flight (daemon contention → spurious failures).

## Stop conditions

Halt the wave, record the blocker in `ops/progress.json`, and report when:
a §5.3 parity proof fails; a ripple sweep would exceed the assigned scope; any
fence would be violated; the branch base is red for out-of-scope reasons; the
same blocker repeats after reasonable investigation; verification would need
credentials/cost/destructive side effects not named here. Max 2 red hosted-CI
rounds per wave push before the wave is split.

## Definition of Done

1. All five scope files at zero items; clean-checkout regeneration of all five
   produces no diff; all gates green.
2. Enforcement flips landed with fixtures: dual-arity `ENFORCED_ROOTS` repo-wide;
   exception entries require non-empty `issue`; schema-first zero-entry fixture
   (new violation fails bare check, empty inventory stable under `--write`);
   jsdoc baseline zeros + `JSDocRatchetedTotalName` extended with
   `exampleImportFindings`, `forbiddenTagFindings`,
   `malformedConditionalTagFindings` (evaluate `openModules`/`openExports`).
3. Full `bun run beep ci local` green; umbrella PR flipped from draft and merged
   via `yeet publish`/`monitor`.
4. Packet closed: `/reflect` reflection passing
   `bun run beep lint reflection-artifacts`;
   `goals/schema-first-zero-actionables` cross-closed.
