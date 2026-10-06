# @beep/m365

Microsoft Graph v1.0 driver (delegated read lane; app-only lane with mailbox write verbs)

## Installation

```bash
bun add @beep/m365
```

## Usage

```ts
import { VERSION } from "@beep/m365"
```

## Lanes

The driver has two token lanes behind one `M365` service.

| Lane | Layer | Token | Reach |
| --- | --- | --- | --- |
| Delegated | `M365.makeLayer` / `M365.makeLiveLayer` | Auth-code + PKCE for a signed-in user | Read verbs only; write scopes are rejected in configuration. |
| App-only | `M365.makeAppOnlyLayer` / `M365.makeAppOnlyLiveLayer` | Client credentials against Graph `/.default`, certificate first | Read verbs plus mailbox writes, for whatever mailboxes the service principal has been assigned. |

On the app-only lane:

- Every mailbox verb needs a `userId`. A request that would use a `/me` route
  fails with `"request encoding"` before any HTTP call.
- Grant mailbox access with an Exchange RBAC-for-Applications role assignment
  scoped to the mailboxes the service needs. Do not consent a tenant-wide Graph
  application permission beside it: the two add up, and the unscoped one wins.
- A create (`POST`) is replayed only after an explicit 429. After a transport
  failure or a 503 its outcome is unknown, so it fails as `"ambiguous write"`.
  Give `createEvent` an `idempotencyKey` and look it up with
  `findEventsByIdempotencyKey` before creating again.
- `updateEvent` and `updateMessageCategories` replace the whole category list.
  Read first and keep the categories you did not add.

```ts
import { M365, M365CreateEventRequest, M365EventDraft, m365AllDayWindow } from "@beep/m365"
import { LocalDate } from "@beep/schema/LocalDate"
import { Effect } from "effect"
import * as O from "effect/Option"

const program = Effect.gen(function* () {
  const m365 = yield* M365
  return yield* m365.createEvent(
    M365CreateEventRequest.make({
      event: M365EventDraft.make({
        ...m365AllDayWindow(LocalDate.make({ year: 2030, month: 1, day: 15 }), "UTC"),
        categories: ["Docket - unverified"],
        isAllDay: true,
        showAs: O.some("tentative"),
        subject: "Response due"
      }),
      idempotencyKey: O.some("docket:3f9a1c2b7d"),
      userId: O.some("mailbox@example.test")
    })
  )
})
```

The write verbs are not exposed through `@beep/m365-mcp`.

## Token Cache Persistence

The live auth layer uses the in-memory MSAL token cache by default. Supplying
`tokenCachePath` opts into encrypted persistence through
`@azure/msal-node-extensions` (DPAPI / Keychain / libsecret). That package is an
optional peer dependency this workspace does not install: it hard-depends on the
native `keytar` addon, whose prebuild download fails hosted installs. A host that
sets `tokenCachePath` adds `@azure/msal-node-extensions` to its own dependencies;
the driver imports it lazily and fails with a `config` `M365Error` when it is
missing. Headless CI and non-desktop hosts should omit `tokenCachePath` or inject
an externally minted token with `M365Auth.layerStatic`.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

The app-only live test (`test/integration/M365.appOnly.live.test.ts`) runs only
when the `M365_APP_ONLY_*` settings are present, and writes its one test event
only when `M365_LIVE_WRITE=1` is also set; it deletes that event afterwards.

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/m365` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
