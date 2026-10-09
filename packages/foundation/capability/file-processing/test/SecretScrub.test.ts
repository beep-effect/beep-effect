import { SecretScrub } from "@beep/file-processing";
import { CredentialPatternBank as Bank } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { constTrue } from "effect/Function";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import * as TestClock from "effect/testing/TestClock";
import { canaryBuilders, secretScrubFixtures } from "./fixtures/SecretScrub.fixtures.ts";
import { countCanaries } from "./support/CanaryScan.ts";

const { credentialPatternBankVersion } = Bank;

const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeResult = S.encodeEffect(S.fromJsonString(SecretScrub.SecretScrubResult));
const encodeCounts = S.encodeEffect(S.fromJsonString(S.Array(SecretScrub.SecretCategoryCount)));
const encodeEvidence = S.encodeEffect(S.fromJsonString(S.Array(SecretScrub.SecretEvidence)));

describe("secret scrub proof and prompt admission", () => {
  for (const fixture of secretScrubFixtures()) {
    it.effect(fixture.id, () =>
      Effect.gen(function* () {
        let messages = A.empty<unknown>();
        let spans = A.empty<Tracer.Span>();
        const logger = Logger.make<unknown, void>((options) => {
          messages = A.append(messages, options.message);
        });
        const tracer = Tracer.make({
          span(options) {
            const span = Tracer.nativeTracer.span(options);
            spans = A.append(spans, span);
            return span;
          },
        });
        const result = yield* SecretScrub.scrubSecretText(
          SecretScrub.SecretScrubInput.make({ text: fixture.text, coverage: fixture.inputCoverage })
        ).pipe(Effect.withLogger(logger), Effect.withTracer(tracer));
        // Boolean comparisons keep assertion failures from serializing transient input.
        expect(result.sanitizedText === fixture.expected.sanitizedText).toBe(true);
        expect(
          (yield* encodeCounts(result.proof.counts)) ===
            (yield* encodeCounts(
              A.map(fixture.expected.categories, (count) => SecretScrub.SecretCategoryCount.make(count))
            ))
        ).toBe(true);
        expect(result.coverage === fixture.expected.coverage).toBe(true);
        expect(result.residue === fixture.expected.residue).toBe(true);
        expect(result.safeForPrompt).toBe(fixture.expected.safeForPrompt);
        deepStrictEqual(O.isSome(SecretScrub.promptTextFromScrub(result)), fixture.expected.safeForPrompt);
        expect(S.is(SecretScrub.SecretScrubResult)(result)).toBe(true);
        expect(result.proof.bankVersion === credentialPatternBankVersion).toBe(true);
        expect(
          A.every(
            result.proof.evidence,
            (evidence) =>
              evidence.start <= evidence.end &&
              evidence.end <= fixture.text.length &&
              evidence.mask === "[REDACTED]" &&
              evidence.ruleVersion === "v1" &&
              evidence.retention.retentionClass === "scrub-proof" &&
              !("quote" in evidence) &&
              !("text" in evidence)
          )
        ).toBe(true);
        expect(countCanaries(yield* encodeResult(result), canaryBuilders)).toBe(
          fixture.expected.persistenceCanaryCount
        );
        expect(countCanaries(yield* encodeEvidence(result.proof.evidence), canaryBuilders)).toBe(0);
        expect(countCanaries(yield* encode(messages), canaryBuilders)).toBe(fixture.expected.logCanaryCount);
        expect(
          countCanaries(
            yield* encode(
              A.map(spans, (span) => ({
                name: span.name,
                attributes: A.fromIterable(span.attributes),
                status: span.status._tag,
              }))
            ),
            canaryBuilders
          )
        ).toBe(0);
        // The paired action policy is independent of the admission capability.
        if (fixture.id === "action-enabling-public-denied") {
          expect(result.safeForPrompt && !fixture.expected.actionAuthorized).toBe(true);
        }
        if (fixture.id === "unknown-action-allowed") {
          expect(!result.safeForPrompt && fixture.expected.actionAuthorized).toBe(true);
        }
      })
    );
  }

  it.effect("rejects inconsistent results even when the claimed boolean is true", () =>
    Effect.gen(function* () {
      const clean = yield* SecretScrub.scrubSecretText(SecretScrub.SecretScrubInput.make({ text: "public text" }));
      const forged = SecretScrub.SecretScrubResult.make({ ...clean, sanitizedText: `API_KEY=${canaryBuilders[0]()}` });
      for (const result of [
        forged,
        SecretScrub.SecretScrubResult.make({ ...clean, coverage: "unknown" }),
        SecretScrub.SecretScrubResult.make({ ...clean, residue: "present" }),
        SecretScrub.SecretScrubResult.make({ ...clean, safeForPrompt: false }),
      ]) {
        assertNone(O.map(SecretScrub.promptTextFromScrub(result), constTrue));
      }
    })
  );
});

