---
title: "Global flags print on root help through a formatter layer in the dispatch context"
date: 2026-11-18
lane: "fix/gate-output-quiet-surfaces"
reversal: "Remove the formatter layer from the dispatch context; every help page prints the five global flags again."
---

The CLI entry does not pass an environment to the runtime's main, so `globalFlags: "summary"` is provided as a formatter layer merged into the context the command program builds. Help colour now follows the shared colour decision in `@beep/cli-kit` instead of the core TTY check. The quality-task names (`check`, `test`, `lint`, `build`) are not commands, so their `--help` still shows root help with the full list.
