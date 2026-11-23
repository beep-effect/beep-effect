---
title: The optimizer pushes globstars right and never reorders them past a star
date: 2026-11-23
reversal: Drop the first- and second-phase rewrites (or add the star-reordering ones) and re-run the minimatch-v10-optimizer corpus to see which outcomes move.
governs:
  - src/internal/minimatch.ts#Minimatch
  - src/internal/minimatch.ts#splitGlobstarParents
enforcedBy: []
---

Optimization level 2 rewrites pattern sets for a filesystem walk: eliminate what it can and push every `**` as far right as possible, even when that adds patterns.
`**/..` resets the recursive walk each time it occurs, and `**` cannot be reduced by a `..` the way a regexp part or a plain string can, so `<pre>/**/../<p>/<p>/<rest>` splits into `<pre>/../<p>/<p>/<rest>` and `<pre>/**/<p>/<p>/<rest>`.
First phase, per pattern (`<p>` is any part but `.`, `..`, `''` or `**`; `<e>` is `.` or `''`): that split, `<pre>/<e>/<rest>` to `<pre>/<rest>`, `<pre>/<p>/../<rest>` to `<pre>/<rest>`, and `**/**/<rest>` to `**/<rest>`.
Second phase, across patterns: `{<pre>/*/<rest>,<pre>/<p>/<rest>}`, `{<pre>/<rest>,<pre>/<rest>}` and `{<pre>/**/<rest>,<pre>/<rest>}` each collapse to the wider member.
Rejected: `**/*/<rest>` to `*/**/<rest>`, and `{<pre>/**/<rest>,<pre>/**/<p>/<rest>}` to `<pre>/**/<rest>`.
Both would be valid only if `**` followed symlinks (or `*` did not); since `**` does not, they change which paths a walk reaches.
Rejected: keeping fewer patterns at the cost of leaving `**/..` in place, which upstream calls brutal for walk performance.
