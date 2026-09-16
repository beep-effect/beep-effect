# Compare agent convention trials

`beep agent-effectiveness evals compare` compares two local JSON receipts. It
keeps the existing eval scorer intact and reports each outcome separately.

## Try the synthetic example

From the repository root:

```sh
bun run beep agent-effectiveness evals compare \
  --baseline packages/tooling/tool/cli/test/fixtures/agent-effectiveness/comparison/baseline.json \
  --candidate packages/tooling/tool/cli/test/fixtures/agent-effectiveness/comparison/candidate.json
```

These fixtures are synthetic. No model ran and their timings are not benchmark
results. The example changes navigation only and reports a time difference of
-200 milliseconds, an input-token difference of -20, unchanged completion, and
an unknown defect difference.

## Prepare a real pair

1. Choose one bounded task and its deterministic acceptance commands before
   either run. Reuse a `SkillOptTaskManifest` and the JSON from
   `beep agent-effectiveness evals score --task <manifest> --dir <fixture> --json`.
   The scorer measures completion patterns and repository laws; those checks
   alone do not prove functional correctness. Include task-specific tests in
   the acceptance suite.
2. Freeze the repository snapshot, task/prompt, model and reasoning effort,
   harness, environment, safety rules, acceptance suite, and resource budgets.
   Record content SHA-256 identities for the snapshot and relevant inputs. Both
   receipts must describe exactly the same controls. A git commit ID is not a
   SHA-256 content digest; hash a reproducible snapshot such as `git archive`
   output if using that representation.
3. Change exactly one of `guidance`, `navigation`, or `handoff`, represented by
   its content digest. Include an explicit empty-content digest if a surface is
   absent. Removing a safety rule changes the safety control and makes the pair
   incomparable.
4. Assign a shared `pairId` and distinct `runId` values. Capture elapsed
   milliseconds, input/output tokens, human interventions, introduced defects,
   and each named acceptance command's outcome. Use JSON `null` for any
   unmeasured count. Zero means measured and none observed. Missing acceptance
   commands count as `not-run`; extra commands cannot increase passed counts.
5. Copy each existing scorer report into `evaluation`, along with `controls`,
   `variant`, and `measurements`, following the fixture's
   `agent-convention-trial/v1` shape. Run the comparison against those receipts.

The CLI only reads these files and prints JSON. It does not start an agent,
resolve credentials, write to AI metrics or Phoenix, verify the declared digests,
or authenticate the receipts. Prompts in the embedded task can be sensitive;
review receipts before sharing them publicly.

## Read the result

The output retains both receipts and a tagged result:

- `Comparable`: all declared controls match, run identities differ, and exactly
  one convention surface changed. Differences are **candidate minus baseline**.
- `Incomparable`: explicit reasons identify changed controls, mismatched pairs
  or task IDs, reused runs, invalid score fractions, or an invalid number of
  changed surfaces. No differences are emitted for these pairs.

Higher completion, law fractions, and passed-check counts indicate better
reported outcomes. Acceptance differences include separate `acceptancePassed`,
`acceptanceFailed`, and `acceptanceNotRun` counts over the required checks.
Lower defects, interventions, failed or not-run checks, time, and token
counts indicate better reported outcomes. Missing measurements remain `null`.
There is no combined grade, winner, or exchange rate between correctness and
speed. Inspect the original receipts when two differences cancel or a value is
unknown. Exit zero means the comparison document was produced, including an
`Incomparable` result; malformed or unreadable input fails the command.
For a CI gate, add `--fail-incomparable`: the command prints the same JSON, then
exits non-zero when the receipts cannot be compared. A comparable pair still
exits zero; interpreting its measured outcomes remains the caller's decision.

A single matched pair is descriptive evidence. Repeat predeclared tasks,
counterbalance run order, retain failed runs, and inspect distributions before
making claims about a convention's effect. Different repositories or starting
snapshots require separate pairs. This tool deliberately refuses to turn
unmatched observations into evidence that one convention caused an improvement.
