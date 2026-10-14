# Failure handling

Read when a publish, proof, or hosted check fails and the summary line is not enough. Part of the yeet skill.


- If Yeet fails after creating a local commit but before pushing, fix the issue.
  When you prove the exact current worktree with `bun run beep yeet verify`, you
  may retry with `bun run beep yeet publish --amend --no-edit --reuse-verified`.
  Yeet reuses only exact matching full-proof state; if the state is stale,
  publish normally (push-first) instead of re-proving.
- If the current clean commit was already verified and only the push was blocked
  or skipped, prefer `bun run beep yeet publish --push-only --reuse-verified`.
  Yeet still requires exact reusable proof state and a clean worktree, and it
  pushes with `git push -u origin HEAD` so upstream branch naming cannot block
  agent-created feature branches.
- A red job lost to a dead runner ("lost communication with the server") is
  re-run automatically by the hosted `Rerun Runner Loss` workflow, one job per
  attempt, at most 3 times per job and only while the head is current; check
  the run's `run_attempt` (`gh run view <id> --json attempt`) and its
  `Rerun Runner Loss` summary before re-running it by hand.
- There is no pre-push git hook; `yeet publish` runs the cheap-gates tier and
  the head-install preflight itself before pushing, and hosted CI proves the
  head after. (The former pre-push catalog hook was removed with the
  repo-exports catalog.)
- If Yeet refuses untracked, unstaged, or newly generated paths, inspect the
  paths and decide whether they belong in the reviewed publish intent.
- Full proofs use machine-wide weighted admission as the sole current-version
  concurrency authority (ship-velocity D1). New tickets and leases identify
  `scheduler-origin-concurrency/v1`; state written before this migration
  decodes as `legacy-origin-lock/v1`, and same-origin legacy state drains first.
  The first current contender then atomically installs a persistent
  `yeet-proof-lock/v4`
  retirement marker at the former per-origin lock path. Previous v3 clients
  cannot decode that marker and therefore fail closed instead of racing a
  current proof. Current clients recognize the marker and may overlap when
  machine capacity permits. Hosts below the scheduler memory envelope retain
  single-proof execution through one machine-wide `scheduler-fallback.lock`.
- The `yeet-proof-lock/v4` marker is a permanent compatibility fence, not stale
  owner state. Never reap or delete it during routine repair. Its legacy
  decoders and v3 acquisition test seams remain until a future CLI generation
  floor makes pre-v4 proof binaries non-runnable and a seven-day fleet audit
  observes no legacy ticket or lease; the exact removal gate is recorded in
  `goals/ship-velocity/research/d1-admission-scheduler.md`.
- Origin paths still hash a canonical host/repository identity into an opaque
  path under the machine temporary directory, so equivalent SCP, SSH, HTTPS,
  and Git origin URLs share one coordinator even when `.git`, trailing
  slashes, user info, or default ports differ; unparseable origins use their
  trimmed raw text, and the path never contains the remote URL. A stale v3
  owner is replaced by the v4 marker through the existing observation-bound
  compare-and-swap reaper. Legacy v2 and unreadable state remain fail-closed.
- A contender enqueues a durable ticket under
  `$XDG_RUNTIME_DIR/beep/admit/` and waits
  with a visible progress line (position, tokens active/capacity, holders,
  MemAvailable watermark). One token is ~5 GiB; capacity is
  `min(10, floor((MemAvailable − 10) / 5))` with a hard admission floor at
  15 GiB free. Weights: full proof 3, merged preview 5, review-fix 1 (at most
  3 concurrent). Publish proofs queue with priority; a waiting verify ages up
  to equal priority after 2 minutes, and running work is never preempted.
  Leases record pid plus `/proc` start time and heartbeat every 5 seconds;
  dead or pid-reused state is reaped automatically, and malformed state is
  quarantined visibly. Inspect with `bun run beep quality scheduler status`
  and repair with `bun run beep quality scheduler reap [--apply]` (dry-run by
  default). `Ctrl-C` while queued removes the ticket. Admission transitions
  are journaled best-effort to `$XDG_RUNTIME_DIR/beep/admit/journal.ndjson`
  (ring-buffered NDJSON; admitted and released events keyed by ticket nonce
  and pid), so granted queue-wait survives lease release.
  `verify --tier review-fix` remains the cheaper loop lane while a full proof
  is active (one token, never the origin lock); `--tier cheap-gates` takes
  neither admission nor the lock.
