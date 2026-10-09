# Server cache posture review — 2026-10-09

Reviewer: Codex oa-slice worker, under the lane autonomy charter.

The only reviewed subject is `@beep/law-practice-server`. Adding its explicit
`@beep/provenance` workspace dependency changes the package configuration digest
for `build`, `check`, `lint:deprecated-apis` and `test`. The generated package
scripts, task commands, input globs, declared outputs, environment keys,
cache flags and remote-writer permissions retain their reviewed posture.
The dependency participates in Turbo’s native dependency hashing; its removal
from the direct-import boundary would be incorrect.

The server package audit passes on the added implementation; the final source
proof took 42.7 seconds and docgen took 12.2 seconds. Typed persistence failure
paths, restarted exact-source replay and the evidence-only consumer pass.
Scoped coverage meets every baseline row and all new source files have 100%
coverage across the four metrics. See the adjacent verification report.

Re-record this subject through `beep cache baseline --request`, preserving the
existing profile, epoch, qualification scope and all other subjects. This
accepts the changed configuration digest without promoting any tuple or
granting new cache reuse. Retain the request and CLI result in the private
lane ledger. Reversal: remove the additive dependency, regenerate the lockfile
and projections, then re-record the subject against the resulting posture.
