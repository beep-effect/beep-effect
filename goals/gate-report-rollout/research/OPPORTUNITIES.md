# Friction receipts — gate-report-rollout

Receipts recorded while graduating the packet (2026-11-18). Each one is a
case this goal's contract is meant to remove.

1. **`yeet final-check` names a red gate and nothing else.** Doing: final-check
   on a docs-only head. Evidence: the closing block printed
   `failed final-check:lint-policy:laws ... exit 1`; the receipt's step row
   holds `"reason":"exit 1"` and no log path; the last forty lines of output
   were fallow envelope checks that passed. Finding the cause took a re-run of
   the gate into a 754 KB log and four filter passes over it. Prevention: the
   aggregate prints each red child's verdict and failure list from its gate
   report, and the receipt carries the report path.
2. **Three unrelated tasks failed and one line said so.** Doing: the same
   re-run. Evidence: `Failed: //#knowledge:refs-check,
   //#knowledge:semantic-delta, //#lint:retired-effect-paths` sat 3,900 lines
   into the log; the 29 introduced findings were interleaved with 223
   inherited ones in the same list. Prevention: introduced findings print
   first and alone; inherited ones are a count with a path to the record.
3. **A gate that reads committed content gave a working-tree edit a pass or
   fail it had not earned.** Doing: testing a path spelling against
   `bun run beep knowledge semantic-delta`. Evidence: three edited spans were
   reported unchanged because the gate reads `HEAD`. Prevention: the verdict
   line names the tree the gate judged (`HEAD <sha>` or `working tree`).
4. **`yeet repair` rewrote two source files outside the diff.** Doing: repair
   on a docs-only lane. Evidence: `ResidueReapDrainLive.ts` and
   `EconomicsPressure.ts` gained terse-form rewrites and had to be restored by
   hand. Prevention: repair scopes its writers to the lane's diff, or lists
   the files it changed outside it in its verdict.
