# Friction receipts — gate-output-switch-on

Recorded while landing the six fixes (2026-11-18).

1. **A one-key change to the root Turbo config made the local final proof repo-wide.** Doing:
   `bun run beep yeet final-check` on the lane that adds keys to `global.passThroughEnv`. Evidence:
   the docgen step alone passed the ten-minute local bound, and coverage would re-measure every
   package; both were skipped by reason and left to hosted CI. Prevention: final-check sizes its
   scope before it starts and says which gates it will hand to hosted CI, instead of running until
   a bound trips.
2. **Changing one generated script re-keyed 207 cache baselines.** Doing: leading the generated
   `check` with the probe. Evidence: `bun run beep cache audit` reported `configuration-drift` on
   every task of every rewritten package; the reviewed request carries 207 package-keyed SHA-256
   digests, six of which matched secret-scanner token rules. Ignore fingerprints added in the same PR had
   no effect, because the hosted scan pins its configuration and ignore list to the base; a separate
   allowlist PR had to merge first.
   Prevention: the baseline request accepts a rule ("every subject whose only drift is the scripts
   digest of this generated command") and computes the digests itself.
3. **The root cache baseline conflicts on every base merge that touches the root Turbo config.**
   Doing: merging `main` into the P1 lane, twice, and the sibling slices into the probe lane.
   Evidence: the root baseline file conflicted each time and needed a fresh request whose
   `previous` digest names the incoming file; one change produced four request files. Prevention:
   a `cache baseline --rebase` that re-records the lane's reviewed subjects on top of the incoming
   record and keeps the original review.
4. **A phase status of `completed` passed the editor and failed two hosted-tier gates.** Doing:
   flipping P2 in the plan table and the manifest. Evidence: `bun run beep goals doctor` rejects
   anything outside `pending`, `in-progress`, `complete`, `superseded`, and it surfaced as reds in
   cheap-gates and lint-policy during final-check. Prevention: a `goals phase set` command, or the
   literal set printed in the plan template beside the table.
5. **An inherited coverage red needed an attribution comment on each open PR.** Doing: reading
   `Heavy / Coverage Regression` on two PRs of this goal. Evidence: the failing rows were three
   thresholds on one file of another package, red on `main` since an earlier merge. Each PR's owner
   had to fetch the job log, strip escape sequences and compare with `main` to say so. Prevention:
   the ratchet's summary names rows that are already red on the merge base as inherited.
6. **Background proofs died with the session host, twice.** Doing: a final-check and two
   implementer runs started from the session. Evidence: a host restart cancelled them without a
   verdict; the lanes were untouched and the work was restarted from the top. Prevention: the
   final proof gains a detached mode under the job runner, as the readiness monitor has, and an
   agent session uses it by default.
