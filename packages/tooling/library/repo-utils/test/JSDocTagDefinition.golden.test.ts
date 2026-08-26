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
import { FastCheck as fc } from "effect/testing";
import golden from "./__golden__/jsdoc-tag-fingerprints.json" with { type: "json" };
import type { TagName } from "@beep/repo-utils/JSDoc/models/tag-values";

const legacyMake: typeof make = dual(
  2,
  <const Tag extends TagName, const Def extends typeof JSDocTagDefinition.Encoded>(
    _tag: Tag,
    meta: Omit<JSDocTagDefinition.Instance<Tag, Def>, "_tag">
  ) => {
    const def = Result.getOrThrow(S.decodeResult(JSDocTagDefinition)({ _tag, ...meta }));
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

const sampleMember = <Tag extends TagName>(tag: Tag, seed: number) => {
  const value = pipe(fc.sample(S.toArbitrary(TagValue.cases[tag])(fc), { numRuns: 1, seed }), A.head, O.getOrThrow);

  return { _tag: tag, value };
};

const fingerprint = (schema: MemberSchema, sample: unknown) => {
  const metadata = pipe(getJSDocTagMetadata(schema), O.getOrThrow);
  const synchronous = schema as MemberSchema & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>;
  const decoded = S.decodeUnknownSync(synchronous)(sample);

  return {
    ast: String(schema.ast),
    annotation: S.encodeSync(JSDocTagDefinition)(metadata),
    fieldKeys: R.keys(schema.fields),
    roundTrip: S.encodeSync(synchronous)(decoded),
  };
};

const fingerprints = (implementation: MakeMember, jsDocTag: JSDocTagSchema) =>
  R.fromEntries(
    A.map(jsDocTag.discriminants, (tag, index) => {
      const definition = pipe(getJSDocTagMetadata(jsDocTag.cases[tag]), O.getOrThrow);
      const { _tag: _, ...meta } = S.encodeSync(JSDocTagDefinition)(definition);
      const schema = implementation(tag, meta);

      return [tag, fingerprint(schema, sampleMember(tag, index + 1))] as const;
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
