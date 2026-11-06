# Effect crypto service integration repair

Hosted run [41407874623](https://github.com/beep-effect/beep-effect/actions/runs/41407874623)
failed to build the citation server because `effect/Crypto` no longer exists in
the installed Effect 4.1.1 dependency. The missing module produced additional
unknown/any requirement diagnostics in callback and document owners.

The repair uses `effect/crypto/Digest` for hashes and captures
`effect/crypto/SecureRandom` separately for runtime dictionary nonces. Captured
services remain supplied to the owning operations; no request field or new
ambient service lookup was added to returned service methods.

The current Digest API has a never error channel and reports runtime failures
as defects. Each private citation byte-to-digest boundary maps defects into its
existing sanitized tagged failure. Interruption remains interruption. Existing
failure and mutable-input test doubles now implement both Digest operations
from one byte-producing function; injected failures use the current defect
semantics. The pinned citation digest protocol and expected hashes are unchanged.

Validation on this repair wave:

- Biome checked the citation implementation and affected tests successfully.
- Three focused suites passed: authority identity, external resource identity,
  and mention identity; 16 tests, 7.31 seconds, one worker.
- The divergence ledger was regenerated and audited: 11 representation laws,
  four fidelity questions, 15 unfinished proof rows; no semantic waiver.
- A local package type check failed against stale built dependency declarations:
  `@beep/schema`'s local `dist/Sha256.d.ts` still imports removed `effect/Crypto`.
  This is not a green package result. Full dependency rebuild and package proof
  remain delegated to hosted CI under the approved publication instruction.

This fixes a hosted integration failure; it does not establish exhaustive
parity, full package quality, or completion of the citation engine goal.
