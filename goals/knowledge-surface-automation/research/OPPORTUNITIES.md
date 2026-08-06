# Running opportunities ledger — knowledge-surface-automation

Friction receipts captured while shipping, per the AGENTS.md friction law: what
was being done, the evidence, and what would have prevented it. Status:
`unowned` (nobody decided), `queued` (in a locked decision), `spiked` (needs
measurement first). Reviewed at each grill.

## Receipts from P3 gate wiring (2026-08-06, PR #593)

1. **The Stage-1 scanner could not extract this repo's own archive, and nothing
   caught it for two days.** `unowned`

   Wiring the P3 gate meant running `bun run beep knowledge semantic-delta`
   against live `main` for the first time since the scanner slice merged. It
   failed closed on every invocation:

   ```
   Failed to safely extract Git archive "/tmp/beep-knowledge-semantic-delta-*/base.tar".
   ```

   Root cause: `TAR_SYMLINK_ERROR: Cannot extract through symbolic link` on
   `.junie/skills/adhd -> ../../.agents/skills/adhd`, whose target traverses the
   `.agents/skills` symlink. That link landed 2026-08-04 (#546); the scanner
   landed 2026-08-05 (#563). The command therefore never worked on a `main`
   containing it, and the P1 evidence run predates the link.

   **What would have prevented it:** a command that is not yet wired into any
   lane has no owner and no signal. Either wire a smoke invocation in the same
   PR that lands a command, or accept that "landed" ≠ "works" until a lane runs
   it. The generalizable form: *the gap between landing a capability and gating
   on it is exactly how long a silent breakage can live.*

2. **Local `check` does not cover test files, so a repo law violation only
   surfaced in the full proof.** `unowned`

   `bun run --filter @beep/repo-cli check` exited 0 on a test file using
   `JSON.stringify`; the `preferSchemaOverJson` law (TS377026) fired only in
   `check:tsgo:tests` during `yeet verify` — after ~6 minutes of proof. Cost: a
   whole proof cycle.

   **What would have prevented it:** `bun run beep quality test-tsgo` as a
   documented pre-verify step for any PR touching `test/**`, or a package script
   that runs both scopes. See [[stale-artifact-false-greens]] — this is the
   package-vs-test tsgo scope trap, hit in practice.

3. **docgen's `tsc` rejects what `tsgo` accepts.** `unowned`

   A node-tar `filter` callback typed more narrowly than the library's declared
   `(path, entry: ReadEntry | Stats)` passed `tsgo -b` cleanly and then failed
   docgen with `TS2769`. Widening to an all-optional type still failed on weak-type
   detection (`Stats` has no properties in common). The working form takes
   `unknown` and narrows with `P.hasProperty` / `P.isString`.

   **What would have prevented it:** running `bun run docgen:local` before
   `yeet verify` rather than after — already the documented order, now with a
   concrete reason: the two typecheckers genuinely disagree on callback
   parameter bivariance.

4. **Proofs serialize machine-wide, but nothing enforces or signals it.**
   `unowned`

   Four proof cycles were needed. One failed purely on cross-checkout
   contention: with three other worktrees compiling concurrently (load average
   36 on 64 cores), `quality:build` failed with no-location `TS2589` in
   `@beep/box`, then `@beep/ui` on the quarantine rerun, and `@beep/xai` in
   `check`. Three different packages in one run — the signature of resource
   exhaustion, not a type error. Re-running `bun run build` alone at load 15
   passed 131/131 with zero `TS2589`.

   Checking `pgrep -f "beep yeet verify"` is insufficient: sibling sessions run
   `tsc`/`turbo` directly without a verify wrapper.

   **What would have prevented it:** a machine-wide proof lock (advisory file
   lock in a well-known path that every heavy lane acquires), or at minimum a
   load-aware preflight that refuses to start a proof above a threshold and says
   why. Today the cost of getting this wrong is a full ~20-minute cycle plus the
   attribution work to prove the failure was environmental.

5. **`pgrep`-based wait loops self-match and deadlock.** `spiked`

   An `until ! pgrep -f "beep yeet verify"` waiter never fires, because the
   waiting shell's own command line contains the pattern. Bracket the first
   character (`[b]eep`) — and when the same script later *runs* the command,
   split a word into a variable so the literal never appears either.

   **What would have prevented it:** it is in memory as
   [[pkill-matches-own-bash-invocation]]; it still cost a stopped task. Worth a
   one-line helper rather than re-deriving the trick.

6. **Piping a proof through `tail` reports the pipe's exit code.** `queued`

   `bun run beep yeet verify 2>&1 | tail -80` exited 0 while the proof had
   failed. The failure was only visible by reading the verdict text. Already
   recorded as [[piped-command-masks-exit-code]]; hit again here, which suggests
   the memory is not enough on its own.

   **What would have prevented it:** never pipe a gate command — redirect to a
   file and echo `$?`. A lint rule over agent-authored shell would be
   over-engineering; a louder note in the yeet skill would not.

## Observations that are not friction, but want a decision

7. **The semantic-delta report prints ~512 inherited findings on every green
   policy run.** `unowned` — the always-print contract was ratified in #563 when
   the command was invoked manually. Now that it runs on every lint-policy lane
   it is a standing log cost. Worth deciding before Stage 2 whether inherited
   findings should be summarized by class and only introduced ones enumerated.

8. **jsdoc ratchet baseline carries inherited slack.** `unowned` —
   `forbidden-remarks -12` and `multiple-description-paragraphs -12` are
   available to tighten, from doc work on `main` that did not refresh the
   baseline. Nobody tightens it because the baseline file conflicts with every
   concurrent branch, so the slack accumulates. A CI-generated baseline-only PR
   (the pattern C8 already ratifies for sealed baselines) would fit here too.
