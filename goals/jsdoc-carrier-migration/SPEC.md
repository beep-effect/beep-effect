# SPEC — JSDoc Legacy Carrier Migration

Packet anchor document. Binding for this initiative.

## 1. Problem

`Check / JSDoc Ratchet` fails on most source-touching PRs. The cause is **not** totals growth.

PR #563, run `31067721557`:

```
[jsdoc-ratchet] ok: tracked=20 increased=0 current_totals=31   <- totals PASSED
[jsdoc-ratchet] cleanup-on-touch: 2 changed source file/tag finding(s)
JSDoc cleanup-on-touch gate failed.                             <- actual failure
```

`enforceTouchedFileCleanup` in
`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts` exits 1 when any
changed non-generated `packages/**/src/**/*.{ts,tsx}` file contains `@example` or `@remarks`.
It scans the **entire file**, not the diff hunk, across `origin/main...HEAD` plus dirty paths.

**1,935 of 2,565 source files (75%) carry a legacy carrier.** Touching almost anything demands
migrating that file's whole documentation surface as an unrelated side quest.

A secondary effect compounds it: agents read the corpus as exemplars, and ~93% of it demonstrates
the retired carrier. The strict JSDoc law is agent-facing, so a non-compliant corpus actively
teaches non-compliance. There is therefore **no ranked subset** — internal tooling packages carry
the same bar as `shared/*`.

## 2. The law contradicts the gate

`.patterns/jsdoc-documentation.md:54-68` has three defects:

1. `:56` — "a legacy `@example` tag remains grandfathered" reads as permission; the gate treats
   it as blocking.
2. `:65-68` — "Phase P2 of `goals/effect-jsdoc-quality/` adds the changed-files check ... Until
   then, cleanup-on-touch is review law, not a claim about the current gate's granularity" is
   **stale**. P2 shipped, that packet is `completed-retained`, and the gate has exactly that
   granularity today.
3. `:58` — "do not mass-migrate untouched files" **prohibits this initiative**. P0 must authorize
   it before P3 can legally land.

Root `AGENTS.md` already states the final rule ("never `@example` or `@remarks` tags"). The
`.patterns/` law is the surface that disagrees with both the gate and `AGENTS.md`.

## 3. Facts that make this tractable

**Both carriers already compile.** `packages/tooling/tool/docgen/src/Core.ts:360-376` extracts
`descriptionExamples` (fences inside `**Example**` sections) *and* `exampleTagExamples`
(`@example` tags), concatenates them, and compiles both. Moving a fence from a tag into a titled
section is **compile-neutral**. The ~13,500 legacy examples are already under the docgen
TypeScript gate; conversion does not detonate a wall of new compile errors.

**The gate scorer doubles as the codemod's oracle.** `documentationShapeViolations`
(`JSDocDocumentationInventory.ts:439`, module-private) is the exact function the ratchet scores
with. Running it per block before and after makes "did this rewrite make the block worse" a
decidable property rather than a review hope.

**Inserting a section moves the lead boundary.** `JSDocDocumentationInventory.ts:453` computes
`firstSectionLine`; with no `**Section**` markers the "lead" is the entire body, so any internal
blank line fires `multiple-description-paragraphs`. Section insertion can therefore *clear*
findings, not only add them.

**No collision hazards exist.** Zero blocks mix `@remarks` with an existing `**Details**` or
`**Gotchas**`, and zero mix `@example` with an existing `**Example** (`. Title uniqueness binds
on 19 blocks repo-wide.

Full measurements and reproduction commands: `research/corpus-census.md`.

Every count in this packet is a snapshot stamped to a commit, currently `dbbad11e15`. The corpus
shrinks on its own — cleanup-on-touch makes ordinary PRs retire carriers as a side effect, and
340 examples went that way in a single day without anyone targeting them. Re-measure before P3
and never quote a count without its commit. Two figures have not moved and are not expected to:
the 19 multi-example blocks and the 114 unfenced examples, which is precisely why they are the
cases the codemod must handle explicitly.

## 4. Scope

**In scope.** Carrier retirement across every non-generated `packages/**/src/**/*.{ts,tsx}` file;
deterministic grammar fixes (`@template`→`@typeParam`, `@module`→`@packageDocumentation`,
`@default`→`@defaultValue`, `{type}` blob removal, `@returns`/`@throws` hyphen, canonical tag
order); lead-paragraph splitting; `@see` purpose phrases; repo-owned generator templates; the
gate swap; the totals baseline rewrite; the law's final state.

**Out of scope.** Rewriting lead descriptions for quality, making non-observable examples
observable, or any change to example *code*. Prose and code are preserved verbatim. This is
carrier retirement, not a documentation quality rewrite.

## 5. Contracts

### 5.1 Command surface

`beep quality jsdoc-migrate`, colocated in `commands/Quality/internal/` inside
`packages/tooling/tool/cli`:

