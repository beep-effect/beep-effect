import { makeCitationBuiltinDump } from "@beep/law-practice-server/internal/Citation/BuiltinDump";
import { makeCitationDump } from "@beep/law-practice-server/internal/Citation/Dump";
import {
  CitationReferenceTokenOutcome,
  CitationReferenceTokenResult,
} from "@beep/law-practice-server/internal/Citation/ReferenceTokenExtraction";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import {
  CitationPythonUnicodeStorage,
  CitationTextBudget,
  CitationTokenSeed,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
import { readCitationNativeRenderingAsset } from "./CitationNativeRendering.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
const header = "\x1b[32mIdCitation:\x1b[0m \x1b[94m\x1b[1m";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "builtin dump boundaries",
  (it) => {
    it.effect("renders dictionary Boolean and None values while omitting false scalar fields", () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const table = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump(limits, table);
        const actual = yield* dump.render({
          text: word("x"),
          citations: [
            {
              kind: "IdCitation",
              span: [0, 1],
              fields: [
                { _tag: "Scalar", name: "hidden", value: { _tag: "Boolean", value: false } },
                { _tag: "Scalar", name: "missing", value: { _tag: "None" } },
                { _tag: "Scalar", name: "empty", value: { _tag: "Text", value: word("") } },
                { _tag: "Scalar", name: "label", value: { _tag: "Text", value: word("ready") } },
                { _tag: "Scalar", name: "zero", value: { _tag: "Integer", value: 0 } },
                { _tag: "Scalar", name: "negative", value: { _tag: "Integer", value: -7 } },
                { _tag: "Scalar", name: "large", value: { _tag: "Integer", value: 9007199254740991 } },
                { _tag: "Scalar", name: "enabled", value: { _tag: "Boolean", value: true } },
                {
                  _tag: "Fields",
                  name: "flags",
                  entries: [
                    { name: "yes", value: { _tag: "Boolean", value: true } },
                    { name: "no", value: { _tag: "Boolean", value: false } },
                    { name: "unset", value: { _tag: "None" } },
                  ],
                },
              ],
            },
          ],
        });
        expect(actual).toEqual(
          word(
            `${header}x\x1b[0m\n  * label='ready'\n  * negative=-7\n  * large=9007199254740991\n  * enabled=True\n  * flags\n    * yes=True\n    * no=False\n    * unset=None`
          )
        );
      })
    );

    it.effect("trims long context cooperatively and clamps negative spans without leaking context", () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const table = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump(limits, table);
        const spaces = Str.repeat(8192)(" ");
        const trimmed = yield* dump.render({
          text: word(`${spaces}x${spaces}`),
          contextChars: 8192,
          citations: [{ kind: "IdCitation", span: [8192, 8193], fields: [] }],
        });
        expect(trimmed).toEqual(word(`${header}x\x1b[0m`));
        const negative = yield* dump.render({
          text: word("abc"),
          citations: [{ kind: "IdCitation", span: [-100, -90], fields: [] }],
        });
        expect(negative).toEqual(word(`${header}\x1b[0m`));
      })
    );

    it.effect("refuses invalid policy, printability and mention overflow, then renders a valid request", () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const table = yield* readCitationNativeRenderingAsset("python-printability");
        const invalidPolicy = yield* makeCitationDump({}, table).pipe(Effect.flip);
        expect(invalidPolicy).toMatchObject({ _tag: "CitationDumpFailure", reason: "invalid-policy" });
        const enclosing = yield* makeCitationTextBudget(limits);
        const mismatch = yield* makeCitationDump({ ...limits, producedTextUtf16: 12 }, table).pipe(
          Effect.provideService(CitationTextBudget, enclosing),
          Effect.flip
        );
        expect(mismatch).toMatchObject({ _tag: "CitationDumpFailure", reason: "invalid-policy" });
        const used = yield* enclosing.snapshot;
        expect(used).toBe(0);
        for (const raw of [null, "{}"]) {
          const invalidTable = yield* makeCitationDump(limits, raw).pipe(Effect.flip);
          expect(invalidTable).toMatchObject({ _tag: "CitationDumpFailure", reason: "invalid-configuration" });
          expect("cause" in invalidTable).toBe(false);
        }
        const dump = yield* makeCitationDump({ ...limits, mentions: 1 }, table);
        const row = { kind: "IdCitation", span: [0, 1], fields: [] };
        const refused = yield* dump.render({ text: word("x"), citations: [row, row] }).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "extract", limit: "mentions" });
        const recovered = yield* dump.render({ text: word("x"), citations: [row] });
        expect(recovered).toEqual(word(`${header}x\x1b[0m`));
        for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 0.5]) {
          const malformedInteger = yield* dump
            .render({
              text: word("x"),
              citations: [{ ...row, fields: [{ _tag: "Scalar", name: "invalid", value: { _tag: "Integer", value } }] }],
            })
            .pipe(Effect.flip);
          expect(malformedInteger).toMatchObject({ _tag: "CitationDumpFailure", reason: "invalid-input" });
          expect("cause" in malformedInteger).toBe(false);
        }
      })
    );

    it.effect("projects a no-year Id model with null groups and refuses malformed captured inputs", () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const profile = yield* readCitationNativeRenderingAsset("builtin-dump-profile");
        for (const raw of [null, `${profile} `]) {
          const refused = yield* makeCitationBuiltinDump(limits, raw).pipe(Effect.flip);
          expect(refused).toMatchObject({ _tag: "CitationDumpFailure", reason: "invalid-configuration" });
          expect("cause" in refused).toBe(false);
        }
        const policy = yield* makeCitationBuiltinDump({}, profile).pipe(Effect.flip);
        expect(policy).toMatchObject({ _tag: "CitationDumpFailure", reason: "invalid-policy" });
        const dump = yield* makeCitationBuiltinDump(limits, profile);
        const malformed = yield* dump.project({}).pipe(Effect.flip);
        expect(malformed).toMatchObject({ _tag: "CitationDumpFailure", reason: "invalid-input" });
        const model = CitationReferenceTokenResult.make({
          index: 0,
          reservedUnits: 0,
          token: CitationTokenSeed.make({
            kind: "IdToken",
            data: word("Id."),
            start: 0,
            end: 3,
            groups: { optional: null },
            exact: [],
            variation: [],
            short: false,
          }),
          outcome: CitationReferenceTokenOutcome.cases.IdCitation.make({
            spanEnd: null,
            fullSpanStart: null,
            fullSpanEnd: null,
            metadata: { pinCite: null, parenthetical: null, pinCiteSpanStart: null, pinCiteSpanEnd: null },
          }),
        });
        const projected = yield* dump.project(model);
        expect(projected).toMatchObject({ kind: "IdCitation", span: [0, 3] });
        expect(projected.fields).toEqual([
          { _tag: "Fields", name: "groups", entries: [{ name: word("optional"), value: { _tag: "None" } }] },
          { _tag: "Fields", name: "metadata", entries: [] },
        ]);
      })
    );
  }
);
