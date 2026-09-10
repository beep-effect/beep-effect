# Instance

- id: `foundation-ui-system-speech-input-connection`
- file:line: `packages/foundation/ui-system/ui/src/components/speech-input.tsx:53`
- symbol: `SpeechInputContextValue`
- members: `isConnected`, `isConnecting`
- evidence classes:
  - E1 at `packages/foundation/ui-system/ui/src/components/speech-input.tsx:236,288-290` — `isConnecting` and `isConnected` are projections of the same `scribe.status`; the upstream connected projection is `use-scribe.ts:371`.
  - E2 at `packages/foundation/ui-system/ui/src/components/speech-input.tsx:371-383` — the three icon branches reconstruct connecting, connected, and idle from the pair.

Reviewed against merged checkout `7440cb8c4302ce64b87860069a464bafbf65f576`
and main corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. The
speech wrapper source is unchanged from the earlier
`05405bf322da0ca7eb88b8bb402145081e8fded6` /
`be8995e66aeefedf0dabf131deaeaaf25c8e6fc8` review; the installed
`@elevenlabs/client@1.25.0` still satisfies the live wrapper calls and event
types.

# Current shape

Live declaration at `packages/foundation/ui-system/ui/src/components/speech-input.tsx:49`:

```ts
interface SpeechInputContextValue {
  readonly cancel: () => void;
  readonly committedTranscripts: string[];
  readonly error: string | null;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly partialTranscript: string;
  readonly size: VariantProps<typeof buttonVariants>["size"];
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly transcript: string;
}
```

# Cardinality gap

The two booleans represent four combinations. The upstream connection has exactly three legal states:

- `idle`
- `connecting`
- `connected`

Both booleans true is illegal. This context is a derived projection of one upstream source, `scribe.status`; it must pass that source literal through rather than store or mint another domain.

# Target schema

`ScribeStatus` is repo-owned: it is declared locally at
`packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:77`, rather than
imported from `@elevenlabs/client`. Promote that existing canonical owner to a
`LiteralKit` value and derived same-name type. Preserve the exact three
strings and the existing type export; the new value export makes construction
and guards schema-owned without creating a second family.

```ts
import { $UiId } from "@beep/identity"
import { LiteralKit } from "@beep/schema"

const $I = $UiId.create("hooks/use-scribe")

export const ScribeStatus = LiteralKit(["idle", "connecting", "connected"]).pipe(
  $I.annoteSchema("ScribeStatus", {
    description: "Lifecycle state of an ElevenLabs Scribe realtime connection.",
  })
)
export type ScribeStatus = typeof ScribeStatus.Type
```

Use `ScribeStatus.Enum.*` at the existing status writers and
`ScribeStatus.is.*` at guards. This changes neither the runtime strings nor
the exported type accepted by existing consumers.

```ts
import { ScribeStatus } from "@beep/ui/hooks/use-scribe";
import type { AudioFormat, CommitStrategy } from "@beep/ui/hooks/use-scribe";

interface SpeechInputContextValue {
  readonly cancel: () => void;
  readonly committedTranscripts: string[];
  readonly error: string | null;
  readonly partialTranscript: string;
  readonly size: VariantProps<typeof buttonVariants>["size"];
  readonly start: () => Promise<void>;
  readonly status: ScribeStatus;
  readonly stop: () => void;
  readonly transcript: string;
}

const contextValue: SpeechInputContextValue = {
  status: scribe.status,
  start,
  stop,
  cancel,
  error: scribe.error,
  size,
  ...buildEvent({
    partialTranscript: scribe.partialTranscript,
    committedTranscripts: A.map(scribe.committedTranscripts, (t) => t.text),
  }),
};
```

Consumers use the one canonical value's guards. No local status kit belongs in
`speech-input.tsx`.

The state-carrier change must leave connection orchestration untouched.
`startRequestIdRef` at lines 208 and 238-267 invalidates an older token or
connection completion after a later start, stop, cancel, or unmount. Keep those
request-id checks, the stale completion disconnect, transcript reset timing,
and swallowed start rejection exactly as they are. Keep `useScribe.connect`
responsible for the `idle -> connecting -> connected` transition and for
returning to idle on close/error. Do not derive status from promise settlement
or add another pending flag.

# Migration inventory

- `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:35-42` — import
  `$UiId` and `LiteralKit`, and create the module identity composer.
- `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:61-77` — replace
  the plain union with the exported `ScribeStatus` kit and its derived
  same-name type; retain and update both value/type JSDoc examples.
