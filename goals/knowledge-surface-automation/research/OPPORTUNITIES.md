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

## Receipts from P1 refs census (2026-08-06, PR-A refs-tree)

9. **The packet's own host-path verification grep was red on `main`.** `fixed-in-pr`

   `! rg -n "<redacted-home-prefix>|<redacted-tilde-tree>" goals/knowledge-surface-automation …`
   (the manifest's sixth verification command) failed against the checkout this
   branch forked from: `research/p1-context-pruning-analysis.md:110` carried an
   unredacted absolute home path, landed by an earlier PR without the command
   being run. Redacted in the refs-tree PR; the census itself now reports the
   same class (`actionable-host-path` / `archival-provenance`), so once the P3
   gate consumes it this cannot silently recur.

   **What would have prevented it:** manifest `verificationCommands` are prose
   until something executes them; a lane that runs each packet's declared
   commands on touched packets (Workstream E's doctor is the natural home) would
   have caught this at the introducing PR.

10. **Three publish attempts burned on yeet publish ordering semantics.** `unowned`

    Closing out PR #613 cost three failed publish invocations before the working
    form: `--push-only` rejects `--message` (it never creates a commit); plain
    `publish` refuses a dirty-but-unstaged worktree ("requires reviewed staged
    changes") because it does not auto-stage; and staging files AFTER a green
    verify flips "diff fingerprint changed", invalidating `--reuse-verified` and
    forcing a fresh ~18-minute proof. The working sequence is stage first, then
    `yeet verify && yeet publish --reuse-verified --message ...` chained in one
    shell.

    **What would have prevented it:** either a stage-aware proof fingerprint
    (index-only transitions over identical content should not invalidate a
    proof) or a `publish` preflight that names the required order in one message
    instead of one constraint per failed attempt.

11. **`lint schema-first --write` records entries that still fail the gate.** `unowned`

    The refs census added five exported scanner-machinery types; the policy
    finding's remediation says "Run bun run beep lint schema-first --write after
    reviewing the finding". `--write` appended them with `status: "candidate"`
    and the finding text as `reason` — and candidate entries still fail the
    lint. The undocumented second step is hand-flipping each entry to
    `status: "exception"` with a real justification (existing entries show the
    expected quality bar).

    **What would have prevented it:** `--write` emitting exception scaffolds
    with an explicit `TODO-justify` reason, or the remediation text stating that
    candidate entries keep the gate red until upgraded by hand.

12. **docgen rejects an unregistered `@category` without naming the valid set.** `unowned`

    `docgen check` failed with `invalid category: Unknown @category value
    scanning.` — no list of registered values in the error or the finding. Two
    agents hit it independently in one PR: the first migrated its symbols and
    the second reintroduced the same unregistered value on a new export because
    nothing at the authoring site says which categories exist.

    **What would have prevented it:** the error enumerating the registered
    category values (they are known to the checker), or the JSDoc skill carrying
    the list.

13. **Codex fan-out died on a spent usage window mid-campaign.** `unowned`

    The P3 rewrite pass launched four `codex exec` draft jobs per the packet's
    delegation doctrine; all four exited immediately with "You've hit your
    usage limit ... try again at Aug 19th". The session fell back to Claude
    subagents (the precedented 2026-08-04 fallback), which produced all 269
    draft entries — but the doctrine's primary path failed silently at launch
    time with no pre-flight signal.

    **What would have prevented it:** a cheap quota pre-flight (a one-token
    `codex exec` ping, or the wrapper surfacing the reset timestamp) before
    fanning out, so the orchestrator picks the fallback in one step instead of
    discovering the outage from four identical error logs.

14. **Markdown emphasis markers defeat the convention-prefix classifier.** `unowned`

    A bold-wrapped `**fail instead of mutating ~/.openclaw**` span left the
    token starting with `**`, so the portable-home-convention prefix test
    failed and the row classified as external-mirror-reference — the one
    straggler after a 226-rule mechanical pass. The token trimmer strips
    backticks, quotes, and brackets but not emphasis markers.

    **What would have prevented it:** `*`/`_` in the host-token leading-trim
    set (a falsifiable one-character rule-table widening for the next census
    version), or the authoring rule "never wrap a path span inside emphasis".

15. **Archival-segment matching is depth-blind, so a live guidance directory can
    name its way out of the standing gate.** `unowned`

    `isKnowledgeArchivalPath` tests every path segment against
    `ARCHIVAL_SEGMENTS`, so the label applies at any depth, not only under a
    packet's capture directory. Probed against the shipped classifier: both
    `docs/data/GUIDE.md` and `.claude/skills/data/SKILL.md` carrying a
    beep-checkout absolute path classify `archival` /`archival-provenance` and
    contribute **zero** live debt — the `--check` gate passes. The property is
    inherited (the nine pre-existing segments — `research`, `logs`, `outputs`,
    `findings`, … — behave identically on `main`); the P3 pass only widened the
    set with `data`, so this is a rule-table shape question, not a regression.

    **What would have prevented it:** anchoring archival segments to their
    owning surface (`goals/<slug>/data/**`, `explorations/<slug>/research/**`)
    instead of matching a bare segment name anywhere in the path. That is a
    ratified-semantics change, so it is proposed here rather than applied —
    it needs the same phase-0 false-positive eyeball the original class got.

16. **The standing gate's own PR went red on a lane the authoritative local
    proof does not run.** `unowned`

    `yeet verify` (full tier) is documented as the authoritative gate — "if
    `yeet verify` is green, CI should be green on the first push". It runs
    `bun run test`; it never runs `bun run coverage`, and the Yeet sources
    reference coverage only for baseline *staleness*, never to execute the
    ratchet. Adding the `--check` applicator to an already-baselined file
    (`Knowledge.command.ts`) therefore passed a full green local proof and then
    failed hosted `Coverage Regression` on a per-file monotonic floor
    (`branches: 37.5 < 40`) — twice, because the first failure was misread as a
    flake and rerun. The two lanes also use different runtimes: the package
    `test` script runs `vitest` under Bun, `coverage` runs it under Node.

    **What would have prevented it:** the full proof running the affected
    packages' coverage ratchet (it already knows the affected owners), or the
    verdict naming `Coverage Regression` as a known hosted-only gate so the
    "green local means green CI" contract carries its own exception list.

17. **The proof pipeline's own archive bytes were host-dependent.** `fixed-in-pr`

    Found while scoping P3's hermetic lane. `.gitattributes` declares
    `* text=auto` and Git children inherit the ambient environment, so
    `git archive` applied the *host's* end-of-line configuration to a commit's
    text blobs. Reproduced read-only on this tree — the same commit, the same
    path, three digests:

    ```
    git archive --format=tar HEAD -- goals/INDEX.md        -> bdd6752319d881d6…
    git -c core.autocrlf=true archive … goals/INDEX.md     -> 985569dede0df9fe…
    git -c core.eol=crlf     archive … goals/INDEX.md      -> 985569dede0df9fe…
    ```

    Semantic-delta compares archived bytes to the in-process index projection
    with an exact `S.toEquivalence(S.Uint8Array)`, so a host carrying
    `core.autocrlf=true` reported a standing `index-drift` on `goals/INDEX.md`
    whose remediation (`beep goals index --write`) regenerates LF and can never
    clear it. **Measured blast radius, both directions:** the finding fires in
    the base *and* the HEAD archive, so the delta cancels it into `unchanged`
    (497 → 496 with the fix) and it never reaches `introduced`. It is standing
    noise and a misleading finding, not a red required lane — the stronger
    claim was checked and did not hold.

    **What would have prevented it:** treating "bytes a gate compares" as a
    determinism contract with its config pinned at the call site, the way
    `makeHermeticEnv` already pins the probe children's environment. The lane
    that would have caught it is exactly the P3 residue, which is why the
    hermetic lane's assertion is worth reframing (see the P3 report).

- **2026-08-17 — A7 fold-in: two gates fired on the fold-in PR itself, both correctly.**
  While folding `lint roadmap-refs` into the shared knowledge link parser
  (`research/p3-report-roadmap-refs-fold-in.md`):

  1. `fallow:audit` blocked the publish with an introduced cognitive-complexity finding on
     the rewritten `parseRoadmapReferences` — nested loops with `continue`s in one function.
     The yeet verdict's repair hint pointed at OSV, a repeat of the known misattributed-hint
     class; the real red step was identifiable only from the log's fallow envelope. Fix was
     the established idiom: extract branch bodies into sibling helpers (four small functions,
     `introduced: 0` after).
  2. The schema-first inventory gate blocked the new exported `KnowledgeLinkDestination`
     type alias ("exported pure-data type alias should be modeled as an annotated schema").
     Resolved with a justified exception in `standards/schema-first.inventory.jsonc`, the
     same record its sealed siblings (`KnowledgeInlineSpan`, `KnowledgeDocumentLine`) carry.

  **What would have prevented the round trips:** both budgets are invisible to the targeted
  inner loop — `vitest` + `biome` + the lint's own run all pass while `fallow audit --check`
  and `lint schema-first` fail. A pre-publish habit of running exactly those two on touched
  files (they are diff-scoped and fast: ~10s and ~35s here) would have caught both before
  the full proof spent its minutes. The misattributed OSV hint is already a recorded
  capsule-derivation defect in the ship-velocity packet; this is one more receipt for it.
