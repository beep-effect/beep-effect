# P0c additional acceptance probes

Current status: all four defects below are closed by unchanged 15/15 probes
and package fixtures. See [the final verification receipt](2026-09-08-p0c-verification.md)
for current acceptance state. The observations below preserve the failing snapshot.

The orchestrator ran 15 read-only cases against a source snapshot after the lane
reported its focused fixtures and direct TypeScript check green. SHA-256 maps
before and after the run matched for all detector modules and Lint.schemas.ts.
The probe process exited 1: 11 cases passed and four failed. The script, complete
JSONL output and hash receipt are retained under
`~/.cache/beep/effect-vitest-canon/p0c-independent-probes.*`.

These failures keep P0c open. They are direct observations, not a retrospective
interpretation of an earlier draft. Reproduce them as focused package fixtures.

| Case | Rule | Expected | Observed |
| --- | --- | --- | --- |
| root namespace Effect | EV001 | present | No finding |
| hoisted function shadows Effect | EV001 | absent | detector: runtime-boundary-in-test |
| live sleep is not a TestClock hang | EV008 | absent | detector: test-clock-stall-risk |
| known Context provision is not a layer | EV002 | absent | judgment: unresolved-layer-provide |

## Required corrections

1. Match the root namespace chain E.Effect.runSync when E imports from effect.
   A root namespace has an extra namespace-export segment; it is different from
   import * as E from effect/Effect. Preserve both forms and unrelated negatives.
2. Function declarations are hoisted. A function named Effect in the same block
   shadows the imported Effect even if its declaration appears after the call.
   The probe places the call inside expect(...).toThrow, so this is a valid test
   of a local function lacking runSync, not an Effect runtime boundary.
3. EV008 targets TestClock hangs under it.effect. An it.live sleep already has a
   live clock and must not be flagged as that mechanical failure. Keep separate
   EV009 judgment about whether the live test is justified.
4. A locally constructed Context.make value is a Context, not an unresolved
   Layer. EV002 applies to non-stub layers; recognize a syntactically known
   Context constructor rather than requesting Resource judgment for it.

Do not weaken the probe expectations or add baseline exceptions for these
implementation defects. After correction, rerun the complete focused suite,
these probes, and the command-produced artifacts/performance checks. Do not
start P0d or declare the package handoff green before they pass.
