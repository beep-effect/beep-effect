/** Snapshot the published vocabulary through its public structured codec only. */
import {
  CourtReporterArtifact,
  CourtReporterArtifactContract,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

if (Result.isFailure(CourtReporterArtifact)) throw new Error("Public vocabulary failed decoding");
Effect.runPromise(
  S.encodeEffect(S.fromJsonString(CourtReporterArtifactContract))(CourtReporterArtifact.success).pipe(
    Effect.flatMap((text) => Effect.tryPromise(() => Bun.write(process.argv[2]!, text)))
  )
);
