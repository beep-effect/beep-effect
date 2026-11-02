# statelyai probe through `beep holds probe` (2026-10-31)

The first end-to-end run of the tooling on the statelyai hold
(`hold-ledger/claims.jsonl`, `statelyai-model-testing-404@1`).

```text
$ bun run beep holds probe statelyai-model-testing-404
[holds] statelyai-model-testing-404
  control   0.15.0: Reproduced
  candidate 0.19.0: Passed
  run verdict: candidate-passed
[holds] recorded statelyai-model-testing-404@1793446502723; confirmed verdict: Unconfirmed

$ bun run beep holds probe statelyai-model-testing-404
...
[holds] recorded statelyai-model-testing-404@1793446508461; confirmed verdict: Flipped

$ bun run beep holds list
[holds] statelyai-model-testing-404 (exact-pin, statelyai): Flipped after 2 run(s)
```

The hold is confirmed `Flipped`: 0.15.0 still fails to install, and 0.19.0
installs. The exit action is `Unpin`. The probe checks installation only. An
unpin to 0.19.0 must still pass the statelyai consumers' tests, so it belongs
in its own PR.
