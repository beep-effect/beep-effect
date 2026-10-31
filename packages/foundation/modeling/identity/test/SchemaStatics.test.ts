import { $SchemaId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as S from "effect/Schema";

const variants = [
  {
    name: "annoteSchema",
    annotate: <Schema extends S.Top>(schema: Schema) => $SchemaId.annoteSchema<Schema>("Preserved")(schema),
  },
  {
    name: "annoteHttp",
    annotate: <Schema extends S.Top>(schema: Schema) => $SchemaId.annoteHttp<Schema>("Preserved")(schema),
  },
];

describe.each(variants)("$name static preservation", ({ annotate }) => {
  it("retains a non-enumerable getter without evaluating it during annotation", () => {
    const source = S.String.annotate({});
    let reads = 0;
    Reflect.defineProperty(source, "label", {
      get: () => {
        reads += 1;
        return "string label";
      },
      enumerable: false,
      configurable: false,
    });

    const annotated = annotate(source);

    expect(reads).toBe(0);
    expect(Reflect.getOwnPropertyDescriptor(annotated, "label")).toEqual(
      Reflect.getOwnPropertyDescriptor(source, "label")
    );
    expect(Reflect.get(annotated, "label")).toBe("string label");
    expect(reads).toBe(1);
  });

  it("retains symbol-keyed data and its immutable descriptor", () => {
    const source = S.String.annotate({});
    const key = Symbol("identity static");
    const value = { label: "owned static" };
    Reflect.defineProperty(source, key, {
      value,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    const annotated = annotate(source);

    expect(Reflect.get(annotated, key)).toBe(value);
    expect(Reflect.getOwnPropertyDescriptor(annotated, key)).toEqual(Reflect.getOwnPropertyDescriptor(source, key));
    expect(Reflect.set(annotated, key, "replacement")).toBe(false);
    expect(Reflect.get(annotated, key)).toBe(value);
  });

  it("keeps rebuilt schema behavior instead of copying an overridden source constructor", () => {
    const source = S.String.annotate({ title: "Original" });
    Reflect.defineProperty(source, "make", { value: () => "source override" });

    const annotated = annotate(source);

    expect(source.make("input")).toBe("source override");
    expect(annotated.make("input")).toBe("input");
    expect(S.is(annotated)(42)).toBe(false);
    expect(S.resolveAnnotations(annotated)?.identifier).toBe("@beep/schema/Preserved");
    expect(S.resolveAnnotations(source)?.title).toBe("Original");
    expect(S.resolveAnnotations(source)?.identifier).toBeUndefined();
  });

  it("keeps a rebuilt own property when the source has the same non-protocol key", () => {
    const source = S.String.annotate({});
    Reflect.defineProperty(source, "length", { value: 57 });
    const expectedLength = source.annotate({}).length;

    const annotated = annotate(source);

    expect(source.length).toBe(57);
    expect(annotated.length).toBe(expectedLength);
    expect(annotated.length).not.toBe(57);
  });
});
