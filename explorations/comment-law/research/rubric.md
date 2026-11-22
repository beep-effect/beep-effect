# Comment classification rubric

Each entry: `#id Lline machine-kind [trailing]`, the comment text, then `> ` the code it sits on (same line, or the next lines).
The repository root for opening source is <lane> (READ ONLY).

Codes (exactly one per comment; judge the comment, not the code's quality in general):

- T Tautology: a competent TypeScript/Effect reader gets the same information from the names, types, literals and structure right there. Restates the next line, the test title, the symbol name.
- S Stale: refers to code, names, files, behaviour, versions, work or plans that no longer exist or are wrong today. You must have evidence: OPEN the source / grep the reference. No evidence -> not S.
- X Excuse: justifies or licenses a hacky, weakened, incomplete or law-violating implementation that should be fixed (casts, skipped validation, duplicated logic, "for now", swallowed errors, disabled checks, hand-rolled copy of an available helper). A limitation imposed by an external system with no better option is D or H, not X. Open the source before choosing X.
- D Decision record, ADR-worthy: documents a deliberate choice between real alternatives with a reason that outlives this one line (protocol, security boundary, algorithm, format, compatibility, ownership, performance trade), and a maintainer who undid it would cause harm.
- H Local hazard/rationale: non-obvious reason, invariant, ordering constraint, unit or upstream quirk that a maintainer needs, but too small or too local for an ADR. (Usually better as a name, type, test title, assertion, or left as is.)
- N Narration: explains non-trivial WHAT (algorithm step, fixture arithmetic, wire format, regex/grammar production, example input) that is not obvious at a glance but is not a reason.
- G Grouping: dividers, section headings, facet/arrange/act labels, case labels.
- L License, attribution, upstream provenance notice.

Tie-breaks: T vs N -> would deleting it make a competent reader slower? no -> T. H vs D -> would you write one page about it? no -> H. X vs H -> is a better implementation available today inside this repo? yes -> X.
Judge strictly and independently of how much prose there is. A long comment can be T; a four-word comment can be D.

For `jsdoc-public` / `jsdoc-member` entries the Example body and bookkeeping tags were removed ("[Example section]" marks one); classify the remaining prose (lead + details) as if it were an ordinary comment.

Output: <scratchpad>/census/out/<SHARD>.tsv — one line per id, tab-separated, no header:
id<TAB>code<TAB>confidence(1 low..3 high)<TAB>note
Note (max 25 words) REQUIRED for X (the hack + the fix), S (the evidence: what is gone or wrong), D (a decision title). For H: one word naming the better home: name | type | test | assert | keep. Otherwise empty.
