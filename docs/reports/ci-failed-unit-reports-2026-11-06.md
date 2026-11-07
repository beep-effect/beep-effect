# Preserve failed unit-test reports

The unit-shard workflow now uploads raw Vitest JSON reports when its test step
fails. The separate `unit-failures` artifact retains the workspace paths and
invocation directories for seven days. Successful and skipped test steps do not
run this upload, and dependency directories are excluded.

## Evidence and purpose

In [PR #2849's Unit D job](https://github.com/beep-effect/beep-effect/actions/runs/42339768143/job/128304643935),
the law-practice server producer failed after 2,048.178 seconds. Its collected
console output reached the 524,288-character limit, hiding later output. The
visible log established six failed cases in four files, but could not establish
the complete failure inventory.

`CiCoverage.runAndWrite` seals a coverage partition only after its producers
succeed. The existing coverage upload runs even after failure, but its artifact
directory can consequently be absent. Raw `coverage/unit-results.json` and
`coverage/invocation-*/unit-results.json` reports remain outside that directory.
This change gives those reports a separate diagnostic destination.

The limitation recurred on head `855490a7528` in
[Unit D job 128338441921](https://github.com/beep-effect/beep-effect/actions/runs/42350844774/job/128338441921).
The server producer ran for 2,546.067 seconds. The visible output exposed one
annotation callback timeout, but again reached the same console-output limit;
the complete failure inventory remained unknown. The normal coverage upload
found no sealed artifact. This repeated diagnostic gap is why the upload is
included in the repair PR before its next hosted run.

The failed test step remains failed. Raw diagnostic reports are never inputs to
the coverage consumer, and the successful, sealed coverage artifact remains the
required proof. A crash or lost runner may prevent Vitest from writing any JSON;
the diagnostic upload warns when reports are absent.

## Expected efficiency benefit

A completed JSON report supplies the full failure list and test timings without
depending on bounded console output. This can avoid an extra reproduction merely
to recover missing diagnostics. No runtime or rerun reduction has been measured;
the 34-minute failed producer is workload context, not a claimed saving.

The implementation uses the already-pinned artifact action and its documented
[multiple-path and exclusion support](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/README.md#upload-using-multiple-paths-and-exclusions).
It adds no package dependency or successful-run upload.

## Verification and reversal

The canonical `beep ci workflow-lint` check and an independent workflow review
pass locally. Hosted publication is pending. A real failed-job artifact has not
yet been observed for this revision.

Revert the new upload step and its test-step identifier to restore the previous
behavior. Existing coverage production, upload and comparison are unchanged.
