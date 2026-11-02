# Cache baseline after accepted Graft-retirement main merge

The baseline is taken from accepted main3fbb6e614b, retaining its retirement changes.
The complete bounded cache audit reports exactly11blocking configuration drifts:
six `//` per-task fingerprint tasks (goals-doctor, goals-index, knowledge,
lint-deprecated-apis, lint-roadmap-refs and quality) and five
`@beep/repo-ai-metrics` tasks (build, check, lint:deprecated-apis, test and
test:property). The root source review also identifies turbo.json.

These are the same reviewed foundation deltas documented in
CACHE-MAIN-SYNC-20261031.md: canonical closure generation removes the retired
GlobPattern dependency and adds JsDocNodes where traversed; the AI-metrics
manifest adds its implementation/test dependencies. The incoming main baseline
does not include these branch deltas. No additional task or subject is admitted.

Re-record only `//` and `@beep/repo-ai-metrics`. Preserve scope, profile, epoch,
qualification, trust and all other subjects from the exact incoming baseline.
This changes recorded configuration/dependency posture, not qualification or
exception policy. The consolidated G4 owner remains responsible for accepted
main's graph/schema/Fallow repair; this request is not a competing runtime fix.
