# Full Document Editor — Sources & Provenance

- **Cluster / origin:** user Notion initiative, live Lexical Playground audit,
  pinned upstream source audit, and beep-effect10 repo capability inventory.
- **Provenance:** [`RESEARCH.md`](../RESEARCH.md),
  [`DECISIONS.md`](../DECISIONS.md), and the two detailed audit reports in this
  directory.

## 1. Mined source corpus

| Source | Title | Upstream | Location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `lexical-live-2026-08-04` | Lexical Playground live audit | `playground.lexical.dev` | [`LEXICAL-PLAYGROUND-LIVE-AUDIT.md`](./LEXICAL-PLAYGROUND-LIVE-AUDIT.md) | visible behavior, keybindings, screenshots, accessibility | behavioral reference |
| `lexical-source-a933222` | Lexical Playground source audit | `facebook/lexical` | [`LEXICAL-PLAYGROUND-SOURCE-AUDIT.md`](./LEXICAL-PLAYGROUND-SOURCE-AUDIT.md) | node/plugin/settings/transformer completeness | port with attribution |
| `lexical-capability-reference` | Reconciled human-readable capability index | derived from the two pinned audits | [`CAPABILITY-REFERENCE.md`](./CAPABILITY-REFERENCE.md) | nodes, surfaces, activation paths, dispositions, named gaps | Goal A normalization input |
| `beep-editor-context` | Full Doc Editor context audit | beep-effect10 | [`RESEARCH.md`](../RESEARCH.md#2026-08-04--in-repo-capability-inventory) | ownership and collision map | compose existing bricks |

The live audit defines what users can observe. The pinned source audit closes
hidden/conditional feature coverage and cites exact upstream files. The repo
inventory decides lawful ownership and existing capability reuse.

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What we take |
| --- | --- | --- | --- |
| [facebook/lexical](https://github.com/facebook/lexical) at `a933222c489e7025d87b9217c2489d309fc8a3cf` | MIT, verified from local `LICENSE` | port with attribution or clean reimplementation | behavior, node/plugin patterns, transformers, commands, accessibility patterns; never vendor the Playground monolith |

## 3. External research sources

- [Lexical Playground](https://playground.lexical.dev/) — live behavior reference.
- [facebook/lexical](https://github.com/facebook/lexical) — pinned upstream source.
- [Full Doc Editor Notion initiative](https://app.notion.com/p/3b269573788d8096b876ed2ad31d151d) — product intent and resolved decisions.

## 4. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| `@beep/md` | `packages/foundation/modeling/md` | reuse and later extend as canonical document model |
| `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | inventory in Goal A; extend in Goal B batches |
| `@beep/editor` | `packages/foundation/ui-system/editor` | extend with capability/profile contract and proof |
| `@beep/ui` | `packages/foundation/ui-system/ui` | reuse theme and editor primitives |
| `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | reuse in later DOCX goal |
| `@beep/provenance` | `packages/foundation/modeling/provenance` | reuse anchor substrate |
| Professional Desktop dock | `apps/professional-desktop/src/workspace` | extend with registry-keyed synthetic proof panel |
| Prose-to-Proof | `docs/product/prose-to-proof.md` | later Portal consumer |
| Workspace substrate | `docs/product/workspace-substrate.md` | governing panel and serializable-state constraints |

## 5. Cross-links and provenance

- Goal A: `goals/lexical-playground-capability-atlas`
- Goal A inherits this ledger as
  `goals/lexical-playground-capability-atlas/research/SOURCES.md`.
- The Notion initiative remains the product/evidence hub; repository goal
  packets are normative execution contracts.
