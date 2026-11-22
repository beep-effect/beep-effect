---
name: delete-comment
description: >
  Source-comment removal, one workspace package at a time: census the banned
  comments into a ledger, classify each row twice in independent sessions
  (tautology, stale, excuse, decision record, hazard, narration, grouping,
  licence), write decision files before deleting decision records, then apply
  the agreed deletions behind an AST-identity proof and prune the comment-law
  pending shard. Use on `/delete-comment <package>`, "delete the comments in
  X", "strip code comments", "sweep the comment law in X", or when
  `beep laws comments` reports a scope to sweep. NOT for pull-request review
  comments or threads (yeet), public JSDoc authoring
  (jsdoc-annotation-specialist), or schema refactors (crispen).
argument-hint: "<package-dir> [census|classify|decisions|apply|fallout]"
compatibility: Requires bun and the beep-effect checkout; X rows need an authenticated gh to file or find issues.
metadata:
  version: "0.2.0"
  status: active
---

# Delete Comment

The engine decides what exists, what is protected and whether the tree is still
the same program. Two independent classifiers decide what each comment is.
Never edit a comment by hand during a run: a verdict goes in a vote file and
`--apply` performs the deletion, so the same ledger, votes and tree always give
the same diff.

Read `references/rubric.md` before classifying anything. Read
`references/worked-examples.md` when a verdict is not obvious.

## Scope of one run

- One workspace package, one ledger, one pull request.
- Comments only. No renames, no reformatting beyond what the deletion forces,
  no helper extraction, no fix for an excuse. Those are other commits or PRs.
- The census covers what the comment law covers: TypeScript and JavaScript
  under `apps`, `packages`, `infra`, `tools`, `**/scripts` and the root.
  Generated, vendored, fixture and declaration files, `scratchpad/`, and goal,
  exploration, research, docs and standards trees are outside it.

## The commands

| Step | Command | Writes |
| --- | --- | --- |
| Count | `bun run beep laws comments --census` | nothing |
| List | `bun run beep laws comments --list <dir>` | nothing |
| Ledger | `bun run beep laws comments --ledger <dir>` | `.beep/comment-law/ledger/<dir-slug>.jsonl` |
| Apply | `bun run beep laws comments --apply <ledger> --votes <a.tsv> --votes <b.tsv>` | source files |
| Prune | `bun run beep laws comments --write` | `standards/comment-law/pending/` |
| Check | `bun run beep laws comments [--base origin/main]` | nothing |

`<dir-slug>` is the directory with `/` replaced by `-`, so
`packages/foundation/modeling/csv` writes
`.beep/comment-law/ledger/packages-foundation-modeling-csv.jsonl`. The ledger
is gitignored and is never committed: it goes stale on every merge, and S31
forbids a growing inventory.

### The ledger

One JSON object per line, one row per banned comment (`prose`, `jsdoc-local`,
`law-disable`, `bad-suppression`):

| Field | Meaning |
| --- | --- |
| `cid` | First 16 hex of SHA-256 over file, kind, normalized text, the next 60 non-whitespace code characters after the comment (other comments skipped) and an ordinal among rows sharing all four. Line shifts keep it; editing the comment or the code under it changes it. |
| `file`, `line` | Where the comment is today. |
| `kind` | The grammar kind from `@beep/lint-rules/comment-grammar`. |
| `text` | The whitespace-normalized comment text. |
| `protect` | Why the strip may never delete the row, or `null`. |

Protected rows: a block carrying a tag tools read (`@since`, `@category`,
`@internal`, `@public`, `@expected-unused`, `@ignore`, `@deprecated`); any
comment holding a code fence (doctest compiles it); a comment that is the only
content of a block, `catch {}` included; a `@ts-` pragma; the continuation line
of a directive above it; a JSDoc block stacked under another JSDoc block
(deleting it would attach the upper one to the declaration). Directives,
triple-slash references, licences, provenance, generated headers, `beep:` port
markers, decision pointers and exported or member JSDoc are not banned kinds,
so they never reach the ledger.

### The votes

A vote file is a TSV with one line per row the classifier judged:
`cid<TAB>code<TAB>ref`. Codes are the rubric's `T S X D H N G L`. `ref` is
empty except:

- X: an issue or pull request URL, `https://github.com/<owner>/<repo>/issues/<n>`
  or `.../pull/<n>`.
- D: the repository-relative path of the decision file,
  `<package>/decisions/<YYYY-MM-DD>-<slug>.md`.

A row the classifier did not judge is left out. A `cid` twice in one file is an
error.

