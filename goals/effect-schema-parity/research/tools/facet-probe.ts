// P3 facet census evidence for goals/effect-schema-parity, runtime half.
//
// 1. Opaque: the identity-exclusion facet. Field and tagged-error equivalence for
//    today's `Defect` / `OpaqueUnknown` against upstream `S.Defect` / `S.Unknown`,
//    with and without `S.overrideToEquivalence`.
// 2. PR 3b: each SchemaUtils default helper shape against its upstream
//    composition, compared on construction, missing-key decode, undefined-key
//    decode and encode (JSON bytes).
//
// Deterministic, no network. Run from the repo root:
//   bun run goals/effect-schema-parity/research/tools/facet-probe.ts
import { Defect, OpaqueUnknown } from "@beep/schema/Opaque";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const out: Array<string> = [];

// --- 1. Opaque identity exclusion -------------------------------------------

const alwaysEquivalent = S.overrideToEquivalence(() => () => true);
const left = new Error("left");
const right = new Error("right");
const opaqueCases = [
  ["@beep/schema Defect()", Defect()],
  ["S.Defect()", S.Defect()],
  ["S.Defect().pipe(S.overrideToEquivalence(() => () => true))", S.Defect().pipe(alwaysEquivalent)],
  ["@beep/schema OpaqueUnknown", OpaqueUnknown],
  ["S.Unknown", S.Unknown],
  ["S.Unknown.pipe(S.overrideToEquivalence(() => () => true))", S.Unknown.pipe(alwaysEquivalent)],
] as const;

out.push(
  "## Opaque identity exclusion\n",
  "| Field schema | S.toEquivalence(Struct), different causes | S.toEquivalence(TaggedError), different causes | Equal.equals(TaggedError), different causes | Equal.equals(TaggedError), same cause |",
  "| --- | --- | --- | --- | --- |"
);
for (const [label, field] of opaqueCases) {
  class ProbeError extends S.TaggedError<ProbeError>("ProbeError")("ProbeError", { cause: field }) {}
  const fieldEquivalent = S.toEquivalence(S.Struct({ cause: field }))({ cause: left }, { cause: right });
  const schemaEquivalent = S.toEquivalence(ProbeError)(
    new ProbeError({ cause: left }),
    new ProbeError({ cause: right })
  );
  const errorsEqual = Equal.equals(new ProbeError({ cause: left }), new ProbeError({ cause: right }));
  const sameCauseEqual = Equal.equals(new ProbeError({ cause: left }), new ProbeError({ cause: left }));
  out.push(`| \`${label}\` | ${fieldEquivalent} | ${schemaEquivalent} | ${errorsEqual} | ${sameCauseEqual} |`);
}

// --- 2. PR 3b default helper shapes -------------------------------------------

const render = (thunk: () => unknown): string => {
  try {
    return JSON.stringify(thunk()) ?? "undefined";
  } catch (error) {
    return `throws: ${P.isError(error) ? error.message.split("\n")[0] : String(error)}`;
  }
};

// Construction with the field omitted, decode with the key missing, decode with the key undefined, encode of a value.
const observe = <Field extends S.Top & { readonly DecodingServices: never; readonly EncodingServices: never }>(
  field: Field,
  value: unknown
): ReadonlyArray<string> => {
  const schema = S.Struct({ field });
  const encode = S.encodeSync(schema);
  const decode = S.decodeUnknownSync(schema);
  return [
    render(() => encode(schema.make({} as never))),
    render(() => encode(decode({}))),
    render(() => encode(decode({ field: undefined }))),
    render(() => encode(decode({ field: value }))),
  ];
};

const shapes = [
  [
    "withNoneDefault on S.OptionFromOptionalKey",
    observe(S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault), "x"),
    observe(S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none()))), "x"),
  ],
  [
    "withNoneDefault on S.OptionFromNullOr",
    observe(S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault), "x"),
    observe(S.OptionFromNullOr(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none()))), "x"),
  ],
  [
    "withKeyDefaults(v), literal default",
    observe(S.String.pipe(SchemaUtils.withKeyDefaults("fallback")), "x"),
    observe(
      S.String.pipe(
        S.withConstructorDefault(Effect.succeed("fallback")),
        S.withDecodingDefaultTypeKey(Effect.succeed("fallback"))
      ),
      "x"
    ),
  ],
  [
    "withKeyDefaults(schema, v), constructed default",
    observe(SchemaUtils.withKeyDefaults(S.Array(S.String), ["a", "b"]), ["x"]),
    observe(
      S.Array(S.String).pipe(
        S.withConstructorDefault(Effect.succeed(["a", "b"])),
        S.withDecodingDefaultTypeKey(Effect.succeed(["a", "b"]))
      ),
      ["x"]
    ),
  ],
  [
    "withEmptyArrayDefaults<T>()",
    observe(S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults<string>()), ["x"]),
    observe(
      S.Array(S.String).pipe(
        S.withConstructorDefault(Effect.succeed(A.empty<string>())),
        S.withDecodingDefaultType(Effect.succeed(A.empty<string>()))
      ),
      ["x"]
    ),
  ],
  [
    "withConstantDefault(v) on a literal",
    observe(S.Literal("v1").pipe(SchemaUtils.withConstantDefault("v1")), "v1"),
    observe(S.Literal("v1").pipe(S.withConstructorDefault(Effect.succeed("v1"))), "v1"),
  ],
] as const;

out.push(
  "\n## PR 3b default helpers against their upstream compositions\n",
  "| Shape | make({}) | decode({}) | decode({ field: undefined }) | decode({ field: v }) | Identical |",
  "| --- | --- | --- | --- | --- | --- |"
);
for (const [label, today, upstream] of shapes) {
  const cells = A.map(A.zip(today, upstream), ([t, u]) =>
    (t === u ? t : `today ${t} / upstream ${u}`).replaceAll("|", "\\|")
  );
  const identical = A.every(A.zip(today, upstream), ([t, u]) => t === u);
  out.push(`| ${label} | ${A.join(cells, " | ")} | ${identical ? "yes" : "no"} |`);
}

process.stdout.write(`${A.join(out, "\n")}\n`);