- `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:154-160,223-352,365-374`
  — use `ScribeStatus.Enum.*` for every idle/connecting/connected write and
  `ScribeStatus.is.connected` for the convenience projection. Do not change
  any surrounding connection control flow.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:19` —
  import the canonical `ScribeStatus` value for guards and its same-name type
  through the existing subpath.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:53-54` — replace both booleans with `readonly status: ScribeStatus`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:236` — delete the `isConnecting` projection.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:288-300` — pass `status: scribe.status` through the context instead of writing two derived booleans.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:316` — use `ScribeStatus.is.connected(scribe.status)` for root styling; stop consuming the upstream convenience boolean in this component.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:351-365` — record-button click, disabled state, scale, and label use the canonical connected/connecting guards.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:371-383` — each icon visibility branch uses one exact `ScribeStatus.is.*` guard.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:423`, `:429`, and `:433` — preview inertness, width, and ARIA visibility use `ScribeStatus.is.connected`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:473` and `:481` — cancel-button inertness and visibility use `ScribeStatus.is.connected`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:208,238-307`
  — no semantic edit: retain request-id invalidation, callback ordering,
  transcript clearing, and unmount disconnect while changing only context
  projection.
- `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:207-374` — retain
  this hook as the sole owner of connection state; only replace status literals
  and comparisons with the promoted kit's constructors/guards.

`packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:140` and `:371` expose the upstream `isConnected` convenience property, but that property is not a member of `SpeechInputContextValue`; removing it from `UseScribeResult` would be a separate blast-radius decision and is not required for this instance.

# Guard-deletion accounting

- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:236` and `:288-290` — delete both boolean projections from the one upstream `status`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:377` — delete `!isConnecting && isConnected`, whose conjunction exists only to enforce coherence between the flattened flags.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:383` — delete `!isConnecting && !isConnected`, whose double negation reconstructs `idle`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:351-365`, `:423-433`, and `:473-481` — delete repeated reads of the derived `isConnected` bit and branch on the named upstream state.
- `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:77` — delete the
  hand-authored literal union; the same-name type now derives from
  `ScribeStatus.Type`.

# Encoded-side impact

none (internal)

# Test impact

No file under `packages/foundation/ui-system/ui/test/` and no current story
imports `SpeechInput`. Add focused component coverage at the
`@elevenlabs/client` boundary for:

- idle: microphone visible, record enabled, preview/cancel inert;
- delayed token then connecting: progress marker visible and record disabled;
- open connection: stop icon, cancel control, and preview visible;
- partial then committed transcript events: existing event payload and preview
  precedence remain unchanged;
- stop: request invalidated, disconnect before `onStop`, retained transcript
  delivered;
- cancel: request invalidated, disconnect and clear before returning idle, but
  the pre-clear event delivered to `onCancel`;
- two starts whose token promises settle out of order, plus stop/cancel and
  unmount while a start is pending: preserve the current stale branch exactly.
  A request stale before `connect` still reaches the following continuation,
  calls `scribe.disconnect()`, and never calls `onStart`; this design does
  not silently repair that broader orchestration behavior;
- connection close, auth failure, quota failure, and generic error return to
  idle and preserve the current callback/error behavior.

No encoded fixture changes. For recorded browser QA, use a portless Storybook
fixture whose browser harness installs deterministic microphone and
`@elevenlabs/client` connection doubles before the component loads; do not
write context state directly. Drive the real record/cancel buttons with
Playwright input and record these visible scenarios: idle -> delayed connecting
-> connected; partial/committed preview; stop and restart; cancel clearing the
preview; rejected start followed by a successful retry; and rapid double-start
with the older token resolving last. For that last case, assert the existing
stale continuation disconnects and does not call `onStart`; changing it is
outside this carrier migration. Capture button labels, disabled/inert and ARIA
state, callback order, connection open/close counts, and zero unexpected
console errors in the manifest. Run record -> extract -> judge and retain a
green round with `requiredCount: 0`.

# Risk & sequencing

This is a single-component, derived-state migration. Add `status` to the
context, promote its existing upstream owner, and migrate every writer and
compound child in the same landing. Keep `useScribe.isConnected` because it
is an existing hook convenience API with a separate blast radius. The main
regression risk is changing start invalidation or callback timing while
replacing string literals and render guards; the migration must not touch that
control flow. `@beep/schema` is already an `@beep/ui` dependency, and
`$UiId` is already the package's established schema-identity convention; no
manifest or lockfile change is required.
