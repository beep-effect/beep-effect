---
title: "Schema catalog reads exports syntactically instead of through the type checker"
date: 2026-11-08
reversal: "Restore declaration.isExported() and variableStatement.isExported() in SchemaCatalog.ts"
---

The per-file splice alone measured 2.28 GB max RSS (6.2 s) for the five fixture files, above the 1.5 GB target. Phase probes showed parsing is cheap (a 36 KB file adds ~2 MB); the spike came from ts-morph isExported(), which builds the type checker and loads every imported module the first time it meets a statement without an export keyword. For a variable statement isExported() reduces to hasExportKeyword() because a statement has no symbol, so that swap is exact; classes use a syntactic check for the export keyword, a local export specifier or export default. With it the run is 634 MB / 2.1 s. The brief's fallback, a syntactic same-file lookup replacing identifier.getSymbol(), measured 2.27 GB alone and made no difference once exports were syntactic (627 MB without it, 645 MB with it), so it was not adopted; skipFileDependencyResolution was likewise a no-op (634 MB both ways) and was left out. Full-repo parity: the full check prints is current and the full writer leaves git status clean.
