/**
 * Runtime-neutral secret scrub service; raw input is retained only during the transformation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $FileProcessingId } from "@beep/identity";
import * as Bank from "@beep/schema/CredentialPatternBank";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import {
  SecretCategoryCount,
  SecretCoverage,
  SecretEvidence,
  SecretRetentionRecord,
  SecretScrubProof,
  SecretScrubResult,
} from "./SecretScrub.schema.ts";
import type { SecretScrubInput } from "./SecretScrub.schema.ts";

const $I = $FileProcessingId.create("SecretScrub.service");

/**
 * Explicit scrub service boundary with no secret resolver, storage, tool or egress capability.
 * **Example** (Inspect the service key)
 * ```ts import.meta.vitest name="Inspect the service key"
 * import { SecretScrub } from "@beep/file-processing"
 * console.log(SecretScrub.SecretScrubService.key)
 * ```
 * @category services
 * @since 0.0.0
 */
export class SecretScrubService extends Context.Service<
  SecretScrubService,
  {
    readonly scrub: (input: SecretScrubInput) => Effect.Effect<SecretScrubResult>;
  }
>()($I`SecretScrubService`) {}

/**
 * Apply the canonical bank, mask all detected extents and return non-secret proof.
 * **Example** (Scrub public text)
 * ```ts import.meta.vitest name="Scrub public text"
 * import { SecretScrub } from "@beep/file-processing"
 * import * as Effect from "effect/Effect"
 * const result = await Effect.runPromise(SecretScrub.scrubSecretText(SecretScrub.SecretScrubInput.make({ text: "public text" })))
 * console.log(result.proof.counts)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const scrubSecretText = Effect.fn($I`scrubSecretText`)(function* (input: SecretScrubInput) {
  const createdAtEpochMillis = yield* Clock.currentTimeMillis;
  const matches = Bank.detectCredentials(input.text);
  const sanitizedText = Bank.maskCredentialMatches(input.text, matches);
  const unresolved = A.some(matches, (match) => match.state === "unresolved");
  const residuePresent =
    A.some(matches, (match) => match.state === "residue") ||
    !A.isReadonlyArrayEmpty(Bank.detectCredentials(sanitizedText));
  const residue = unresolved ? "unresolved" : residuePresent ? "present" : "clear";
  const safeForPrompt = SecretCoverage.is.known(input.coverage) && residue === "clear";
  const retention = SecretRetentionRecord.make({
    retentionClass: "scrub-proof",
    createdAtEpochMillis,
    purposeResolved: false,
    pinned: false,
  });
  const counts = A.reduce(matches, HashMap.empty<Bank.CredentialCategory, number>(), (acc, match) =>
    match.state === "residue"
      ? acc
      : HashMap.set(acc, match.category, O.getOrElse(HashMap.get(acc, match.category), () => 0) + 1)
  );
  return SecretScrubResult.make({
    sanitizedText,
    coverage: input.coverage,
    residue,
    safeForPrompt,
    proof: SecretScrubProof.make({
      bankVersion: Bank.credentialPatternBankVersion,
      counts: A.filterMap(Bank.CredentialCategory.literals, (category) => {
        const count = HashMap.get(counts, category);
        return O.isNone(count)
          ? Result.failVoid
          : Result.succeed(SecretCategoryCount.make({ category, count: count.value }));
      }),
      evidence: A.map(matches, (match) =>
        SecretEvidence.make({
          ...match,
          bankVersion: Bank.credentialPatternBankVersion,
          count: 1,
          mask: "[REDACTED]",
          retention,
        })
      ),
      transientRaw: SecretRetentionRecord.make({
        retentionClass: "transient-raw",
        createdAtEpochMillis,
        purposeResolved: safeForPrompt,
        pinned: false,
      }),
      audit: SecretRetentionRecord.make({
        retentionClass: "audit",
        createdAtEpochMillis,
        purposeResolved: false,
        pinned: false,
      }),
    }),
  });
});

/**
 * Pure local bank implementation of the scrub contract; the clock remains injectable.
 * **Example** (Provide the service)
 * ```ts import.meta.vitest name="Provide the service"
 * import { SecretScrub } from "@beep/file-processing"
 * import * as Effect from "effect/Effect"
 * const program = Effect.gen(function* () { return (yield* SecretScrub.SecretScrubService).scrub })
 * console.log(await Effect.runPromise(program.pipe(Effect.provide(SecretScrub.SecretScrubLive))))
 * ```
 * @category layers
 * @since 0.0.0
 */
export const SecretScrubLive = Layer.succeed(SecretScrubService, SecretScrubService.of({ scrub: scrubSecretText }));
