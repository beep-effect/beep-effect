import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import {
  FilingDecisionLlmConfig,
  FilingDecisionLlmConfigValue,
  FilingDecisionLlmLayer,
} from "@beep/documents-server/aggregates/Document";
import { Document } from "@beep/documents-use-cases/server";
import { SecretScrub } from "@beep/file-processing";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Prompt from "effect/ai/Prompt";
import * as Response from "effect/ai/Response";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as References from "effect/References";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";

const canary = () => A.join(["canary", "Alpha", "4927", "Beta"], "");
const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodePrompt = S.encodeEffect(S.fromJsonString(Prompt.Prompt));
const usage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});
const config = Layer.succeed(
  FilingDecisionLlmConfig,
  FilingDecisionLlmConfigValue.make({
    confidenceThreshold: UnitInterval.make(0.6),
    extractionTimeout: Duration.seconds(15),
    maxExcerptChars: 8000,
    maxMaterializedBytes: 32 * 1024 * 1024,
    model: "fixture-model",
  })
);
class GateCase extends S.Class<GateCase>("SecretScrubGateCase")({
  id: S.NonEmptyString,
  text: S.Option(S.String),
  coverage: SecretScrub.SecretCoverage,
  admitted: S.Boolean,
}) {}
const cases = [
  GateCase.make({ id: "clean", text: O.some("Public complaint."), coverage: "known", admitted: true }),
  GateCase.make({ id: "masked", text: O.some(`API_KEY=${canary()}`), coverage: "known", admitted: true }),
  GateCase.make({ id: "blocked", text: O.some(`<private>${canary()}`), coverage: "known", admitted: false }),
  GateCase.make({ id: "unknown", text: O.some(`API_KEY=${canary()}`), coverage: "unknown", admitted: false }),
  GateCase.make({ id: "absent", text: O.none(), coverage: "known", admitted: true }),
];

describe("FilingDecisionLlm secret scrub gate", () => {
  for (const fixture of cases) {
    let calls = 0;
    let prompts = A.empty<string>();
    let logs = A.empty<unknown>();
    let spans = A.empty<Tracer.Span>();
    const logger = Logger.make<unknown, void>((options) => {
      logs = A.append(logs, options.message);
      logs = A.append(logs, Cause.pretty(options.cause));
    });
    const tracer = Tracer.make({
      span(options) {
        const span = Tracer.nativeTracer.span(options);
        spans = A.append(spans, span);
        return span;
      },
    });
    const model = Layer.effect(
      LanguageModel.LanguageModel,
      LanguageModel.make({
        generateText: Effect.fn("generateText")(function* (options) {
          calls += 1;
          prompts = A.append(prompts, yield* encodePrompt(options.prompt).pipe(Effect.orDie));
          return [
            Response.makePart("text", {
              text: '{"confidence":0.91,"rationale":"Public complaint.","taxonomyConceptId":"pleadings"}',
            }),
            Response.makePart("finish", { reason: "stop", response: undefined, usage }),
          ];
        }),
        streamText: () => Stream.empty,
      })
    );
    const scrub = Layer.succeed(
      SecretScrub.SecretScrubService,
      SecretScrub.SecretScrubService.of({
        scrub: Effect.fnUntraced(function* (input) {
          return yield* SecretScrub.scrubSecretText(
            SecretScrub.SecretScrubInput.make({ ...input, coverage: fixture.coverage })
          );
        }),
      })
    );
    const decisionLayer = FilingDecisionLlmLayer.pipe(Layer.provide(Layer.mergeAll(config, model, scrub)));
    const testLayer = decisionLayer.pipe(
      Layer.provideMerge(Logger.layer([logger])),
      Layer.provideMerge(Layer.succeed(References.MinimumLogLevel, "Debug"))
    );
    it.layer(testLayer, { timeout: "10 seconds" })((it) => {
      it.effect(fixture.id, () =>
        Effect.gen(function* () {
          const outcome = yield* Effect.gen(function* () {
            return yield* (yield* Document.FilingDecision).decide(
              Document.FilingDecisionInput.make({
                contentDigest: DocumentContentDigest.make("fixture-digest"),
                originalFileName: "synthetic-document.pdf",
                textExcerpt: fixture.text,
              })
            );
          }).pipe(Effect.withTracer(tracer));
          expect(calls).toBe(fixture.admitted ? 1 : 0);
          expect(outcome.kind === (fixture.admitted ? "filed" : "inboxed")).toBe(true);
          if (outcome.kind === "inboxed") expect(outcome.reason).toBe("secret-scrub-blocked");
          expect(A.every(prompts, (text) => !Str.includes(canary())(text))).toBe(true);
          expect(Str.includes(canary())(yield* encode(logs))).toBe(false);
          expect(A.length(logs) > 0).toBe(true);
          expect(A.length(spans) > 0).toBe(true);
          const telemetry = A.map(spans, (span) => ({
            name: span.name,
            attributes: A.fromIterable(span.attributes),
            cause:
              span.status._tag === "Ended" && span.status.exit._tag === "Failure"
                ? Cause.pretty(span.status.exit.cause)
                : "",
          }));
          expect(Str.includes(canary())(yield* encode(telemetry))).toBe(false);
          if (fixture.id === "masked") expect(A.some(prompts, Str.includes("API_KEY=[REDACTED]"))).toBe(true);
          if (fixture.id === "absent") expect(A.some(prompts, Str.includes("Document text excerpt"))).toBe(false);
        })
      );
    });
  }
});
