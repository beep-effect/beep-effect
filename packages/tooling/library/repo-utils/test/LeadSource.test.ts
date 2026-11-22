import { annotationDescription, derivedLead, jsDocLead, leadRestates } from "@beep/repo-utils/JSDoc/LeadSource";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Project } from "ts-morph";

const lines = (...values: ReadonlyArray<string>): string => A.join(values, "\n");

const sourceFile = (text: string) =>
  new Project({ useInMemoryFileSystem: true }).createSourceFile("fixture.ts", text, { overwrite: true });

const close = "*" + "/";

describe("jsDocLead", () => {
  it("joins the lead lines before the first section heading", () => {
    const text = lines("/**", " * Party name", " * as written.", " *", " * **Details**", " *", " * More.", ` ${close}`);
    expect(jsDocLead(text)).toBe("Party name as written.");
  });

  it("stops at the first block tag when the block has no section", () => {
    expect(jsDocLead(lines("/**", " * Lead only.", " *", " * @since 0.0.0", ` ${close}`))).toBe("Lead only.");
  });

  it("is empty when the block opens with a section", () => {
    const text = lines("/**", " * **Example** (Use it)", " *", " * ```ts", " * x", " * ```", ` ${close}`);
    expect(jsDocLead(text)).toBe("");
  });
});

describe("leadRestates", () => {
  it("flags verbatim and boilerplate leads", () => {
    expect(leadRestates("Options for collecting keys.", ["Options", "Options for collecting keys."])).toBe(true);
    expect(leadRestates("Decoded {@link NameKind} type.", ["NameKind"])).toBe(true);
    expect(leadRestates("Runtime schema for parties.", ["Party"])).toBe(true);
  });

  it("allows one new word, or a fifth of the words", () => {
    expect(
      leadRestates("Media kind for selected dataset files.", ["MediaKind", "The media for a selected file."])
    ).toBe(true);
    expect(
      leadRestates("Alpha beta gamma delta epsilon zeta eta theta iota kappa novel unseen.", [
        "Alpha beta gamma delta epsilon zeta eta theta iota kappa",
      ])
    ).toBe(true);
  });

  it("keeps a lead that adds information", () => {
    expect(leadRestates("Names are dated claims, never party fields.", ["NameKind"])).toBe(false);
    expect(leadRestates("One request to sign.", ["SigV4Request", "A plain-object request with the payload."])).toBe(
      false
    );
  });
});

describe("annotationDescription", () => {
  it("reads the annotation that carries the export's name", () => {
    const source = sourceFile(
      lines(
        "export const Party = S.Struct({",
        '  name: S.String.pipe($I.annoteKey("Party.name", { description: "Field." })),',
        '  kind: Kind.pipe($I.annoteSchema("Kind", { description: "Nested." })),',
        '}).pipe($I.annoteSchema("Party", { description: "A party." }))'
      )
    );
    expect(O.getOrUndefined(annotationDescription(source.getVariableDeclarationOrThrow("Party"), "Party"))).toBe(
      "A party."
    );
  });

  it("accepts qualified identifiers and template descriptions", () => {
    const source = sourceFile(
      lines(
        "export class Failure extends S.TaggedErrorClass<Failure>()(",
        '  "Failure",',
        "  {},",
        '  $I.annoteError<Failure>("@beep/x/errors/Failure", { description: `It failed.` })',
        ") {}"
      )
    );
    expect(O.getOrUndefined(annotationDescription(source.getClassOrThrow("Failure"), "Failure"))).toBe("It failed.");
  });

  it("is None without a literal description or a matching annotation", () => {
    const source = sourceFile(
      lines(
        'export const Dynamic = S.String.pipe($I.annoteSchema("Dynamic", { description: text }))',
        'export const Spread = S.String.pipe($I.annoteSchema("Spread", options))',
        'export const Shorthand = S.String.pipe($I.annoteSchema("Shorthand", { description }))',
        'export const Named = S.String.pipe($I.annoteSchema(name, { description: "x" }))',
        'export const Other = S.String.pipe(S.annotate("Other", { description: "x" }))',
        'export const Plain = make("Plain", { description: "x" })'
      )
    );
    for (const name of ["Dynamic", "Spread", "Shorthand", "Named", "Other", "Plain"]) {
      expect(O.isNone(annotationDescription(source.getVariableDeclarationOrThrow(name), name))).toBe(true);
    }
  });
});

describe("derivedLead", () => {
  const source = sourceFile(
    lines(
      'export const Name = S.String.pipe($I.annoteSchema("Name", { description: "A party name." }))',
      "export type Name = typeof Name.Type",
      "export declare namespace Name { export type Encoded = string }",
      "export interface Name { readonly brand: unique symbol }",
      'export class Party extends S.Class<Party>($I`Party`)({}, $I.annote("Party", { description: "A party." })) {}',
      "export declare namespace Party { export type Encoded = {} }",
      "export type Orphan = string",
      "export const plain = 1"
    )
  );

  it("takes a value's own annotation", () => {
    expect(O.getOrUndefined(derivedLead(source.getVariableDeclarationOrThrow("Name"), "Name"))).toBe("A party name.");
    expect(O.getOrUndefined(derivedLead(source.getClassOrThrow("Party"), "Party"))).toBe("A party.");
  });

  it("takes the same-name value's annotation for type companions", () => {
    expect(O.getOrUndefined(derivedLead(source.getTypeAliasOrThrow("Name"), "Name"))).toBe("A party name.");
    expect(O.getOrUndefined(derivedLead(source.getInterfaceOrThrow("Name"), "Name"))).toBe("A party name.");
    expect(O.getOrUndefined(derivedLead(source.getModuleOrThrow("Name"), "Name"))).toBe("A party name.");
  });

  it("takes the namespace owner's annotation for Encoded companions", () => {
    const encoded = source.getModuleOrThrow("Party").getTypeAliasOrThrow("Encoded");
    expect(O.getOrUndefined(derivedLead(encoded, "Encoded"))).toBe("A party.");
  });

  it("is None for unannotated exports", () => {
    expect(O.isNone(derivedLead(source.getTypeAliasOrThrow("Orphan"), "Orphan"))).toBe(true);
    expect(O.isNone(derivedLead(source.getVariableDeclarationOrThrow("plain"), "plain"))).toBe(true);
  });
});
