import { JSDocTag } from "@beep/repo-utils/JSDoc/JSDoc";
import { getJSDocTagMetadata } from "@beep/repo-utils/JSDoc/models/JSDocTagAnnotation.model";
import { JSDocTagDefinition, make } from "@beep/repo-utils/JSDoc/models/JSDocTagDefinition.model";
import { TagValue } from "@beep/repo-utils/JSDoc/models/tag-values";
import { describe, expect, it } from "@effect/vitest";
import { pipe, Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import golden from "./__golden__/jsdoc-tag-fingerprints.json" with { type: "json" };
import type { TagName } from "@beep/repo-utils/JSDoc/models/tag-values";

const decodeJSDocTagDefinitionResult = S.decodeResult(JSDocTagDefinition);
const encodeJSDocTagDefinitionSync = S.encodeSync(JSDocTagDefinition);

const legacyMake: typeof make = dual(
  2,
  <const Tag extends TagName, const Def extends typeof JSDocTagDefinition.Encoded>(
    _tag: Tag,
    meta: Omit<JSDocTagDefinition.Instance<Tag, Def>, "_tag">
  ) => {
    const def = Result.getOrThrow(decodeJSDocTagDefinitionResult({ _tag, ...meta }));
    return JSDocTagDefinition.mapFields((_) => ({
      _tag: S.tag(_tag),
      value: TagValue.cases[_tag],
    })).annotate({ jsDocTagMetadata: def });
  }
);

type MemberSchema = ReturnType<typeof JSDocTagDefinition.mapFields>;
type MakeMember = <const Tag extends TagName, const Def extends typeof JSDocTagDefinition.Encoded>(
  tag: Tag,
  meta: Omit<JSDocTagDefinition.Instance<Tag, Def>, "_tag">
) => MemberSchema;
type JSDocTagSchema = typeof JSDocTag;

// Reuse captured wire values: native Arbitrary seeds do not reproduce fast-check samples.
const sampleMember = (tag: TagName) => golden[tag].roundTrip;

const fingerprint = (schema: MemberSchema, sample: unknown) => {
  const metadata = pipe(getJSDocTagMetadata(schema), O.getOrThrow);
  const synchronous = schema as MemberSchema & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>;
  const decoded = S.decodeUnknownSync(synchronous)(sample);

  return {
    ast: String(schema.ast),
    annotation: encodeJSDocTagDefinitionSync(metadata),
    fieldKeys: R.keys(schema.fields),
    roundTrip: S.encodeSync(synchronous)(decoded),
  };
};

const fingerprints = (implementation: MakeMember, jsDocTag: JSDocTagSchema) =>
  R.fromEntries(
    A.map(jsDocTag.discriminants, (tag) => {
      const definition = pipe(getJSDocTagMetadata(jsDocTag.cases[tag]), O.getOrThrow);
      const { _tag: _, ...meta } = encodeJSDocTagDefinitionSync(definition);
      const schema = implementation(tag, meta);

      return [tag, fingerprint(schema, sampleMember(tag))] as const;
    })
  );

describe("JSDocTagDefinition.make golden compatibility", () => {
  it("matches the copied legacy body for representative tags", () => {
    const current = fingerprints(make, JSDocTag);
    const legacy = fingerprints(legacyMake, JSDocTag);

    for (const tag of ["param", "returns", "deprecated", "example"] as const) {
      expect(current[tag]).toEqual(legacy[tag]);
    }
  });

  it("matches every pre-migration JSDoc tag fingerprint", () => {
    expect(fingerprints(make, JSDocTag)).toEqual(golden);
  });
});
