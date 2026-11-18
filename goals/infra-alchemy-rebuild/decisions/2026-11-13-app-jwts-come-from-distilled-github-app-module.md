---
title: "App JWTs come from distilled GitHub App.appJwt; distilled pins follow main at rc.19"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-github-runners"
reversal: "Pin @distilled.cloud/aws and @distilled.cloud/github back to rc.18 and restore a WebCrypto RS256 signer (rc.18 has no App module)."
---

The GitHub-facing Lambdas authenticate as the fleet's GitHub App: `GitHubAppAuth` reads the App id and base64 PEM key from SSM once, signs the App JWT with `@distilled.cloud/github/App` `appJwt` (RS256 over WebCrypto, PKCS#1 and PKCS#8 keys), and mints installation tokens through distilled `apps.createInstallationAccessToken`. A first draft signed the JWT itself because `@distilled.cloud/github@1.0.0-rc.18` had no App module; main moved the distilled family to `1.0.0-rc.19` with #3278 (Alchemy beta.86), which ships it, so the hand-rolled signer was deleted. Root catalog pins `@distilled.cloud/aws` and `@distilled.cloud/github` follow the version `bun.lock` resolves on main, `1.0.0-rc.19`. The webhook HMAC-SHA256 check stays on `crypto.subtle` with a constant-time compare: Effect ships no HMAC module.
