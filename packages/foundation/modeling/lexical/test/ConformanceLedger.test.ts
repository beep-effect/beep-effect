import { it } from "@beep/test-runner";
import { validateConformanceLedgerArtifacts } from "@beep/test-utils/ConformanceLedger";
import { expect } from "@effect/vitest";
import { Effect } from "effect";

it.effect("validates the Lexical conformance ledger", () =>
  validateConformanceLedgerArtifacts(new URL("../", import.meta.url), "@beep/lexical-schema").pipe(
    Effect.map((issues) => expect(issues).toEqual([]))
  )
);
