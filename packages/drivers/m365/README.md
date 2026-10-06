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

### Mail outbound

Four verbs prepare and send mail from a mailbox on the app-only lane; reading a
draft back is the existing `getMessage`, which returns `bccRecipients` too.

| Verb | Graph call |
| --- | --- |
| `createDraftMessage` | `POST /users/{id}/messages` (lands in Drafts; nothing is sent) |
| `addMessageAttachment` | `POST .../messages/{id}/attachments`, or an upload session |
| `sendDraftMessage` | `POST .../messages/{id}/send` |
| `deleteDraftMessage` | `DELETE .../messages/{id}` (Outlook moves it to Deleted Items) |

- An attachment of at most 3 MiB (`M365_ATTACHMENT_SINGLE_REQUEST_MAX_BYTES`)
  goes in one request. Larger content opens an upload session and is sent in
  3,276,800-byte chunks (`M365_ATTACHMENT_UPLOAD_CHUNK_BYTES`) to the session
  URL, which must be https and receives no bearer token. Empty content and
  content above 150 MiB (`M365_ATTACHMENT_MAX_BYTES`) fail with
  `"request encoding"` before any HTTP call.
- A send is never replayed blindly. It is retried only after an explicit 429;
  after a transport failure or a 503 it fails as `"ambiguous write"`. Read the
  draft back with `getMessage` before deciding anything: a draft that has left
  the Drafts folder was sent.
- A throttled chunk is retried with the same byte range. A failed attachment
  leaves the draft in place; delete it with `deleteDraftMessage` if it should
  not stay.

The write verbs are not exposed through the read-only `@beep/m365-mcp` server.
The mail verbs are exposed by the outbox server in a later change.

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
