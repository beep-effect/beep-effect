# P3 report — the hermetic lane is vacuous as specced; one real defect found

Scoping the last open P3 item, executed 2026-08-17 on branch
`feat/knowledge-hermetic-clone-lane`. SPEC Workstream A ratifies:

> Hermetic proof: clean-clone lane with emptied `$HOME`; plus an optional
> scheduled ASLR torture variant (randomized clone depth, spaced/Unicode
> directory names, read-only home) to flush hidden base-address assumptions.

Two independent design passes reached the same conclusion, and the load-bearing
claims were re-verified by hand before this was written. **The lane as worded
cannot fail.** A separate, real determinism defect was found while proving that,
and is fixed in this PR.

## Why the specced lane is vacuous

Three of its four controls remove state nothing reads.

1. **Emptied `$HOME` — vacuous.** The Knowledge path reads exactly one
   environment input, `resolveKnowledgeProbePolicy(process.env)`
   (`Knowledge.service.ts:1383`), keyed on `GITHUB_*`. No `os.homedir`, no
   `XDG_*`, no network, no locale. The only children that could care — the three
   semantic-delta probes — already run under `makeHermeticEnv`
   (`Knowledge.service.ts:963-986`, applied at `:1039`), which synthesizes
   `HOME`, all five XDG dirs and `TMPDIR`, and sets `GIT_CONFIG_GLOBAL=/dev/null`
   plus `GIT_CONFIG_NOSYSTEM=1`. The lane would be *weaker* than what already
   runs.
2. **Clean clone — vacuous for corpus content.** Both commands read the object
   database, never the working tree (`git archive --format=tar`,
   `git ls-tree -r -z --full-tree`). Content addressing guarantees any clone
   holding the commit yields identical objects.
3. **"No `bun install`" — vacuous and unreachable.** `bun run beep` is
   `bun run packages/tooling/tool/cli/src/bin.ts`, and the Knowledge module
   imports `effect` and `tar` at module scope. Without `node_modules` the CLI
   never boots, so the control only re-proves that Bun needs an install.

The fourth control — **spaced/Unicode paths** — is genuinely non-vacuous and
unproven: the probes emit `import … from "<absolute path into the checkout>"`
(`Knowledge.service.ts:1182/1204/1225`), and `POSIX_ABSOLUTE_PATH_PATTERN`
(`:103`) is ASCII-only, so a non-ASCII absolute path in probe stderr redacts
only partially. "Randomized clone depth" is not vacuous either, but it
rediscovers a contract the code already documents (`KNOWLEDGE_HISTORY_REMEDIATION`,
`Knowledge.errors.ts:42`), at CI cost.

## The defect the scoping found

`.gitattributes` declares `* text=auto`, and Git children inherit the ambient
environment — `writeGitArchive` passed no config hardening. So `git archive`
applied the *host's* end-of-line configuration. Same commit, same path, three
digests, reproduced read-only:

```
git archive --format=tar HEAD -- goals/INDEX.md        -> bdd6752319d881d6…
git -c core.autocrlf=true archive … goals/INDEX.md     -> 985569dede0df9fe…
git -c core.eol=crlf     archive … goals/INDEX.md      -> 985569dede0df9fe…
```

Semantic-delta compares archived bytes against the in-process index projection
with an exact `S.toEquivalence(S.Uint8Array)` (`Knowledge.service.ts:107`, used
at `:551`), so a host carrying `core.autocrlf=true` reported an `index-drift` on
`goals/INDEX.md` whose remediation regenerates LF and can never clear it.

**Blast radius, measured in both directions rather than assumed.** Running
`semantic-delta` under a synthetic hostile `GIT_CONFIG_GLOBAL`:

| | `index-drift` | `unchanged` | exit |
| --- | --- | --- | --- |
| before the fix | present on `goals/INDEX.md` | 497 | 0 |
| after the fix | none | 496 | 0 |

The finding fires in the base *and* the HEAD archive, so the delta cancels it
into `unchanged`; it never reaches `introduced` and never reddens the required
Lint Policy lane. The first design pass claimed it did — that stronger claim was
checked and did not hold. It is standing noise plus a misleading finding, which
is worth removing but is not an incident.

Fixed here by leading the archive vector with
`-c core.autocrlf=false -c core.eol=lf`, kept as the pure exported
`gitArchiveArgs` so the contract is asserted without spawning a process.

## Why this is a stop, not a redesign

The useful lane inverts the ratified sentence. As specced it asks "does the
command exit 0 under an *emptied* environment", whose answer is fixed by
construction. The version that bites asks "is the machine-readable verdict
byte-identical under a *hostile* environment" — and an emptied `$HOME`
structurally hides exactly the defect above, because it removes the hostile
config instead of confronting it.

That is a change to ratified doctrine, so manifest stop condition 7 applies:

> A ratified decision … would need reopening.

Per GOAL.md ("Ratified decisions in SPEC.md are closed — do not reopen them")
this stops here and reports rather than shipping a redesign.

## The options, for the grill

- **(a) Ship the specced lane anyway.** Honest cost: a permanently green job.
  Documents intent, proves nothing, and its inertness is invisible.
- **(b) Reframe as a determinism differential.** Run the shipped commands under
  declared hostile profiles (`autocrlf` host config, spaced/Unicode clone path,
  read-only home) and assert the report digest is byte-identical to the
  canonical baseline. Non-vacuous, and it would have caught the defect above.
  Requires reopening the SPEC sentence.
- **(c) Drop the lane, keep the hardening.** Record that `makeHermeticEnv` plus
  per-call-site config pinning already deliver the hermetic *property*, and
  close P3 without a lane.

If (b) is chosen, the design must carry a **negative control**: each hostile
profile declares a witness — an unhardened control whose output must differ from
the baseline. If the witness stops firing, the profile has gone inert and the
lane must fail with "profile inert" rather than pass. Without that witness the
reframed lane rots back into the vacuity it was built to escape.
