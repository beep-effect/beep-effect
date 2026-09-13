---
"@beep/repo-cli": patch
---

Remove the deprecated `--mode` flag from the doctest lane flag inventory and help text. The lane always runs the full Turbo doctest fleet; docgen retains its `--mode` flag.
