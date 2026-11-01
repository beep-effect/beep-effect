# #1875 Effect Vitest canon wave 15: record

Branch `claude/vitest-canon-w15` off `main` `8143d4e70d`. Scope: the effect-vitest rows that
the effect 4.1.0 bump (#2415) reopened or added. That bump took the inventory from 469 rows
(441 exceptions, 28 open) to 522 (385 exceptions, 137 open).

## What #2415 changed

- It added 39 EV014 rows. Effect 4.1 splits crypto into per-family services, so test layers now
  merge `NodeCrypto.layerDigest`, import `@effect/platform-node-shared/NodeCrypto`, or build
  `Digest.layerWebCrypto` / `SecureRandom.layerWebCrypto`. The EV014 acquisition-free rule knew
  only `NodeCrypto.layer` / `BunCrypto.layer` from the two platform roots, so every one of these
  was judged an acquisition.
- It dropped 56 reviewed exceptions (54 EV010, 2 EV003) and reopened them as new open rows. In
  each of the 56, the only change to the flagged statement was the crypto migration: a
  `NodeCrypto` specifier added to the `@effect/platform-node` import (54), or
  `Crypto.Crypto` renamed to `Digest.Digest` in the EV003 wrapper body (2). The statement
  fingerprint changed, so the old exception no longer paired. #2415 restored one such row by
  hand (`gate-order-handoff`).

## Detector repair

`isPlatformCryptoLayer` in `EffectVitestDetectors.ts` treats as acquisition-free leaves:

- `NodeCrypto` / `BunCrypto` `layer` and each per-family `layer<Family>` (`layerSecureRandom`,
  `layerDigest`, `layerMac`, `layerKdf`, `layerAead`, `layerCipher`, `layerSignature`,
  `layerKeyAgreement`, `layerKeyWrap`) from `@effect/platform-node`, `@effect/platform-bun` or
  `@effect/platform-node-shared`, as a root member or its own subpath module;
- `layerWebCrypto` from each `effect/crypto/<Family>` module.

All of these are `Layer.succeed` over `node:crypto` or `Layer.effect` over the WebCrypto
reference (checked in the installed 4.1.0 dists). None acquires a resource a hook timeout could
bound. `Crypto` leaves the generic platform-service list, which this rule now covers.

New counterexamples in `test/effect-vitest-detectors.test.ts`:

- accepted: a `NodeServices` + `NodeCrypto.layerDigest` merge, the `platform-node-shared`
  subpath, two `BunCrypto` family layers, a namespace `Platform.NodeCrypto.layerKdf`, and a
  named merge of two `layerWebCrypto` leaves;
- judged: an unknown `NodeCrypto.layerOther`, an impostor `@beep/fake/NodeCrypto`, a
  non-WebCrypto `Digest.layer`, an impostor `@beep/fake/Digest`, and a `layerWebCrypto` merged
  with an unresolved layer.

## Restored exceptions

The 56 dropped exceptions are carried onto their reopened rows with their original reasons
unchanged. Each pairs one-to-one by `(ruleId, file)`, and each evidence differs from the
reviewed one only by the crypto migration. This restores reviews #2415 lost and adds no new
exception: the 440 exceptions are main's 384 plus these 56.

## Inventory, paired by `(ruleId, file, occurrence)` against `8143d4e70d`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 521 | 384 | 137 |
| After | 482 | 440 | 42 |

| Change | Count |
| --- | ---: |
| Gone | 39, all EV014 open |
| New | 0 |
| Open → exception (restored reviews) | 56 (54 EV010, 2 EV003) |

The 42 rows still open are new test code from #2415 (langextract `provideTestCrypto` EV002 ×9,
ciops `lane-plan` EV006 ×2, gov-legal-mcp EV004, a few EV010) and #2364 (ai-metrics EV010 ×18,
EV013 ×8, EV002, EV004). Wave 16 migrates them.

## Verification

| Check | Result |
| --- | --- |
| `test/effect-vitest-detectors.test.ts`, Bun (`bunx --bun vitest run`) | 260 passed |
| same, Node (`bunx vitest run`) | 260 passed |
| `bun run beep lint effect-vitest --write` | 521 → 482 rows, 0 new |
| repo-cli `bun run check` | exit 0 |
| Biome on the two touched source files | clean |
