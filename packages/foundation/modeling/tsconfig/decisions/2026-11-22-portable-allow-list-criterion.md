---
title: "Portable tsconfig keeps options by type-checking effect, with three named judgment calls"
date: 2026-11-22
reversal: "Re-classify the PRESERVED_* lists by a single mechanical rule (no path and no emit), and update the newLine, maxNodeModuleJsDepth and emit-helper tests in test/PortableTsconfig.test.ts."
governs:
  - src/PortableTsconfig.ts#PRESERVED_BOOLEAN_OPTIONS
  - src/PortableTsconfig.ts#PRESERVED_ENUM_OPTIONS
  - src/PortableTsconfig.ts#PRESERVED_STRING_OPTIONS
enforcedBy: []
---

An option is preserved when it changes what the type checker accepts or reports, independent of any file path or emitted artifact. It is excluded when it names an emit destination or a machine-specific path, selects files, orchestrates builds or project references, or formats CLI diagnostics: a virtual environment drives its own file set and emit and must not inherit them.

Three groups break the mechanical reading on purpose. `importHelpers`, `downlevelIteration` and `preserveConstEnums` shape emitted JS but are carried, because a Twoslash-style environment can still execute what it emits. `newLine` is excluded although it names no path, because it is pure output formatting. `maxNodeModuleJsDepth` is excluded because it is a checking-depth tuning knob, not a type-semantics switch a portable config must travel with. The boolean list is grouped as the strict family, module and interop semantics, checking-depth and lib controls, and language-feature and decorator semantics; the string list is the JSX factory and namespace family.

Rejected: "keep everything that names no path", which would carry `newLine` and `maxNodeModuleJsDepth`; "drop everything that shapes emit", which would break executing environments by dropping the three emit helpers.
