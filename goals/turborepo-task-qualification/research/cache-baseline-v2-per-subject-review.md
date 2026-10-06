# Cache baseline v2: per-subject review record

Reviewer: Claude Fable 5.1 (cache baseline merge-friendly lane,
`fix/cache-baseline-merge-friendly`).

## What this record accepts

The committed `standards/cache-qualification-baseline.json` is re-encoded as
`cache-qualification-baseline/v2`: pretty-printed JSON with nodes sorted by
computation, and one review record per subject (a workspace package, or `//`
for root tasks, the global Turbo configuration, configuration-source digests,
scope, profile and epoch) instead of a single whole-file review.

The projection is re-observed from the current `main` census after merging
`main` into this lane. Every subject is stamped with this review because the
file format changed; no command text, input, output, environment key,
dependency edge or cache flag is accepted beyond what the prior v1 baseline
(recorded for #1459 on top of the #1452 baseline) already recorded, and no
qualification is granted. Scope, profile (`local-linux-x64-bun1.4.2`) and
epoch (`qualification-v2`) are unchanged.

## Why

On 2026-10-06 PRs #1471, #1475, #1477 and #1439 each re-recorded the baseline
for their own package and conflicted with `main` on every other merge because
the file was a single 2 MB line and the whole-file `review` block was
rewritten each time. From v2 on, a re-record stamps its review only on
subjects whose posture changed (or that the request names), carrying the
other subjects' reviews forward byte-for-byte, so independent per-package
re-records merge through git's line merge.

## How to re-record

```sh
sha256sum standards/cache-qualification-baseline.json   # -> "previous"
bun run beep cache baseline --request <request.json>
```

The request names `review`, `scope`, `profile`, `epoch`, `previous` and,
optionally, `subjects`: the packages the reviewer deliberately covers. A
changed subject outside `subjects` rejects the record; a named subject that
did not change is stamped anyway.
