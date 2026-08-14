---
"@beep/epistemic-server": minor
"@beep/semantic-web": minor
"@beep/epistemic-use-cases": patch
---

Move the bounded SHACL validator from `@beep/semantic-web/adapters/shacl-engine`
into `@beep/epistemic-server/ShaclValidation` as
`BoundedShaclValidationServiceLive`, its only production consumer. The old
module name implied it wrapped the `shacl-engine` library; the real
`shacl-engine`-backed implementation lives in the `@beep/shacl` driver. The
`ShaclValidationService` contract stays in `@beep/semantic-web`; the legacy
`ShaclValidationServiceLive` alias is removed.
