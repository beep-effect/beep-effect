# P3 hermetic-lane decisions — ratified 2026-08-17

Outcome record of the grill session over `research/p3-hermetic-lane-design.md`, which
proved the ratified clean-clone/empty-`$HOME` lane vacuous (three of its four controls
remove state nothing reads) and surfaced a real archive-byte determinism defect while
doing so. Every decision below is ratified doctrine for this initiative: do not
relitigate in implementation PRs. All three ratifications were the recommended options.

## H1. The hosted hermetic lane is dropped; the gate is a test

The SPEC's Workstream A "hermetic proof" sentence is amended in the same PR as this
record. No hosted CI lane ships. The hermetic *property* is delivered as code:

- probe children run under `makeHermeticEnv` (synthetic `HOME`, all five XDG dirs,
  `TMPDIR`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`,
  `GIT_ATTR_NOSYSTEM=1`);
- byte-emitting git children pin canonical config at the call site: `gitArchiveArgs`
  leads with `-c core.autocrlf=false -c core.eol=lf -c core.attributesFile=/dev/null
  -c tar.umask=0002`, and the spawn sets `gitArchiveEnv` (`GIT_ATTR_NOSYSTEM=1`) —
  the one attribute layer without a `-c` override.

The standing gate is the hostile-profile differential test in `@beep/repo-cli`
(`test/step-git-exec.test.ts`, landed with #741, running in the existing test lane —
zero new CI jobs): archive bytes under each declared hostile profile (global attributes
file attaching `eol=crlf`; ambient `tar.umask=077`) must be byte-identical to the clean
profile, and each profile carries a **negative-control witness** — the unpinned vector
must produce different bytes under the profile, or the test fails as "profile inert"
instead of rotting green. The witness requirement is part of the doctrine: any future
hostile profile added without a witness is a defect.

Rationale: the ratified lane as worded could not fail (evidence in the design report);
the version that bites inverts the sentence (hostile environment, not emptied), and a
test delivers that differential at test cost where a scheduled lane would add a CI job
to a repo already managing lane sprawl and runner memory ceilings.

## H2. The ASLR torture variant is dropped

The variant was "optional scheduled" in the ratified text, so this reopens nothing.

**Correction (review round, PR #744).** The design report's rationale for this drop
conflated the checkout's filesystem nesting depth with shallow git history:
"randomized clone depth" in the ratified sentence means where the checkout *sits on
disk* (deep nesting, spaces, non-ASCII segments), while `KNOWLEDGE_HISTORY_REMEDIATION`
concerns missing git *history* (`fetch-depth: 0` / `--unshallow`) and is unrelated.
The location-depth control is therefore real, not vacuous-by-rediscovery: it probes
path-handling assumptions in the live spawn path, which the current tests do not
exercise (the differential test archives from a flat `<tmp>/repo`, and the
spaced/Unicode assertion only constructs an `--output` argument). The variant is still
dropped in *lane* form — but its real control moves to the H3 follow-up rather than
being declared covered. The remaining variant controls (read-only home) inherit the
lane's vacuity analysis from the design report.

## H3. The ASCII-only redaction gap gets its own follow-up PR

`POSIX_ABSOLUTE_PATH_PATTERN` (`Knowledge.service.ts`) is ASCII-only, so a non-ASCII
checkout path in probe stderr is only partially redacted. Ratified: widen the pattern
in its own small PR with a spaced/Unicode fixture test — and, per H2's correction, that
same PR adds a nested spaced/Unicode checkout profile to the hostile-profile
differential test (the scratch repo sits under a deep path with space and non-ASCII
segments), so location-depth behavior is exercised in the live spawn path rather than
assumed. It is hygiene, not a security boundary, and stays out of the archive-contract
changes to keep each PR single-subject.

## Measured residual, recorded not fixed

Clone-local `.git/info/attributes` outranks every attribute layer and **no git
invocation can disable it** — measured against git 2.55.0: `core.attributesFile=/dev/null`,
`--attr-source=HEAD`, `GIT_ATTR_SOURCE`, `-c attr.tree=HEAD`, and `GIT_ATTR_NOSYSTEM`
all fail to suppress it (full matrix in the design report's addendum). It is absent
from fresh clones and CI. If it must be guarded, the shape is: stat
`git rev-parse --git-path info/attributes` before archiving and fail with a remediation
naming the file. Whether to add that guard is an open decision, not ratified here.
