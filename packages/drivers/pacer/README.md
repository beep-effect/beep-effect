# @beep/pacer

Offline-safe PACER API driver package.

## Surface

`@beep/pacer` exposes the PACER Authentication API and PACER Case Locator (PCL)
API as separate services:

- `PacerAuth` handles `cso-auth` and `cso-logout`.
- `PacerSession` acquires a token in scope and logs out on scope release.
- `PclClient` injects and rotates `X-NEXT-GEN-CSO`, sends optional
  `X-CLIENT-CODE`, runs case and party searches, and cleans up batch reports.
- `makePacerLayer` composes Auth, Session, and PCL over an explicit
  `HttpClient` layer.
- `makePacerMockHttpClient` and `PacerMockHttpClient` provide deterministic
  offline tests with no PACER credentials and no network.

There is intentionally no top-level `Pacer` facade. Auth errors are body-code
driven (`loginResult`), while PCL errors are HTTP-status driven.

## Config

`loadPacerConfig` reads generic driver environment variables through
`effect/Config`:

- `PACER_USERNAME`
- `PACER_PASSWORD`
- `PACER_CLIENT_CODE`
- `PACER_OTP`
- `PACER_IS_FILER`

The caller must explicitly choose `qa` or `prod`. This package does not ship a
live runner and does not default any command to either PACER environment.

## Example

```ts
import { Effect } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { PacerConfigLoadOptions, PclClient, loadPacerConfig, makePacerLayer } from "@beep/pacer"

const program = Effect.gen(function*() {
  const config = yield* loadPacerConfig(PacerConfigLoadOptions.make({ environment: "qa" }))
  const layers = makePacerLayer(config, FetchHttpClient.layer)
  return layers.full
})
```

For tests, prefer the mock transport:

```ts
import { makePacerLayer, makePacerMockHttpClient, mockPacerConfig } from "@beep/pacer"

const layers = makePacerLayer(mockPacerConfig(), makePacerMockHttpClient())
```

## References

- [PACER Developer Resources](https://pacer.uscourts.gov/file-case/developer-resources)
- [PACER Authentication API guide](https://pacer.uscourts.gov/sites/default/files/files/PACER%20Authentication%20API-2025_v2_0.pdf)
- [PACER Case Locator API guide](https://pacer.uscourts.gov/help/pacer/pacer-case-locator-pcl-api-user-guide)

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Lint
bun run lint:fix
```

No live integration tests or live runner are committed. Tests import package source through `@beep/pacer` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
