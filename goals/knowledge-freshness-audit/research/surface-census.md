# Baseline surface census

Observed 2026-09-24 at Git commit
b007ddd5a0df7fab0c9fbabc4c9f1b434b5f6a98.
The denominator is 28,396 tracked index entries from a clean checkout, including
symlinks, binaries, and generated artifacts. It excludes untracked and ignored
files. Packet additions are not part of this historical baseline.

## Counts

| Prefix | Entries |
| --- | ---: |
| goals | 8,954 |
| explorations | 10,503 |
| packages | 5,825 |
| docs | 50 |
| research | 90 |
| standards | 59 |
| .patterns | 6 |
| scripts | 24 |
| plugins | 135 |
| .claude/skills | 293 |
| .claude/agents | 7 |
| .codex/agents | 7 |
| .github/skills | 149 |
| apps | 590 |
| .github | 168 |
| infra | 78 |
| tools | 42 |
| scratchpad | 776 |
| .junie | 6 |
| .cursor | 6 |

Nested prefixes overlap; this table is not an additive partition. Remaining
root and hidden entries still belong to the complete census.

| Basename | Entries |
| --- | ---: |
| README.md | 504 |
| AGENTS.md | 87 |
| CLAUDE.md | 67 |
| package.json | 153 |
| SKILL.md | 48 |

All 67 CLAUDE entries were symlinks. Across 70 tracked symlinks, none were broken
when inspected. Canonical skill and agent aliases must remain edges, not duplicate
claim inventories.

Goals and explorations contain 19,457 entries, or 68.5% of the tree. Their 191
and 78 second-level directories are directory counts, not validated lifecycle
counts. One ontology exploration contains 8,995 entries. Equal directory-count
work allocation would be misleading.

The 3,073 package source TS/TSX files contained 27,072 raw slash-star-star comment
markers across 3,030 files. This is a sizing observation, not an AST-validated
JSDoc denominator. The generated Effect/Vitest and JSDoc JSONC inventories were
approximately 21.6 MB and 20.8 MB. Parse records rather than placing these whole
files in model context.

## Reproduce the tracked denominator

```sh
git ls-tree -r -z --full-tree b007ddd5a0df7fab0c9fbabc4c9f1b434b5f6a98
git ls-files -z
```

The first command is immutable revision evidence. The second describes the
current index and includes staged changes, so record its tree state before
comparing runs. Future inventory extraction must use the immutable tree's
mode/blob/path tuples; local filesystem existence cannot manufacture a tracked
reference.

## Treatment by corpus class

- Active authored guidance: extract and verify material assertions and references.
- Binding standards: distinguish intended constraints from implementation behavior.
- Historical packets and receipts: evaluate at their as-of revision; retain
  immutable content and add subsequent corrections where required.
- Generated material: identify producer, input revisions, and refresh policy;
  verify generation semantics before proposing an output rewrite.
- Aliases: validate targets and inheritance/distribution consistency; extract once.
- Source/JSDoc and manifests: use parsers and package contracts before semantic review.
- Third-party bundles: establish provenance, license, customization, and upstream state.
- Binary or claim-free entries: record explicit disposition rather than dropping them.
- Private/untracked/ignored boundaries: record exclusion reasons without publishing content.

The authored [docs policy](../../../docs/README.md), immutable
[research policy](../../../research/README.md), and generated
[standards policy](../../../standards/generated-artifacts.policy.md) govern
different classes. No private docs entries were tracked in the inspected tree.

## Coverage limits

This census does not prove that claims were extracted or verified. P1 must
produce the complete per-entry ledger and extraction receipts at its new
revision. Counts and sampled observations here establish scope and workload;
they are not the audit's final coverage certificate.
