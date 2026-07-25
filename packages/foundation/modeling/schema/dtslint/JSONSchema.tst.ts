import { Node, NodeCodec } from "@beep/schema/JSONSchema";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type { JSONSchema } from "@beep/schema";
import type { Document, SubSchema, Types } from "@beep/schema/JSONSchema";
import type { Effect } from "effect";
import type * as O from "effect/Option";

describe("JSONSchema", () => {
  it("Option-wraps every optional keyword on the runtime type", () => {
    expect<Node["minLength"]>().type.toBe<O.Option<number>>();
    expect<Node["title"]>().type.toBe<O.Option<string>>();
    expect<Node["deprecated"]>().type.toBe<O.Option<boolean>>();
    expect<Node["$ref"]>().type.toBe<O.Option<string>>();
    expect<Node["type"]>().type.toBe<O.Option<Types>>();
    expect<Node["items"]>().type.toBe<O.Option<SubSchema.Type>>();
    expect<Node["extensions"]>().type.toBe<{ readonly [x: string]: unknown }>();
  });

  it("instances satisfy the hand-declared namespace Type", () => {
    expect<Node>().type.toBeAssignableTo<Node.Type>();
    expect<Node>().type.toBeAssignableTo<JSONSchema.Node.Type>();
    expect<Node.Type["items"]>().type.toBe<O.Option<SubSchema.Type>>();
    expect<Node.Type["properties"]>().type.toBe<O.Option<{ readonly [key: string]: SubSchema.Type }>>();
  });

  it("wire form is a flat open record with every keyword absent-able", () => {
    expect<Node.Encoded>().type.toBe<{ readonly [keyword: string]: unknown }>();
    expect<{ readonly type: "object" }>().type.toBeAssignableTo<Node.Encoded>();
    expect<Record<string, never>>().type.toBeAssignableTo<Node.Encoded>();
  });

  it("SubSchema is the boolean-or-node union on both sides", () => {
    expect<SubSchema.Type>().type.toBe<boolean | Node.Type>();
    expect<SubSchema.Encoded>().type.toBe<boolean | Node.Encoded>();
    expect<SubSchema>().type.toBeAssignableTo<boolean | Node.Type>();
  });

  it("NodeCodec decodes flat records into Node instances", () => {
    expect<NodeCodec>().type.toBe<Node>();
    expect<typeof NodeCodec.Encoded>().type.toBeAssignableTo<Node.Encoded>();
    const decode = S.decodeUnknownEffect(NodeCodec);
    const encode = S.encodeEffect(NodeCodec);
    expect(decode({})).type.toBe<Effect.Effect<Node, S.SchemaError, never>>();
    expect(encode(Node.make({}))).type.toBe<Effect.Effect<{ readonly [x: string]: unknown }, S.SchemaError, never>>();
  });

  it("Document mirrors effect's draft-2020-12 envelope", () => {
    expect<Document["dialect"]>().type.toBe<"draft-2020-12">();
    expect<Document["schema"]>().type.toBe<Node>();
    expect<Document["definitions"]>().type.toBe<{ readonly [x: string]: Node }>();
    expect<Document>().type.toBeAssignableTo<Document.Type>();
    expect<Document.Encoded["dialect"]>().type.toBe<"draft-2020-12" | undefined>();
  });
});
