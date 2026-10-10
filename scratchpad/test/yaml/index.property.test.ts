import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Y from "../../effected/yaml/index.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E, RD, RE>(name: string, schema: S.Codec<T, E, RD, RE>): void => {
  // YamlDocument's suspended schema conservatively exposes unknown services;
  // these pure data codecs round-trip with an empty service context.
  const services = Context.makeUnsafe<RD | RE>(Context.empty().mapUnsafe);
  it.effect.prop(`barrel ${name} round trip`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value).pipe(Effect.provideContext(services));
    const decoded = yield* S.decodeEffect(schema)(encoded).pipe(Effect.provideContext(services));
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded).pipe(Effect.provideContext(services)), encoded);
  }), runs);
};
describe("YAML barrel schema property floor", () => {
  roundTrips("YamlParseError", Y.YamlParseError);
  roundTrips("YamlParseOptions", Y.YamlParseOptions);
  roundTrips("YamlStringifyError", Y.YamlStringifyError);
  roundTrips("YamlStringifyOptions", Y.YamlStringifyOptions);
  roundTrips("YamlComposerErrorCode", Y.YamlComposerErrorCode);
  roundTrips("YamlDiagnostic", Y.YamlDiagnostic);
  roundTrips("YamlErrorCode", Y.YamlErrorCode);
  roundTrips("YamlLexErrorCode", Y.YamlLexErrorCode);
  roundTrips("YamlModifyErrorCode", Y.YamlModifyErrorCode);
  roundTrips("YamlParseErrorCode", Y.YamlParseErrorCode);
  roundTrips("YamlStringifyErrorCode", Y.YamlStringifyErrorCode);
  roundTrips("YamlDirective", Y.YamlDirective);
  roundTrips("YamlDocument", Y.YamlDocument);
  roundTrips("YamlEdit", Y.YamlEdit);
  roundTrips("YamlRange", Y.YamlRange);
  roundTrips("YamlFormattingOptions", Y.YamlFormattingOptions);
  roundTrips("YamlModificationError", Y.YamlModificationError);
  roundTrips("StyleConflict", Y.StyleConflict);
  roundTrips("StyleEvidence", Y.StyleEvidence);
  roundTrips("StyleFloorTally", Y.StyleFloorTally);
  roundTrips("StyleVoteTally", Y.StyleVoteTally);
  roundTrips("YamlLintConfig", Y.YamlLintConfig);
  roundTrips("YamlLintRuleSetting", Y.YamlLintRuleSetting);
  roundTrips("YamlStyleConflictError", Y.YamlStyleConflictError);
  roundTrips("StyleFloor", Y.StyleFloor);
  roundTrips("StyleVote", Y.StyleVote);
  roundTrips("YamlLintDiagnostic", Y.YamlLintDiagnostic);
  roundTrips("YamlLintSeverity", Y.YamlLintSeverity);
  // Node vocabularies, classes and token schemas are checked in their own property files.
});
