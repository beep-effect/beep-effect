---
title: "Build portable archive commands once with bounded file-list transport"
date: 2026-11-26
reversal: "Restore per-service commands and inline file lists only after proving Windows overwrite, relative names, literal paths, error text and large archive inputs."
governs:
  - "src/internal/archiveCommands.ts#zipCommand"
  - "src/internal/archiveCommands.ts#unzipCommand"
  - "src/internal/archiveCommands.ts#tarExtractCommand"
  - "src/ActionCache.ts#make"
enforcedBy: []
---

Use shared pure command builders for Artifact and ToolInstaller so their Windows command text cannot drift; retain verbatim command tests because POSIX tests cannot execute the Windows halves. Construction adds no Azure or GitHub SDK imports; spawnOnce owns execution.
Windows unzip uses the three-argument ExtractToDirectory overwrite overload, ErrorActionPreference Stop and try/catch that prints the actual .NET exception to stderr and exits 1; default pwsh error rendering can leave captured stderr empty.
Windows zip uses ZipFile CreateEntryFromFile with explicit relative entry names, preserving directories and literal bracketed names. Combine root with each relative source and convert entry-name backslashes to forward slashes, matching POSIX zip.
Pass the Windows zip file list through a one-relative-path-per-line manifest and ReadAllLines, keeping the script constant-size: CreateProcessW caps command lines at 32767 characters and per-file statements reached that limit near 150 files. POSIX zip retains argv and its larger ARG_MAX ceiling.
Write the manifest as UTF-8 without a BOM; ReadAllLines detects a BOM rather than exposing it to the first path, and ignores the trailing newline. Reject path line breaks; skip stray blank lines rather than adding the root itself. The backslash replacement is literal .NET String.Replace, not regex escaping.
Assign CreateEntryFromFile results to $null so formatted entry objects do not bury the real exception in interleaved captured output. Single-quote every PowerShell path and double embedded single quotes.
Cache tar receives its potentially huge absolute resolved path list through a manifest and -T, avoiding E2BIG. Both GNU tar and bsdtar accept -T; it avoids their long-option argument spelling split. Absolute manifest paths cannot begin with a dash that GNU tar would parse as an option.
Rejected: duplicate per-service command strings, Compress-Archive over individual file paths (which flattens directories and expands wildcards), and per-file inline PowerShell or tar argv lists (which exceed process argument limits).
