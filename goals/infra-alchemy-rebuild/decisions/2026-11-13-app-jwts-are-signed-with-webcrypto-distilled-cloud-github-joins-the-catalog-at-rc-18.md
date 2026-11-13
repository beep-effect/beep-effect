---
title: "App JWTs are signed with WebCrypto; @distilled.cloud/github joins the catalog at rc.18"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-github-runners"
reversal: "Replace WebCrypto.signAppJwt with distilled's App module once a bump ships it, and drop the PKCS#1 wrapper."
---

`@distilled.cloud/github@1.0.0-rc.18` (the version matching the repo's other distilled pins; `@alchemy.run/github@2.0.0-beta.85` depends on exactly it) has no App-authentication module: its `Credentials` takes a bearer token only. The package signs the RS256 App JWT with `crypto.subtle` (Effect has no RSA module; `node:crypto` is avoided), wrapping GitHub's PKCS#1 keys to PKCS#8, and exchanges it for installation tokens through distilled `apps.*`. Webhook HMAC-SHA256 uses `crypto.subtle` with a constant-time compare. Root catalog pins added at exactly the resolved rc.18: `@distilled.cloud/aws`, `@distilled.cloud/core`, `@distilled.cloud/github`.
