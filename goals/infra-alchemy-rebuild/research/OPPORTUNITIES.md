# Infra Alchemy rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: `A.makeBy(0, f)` returns one element

- **Doing:** P2 `@beep/alchemy-github-runners` scale-up tests (lane
  goals/infra-alchemy-rebuild-p2-github-runners).
- **Evidence:** the on-demand failover test failed with one `CreateFleet`
  request instead of two. The fake EC2 launched `A.makeBy(count, f)` instances
  and `A.makeBy(0, f)` returns `[f(0)]`: the result is a `NonEmptyArray`, so a
  zero count is clamped to one. The fake reported a full launch and the
  failover branch never ran.
- **Would have prevented it:** a `Gotchas` line on `effect/Array.makeBy` in the
  repo's Effect notes, or a lint that flags `makeBy` with a count that can be 0.

## 2026-11-13: opaque schema classes do not satisfy `S.Codec<A, I>` inference

- **Doing:** the same package, a generic Lambda-boundary helper that decodes a
  runtime config with the schema it is given.
- **Evidence:** typing the parameter `S.Codec<C, CI>` and passing an
  `S.Opaque` class failed with `Property 'brand' is missing` (the inferred `C`
  is the struct's type, not the opaque class). Typing it
  `SC extends S.Codec<unknown, unknown, never, never>` and using `SC["Type"]`
  works.
- **Would have prevented it:** the schema-first skill showing the generic
  signature for helpers that take an opaque schema.

## 2026-11-13: distilled GitHub rc.18 has no App authentication

- **Doing:** the GitHub App live layer of the same package.
- **Evidence:** `@distilled.cloud/github@1.0.0-rc.18` exports `Credentials`
  (bearer token only); the `App` module that mints JWTs and installation tokens
  exists on distilled `main` but not in rc.18, so the package signs the RS256
  JWT itself with WebCrypto, including a PKCS#1 to PKCS#8 key wrapper.
- **Would have prevented it:** a distilled bump that ships the App module; the
  package's `WebCrypto.signAppJwt` is then deleted (decision file
  `2026-11-13-app-jwts-are-signed-with-webcrypto-...`).

**Update, same day:** #3278 moved the distilled family to `1.0.0-rc.19`, which ships `@distilled.cloud/github/App`;
the package now uses `App.appJwt` and the hand-rolled signer is gone. The receipt stands for the hours lost
to the gap between the reference checkout (main) and the pinned release.

## 2026-11-13: SAST flags a PEM template that wraps a test-generated key

- **Doing:** PR #3291 hosted SAST.
- **Evidence:** semgrep `beep-hardcoded-private-key` blocked on a test helper that formats a key generated at
  test time (`crypto.subtle.generateKey`) into a PEM whose header and footer were string literals; no key
  material was committed. Assembling the label at runtime clears it.
- **Would have prevented it:** a local `sast` step in `package-verify`, or a note in the test checklist that PEM
  header and footer literals trip the rule even around generated keys.