describe("ratified secret retention decisions", () => {
  it.prop(
    "resolved raw is always purgeable and pinned proof is retained",
    [Arbitrary.schema(SecretScrub.SecretRetentionRecord)],
    ([record]) => {
      const raw = SecretScrub.SecretRetentionRecord.make({
        ...record,
        retentionClass: "transient-raw",
        purposeResolved: true,
      });
      const proof = SecretScrub.SecretRetentionRecord.make({ ...record, retentionClass: "scrub-proof", pinned: true });
      expect(SecretScrub.isSecretPurgeEligible(raw, record.createdAtEpochMillis)).toBe(true);
      expect(SecretScrub.isSecretPurgeEligible(proof, SecretScrub.secretRetentionDeadline(proof))).toBe(false);
    }
  );

  it.effect("uses TestClock at raw/proof deadlines and honors purpose and pins", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(0);
      const record = (retentionClass: SecretScrub.SecretRetentionClass, purposeResolved = false, pinned = false) =>
        SecretScrub.SecretRetentionRecord.make({ retentionClass, createdAtEpochMillis: 0, purposeResolved, pinned });
      expect(SecretScrub.isSecretPurgeEligible(record("transient-raw", true), yield* Clock.currentTimeMillis)).toBe(
        true
      );
      yield* TestClock.adjust(Duration.days(7));
      const rawDeadline = yield* Clock.currentTimeMillis;
      expect(SecretScrub.isSecretPurgeEligible(record("transient-raw"), rawDeadline - 1)).toBe(false);
      expect(SecretScrub.isSecretPurgeEligible(record("transient-raw"), rawDeadline)).toBe(true);
      expect(SecretScrub.isSecretPurgeEligible(record("scrub-proof"), rawDeadline)).toBe(false);
      yield* TestClock.adjust(Duration.days(23));
      const proofDeadline = yield* Clock.currentTimeMillis;
      expect(SecretScrub.isSecretPurgeEligible(proofDeadline - 1)(record("scrub-proof"))).toBe(false);
      expect(SecretScrub.isSecretPurgeEligible(record("scrub-proof"), proofDeadline)).toBe(true);
      expect(SecretScrub.isSecretPurgeEligible(record("scrub-proof", false, true), proofDeadline)).toBe(false);
    })
  );
  it.effect("uses twelve calendar months across a leap year", () =>
    Effect.gen(function* () {
      const start = 1_709_164_800_000; // 2024-02-29 UTC
      const deadline = 1_740_700_800_000; // 2025-02-28 UTC
      const record = SecretScrub.SecretRetentionRecord.make({
        retentionClass: "audit",
        createdAtEpochMillis: start,
        purposeResolved: false,
        pinned: true,
      });
      yield* TestClock.setTime(deadline - 1);
      expect(SecretScrub.secretRetentionDeadline(record)).toBe(deadline);
      expect(SecretScrub.isSecretPurgeEligible(record, yield* Clock.currentTimeMillis)).toBe(false);
      yield* TestClock.adjust(1);
      expect(SecretScrub.isSecretPurgeEligible(record, yield* Clock.currentTimeMillis)).toBe(true);
    })
  );
});
