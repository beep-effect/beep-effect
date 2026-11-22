---
name: delete-comment
description: >
  Source-comment removal, one workspace package at a time: census every comment,
  classify it (tautology, excuse, stale, decision record, hazard, narration,
  grouping, license), verify, delete what the code already says, move decisions
  into decision files, turn excuses into fixes or deduplicated issues, and lower
  the comment ratchet. Use on `/delete-comment <package>`, "delete the comments
  in X", "strip code comments", "run comment law on X", or when the comment
  ratchet fails. NOT for pull-request review comments or threads (yeet), public
  JSDoc authoring (jsdoc-annotation-specialist), or schema refactors (crispen).
argument-hint: "<@beep/package> [census|classify|verify|apply|ratchet]"
compatibility: Requires bun and the beep-effect checkout; issue creation needs an authenticated gh.
metadata:
  version: "0.1.0"
  status: draft
---

# Delete Comment

The engine decides what exists, what is protected and whether the tree is still
the same program. You decide what each comment is. Never edit a comment by hand
during a run: a verdict goes in the ledger and `apply` performs the deletion, so
the same ledger on the same tree always produces the same diff.

Read `references/rubric.md` before classifying anything. Read
`references/worked-examples.md` when a verdict is not obvious.

## Scope of one run

- One workspace package, one ledger, one pull request.
- Comments only. No renames, no reformatting beyond what the deletion forces, no
  helper extraction, no fix for an excuse. Those are other commits or other PRs.
- Vendored skills, generated files, fixtures, `scratchpad/`, and goal,
  exploration, research and docs trees are outside the census.

## The ledger

`.beep/comment-law/<package>/ledger.jsonl` (gitignored), one row per comment
group. Adjacent `//` lines with the same indent form one group.

| Field | Written by | Meaning |
| --- | --- | --- |
| `cid` | census | Hash of path, kind, normalized text, the next 60 code characters and an ordinal. Line shifts and most other deletions do not change it. Exception: when two rows share path, kind, text and anchor, deleting the earlier one gives the survivor its `cid`. A survivor whose `cid` matches a deleted row always gets a fresh verdict, including after a merge of `main`. Editing the comment or the code under it changes the `cid` and forces a fresh verdict too. |
| `protect` | census | Why the row can never be deleted here, or null |
| `codeOffset` | census | Count of non-whitespace code characters before the comment |
| `code`, `conf`, `note` | classify | Rubric code, confidence 1-3, evidence |
| `family`, `issue` | issues | Excuse family and where it is tracked or fixed |
| `adr` | classify | Path of the written decision file |
| `home` | classify | H and N only: `name`, `type`, `test`, `assert`, `keep` |

A later census joins on `cid`, so a rerun asks only about new or changed
comments. To resume on another workstation, keep the verdicts outside the repository in
`~/.local/state/beep/comment-law/<package>.tsv` (`cid<TAB>code<TAB>home`). A
per-comment ledger is never committed: it goes stale on every merge, and S31
forbids a growing inventory.

## Procedure

### 0. Preconditions

```sh
bun run beep compute profile
git status --short                         # must be clean
bun run beep comments doctor <@beep/package>
```

Stop if another open PR deletes comments in the same package, or if the package
has uncommitted work that is not yours.

### 1. Census

```sh
bun run beep comments census <@beep/package>
```

Read the tally. `unclassified` is your work; every other bucket is protected.
Rerunning is safe: earlier verdicts carry over by `cid`, except for a row whose `cid`
matches a row deleted since the last census (an ordinal sibling). `census` clears that
row's code, so it comes back unclassified.

### 2. Classify

```sh
bun run beep comments shard <@beep/package>      # shards of at most 160 KB
bun run beep comments import <@beep/package> <verdicts.tsv>
```

Write one TSV line per row: `cid<TAB>code<TAB>confidence<TAB>note`. One child
reads one shard. Children run on the pinned Claude or Codex route from
`docs/runbooks/agent-pools.md`; give each the rubric path, the shard path and the
output path, and no other context.

`import` rejects unknown ids, duplicates, missing rows, unknown codes, and an X,
S or D without an evidence note. Open the source for X, S and D. A path, symbol,
issue or version named in a note must exist (or be shown not to).

### 3. Verify

A second session, not the classifier's, re-judges without seeing the first
verdicts: every X, S and D; every confidence-1 row; and a seeded 10% of T, G and
N. Disagreement on X, S or D means the row becomes H `keep` until a third read
settles it. If more than 5% of sampled T or G rows are overturned, discard the
shard and reclassify it.

```sh
bun run beep comments sample <@beep/package> --seed <n>
bun run beep comments import <@beep/package> <second.tsv> --as verifier
```

### 4. Decisions before deletions

