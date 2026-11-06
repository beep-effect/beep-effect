# Hosted native tokenizer composition receipt

Exact head: `631da83988c624bf3278ae65779926fac7fd0af2`.
Check run: [41654332172](https://github.com/beep-effect/beep-effect/actions/runs/41654332172).
Successful Heavy / Test Integration job:
[125982250745](https://github.com/beep-effect/beep-effect/actions/runs/41654332172/job/125982250745).
The completed job API reports success; its actual log records both canonical
runtime tests and both controlled composition tests as successful.

The test source on this head requires:

- Complete default tokenizer: all seventeen source cases and exact native
  token/edition/assembly comparisons under actual Bun and actual Node, with
  192 spawned and 192 independently confirmed exits per runtime.
- Controlled tokenizer composition: all twenty source cases, 44 candidates,
  and 35 spawned/confirmed exits per runtime.
- Source selector: all 6,805 extractor bindings and exact independent membership
  vectors; existing regex full-corpus, Unicode and lifecycle controls also run.

All seven law-practice-server parallel integration files and twelve tests pass.
This closes the pending functional composition replay for this historical head.
The same run's Heavy / Check failed on inherited Git W7 diagnostic errors,
repaired separately by `26b5893d36`; this receipt does not claim the run green.

Newer heads, including extraction dispatch, need their own hosted result.
This functional result does not establish performance scaling, approval of
110 regex families, fresh-process edition hash production, custom protocols,
full extraction/context or public CitationEngine completion.
