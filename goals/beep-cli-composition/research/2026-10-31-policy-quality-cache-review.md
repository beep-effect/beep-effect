# Cache baseline review: policy graph quality repair

Reviewer: Codex, GPT-6.1-Sol medium, `fix/policy-closure-quality`.

The canonical policy-fingerprint writer on main `b30cd9e6dd` removes the retired
`src/internal/GlobPattern.ts` input from six root seals and adds the live
`commands/Docgen/internal/JsDocNodes.ts` dependency to the quality seal. The graph
quality repair changes internal type visibility and test assertions only.

Review of the complete `turbo.json` diff confirms that only these generated
input arrays change. Commands, cache flags, outputs, environment selection,
dependency scheduling and qualification scope remain the same. The source
paths resolve through the current imports; the retired module is absent.
The 10 focused graph/fingerprint tests and generated-seal consistency check pass.

Re-record only the root (`//`) legacy cache posture. Carry all other subject
reviews unchanged. This grants no cache qualification and enables no new reuse.
Reverse by reverting this review and the associated generated inputs/baseline
together; the cache-policy check will reject any partial reversal.