### What apply deletes

A row is deleted only when at least two vote files agree on one code, no other
code ties it, and that code is deletable:

| Agreed code | Deleted when |
| --- | --- |
| T, S, G | always |
| X | an agreeing vote carries an issue or pull request URL |
| D | an agreeing vote names a `<package>/decisions/<date>-<slug>.md` committed in `HEAD` in the package that owns the file |
| H, N, L | never (`retained-code`) |

Apply also refuses protected rows (`protected`), rows whose `cid` no longer
matches the tree or whose identical sibling is gone (`stale-cid`: run
`--ledger` again and reclassify), a deletion that would leave an identical
comment with the same anchor behind (`ordinal-sibling`: the survivor would
inherit the deleted row's `cid`), one vote (`too-few-votes`), no agreement
(`votes-disagree`), a path through a symlink (`symlinked-path`), a file the
law does not cover (`uncovered-path`), a file whose working copy differs from
`HEAD` (`target-dirty`) and a file edited while apply ran (`file-changed`).
Each vote file counts once. A file is written to a temporary sibling, checked
once more against the proved text, then renamed over the original.

Each comment's exact range is removed, plus its whole line when nothing else is
on it; an empty JSX `{/* ... */}` container goes with its comment. Then every
touched file is re-parsed with oxc-parser before and after: the ESTree programs,
with `start`, `end`, `range` and `loc` dropped and JSX children compared as
they render, must be identical. A difference (`proof-failed`) or a parse error
(`parse-error`) leaves that file untouched and exits non-zero. Apply prints
`deleted`, `refused` by reason and `files_touched`; it does not run Biome.

## Procedure

### 0. Preconditions

```sh
bun run beep compute profile
git status --short
bun run beep laws comments --list <package-dir>
```

The tree must be clean; apply enforces it per file (`target-dirty`). Stop if another open PR deletes comments in the same
package, or if the package has uncommitted work that is not yours. Work in a
lane worktree, never on `main`.

### 1. Census

```sh
bun run beep laws comments --census
bun run beep laws comments --ledger <package-dir>
```

The ledger line prints `rows` and `protected`. The unprotected rows are the
work:

```sh
jq -c 'select(.protect == null)' .beep/comment-law/ledger/<dir-slug>.jsonl
```

### 2. Classify, twice

Two sessions classify independently. Neither sees the other's votes. Run them
on two different pinned routes from `docs/runbooks/agent-pools.md`, for
example an Opus child (`claude-opus-5-5`, medium) and a Codex lane
(`gpt-6.1-sol`, `model_reasoning_effort="medium"`). Give each exactly:

- the rubric path, `.claude/skills/delete-comment/references/rubric.md`, and
  the worked examples path;
- the ledger path and the package directory, so it can open the source;
- its output path, outside the repository, for example
  `~/.local/state/beep/comment-law/<dir-slug>.a.tsv` and `.b.tsv`.

Each writes one `cid<TAB>code<TAB>ref` line per unprotected row and a notes
file (`cid<TAB>note`) beside it with the evidence the rubric asks for. X, S and
D need the source opened; without evidence the vote is H. The verdicts survive
a workstation move in `~/.local/state/beep/comment-law/`; they never go in the
repository.

Read both vote files before going on. Where they disagree on an X, S or D, the
row stays (apply refuses it). A third session may settle it with a third vote
file; the majority then decides, and a tie still refuses.

### 3. Decisions before deletions

For every D both classifiers agree on, re-check the claim against the code
before writing: a decision comment can be wrong or sit on the wrong function,
and a copied error becomes authoritative. A row that cannot name the rejected
alternative goes back to H.

A D must also pass the admission test in the "Package decisions" section of
`.claude/skills/grill-with-docs/ADR-FORMAT.md`: a named rejected alternative,
an undo that stays green or reds a check without saying why, and more than one
statement or a boundary crossed. A D that fails it is H.

Then write the decision file, `<package>/decisions/<YYYY-MM-DD>-<slug>.md`, in
that section's format: frontmatter `title`, `date`, `reversal`, `governs`
(`<package-relative path>#<declaration>` anchors) and `enforcedBy`; a body of
at most 12 lines with no code fences, carrying the decision, the reason and
`Rejected:`, not a copy of the comment. One file may absorb several comments.
Repo-wide doctrine goes to `standards/architecture/DECISIONS.md` instead, and
its rows stay H in this run.

```sh
bun run beep decisions check
git add <package>/decisions/<file>.md
git commit -m "docs(<scope>): record <decision>"
```

Commit the decision files alone, before the deletion. Apply checks that the
path is committed in `HEAD`, so an uncommitted or only staged file refuses the
row. Put the path in the
`ref` column of both D votes.

### 4. Excuses

For every agreed X, find the record first: search issues for the family
(`gh issue list --search "<thing to export or fix>"`), and read any
`fallow-ignore-next-line ... Exit` directive beside the comment, which already
names an owner and an exit. A fix that fits in this package in under about 50
changed lines goes in its own PR (`AGENTS.md`, "Fix findings where they are
found"); otherwise file one issue per family, keyed by the thing to fix, not by
the sentence. Put the issue or PR URL in the `ref` column. Issue text is
public: paths and code only, no client or corpus data. Show the operator the
list first when a run would open more than 10 issues.

### 5. Apply

```sh
bun run beep laws comments --apply .beep/comment-law/ledger/<dir-slug>.jsonl \
  --votes ~/.local/state/beep/comment-law/<dir-slug>.a.tsv \
  --votes ~/.local/state/beep/comment-law/<dir-slug>.b.tsv
bunx biome format --write <touched files>
git diff --stat
```

Read the refusals list (protected rows are counted, not listed; the touched files are listed). Then format
the touched files with the repo's Biome config and commit the deletion alone:

```sh
git add -- <touched files>
git commit -m "refactor(<scope>): delete <n> comments the code already says"
```

A non-zero exit means the proof refused a file. That file was left as it was;
report it, and do not edit the ledger or the votes to get it through.

### 6. Fallout

Second commit, mechanical only:

- import reordering Biome asks for (`bunx biome check --write <files>`);
- inventories that store line numbers: `bun run beep lint schema-first --write`
  and `bun run beep lint effect-vitest --write`. Read the effect-vitest diff:
  an ambiguous exception loses its reason;
- tests that read source text by line or offset: rerun the package tests;
- `bun run beep laws comments --write` removes every pending scope that now
  holds zero banned comments; the shard only shrinks. A scope that still holds
  H or N rows stays.

Then:

```sh
bun run beep quality package-verify <@beep/package>
bun run beep laws comments --base origin/main
```

The growth check must report `introduced=0`; `removed` is the deletion count.
Publish through the `yeet` skill. The PR body gives counts by code, lines
removed, decision files, excuse issues or PRs, and the apply output.

## What happens to each code

| Code | Category | Action in this PR |
| --- | --- | --- |
| T | Tautology | delete |
| S | Stale | delete; if the evidence also shows a defect, fix it or open the fix PR the same hour |
| X | Excuse | issue or fix PR first, then delete |
| D | Decision record | decision file committed first, then delete |
| G | Grouping | delete |
| H | Hazard | retain; goes to the absorb queue |
| N | Narration | retain; goes to the absorb queue |
| L | Licence | keep forever |

H is not a decision record: sending every hazard note to a decision file would
bury the decisions under thousands of one-line files. N is not a tautology:
deleting it removes information the code does not carry. This skill deletes
neither. They stay under the pending list, which does not grow, and leave
through absorption PRs: the home in the notes (`name`, `type`, `test`,
`assert`) says where the information goes, and the comment is deleted in the PR
that puts it there. Those PRs change code, so they carry tests and no
equivalence proof. `keep` survives until the operator rules otherwise.

## Hard stops

Stop and report; do not work around:

1. Apply exits non-zero (the proof refused a file). Never adjust the ledger,
   the votes or the proof to make it pass.
2. A D has no committed decision file, or an X has no issue or fix PR. Apply
   refuses the row; leave it.
3. The diff touches a second package. Generator templates that re-create a
   comment (for example the vitest `Package-specific overrides` placeholder)
   are a separate PR, landed first.
4. The two classifiers disagree on more than 5% of the T and G rows. Discard
   both vote files and classify again with a sharper brief.
5. You want to change code to make a comment deletable. That is an absorption
   PR.
6. A test, catalog or inventory reads the deleted text by line or offset and
   cannot be regenerated mechanically.

## Resume

The ledger and the vote files are the state. If `main` moved under the run,
merge it, run `--ledger` again, and vote only on the rows whose `cid` is new.
Apply refuses every old vote whose `cid` no longer matches (`stale-cid`), so a
stale vote file can never delete the wrong comment.

## Related

- `crispen`: absorbing H rows into schemas and statics.
- `jsdoc-annotation-specialist`: public JSDoc.
- `grill-with-docs/ADR-FORMAT.md`: decision file format.
- `yeet`, `closeout`: publishing and stopping points.