For every D, re-check the claim against the code before writing: a decision
comment can be wrong or sit on the wrong function, and a copied error becomes
authoritative. A row that cannot name the rejected alternative goes back to H.
Then write the decision file, in the home the packet's decision names (package `decisions/<date>-<topic>.md`; repo-wide doctrine goes to
`standards/architecture/DECISIONS.md` under `grill-with-docs/ADR-FORMAT.md`).
One file may absorb several comments; list their `cid`s. Check that the file
carries the reason, the rejected alternative and the harm of undoing it, not a
copy of the comment. Commit these files alone.

### 5. Excuses into families

```sh
bun run beep comments families <@beep/package> --propose
```

A family is one root cause with one fix: same missing helper, same cast, same
skipped check. Twelve drivers copying one schema is one family. Before anything
new is filed:

1. Search open and closed issues for `comment-law-family:` markers, and read the
   suppression directive next to the comment. A
   `fallow-ignore-next-line ... Owner ... Exit` directive already records the
   debt: reuse its exit condition.
2. Fixable inside this package in under about 50 changed lines: fix it in its own
   PR before or after this one, and set `issue` to that PR. `AGENTS.md`
   ("Fix findings where they are found") prefers this over an issue.
3. Otherwise file one issue per family with
   `bun run beep comments issues <@beep/package> --write`. It puts
   `comment-law-family: <id>` in the body and refuses a second issue with the
   same id. Show the operator the list first when a run would open more than 10.

Issue text is public: file paths and code only, no client or corpus data.

### 6. Verify the plan, then apply

```sh
bun run beep comments verify <@beep/package>
bun run beep comments apply <@beep/package>
bun run beep comments prove <@beep/package>
```

`verify` must print zero refusals. `prove` runs on the raw result, then you run
`biome format --write` on the touched files with the repo config and `prove`
again. Commit the deletion alone, with no other change in the commit.

### 7. Fallout

Second commit, mechanical only: import reordering biome asks for, and inventories
that store line numbers (`bun run beep lint schema-first --write`,
`bun run beep lint effect-vitest --write`; read the diff, because ambiguous
effect-vitest exceptions lose their reason). Then:

```sh
bun run beep quality package-verify <@beep/package>
```

### 8. Ratchet

```sh
bun run beep laws comments --check
```

The check compares with the merge base, so a deletion lowers the floor by
merging and there is no baseline to write. If a scope of the package now holds
zero banned comments, remove its line from the package's pending shard; the shard
only shrinks. A scope that still holds H or N stays pending. Publish through the `yeet`
skill. The PR body gives counts by code, lines removed, decision files, families
with their issue or PR, and the proof output.

## What happens to each code

| Code | Operator category | Action in this PR |
| --- | --- | --- |
| T | Tautology | delete |
| S | Stale | delete; if the evidence also shows a defect, fix it or open the fix PR the same hour |
| X | Excuse | family recorded first, then delete |
| D | Decision record | decision file committed first, then delete |
| G | none | delete |
| H | none | retain; goes to the absorb queue |
| N | none | retain; goes to the absorb queue |
| L | none | keep forever |

H is not a decision record. Sending every hazard note to an ADR would bury the
decisions under thousands of one-line files. N is not a tautology: deleting it
removes information the code does not carry. Neither may be deleted by this
skill. They stay under the ratchet, which does not grow, and leave through
absorption PRs: `home: name`, `type`, `test` or `assert` says where the
information goes, and the comment is deleted in the PR that puts it there. Those
PRs change code, so they carry tests and no equivalence proof. `home: keep`
survives until the operator rules otherwise. If the operator sets a stricter N
policy, change the table in the packet decision, not here in passing.

## Hard stops

Stop and report; do not work around:

1. `prove` fails. Discard the applied tree. Never adjust the proof or the ledger
   to make it pass.
2. A protected row carries a deletion code. Protected means: directives and the
   lines that continue them, triple-slash references, semgrep `ruleid:`/`ok:`
   markers, generated-region markers, licenses and provenance, JSDoc on exported
   symbols and their members, JSDoc with tool-visible tags, JSDoc in story files,
   and any comment holding a code fence (doctest compiles it).
3. A deletion would leave a block empty. The comment is the block's only content:
   classify it H (`assert` or `keep`), or X if it hides a swallowed error. Never
   leave `catch {}`.
4. Deleting a JSDoc block would attach an earlier stacked block to the
   declaration.
5. A D has no committed decision file, or an X has no family with an issue or PR.
6. The diff touches a second package. Generator templates that will re-create the
   comment are a separate PR, landed first.
7. More than 5% of the verifier sample is overturned.
8. You want to change code to make a comment deletable. That is an absorption PR.

## Resume

The ledger is the state. `census` then `verify` tells any session what is left.
If `main` moved under the run, merge it, rerun `census`, and reclassify the rows that
came back without a code. That set includes every ordinal sibling whose `cid` a
deletion on `main` handed over, because `census` clears those codes first.

## Related

- `crispen`: absorbing H rows into schemas and statics. It must not add
  `// crispen:` markers once the ratchet is on.
- `jsdoc-annotation-specialist`: public JSDoc.
- `grill-with-docs/ADR-FORMAT.md`: repo-wide decisions.
- `yeet`, `closeout`: publishing and stopping points.