| subcommand | contract |
| --- | --- |
| `extract` | emits `extract.jsonl`, one record per affected doc block |
| `titles` | calls `http://127.0.0.1:8317` with model `grok-4.5`, appends `titles.jsonl` |
| `apply` | rewrites files, conservation-checked, quarantines on violation |
| `verify` | emits the proof manifest and the residue report |

Analysis uses ts-morph (symbol identity, kind, anchor). The **rewrite is text-surgical by byte
offset** — ts-morph must never reformat a block, or byte conservation becomes unprovable.

`documentationShapeViolations` is exported **within** the package. It does not become a
cross-package public surface.

### 5.2 Data files

The only non-code inputs. Frozen and versioned once P3 opens.

```jsonc
// titles.jsonl — one record per block
{ "anchor":     "packages/x/src/Y.ts#decodeUserName#0",
  "sourceHash": "sha256:1f3a…",       // hash of the ORIGINAL block bytes at extract time
  "kind":       "value",              // value | type-level, from ts-morph
  "title":      "Decode a user name",
  "remarks":    "details" | "gotchas", // routing for the 501 @remarks blocks
  "leadEnd":    1 }                    // paragraphs 2..n -> Details, for the 872

// overrides.jsonl — full replacement block text for quarantined blocks
{ "anchor":     "packages/x/src/Y.ts#thing#0",
  "sourceHash": "sha256:9c02…",       // same verification fields as titles.jsonl
  "kind":       "value",
  "block":      "/** ... */" }
```

Both files carry `anchor`, `sourceHash`, and `kind`. The binding rule below applies to **every**
frozen record regardless of which file it came from — an override is a hand-authored replacement
block, so applying one to the wrong declaration is exactly as damaging as a mis-bound title, and
the `kind` check is what stops a value-level replacement landing on a type-level companion.

#### Anchor format

`path#symbol#ordinal`. The **anchor** is never a content hash and never a line number — anchor
stability across upstream edits is what makes the P3 branch re-derivable.

`path#symbol` alone is **not unique**. Overloads, declaration merging, default exports, and —
most commonly in this repo — same-name type companions for runtime schemas all produce multiple
documented declarations sharing one name. `§Kind-split Example law` names that companion pattern
explicitly, so `export const Foo` and `export type Foo` in one file would both anchor to
`path#Foo`.

`ordinal` is the 0-based index among blocks resolving to the same `path#symbol`, in source order.
It is `0` for the overwhelmingly common unique case, and it is stable under edits elsewhere in
the file (unlike a line number) and under edits to the block itself (unlike a content hash).

**Ordinals are not stable under every edit.** They shift when a same-named declaration is added
ahead of a block, removed from ahead of it, **or reordered relative to it**. Reordering is the
nastiest case: the anchor set is unchanged and the record count still matches, so nothing about
the shape of the data looks wrong — the frozen title simply binds to a different block.

#### Binding rule: fail closed, never guess

`titles.jsonl` and `overrides.jsonl` are frozen once P3 opens, so any later `extract` renumber can
mis-bind a frozen record. The conservation law **cannot detect this** — a title applied to the
wrong block is well-formed prose in a valid section and passes every assertion in §5.3. The
binding therefore has to be checked directly, not inferred.

`extract` must fail loudly if two blocks produce the same anchor. `apply` and `verify` must fail
closed unless **all** of the following hold:

1. **Bijection.** Every `extract` anchor has exactly one record, and every record matches exactly
   one `extract` anchor. Orphans on either side are a hard failure, never a skip. This catches
   additions and removals, where counts diverge.
2. **Identity.** Each record's `sourceHash` equals the hash of the block currently at that anchor.
   This catches reordering and in-place edits, where counts still match. A mismatch means the
   record is stale for that block — re-title it rather than applying the frozen value.
3. **Kind agreement.** The record's `kind` matches what ts-morph reports for the block, so a
   value-level title never lands on a type-level companion.

`sourceHash` is a *verification* field, not an addressing one. Anchors stay stable so records can
be found; hashes stay exact so a found record can be proved to belong. Using a hash to address
would break re-derivability; using one to verify is what makes freezing safe.

This composes with the regeneration model rather than fighting it: when P3 is re-derived against a
newer `main`, blocks whose documentation changed upstream fail the identity check, get re-titled,
and everything untouched reuses its frozen record.

### 5.3 Conservation law

Two clauses. Content is conserved absolutely; tag rewrites are permitted only from a closed,
enumerated allowlist.

**(a) Content conservation.** This is the clause that catches destroyed documentation.

```
ASSERT every fence's code bytes are identical
ASSERT prose tokens ⊆ after tokens
ASSERT added prose ⊆ data-sourced additions
       { "**When to use**", "**Details**", "**Gotchas**",
         "**Example** (<title>)", <see-purpose phrase> }
```

Titles and `@see` purpose phrases are additions **only** when they come from `titles.jsonl`. The
codemod never invents prose.

**(b) Tag rewrite allowlist.** A closed set. Each entry has one defined normal form.

