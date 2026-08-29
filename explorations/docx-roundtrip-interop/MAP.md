# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `pandoc-ast-foundation` | Add `@beep/pandoc-ast`: schema-first DOCX-core Pandoc JSON AST mirror plus generated-once fixture provenance and bidirectional `PandocAst <-> @beep/md` compatibility proof. | `rich-text-foundation` | `@beep/md`, `@beep/schema`, Effect Schema, NET-NEW `@beep/pandoc-ast` |
| `pandoc-driver-sidecar` | Wrap the Pandoc executable as a repo-level driver for later DOCX -> JSON and JSON -> DOCX conversion. | `pandoc-ast-foundation` | `drivers/*` doctrine, future NET-NEW `@beep/pandoc` |
| `docx-fixture-pipeline` | Automate regeneration and refresh of real DOCX/Pandoc JSON fixtures once the binary driver exists. | `pandoc-driver-sidecar` | `@beep/pandoc-ast`, future `@beep/pandoc`, repo fixture patterns |
| `document-ast-decision` | Decide whether to extend `@beep/md` or create a richer document interchange AST based on the compatibility report. | `pandoc-ast-foundation` | `@beep/md`, `@beep/lexical-schema`, compatibility report |

## Sequencing

1. `pandoc-ast-foundation` first. It is pure, deterministic, and answers the
   central question before runtime complexity enters.
2. `document-ast-decision` after the compatibility report exists. Do not invent
   the richer AST before the gap evidence.
3. `pandoc-driver-sidecar` after the pure mapping proof. The binary wrapper is
   valuable, but it should not be the first source of complexity.
4. `docx-fixture-pipeline` after the driver, so the first generated-once
   fixtures can be refreshed and expanded from a pinned Pandoc version.

## First Vertical Slice

The first slice is a foundation modeling package that proves:

- decode representative Pandoc JSON fixtures into schema-first `PandocAst`
- use generated-once Pandoc JSON fixtures committed with provenance notes
- map issue-free supported fixtures to `@beep/md`
- map supported `@beep/md` fixtures back to `PandocAst`
- prove `@beep/md -> PandocAst -> @beep/md` identity for the supported profile
- prove `PandocAst -> @beep/md -> PandocAst` normalized identity only for
  supported constructs
- produce stable path-located issues for deliberate gap fixtures
- decode tables and custom-style nodes enough to report stable issues, without
  claiming lossless `@beep/md` mapping for them

No user-facing UI is required for this slice. The output is the package API,
tests, fixtures, and compatibility report.

## Open Risks Inherited From The Brief

- `@beep/md` may be too markdown-shaped for DOCX interop.
- Pandoc tables and `custom-style` are intentionally gap-only in v1. The
  existence of `@beep/md` tables does not make Pandoc's richer table payload
  lossless; closing that gap may require richer table or document-AST decisions.
- Notes, math, images, and tracked changes can blow up scope if pulled into v1.
- Pandoc JSON shape may drift by version; binary pinning belongs to the later
  driver goal.
- A new document AST may still be needed, but only after the first matrix makes
  that cost visible.
