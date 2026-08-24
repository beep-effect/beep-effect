# Semantica Atlas upgrade report, run 3

Date: 2026-08-24  
Workspace: Todox  
Target: `@beep/semantica` (`3c669573-788d-8001-82c3-e19b0cf3b58c`)  
Database: `Findings — Bugs, Drift & Gaps` (`25337805-3c30-4051-a636-d3315ead2d82`)

## Outcome

Added the six requested findings. Every new row has `Source=audit` and `Status=open`.
No existing Notion row, property, page body, schema, or view was changed.

## Rows

1. FAQ version contradiction, `doc-gap`, `docs` (`3c669573-788d-81bc-9f41-c4e047cd047c`).
2. Runnable evals claim versus empty `__all__`, `drift`, `evals`
   (`3c669573-788d-8194-8ccc-eaeb455c3672`).
3. Jena inference placeholder, `design-flaw`, `triplet_store`
   (`3c669573-788d-81f7-b9b8-f146791c2c5b`).
4. Unpublished local docs, `doc-gap`, `docs` (`3c669573-788d-8104-93c2-d2d48c0fa5bd`).
5. Hosted docs lag the 0.6.6 code surface, `drift`, `docs`
   (`3c669573-788d-8100-8e96-f0800c0adb65`).
6. Mintlify sibling-link 404s, `doc-gap`, `docs`
   (`3c669573-788d-81ef-a10c-d85e5ddc06ff`).

## Verification

A SQL read-back by the six page URLs returned exactly six rows with the requested Finding,
Class, Module, Evidence, Source, and Status values. Direct page fetches also confirmed that all
six rows belong to the target collection under `@beep/semantica`.

The evals title needed one property-only correction because Notion first parsed `__all__` as
inline Markdown. A second read-back confirmed the literal `__all__ = []`. No other write was made.
