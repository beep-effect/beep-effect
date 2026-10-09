# Knip retirement: cache-policy baseline review

Date: 2026-10-09. Owner: `rsc-a-retire`, serialized by `rsc-shared`.

The accepted Knip retirement removes the hand-owned root `knip` and
`knip:check` scripts together with `//#knip:check`, the Knip policy-fingerprint
input, and Knip dependency/catalog/patch declarations. This changes the root
scripts digest and drops one executable root computation. Every surviving
root command, input, output, environment and dependency contract remains
unchanged except the fingerprint task no longer names the deleted config.

The `beep cache baseline --request` owner command re-records the root posture
with the supported changed-subject review mode. It covers the root
retirement and FreshBooks test dependency correction; unchanged package
reviews, scope, profile and epoch are carried forward. FreshBooks replaces
unused `@beep/test-utils` with directly declared `bun-types`, with its default
package gate already passed. This is a posture review, not qualification or TTC proof reuse.
Reversal: revert this PR and re-record the restored root posture through the
same owner command. The 41-finding transfer is in the packet research list.

The ciops v1 fixture pins a historical handoff by digest; it remains immutable
and retains its historical Knip lane. Its tests compare against that pinned
packet artifact rather than the current CLI lane registry.
