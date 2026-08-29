# Semantica Atlas upgrade report, run 3

Date: 2026-08-24  
Workspace: Todox  
Target: `@beep/semantica` (`[notion: page @beep/semantica]`)
Database: `Findings — Bugs, Drift & Gaps` (`[notion: Findings — Bugs, Drift & Gaps database]`)

## Outcome

Added the six requested findings. Every new row has `Source=audit` and `Status=open`.
No existing Notion row, property, page body, schema, or view was changed.

## Rows

1. FAQ version contradiction, `doc-gap`, `docs` (`[notion: row FAQ version contradiction]`).
2. Runnable evals claim versus empty `__all__`, `drift`, `evals`
   (`[notion: row Runnable evals claim versus empty __all__]`).
3. Jena inference placeholder, `design-flaw`, `triplet_store`
   (`[notion: row Jena inference placeholder]`).
4. Unpublished local docs, `doc-gap`, `docs` (`[notion: row Unpublished local docs]`).
5. Hosted docs lag the 0.6.6 code surface, `drift`, `docs`
   (`[notion: row Hosted docs lag the 0.6.6 code surface]`).
6. Mintlify sibling-link 404s, `doc-gap`, `docs`
   (`[notion: row Mintlify sibling-link 404s]`).

## Verification

A SQL read-back by the six page URLs returned exactly six rows with the requested Finding,
Class, Module, Evidence, Source, and Status values. Direct page fetches also confirmed that all
six rows belong to the target collection under `@beep/semantica`.

The evals title needed one property-only correction because Notion first parsed `__all__` as
inline Markdown. A second read-back confirmed the literal `__all__ = []`. No other write was made.
