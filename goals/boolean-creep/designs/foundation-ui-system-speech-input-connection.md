# Instance

- id: `foundation-ui-system-speech-input-connection`
- file:line: `packages/foundation/ui-system/ui/src/components/speech-input.tsx:53`
- symbol: `SpeechInputContextValue`
- members: `isConnected`, `isConnecting`
- evidence classes:
  - E1 at `packages/foundation/ui-system/ui/src/components/speech-input.tsx:236` — isConnecting is derived as status==='connecting'; isConnected is status==='connected' (`use-scribe.ts:371`). Combined-true is unrepresentable in the upstream ScribeStatus.
  - E2 at `packages/foundation/ui-system/ui/src/components/speech-input.tsx:377` — Icon branches pair !isConnecting && isConnected vs !isConnecting && !isConnected; never handles both-true.

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

Reuse the existing `ScribeStatus` type exported from `@beep/ui/hooks/use-scribe` at `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:77`. No new literal kit or schema is introduced in this instance because `scribe.status` is the required source of truth. The interface is a React context contract containing functions, not a pure-data model.

```ts
import type { AudioFormat, CommitStrategy, ScribeStatus } from "@beep/ui/hooks/use-scribe";

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

Consumers compare the one `status` value. A future schema-first conversion of the pre-existing `ScribeStatus` declaration is outside this instance; duplicating it locally is forbidden.

# Migration inventory

- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:19` — import the existing `ScribeStatus` type.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:53-54` — replace both booleans with `readonly status: ScribeStatus`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:236` — delete the `isConnecting` projection.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:288-300` — pass `status: scribe.status` through the context instead of writing two derived booleans.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:316` — use `scribe.status === "connected"` for the root styling (or the context only inside children); stop consuming the upstream convenience boolean in this component.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:351-365` — record-button click, disabled state, scale, and label branch on `speechInput.status` (`connected`, `connecting`, or otherwise `idle`).
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:371-383` — each icon visibility condition becomes one exact status comparison.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:423`, `:429`, and `:433` — preview inertness, width, and ARIA visibility compare status with `connected`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:473` and `:481` — cancel-button inertness and visibility compare status with `connected`.

`packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:140` and `:371` expose the upstream `isConnected` convenience property, but that property is not a member of `SpeechInputContextValue`; removing it from `UseScribeResult` would be a separate blast-radius decision and is not required for this instance.

# Guard-deletion accounting

- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:236` and `:288-290` — delete both boolean projections from the one upstream `status`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:377` — delete `!isConnecting && isConnected`, whose conjunction exists only to enforce coherence between the flattened flags.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:383` — delete `!isConnecting && !isConnected`, whose double negation reconstructs `idle`.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:351-365`, `:423-433`, and `:473-481` — delete repeated reads of the derived `isConnected` bit and branch on the named upstream state.

# Encoded-side impact

none (internal)

# Test impact

No file under `packages/foundation/ui-system/ui/test/` imports `SpeechInput` or reads these context members. Add component coverage for all three upstream statuses: idle shows/enables the microphone, connecting shows the progress dot and disables the button, and connected shows stop/cancel/transcript UI. No encoded fixtures change.

# Risk & sequencing

This is a single-component, derived-state migration. The critical sequencing rule is to add `status` to the context and migrate every compound child in the same landing; otherwise consumers see an incompatible context shape. Do not create a second connection literal domain in `speech-input.tsx`, and do not fold the broader `useScribe.isConnected` API removal into this instance.
