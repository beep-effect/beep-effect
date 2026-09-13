---
"@beep/repo-cli": patch
---

`beep yeet sweep --retire` now explains a fence refusal correctly: the holders
it names are outside the command's own ancestry (an editor, another shell, or
the other stages of a pipeline the output was piped into), so the hint says to
leave or close them, redirect output to a file, and rerun from the lane, and
keeps the `--lane` form for a clone that already carries the merged CLI. The
old hint sent the operator to the owning clone, which neither removes the
holder nor works while that clone's `main` is still behind the merge.
