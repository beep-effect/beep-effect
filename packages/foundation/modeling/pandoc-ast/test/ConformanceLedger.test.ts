import { validateConformanceLedgerArtifacts } from "@beep/test-utils/ConformanceLedger";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

it.effect("validates the Pandoc conformance ledger", () =>
  validateConformanceLedgerArtifacts(new URL("../", import.meta.url), "@beep/pandoc-ast").pipe(
    Effect.map((issues) => expect(issues).toEqual([]))
  )
);
