---
title: The reference census admits portable home paths from a closed allowlist
date: 2026-11-27
reversal: Replace both sets in Knowledge.refs.ts with a rule that admits any `~/.<name>` directory.
governs:
  - src/commands/Knowledge/Knowledge.refs.ts#PORTABLE_HOME_CONVENTIONS
  - src/commands/Knowledge/Knowledge.refs.ts#PORTABLE_HOME_EXACT_CONVENTIONS
enforcedBy: []
---

A home path is portable when it sits under a config, state or toolchain directory of a named product or of the XDG basedir spec, so the census admits those directories by prefix from a closed list. `~` and `~/Downloads` are admitted only as exact mentions: the bare home root is the generic "your home" placeholder that upstream skill mirrors use, and a concrete file under the user directory is machine session residue that stays gated.
Widening either set is a reviewed change to this list.
Rejected: a pattern that admits any `~/.<name>` directory, which would let live guidance park machine-local files behind any dot-directory.
