import { validateConformanceLedgerArtifacts } from "@beep/test-utils/ConformanceLedger";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

it.effect("validates the Markdown conformance ledger", () =>
  validateConformanceLedgerArtifacts(new URL("../", import.meta.url), "@beep/md").pipe(
    Effect.map((issues) => expect(issues).toEqual([]))
  )
);
