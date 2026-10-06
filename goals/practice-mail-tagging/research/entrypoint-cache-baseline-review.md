# Record the cache baseline for the new `@beep/practice-mail-tagging` app

The mail-tagging entrypoint (`goals/practice-mail-tagging`, PR 3) adds one
workspace, `apps/practice-mail-tagging`, scaffolded with
`bun run beep create-package practice-mail-tagging --type app --app-kind service`.
A new workspace brings new computations into the projection.
`beep quality cache-policy` blocks on the seven that carry a cache policy:

```text
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#build
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#check
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#lint
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#lint:deprecated-apis
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#lint:jsdoc
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#lint:laws
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#test
```

Every one of them is the generated task of a service app: the scripts block
is the generator's (`bun run beep lint package-scripts --check` reports no
drift), with the HTTP `dev` script removed because the app is a command line.
No existing computation changes its command text, input glob, output
declaration, environment key, or cache flag. The app's workspace dependencies
are `@beep/box`, `@beep/duckdb`, `@beep/identity`, `@beep/law-practice-domain`,
`@beep/law-practice-server`, `@beep/law-practice-use-cases`, `@beep/m365`, and
`@beep/schema`; no other package gains a dependency edge.

Accept the seven `@beep/practice-mail-tagging` computations in the
configuration baseline. This review grants no runtime qualification. Retain
the current lint scope, profile, and epoch; the qualification ledger is
untouched.

## Status

The baseline was **not** re-recorded in PR 3: the baseline file is moving to
a v2 format on `main`, and a re-record against the old format would conflict.
`beep quality cache-policy` therefore stays red on this branch with exactly
the seven lines above until `main` is merged in and the record below is run.

## Re-record, once `main` carries the new format

Write a request file (outside the repository) with the review naming this
note, and the scope, profile, and epoch copied from the baseline as it stands
after the merge:

```json
{
  "review": {
    "reviewer": "<who runs it>",
    "reason": "Accept the seven @beep/practice-mail-tagging computations added by the new apps/practice-mail-tagging workspace; no existing computation changes, and no qualification is granted.",
    "basis": {
      "path": "goals/practice-mail-tagging/research/entrypoint-cache-baseline-review.md",
      "sha256": "<sha256sum of this file>"
    }
  },
  "scope": "<copied from the current baseline>",
  "profile": "<copied from the current baseline>",
  "epoch": "<copied from the current baseline>",
  "previous": "<sha256sum of standards/cache-qualification-baseline.json>"
}
```

```bash
bun run beep cache baseline --request <request.json>
bun run beep quality cache-policy
```

If the v2 format changes the request shape, the review reason and this basis
note carry over unchanged.
