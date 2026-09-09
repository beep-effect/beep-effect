# Synthetic local matrix with explicit runtime identities

Receipt schema `cache-synthetic-local/v3` requires primary and alternate
native Bun binaries with observed version and SHA-256 pins. It preserves
stable and canary Turbo clients in separate namespaces. Earlier v1/v2 and
preliminary v3 receipts remain historical for their runner bytes and scenarios.

The final [stable](./synthetic-local-v3-stable.json) and
[canary](./synthetic-local-v3-canary.json) runs each pass 30 assertions across
60 selected-task observations and one separate absent-script observation.
Both use Bun 1.4.2 as primary and an actual Bun 1.4.1 binary as the alternate.
Turbo remains exactly 2.10.12 / 2.10.13-canary.1. The
[registry refresh](./post-merge-registry-pins.json) records exact published
package metadata; each executable is also hashed locally before execution.

The matrix retains three isolated fresh/fresh pairs, supported cross-root and
concurrent fresh runs, semantic environment/file and root/child configuration
perturbations, orchestration invariance, restoration, failure non-reuse,
unsafe-log/absolute-path rejection and bounded-capture failure. Missing
scripts remain separate graph observations with no execution or output credit.

New lockfile and package-manager cases each start from an independent local
producer. Their bytes are explicit global fixture inputs; mutation produces
a fresh task hash while preserving output/log bytes. This verifies the
declared fixture policy, not an assertion that arbitrary unused metadata
always participates in Turbo hashing.

The actual-runtime case replaces the mounted Bun executable. Its independently
verified digest enters `QUALIFY_BUN_SHA256`, a declared semantic environment
input, and the task writes `bun --version` into its output. The replacement
must change the task hash and output, preserve the safe task log and produce
a fresh execution. Run receipts bind their runtime digests; the comparison
helper rejects mixed-runtime equivalence even if other digests match.

Ten primary-profile local shadow decisions cover baseline, semantic and empty
environment values, empty and Unicode files, root and child configuration,
lockfile, package-manager declaration and orchestration-only changes. Each
scenario runs cache-disabled execution first as authority, then a producer
and local replay. All ten match with zero unexplained divergence. An eleventh
scenario uses the alternate runtime and has separate credit; it does not
inflate the primary profile's count or establish ten alternate-profile cases.

The first expanded v3 run passed 57 observations and 29 assertions, but only
nine shadow authorities used the primary profile. The final runner added the
empty-environment scenario and reran both exact clients. Only the final
60-observation receipts support the ten-primary-decision claim.

Four [native pin-negative cases](./synthetic-local-v3-pin-negatives.json)
reject a changed Bun digest, a false alternate version, identical primary and
alternate runtimes, and a changed Turbo digest. Each exits nonzero for its
intended reason and writes no receipt. The fingerprint command separately
rejects an ambient Bun 1.4.1 process against the repository's 1.4.2 pin.

Requests contain `channel`, `client`, native Turbo `executable`, and `bun` /
`alternateBun` objects with `executable` and `pin: { version, sha256 }`. Resolve
the installed binaries and hash their bytes before writing a private request.
Run `beep cache synthetic --request <contained-request> --output <receipt>`
through the selected installed runtime. The Cache runner takes the normal
one-token scheduler admission, allocates disposable roots, disables networking
and ambient credentials, bounds captures, and removes owned fixture roots.

This is synthetic local evidence. It supplies no real-pilot, signed-remote,
tenant/signature or hosted qualification. Signed replay remains dependent on
accepted conformance/trust artifacts; the real identity pilot still needs its
durable execution matrix under the merged wrapper and runtime.