| from | to |
| --- | --- |
| `@template` | `@typeParam` |
| `@module` | `@packageDocumentation` |
| `@default` | `@defaultValue` |
| `{type}` blob in `@param`/`@returns`/`@throws` | removed |
| `@returns - ` / `@throws - ` | hyphen removed |
| tag sequence | canonical order (§Tag order) |
| `@see {@link X}` | `@see {@link X} <purpose>` from `titles.jsonl` |
| `@example` | consumed into an `**Example** (Title)` section |
| `@remarks` | consumed into `**Details**` / `**Gotchas**` |

```
ASSERT every tag not in the allowlist is bytes-identical
ASSERT every allowlisted rewrite matches its normal form exactly
ASSERT no tag is dropped without a consuming rule above

violation -> quarantine, do not write
```

A rewrite that lands off its normal form quarantines rather than being written — the allowlist
permits *specified* transformations, not arbitrary tag mutation.

Exhaustive over all 13,265 blocks. No sampling. Results recorded in a schema-versioned proof
manifest following the existing `DocgenProofManifest` / `AcceptedProofManifest` idiom.

Conservation is computed on **post-format** bytes. Run biome first, then verify, or reflow is
misread as content mutation.

**Consequence:** adding a fence is not in either clause, so the 114 unfenced examples
auto-quarantine by construction and flow to `overrides.jsonl`. That is the check working, not a
defect.

### 5.4 Grok's role

Grok 4.5 returns **data only** and never writes a file. It is reached through the local
CLIProxyAPI at `http://127.0.0.1:8317`, which is what bills the Grok plan rather than API
credits. A direct xAI API call would defeat the purpose.

The title pass is a repo pipeline step, not a Workflow: a native Workflow caps at 1,000 agents
per run and one call per file is 1,935.

## 6. Definition of done

1. Zero `@example` and zero `@remarks` in non-generated `packages/**/src/**/*.{ts,tsx}`.
2. All 18 generated files law-compliant, proved by regenerating and scanning them in
   generated-inclusive scope — not by re-running the non-generated check.
3. Conservation proof manifest covers all blocks with zero unexplained quarantines.
4. `extract` reports zero anchor collisions, and every frozen record binds to its intended block:
   bijection with `extract`, `sourceHash` match, and `kind` agreement — no orphans, no skips.
5. `cleanup-on-touch` replaced by a repo-wide zero-legacy check with both scopes available.
6. `standards/jsdoc-totals.regression-baseline.jsonc` rewritten to the new floor.
7. `.patterns/jsdoc-documentation.md` transitional carrier section deleted.
8. The P3 branch is re-derivable: `f(main, codemod, titles.jsonl, overrides.jsonl)`.

## 7. Verification matrix

| # | Claim | Proof |
| --- | --- | --- |
| 1 | No documentation content was destroyed | Conservation law over 13,265 blocks, proof manifest |
| 2 | No block's shape regressed | `documentationShapeViolations` pre/post, finding set never grows |
| 3 | Every example still compiles | `bun run docgen` full-repo proof |
| 4 | Corpus reaches zero legacy carriers | Repo-wide zero-legacy check, **non-generated scope**, passes |
| 5 | Totals did not regress | `beep quality jsdoc-ratchet` against the rewritten baseline |
| 6 | Generated output stays compliant | Regenerate all 18, then zero-legacy check in **`--include-generated` scope** |
| 7 | No anchor collided | `extract` reports zero duplicate anchors across the corpus |
| 8 | Every frozen record bound to its intended block | Bijection with `extract`, `sourceHash` match, `kind` agreement — all three, fail closed |
| 9 | The branch is re-derivable | Re-run codemod on fresh `main`, diff against branch: empty |

Row 6 must not be proved by re-running row 4. Row 4's check is scoped to non-generated files by
construction, so re-running it after regeneration cannot observe a carrier in a generated file and
would pass vacuously. The zero-legacy check therefore needs an explicit generated-inclusive mode,
and row 6 is the only place it is used.

Rows 7 and 8 exist because the conservation law cannot detect a mis-binding: a title applied to
the wrong block is well-formed prose in a valid section and passes every assertion in §5.3. Row 7
covers collisions within a single `extract`; row 8 covers drift between a frozen record set and a
later `extract`, including the reorder case where anchors and counts both still look correct.

## 8. Hazards

- A 1,935-file diff busts turbo cache repo-wide, producing a full-matrix CI run on a chronically
  red `main`. Attribute before repairing: introduced / inherited / unrelated / environment-only.
- Greptile review of a mechanical 1,935-file diff is theater. The real review target is P1.
- The P3 branch is **regenerated, never rebased**. One hand-edit forfeits that property and
  returns you to rebasing a 1,935-file diff. Residue fixes therefore go in `overrides.jsonl`.
- The changeset gate counts `--since=origin/main` and fails on uncommitted changesets; P3 spans
  ~96 package-family buckets.
- The docgen proof manifest goes stale on a change this size and must be regenerated in P3.
