import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationMetadataStringBudget,
  assertCitationMetadataStringsDeadline,
  replayCitationMetadataStrings,
} from "./CitationMetadataStrings.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("native metadata strings", (it) => {
  it.effect(
    "preflights extra copies, preserves early-return order and owns output",
    assertCitationMetadataStringBudget,
    { timeout: 60000 }
  );
  it.effect(
    "retains both captured helper deadlines under a disabled caller Clock",
    assertCitationMetadataStringsDeadline,
    { timeout: 60000 }
  );
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches source pincites and parenthetical controls through ${kind}`,
      () => replayCitationMetadataStrings(kind, false),
      { timeout: 120000 }
    );
  }
});
