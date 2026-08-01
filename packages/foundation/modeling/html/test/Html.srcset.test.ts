import { inspectSrcset } from "@beep/html/Html.srcset";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { isValidURLString, parseURL } from "whatwg-url";

const acceptUrl = Str.isNonEmpty;
const htmlUrlBase = pipe(parseURL("https://html.invalid/"), O.fromNullOr);
const isValidHtmlUrl = (url: string): boolean =>
  pipe(
    htmlUrlBase,
    O.exists((baseURL) => isValidURLString(url, { baseURL }))
  );

const profileOf = (input: string): string | undefined => O.getOrUndefined(inspectSrcset(input, acceptUrl));

describe("@beep/html srcset author conformance", () => {
  it("accepts WHATWG density, width, and descriptorless profiles", () => {
    expect(profileOf("image.png")).toBe("density");
    expect(profileOf("image.png .5x, image@2x.png 2x")).toBe("density");
    expect(profileOf("small.png 400w, large.png 800w")).toBe("width");
    expect(profileOf("\timage.png 1e+2x,\n image@2x.png 2e2x\r")).toBe("density");
  });

  it("keeps commas inside candidate URLs, including data URLs", () => {
    const urls: Array<string> = [];
    const inspect = inspectSrcset((url) => {
      urls.push(url);
      return true;
    });

    expect(O.getOrUndefined(inspect("data:image/svg+xml,%3Csvg%3E 1x, fallback,image.png 2x"))).toBe("density");
    expect(urls).toStrictEqual(["data:image/svg+xml,%3Csvg%3E", "fallback,image.png"]);
    expect(profileOf("data:,a")).toBe("density");
    expect(profileOf("data:,a, data:,b 2x")).toBe("density");
    expect(profileOf("one.png ,two.png 2x")).toBe("density");
    expect(profileOf("one.png 1x,two.png 2x")).toBe("density");
    expect(profileOf("one,two,three")).toBe("density");
  });

  it("delegates candidate URL validity without trimming or rewriting URLs", () => {
    const urls: Array<string> = [];
    const result = inspectSrcset("good.png 1x, http: 2x", (url) => {
      urls.push(url);
      return !Str.Equivalence(url, "http:");
    });

    expect(O.isNone(result)).toBe(true);
    expect(urls).toStrictEqual(["good.png", "http:"]);
  });

  it("composes with WHATWG URL validation and rejects malformed percent escapes", () => {
    expect(O.getOrUndefined(inspectSrcset("/image%20one.png 1x, data:image/png;base64,AA== 2x", isValidHtmlUrl))).toBe(
      "density"
    );

    for (const value of ["bad%.png 1x", "bad%2.png 1x", "bad%GG.png 1x", "http: 1x", "https://exa mple/ 1x"]) {
      expect(O.isNone(inspectSrcset(value, isValidHtmlUrl)), value).toBe(true);
    }
  });

  it("rejects empty candidates and invalid comma placement from Nu conformance cases", () => {
    for (const value of ["", " ", ",", ", image.png", ",,image.png", "image.png,", "image.png,,"]) {
      expect(O.isNone(inspectSrcset(value, acceptUrl)), value).toBe(true);
    }
  });

  it("rejects malformed, non-positive, and multiple descriptors", () => {
    for (const descriptor of [
      "0w",
      "-1w",
      "+1w",
      "1.0w",
      "1e0w",
      "1W",
      "0x",
      "-0x",
      "-1x",
      "+1x",
      "Infinityx",
      "NaNx",
      "1X",
      "1h",
      "(1x)",
      "1x 2x",
      "1w 1h",
      "1x /* junk */",
    ]) {
      expect(O.isNone(inspectSrcset(`image.png ${descriptor}`, acceptUrl)), descriptor).toBe(true);
    }
  });

  it("rejects duplicate and mixed descriptor values exactly", () => {
    for (const value of [
      "a.png, b.png 1x",
      "a.png 1x, b.png 1.0x",
      "a.png 1x, b.png 10e-1x",
      "a.png 1e999x, b.png 10e998x",
      "a.png 1w, b.png 01w",
      "a.png 1w, b.png 1x",
      "a.png 1w, b.png",
    ]) {
      expect(O.isNone(inspectSrcset(value, acceptUrl)), value).toBe(true);
    }

    expect(profileOf("a.png 9007199254740992x, b.png 9007199254740993x")).toBe("density");
    expect(profileOf("a.png 1e-999x, b.png 2e-999x")).toBe("density");
  });

  it("accepts generated positive width lists", () =>
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000 }), fc.integer({ min: 10_001, max: 20_000 }), (small, large) => {
        expect(profileOf(`small.png ${small}w, large.png ${large}w`)).toBe("width");
      }),
      fcRuns(100)
    ));

  it("rejects generated numerically duplicate width spellings", () =>
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20_000 }), (width) => {
        expect(O.isNone(inspectSrcset(`a.png ${width}w, b.png 0${width}w`, acceptUrl))).toBe(true);
      }),
      fcRuns(100)
    ));

  it("handles a large unique candidate list with one URL validation per candidate", () => {
    const candidateCount = 4_096;
    const input = pipe(
      A.makeBy(candidateCount, (index) => `image-${index}.png ${index + 1}w`),
      A.join(", ")
    );
    let validationCount = 0;

    const result = inspectSrcset(input, (url) => {
      validationCount += 1;
      return Str.isNonEmpty(url);
    });

    expect(O.getOrUndefined(result)).toBe("width");
    expect(validationCount).toBe(candidateCount);
  });

  it("is total for arbitrary Unicode and UTF-16 input", () =>
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 256 }), (input) => {
        expect(O.isOption(inspectSrcset(input, acceptUrl))).toBe(true);
      }),
      fcRuns(250)
    ));
});
