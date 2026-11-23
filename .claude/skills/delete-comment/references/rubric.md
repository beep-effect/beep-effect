# Rubric

Exactly one code per ledger row. A row is one comment as the parser sees it: a
`/* */` block, or one `//` line. Judge the comment, not the code around it.
Length is not evidence: a long comment can be T and four words can be D.

A vote is one TSV line, `cid<TAB>code<TAB>ref`. `ref` is empty except for X (an
issue or pull request URL) and D (the decision file's repository-relative
path). `apply` deletes only T, S, X, D and G, and only when two vote files agree.

| Code | Name | Test |
| --- | --- | --- |
| T | Tautology | A competent TypeScript and Effect reader gets the same information from the names, types, literals and structure right there. |
| S | Stale | It refers to code, names, files, behaviour, versions, work or plans that no longer exist or are wrong today. Needs evidence you opened. |
| X | Excuse | It licenses a hacky, weakened, incomplete or law-breaking implementation, and a better one is available in this repo today. |
| D | Decision record | It documents a deliberate choice between real alternatives whose reason outlives this line, and undoing it would cause harm. |
| H | Hazard | A non-obvious reason, invariant, ordering constraint, unit or upstream quirk a maintainer needs, too local for a decision file. |
| N | Narration | It explains a non-trivial what: an algorithm step, fixture arithmetic, a wire format, a grammar production, an example input. |
| G | Grouping | Divider, section heading, arrange/act/assert label, case label. |
| L | License | License, attribution or upstream provenance. |

## Decide in this order

1. License, attribution, ported-from notice: L.
2. Does it name something checkable (symbol, file, version, issue, behaviour)?
   Check it. Wrong today: S, with the evidence in the note. No evidence, no S.
3. Does it justify something this repo forbids or already has a better answer
   for? Open the source. Better implementation available today: X. Imposed by an
   external system with no better option: continue.
4. Would you write one page about it, with a rejected alternative and the harm of
   undoing it? D. Otherwise, is there a reason at all? H.
5. No reason, but deleting it makes a competent reader slower: N. Not slower: T.
6. Only a label for a run of lines: G.

## Boundary rules

- T or N: would deletion make a competent reader slower? No means T.
- H or D: one page, or one line? One line means H.
- X or H: is the better implementation available here, now? No means H.
- S or X on a TODO: the work is done or the plan is dead, S. The work is still
  owed, X.
- A comment that restates a suppression directive beside it is T. The directive
  is the record, and it is protected.
- A comment attached to the wrong declaration is S even if its sentence is true
  of some other symbol. Name that symbol in your notes.
- Adjacent `//` lines that read as one paragraph are judged together: give
  every line of the paragraph the same code, so `apply` never deletes half a
  sentence.
- Mixed rows take the code of their most valuable sentence, in the order
  D, X, H, N, S, T, G. A row is deleted whole only when every sentence in it
  may be deleted, so a row that also holds an H or N sentence is H or N. A D,
  S or T verdict never carries a hazard out with it. Editing the deletable
  sentences out of a mixed row is an absorption PR, not a strip.
- Test titles count as code. A comment that repeats the `it` title is T.

## Notes and homes

Keep a notes file beside your votes (`cid<TAB>note`, outside the repository):
X the hack and the fix; S what is gone or wrong and where you looked; D the
decision title as a sentence. At most 25 words each. Notes never enter the
vote file and are not read by `apply`.

- H and N need a home, recorded in the notes:
  - `name`: a rename, a named constant or an extracted named step carries it.
  - `type`: a brand, refinement, literal kit, `Option` or signature carries it.
  - `test`: a test title or a new test case carries it.
  - `assert`: a runtime check, typed error or explicit no-op carries it.
  - `keep`: none of these works.

## Mapping to the operator's words

The operator named four categories: tautology T, excuse X, stale S, decision
record D. L, G, H and N are ours. L is kept by law. G carries no information the
structure lacks, so it is deleted with T. H and N carry information that exists
nowhere else, so this skill retains them and queues them for absorption.

## JSDoc

Only JSDoc on non-exported declarations reaches you, and only when it holds no
code fence and no tool-visible tag. Read its prose as an ordinary comment.

## When unsure

Vote H. A retained row costs nothing and stays under the ratchet; a wrong
deletion loses information no test notices. X, S and D need the source opened:
without evidence you checked, vote H.
