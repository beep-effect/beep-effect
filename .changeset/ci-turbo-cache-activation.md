---
"@beep/infra": patch
---

Activate the asymmetric Turbo remote cache: `loadCiTurboCacheConfig` loader,
`ci-runners` entry instantiation with `turboCacheApiEndpoint` /
`turboCacheBucketName` outputs, production `ciTurboCache:*` stack config, and
the bundled Lambda source (pinned ducktors shim + token-and-method authorizer
+ HMAC-validating writer) under `infra/lambda/turbo-cache`.
