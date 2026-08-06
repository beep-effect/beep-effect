# Sources

Every load-bearing claim in this packet, with its citation. Verified 2026-08-06 against `main`
at `680a862a8e`.

## The gate

| claim | source |
| --- | --- |
| The failing check is `enforceTouchedFileCleanup`, not the totals ratchet | PR #563, run `31067721557`: `[jsdoc-ratchet] ok: tracked=20 increased=0` followed by `cleanup-on-touch: 2 changed source file/tag finding(s)` and `JSDoc cleanup-on-touch gate failed.` |
| The gate scans the whole file, not the diff hunk | `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts` — `touchedFileFindings` reads each changed file and tests `A.contains(tags, tag)` |
| Change set is `origin/main...HEAD` plus dirty | same file — `collectChangedPathsSinceBase(repoRoot, "origin/main...HEAD", ...)` appended with `collectDirtyPaths` |
| Forbidden carriers are exactly `@remarks` and `@example` | same file — `JSDocTouchedFileLegacyTag = LiteralKit(["@remarks", "@example"])` |
| Generated files are excluded from the touch gate | same file `:452-455` — `isGeneratedSourceFile` matches `.generated.ts`, `/_generated/`, `/generated/`; plus `hasGeneratedFileHeader` probing the first 512 bytes for `GENERATED FILE` |
| Ratchet comparison is fail-on-growth per metric | `standards/jsdoc-totals.regression-baseline.jsonc` — `"comparison": "fail-on-growth: ..."`, 20 tracked totals |

## The inventory and its detectors

| claim | source |
| --- | --- |
| `documentationShapeViolations` is the gate's scorer and is module-private | `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:439` — declared `const`, not exported |
| The "lead" is everything before the first section marker | same file `:453` — `firstSectionLine = hasNewStyleSections ? A.headNonEmpty(sections).lineOffset - 1 : bodyLines.length` |
| `multiple-description-paragraphs` fires on any blank line strictly inside the lead | same file `:467-469` — `A.some(A.drop(A.dropRight(trimmedLead, 1), 1), Str.isEmpty)` |
| `forbidden-remarks` fires on the tag's presence | same file `:449-451` |
| `undescribed-see` requires a purpose phrase after the link | same file `:444-448` — `/^\{@link\s+[^}]+}\s+\S/` |
| The inventory does **not** exclude generated files | same file — no `isGeneratedSourceFile` or header probe anywhere in it |

## Docgen

| claim | source |
| --- | --- |
| Both carriers are extracted and compiled | `packages/tooling/tool/docgen/src/Core.ts:360-376` — `descriptionExamples` from the description, `exampleTagExamples` from `doc.examples`, then `A.appendAll` into one file list |
| Description-carried fences are a supported, regression-tested path | `packages/tooling/tool/docgen/test/fixtures/section-example/src/index.ts` — "Regression fixture for description-carried Example compilation" |
| Example filenames index per symbol | `Core.ts:341-352` — `uniqueExamplePath`; combined with zero mixed-carrier blocks, index 0 stays index 0 |
| A proof-manifest idiom already exists | `packages/tooling/tool/docgen/src/ProofManifest.ts` — schema-versioned, fingerprinted, `current \| missing \| stale`; and `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts` |

## The law

| claim | source |
| --- | --- |
| Legacy tags described as "grandfathered" | `.patterns/jsdoc-documentation.md:56` |
| Per-file check described as future work | `.patterns/jsdoc-documentation.md:65-68` — "Phase P2 of `goals/effect-jsdoc-quality/` adds the changed-files check ... Until then, cleanup-on-touch is review law, not a claim about the current gate's granularity" |
| That phase already shipped | `goals/effect-jsdoc-quality/ops/manifest.json` — `"status": "completed-retained"`, `"lifecycle": "completed-retained"` |
| Mass migration is currently prohibited | `.patterns/jsdoc-documentation.md:58` — "do not mass-migrate untouched files" |
| `AGENTS.md` already states the final rule | root `AGENTS.md` Code Laws — "never `@example` or `@remarks` tags" |

## Grok routing

| claim | source |
| --- | --- |
| `claudeg` selects Grok 4.5 through the local proxy | `~/.zshrc:161-163` — `claudeg() { _claude_proxy claude --model 'grok-4.5' "$@" }` |
| The proxy is an Anthropic-compatible endpoint on `127.0.0.1:8317` | `~/.zshrc:149` — `ANTHROPIC_BASE_URL=http://127.0.0.1:8317`; `~/.cli-proxy-api/config.yaml` — `host: "127.0.0.1"`, `port: 8317` |
| The proxy fronts personal OAuth credentials, so it bills the plan | `~/.cli-proxy-api/config.yaml` header — "this proxy fronts personal OAuth credentials"; `routing.strategy: fill-first` over admitted OAuth credentials |
| A Workflow cannot host one call per file | Workflow tool contract — 1,000-agent lifetime cap per run; the corpus is 1,965 files |
| An Anthropic-direct session cannot select `grok-4.5` | `ANTHROPIC_BASE_URL` unset in a plain `claude` session, so proxy model IDs are unreachable there |

## Corpus measurements

All counts and their reproduction commands: `corpus-census.md`. Block-level distribution was
measured with throwaway Node scripts walking `/\*\*[\s\S]*?\*\//g`; `beep quality jsdoc-migrate
extract` supersedes them in P1.

## Repo constraints carried in from prior work

| constraint | where it bites |
| --- | --- |
| `main` is PR-only; publish from a feature branch through Yeet | every phase |
| Same-PR packet-state flips | P4 must land with P3 |
| Attribute verification failures before repairing | P3's full-matrix CI run on a chronically red `main` |
| Changeset gate counts `--since=origin/main` and fails on uncommitted changesets | P3 spans ~91 family buckets |
| Stacked PRs on a non-`main` base run a fraction of the required checks | why D3 rejected stacking |
