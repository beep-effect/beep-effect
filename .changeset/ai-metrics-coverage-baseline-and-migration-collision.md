---
{}
---

No release: re-baseline `@beep/repo-ai-metrics` coverage to measured values and cover the
session-id migration's remaining collision branch.

`#617` re-baselined this package eleven minutes before `#610` merged, so it measured a main
that did not yet carry that PR. The rows landed ~1.2-2.4 percentage points below actual,
which left the ratchet unable to catch a regression that large — enough to silently delete
the OTLP wire-path coverage `#610` added, which is the only test the real protobuf delivery
path has. Measured on post-merge main: lines 86.75, statements 86.8, branches 73.99,
functions 71.39. Only the four `@beep/repo-ai-metrics` rows change;
`bun run coverage:baseline:write` is repo-wide and would rewrite every package from one
local run.

`ai-metrics-agent-session-id-v2` has two collision branches and only one was tested. The
untested one handles a store caught mid-transition, holding both a row already minted under
the content key and a legacy per-run row for the same transcript. Disabling that branch
fails the new test with `Constraint Error: Duplicate key "agent_session_id: ..." violates
primary key constraint`, so it was load-bearing and unguarded.

Also converts five literal NUL bytes in `test/ingest.test.ts` to `\u0000` escapes. NUL is
the correct separator — `rowId` joins parts with it — but as raw bytes it makes the file
grep as binary, which silently returns no matches for any pattern in it. `privacy.ts` holds
zero literal NULs and writes the escape; this now matches.
