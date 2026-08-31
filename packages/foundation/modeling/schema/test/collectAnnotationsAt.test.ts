import { collectAnnotationsAt } from "@beep/schema/SchemaUtils/collectAnnotationsAt";
import { describe, expect, it } from "@effect/vitest";
import { Effect, identity } from "effect";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

describe("collectAnnotationsAt", () => {
  it("supports data-first and data-last calls with deterministic root-first order", () => {
    const Name = S.String.annotate({ traversalLabel: "name" });
    const Count = S.Finite.annotate({ traversalLabel: "count" });
    const Root = S.Struct({ name: Name, counts: S.Array(Count) }).annotate({ traversalLabel: "root" });

    expect(collectAnnotationsAt(Root, "traversalLabel")).toEqual(["root", "name", "count"]);
    expect(collectAnnotationsAt("traversalLabel")(Root)).toEqual(["root", "name", "count"]);

    // @ts-expect-error The raw collector does not accept a caller-selected payload type.
    expect(collectAnnotationsAt<string>(Root, "traversalLabel")).toEqual(["root", "name", "count"]);
  });

  it("preserves ordinary annotations through checks and includes check and property-key annotations", () => {
    const Value = S.String.annotate({ traversalLabel: "ordinary" })
      .check(S.isMinLength(1))
      .annotate({ traversalLabel: "check" })
      .annotateKey({ traversalLabel: "key" });
    const Root = S.Struct({ value: Value });

    expect(collectAnnotationsAt(Root, "traversalLabel")).toEqual(["ordinary", "check", "key"]);
  });

  it("traverses filter groups and visits a reused nested check once within its owner", () => {
    const Shared = S.makeFilter(() => true, { traversalLabel: "shared" });
    const Group = S.makeFilterGroup([Shared, Shared], { traversalLabel: "group" });
    const Value = S.String.check(Group);

    expect(collectAnnotationsAt(Value, "traversalLabel")).toEqual(["group", "shared"]);
  });

  it("retains structurally equal sibling ASTs and counts reused checks once per owner", () => {
    const SharedCheck = S.makeFilter(() => true, { traversalLabel: "shared-check" });
    const Left = S.String.annotate({ traversalLabel: "same" }).check(SharedCheck);
    const Right = S.String.annotate({ traversalLabel: "same" }).check(SharedCheck);
    const Root = S.Struct({ left: Left, right: Right });

    expect(collectAnnotationsAt(Root, "traversalLabel")).toEqual(["same", "shared-check", "same", "shared-check"]);
  });

  it("terminates recursive Suspend graphs and visits each AST identity once", () => {
    interface RecursiveValue {
      readonly children: ReadonlyArray<RecursiveValue>;
      readonly label: string;
    }

    const Recursive: S.Codec<RecursiveValue> = S.suspend(() =>
      S.Struct({
        label: S.String.annotate({ traversalLabel: "label" }),
        children: S.Array(Recursive),
      })
    ).annotate({ traversalLabel: "recursive-root" });

    expect(collectAnnotationsAt(Recursive, "traversalLabel")).toEqual(["recursive-root", "label"]);
  });

  it("traverses encoding links after decoded structural children", () => {
    const Encoded = S.String.annotate({ traversalLabel: "encoded" });
    const Decoded = S.String.annotate({ traversalLabel: "decoded" });
    const Codec = Encoded.pipe(
      S.decodeTo(
        Decoded,
        SchemaTransformation.transform({
          decode: identity,
          encode: identity,
        })
      )
    );

    expect(collectAnnotationsAt(Codec, "traversalLabel")).toEqual(["decoded", "encoded"]);
  });

  it("traverses constructor-default targets after structural children", () => {
    const Value = S.String.annotate({ traversalLabel: "value" }).pipe(
      S.withConstructorDefault(Effect.succeed("fallback"))
    );

    expect(collectAnnotationsAt(Value, "traversalLabel")).toEqual(["value"]);
  });

  it("traverses declaration parameters, union members, and record index signatures", () => {
    const Declaration = S.declare<string>((input): input is string => typeof input === "string", {
      traversalLabel: "declaration",
    });
    const Union = S.Union([
      S.String.annotate({ traversalLabel: "left" }),
      S.Finite.annotate({ traversalLabel: "right" }),
    ]);
    const Record = S.Record(
      S.String.annotate({ traversalLabel: "record-key" }),
      S.Finite.annotate({ traversalLabel: "record-value" })
    );

    expect(collectAnnotationsAt(Declaration, "traversalLabel")).toEqual(["declaration"]);
    expect(collectAnnotationsAt(Union, "traversalLabel")).toEqual(["left", "right"]);
    expect(collectAnnotationsAt(Record, "traversalLabel")).toEqual(["record-key", "record-value"]);
  });

  it("visits every leaf AST variant without manufacturing annotations", () => {
    const leafSchemas: ReadonlyArray<readonly [string, S.Top]> = [
      ["null", S.Null],
      ["undefined", S.Undefined],
      ["void", S.Void],
      ["never", S.Never],
      ["unknown", S.Unknown],
      ["any", S.Any],
      ["string", S.String],
      ["number", S.Finite],
      ["boolean", S.Boolean],
      ["bigint", S.BigInt],
      ["symbol", S.Symbol],
      ["literal", S.Literal("literal")],
      ["unique-symbol", S.UniqueSymbol(Symbol.for("collectAnnotationsAt"))],
      ["object", S.ObjectKeyword],
      ["enum", S.Enum({ Only: "only" })],
    ];

    for (const [label, schema] of leafSchemas) {
      expect(collectAnnotationsAt(schema, "traversalLabel"), label).toEqual([]);
    }
  });

  it("traverses template literal parts in declaration order", () => {
    const Template = S.TemplateLiteral([
      S.Literal("prefix-").annotate({ traversalLabel: "prefix" }),
      S.String.annotate({ traversalLabel: "value" }),
    ]).annotate({ traversalLabel: "template" });

    expect(collectAnnotationsAt(Template, "traversalLabel")).toEqual(["template", "prefix", "value"]);
  });

  it("propagates errors thrown by a Suspend thunk", () => {
    const Broken = S.suspend((): S.Codec<string> => {
      throw new Error("boom");
    });

    expect(() => collectAnnotationsAt(Broken, "traversalLabel")).toThrow("boom");
  });
});