- The cheap tier always collects every lane failure. The later full proof uses
  its versioned economics seed to run short gates before expensive gates. Under
  the default fail-fast policy, a precise red stops launching subsequent lanes;
  imprecise reds remain diagnostic and do not stop the plan. Unlaunched lanes
  are recorded as `not-run-early-stop`, and already-running work is never
  cancelled. `--no-fail-fast` (or the compatibility spelling `--collect-all`)
  requests the complete diagnostic picture. Fix every reported lane before
  retrying. A lane added to `githubCheckPrePushLanes` (`GithubChecks.ts`),
  directly or through a lane group it composes, needs a gate-order seed row and
  cost-source entry under the time-to-certainty ruling 76 seeding rule, or
  `gate-order-handoff.test.ts` fails. The runtime pre-push check still
  assembles its own copy of that list in `Quality.command.ts` until a follow-up
  PR adopts `githubCheckPrePushLanes`, so a lane group added only there escapes
  the fixture and runs last.
- Failure packets are written for proof/commit/publish/monitor step failures,
  publish-intent refusals (untracked/unstaged/partially staged paths), and
  stale-base refusals. Intent refusals print a summarized path list on stderr;
  the full list lives in the packet. Known sub-lane hints cover typos,
  terse-effect, every cheap gate, docgen, changeset status, secrets, SAST,
  security, and Nix. Hint selection follows the lane-run record: a tier lane's
  `repairCommand` in `verdict.json` is its first red inner lane's repair
  command, and each red inner lane carries its own (the catalog hint for its
  exact lane id, else a known marker inside that lane's own output segment,
  else the lane's recorded launch command). The failure packet
  (`quality-issue-index.json`, the per-package packet, the inbox capsule)
  follows the same record: a wrapper step's raw issue takes its sub-category,
  category, message, and remediation from its first red inner lane. A red
  inner lane that yields no repair command (no catalog hint, no marker in its
  own segment, no recorded launch command) gives the tier lane the wrapper's
  own command instead. Broad log scanning of the whole wrapper output is only
  the fallback when the record names no red inner lane, which includes
  wrappers that emitted no record at all. Prefer the suggested repair command
  in `yeet status`, the packet, or `verdict.json` over rerunning the whole
  loop blindly.
- Root composite lanes prefer streaming accumulation where child commands are
  independent. For example, root `lint` streams the Turbo/Biome aggregate and
  then still runs repo-law policy lints, so one lint-family failure does not
  hide sibling lint findings.
- The root docgen lint check uses package-local docgen proof manifests. A
  package with a current `.beep/docgen/proof.json` can skip duplicate docgen
  metadata analysis; missing or stale manifests fall back to the normal check.
- Terse-effect output separates `blocking`, `rewritable`, and `informational`
  files. Use `--write` only for the rewritable helper subset; manual candidates
  still need direct edits.
- If there is no open PR for `yeet monitor`, create the draft PR first or run
  `bun run audit:github pre-push` as the full local fallback.
- If `yeet closeout` reports Greptile score/issues as unknown, Greptile has not
  reviewed the head (often no quota). It is advisory and does not block
  `merge-ready`; rerun Greptile with `--retrigger-greptile` only when the user
  wants that GitHub write.
- Do not weaken GitHub check names, hosted PR checks, or manual fallback lanes
  to make a branch appear green faster.

## Read a failed job's log without waiting for the run

Never wait for the whole workflow run to finish before reading a red job.
`gh run view --job <id> --log` and `--log-failed` refuse while the run is in
progress ("run … is still in progress; logs will be available when it is
complete"); that is `gh` behaviour, not a GitHub Actions limit. The per-job
endpoint serves a completed job's full log mid-run, and `yeet monitor` already
falls back to it.

```bash
# Job ids for the PR head (`.id` is the job id; after a rerun take the latest by completed_at).
gh api "repos/<owner>/<repo>/commits/<sha>/check-runs?per_page=100" \
  --jq '.check_runs[] | [.id, .name, .status, .conclusion, .completed_at] | @tsv'

# Full log of one completed job, ANSI colour and hyperlink escapes stripped.
gh api --allow-escape-sequences "repos/<owner>/<repo>/actions/jobs/<job_id>/logs" \
  | perl -pe 's/\e\[[0-9;?]*[0-9A-Za-z]|\e\][^\a\e]*(?:\a|\e\\)//g' > "<scratch>/job-<job_id>.log"

# Annotations (error lines with file/line), also readable mid-run.
gh api "repos/<owner>/<repo>/check-runs/<job_id>/annotations"
```

- `--allow-escape-sequences` is required. Without it `gh api` writes nothing
  to stdout and prints only "the response contains terminal escape sequences;
  pass --allow-escape-sequences to output it anyway" on stderr, so with stderr
  discarded the log looks empty.
- A job that is itself still running has no downloadable log through the API;
  only the web UI streams it. Wait for that job, not for the run.
- Rerun only jobs of the run for the PR's current head. `gh run rerun --job <id>`
  on an older head's run re-queues that run, and the branch concurrency group
  then cancels the current head's run.
