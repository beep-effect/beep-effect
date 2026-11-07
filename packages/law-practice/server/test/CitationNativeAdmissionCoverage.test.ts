import { CitationAdmissionFailure } from "@beep/law-practice-server/internal/Citation/Admission";
import {
  acquireCitationNativeLease,
  CitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { CitationNativeProcessLease } from "@beep/law-practice-server/internal/Citation/NativeAdmission";

class Translated extends S.TaggedError<Translated, { readonly brand: unique symbol }>()("Translated", {
  reason: S.Literals(["quarantined", "closed"]),
}) {}
const lease: CitationNativeProcessLease = { quarantine: Effect.void, release: Effect.void };
const refusing = (error: CitationAdmissionFailure | CitationSafetyLimitExceeded, calls: Array<string>) =>
  CitationNativeProcessAdmission.of({
    acquire: Effect.fn("NativeAdmissionCoverage.refuseTotal")(function* (operation) {
      calls.push(`total:${operation}`);
      return yield* error;
    }),
    acquireRegex: Effect.fn("NativeAdmissionCoverage.refuseRegex")(function* (operation) {
      calls.push(`regex:${operation}`);
      return yield* error;
    }),
    snapshot: Effect.die("unused"),
  });
const translate = (reason: "quarantined" | "closed") => Translated.make({ reason });

it.effect("selects the total or regex reservation and returns its lease unchanged", () =>
  Effect.gen(function* () {
    const calls: Array<string> = [];
    const admission = CitationNativeProcessAdmission.of({
      acquire: Effect.fn("NativeAdmissionCoverage.acquireTotal")(function* (operation) {
        calls.push(`total:${operation}`);
        return lease;
      }),
      acquireRegex: Effect.fn("NativeAdmissionCoverage.acquireRegex")(function* (operation) {
        calls.push(`regex:${operation}`);
        return lease;
      }),
      snapshot: Effect.die("unused"),
    });
    const total = yield* acquireCitationNativeLease(admission, "clean", false, translate);
    const regex = yield* acquireCitationNativeLease(admission, "extract", true, translate);
    deepStrictEqual([total === lease, regex === lease], [true, true]);
    deepStrictEqual(calls, ["total:clean", "regex:extract"]);
  })
);

it.effect("passes safety limits through and translates admission reasons to quarantined or closed", () =>
  Effect.gen(function* () {
    const calls: Array<string> = [];
    const limit = CitationSafetyLimitExceeded.make({ operation: "extract", limit: "queueDeadline" });
    const passed = yield* acquireCitationNativeLease(refusing(limit, calls), "extract", true, translate).pipe(
      Effect.flip
    );
    deepStrictEqual(passed === limit, true);
    const outcomes = yield* Effect.forEach(["quarantined", "closed", "invalid-policy"] as const, (reason) =>
      acquireCitationNativeLease(
        refusing(CitationAdmissionFailure.make({ reason }), calls),
        "annotate",
        false,
        translate
      ).pipe(Effect.flip)
    );
    deepStrictEqual(
      A.map(outcomes, (error) => error._tag === "Translated" && error.reason),
      ["quarantined", "closed", "closed"]
    );
    deepStrictEqual(calls, ["regex:extract", "total:annotate", "total:annotate", "total:annotate"]);
  })
);
