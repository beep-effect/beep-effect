import { Str } from "@beep/utils";
import { pipe } from "effect/Function";
import { describe, expect, it } from "tstyche";
import type { A } from "@beep/utils";

describe("prefix", () => {
  it("data-first returns template literal", () => {
    expect(Str.prefix("world", "hello_")).type.toBe<"hello_world">();
  });

  it("data-last returns template literal", () => {
    expect(pipe("world" as const, Str.prefix("hello_"))).type.toBe<"hello_world">();
  });
});

describe("postfix", () => {
  it("data-first returns template literal", () => {
    expect(Str.postfix("hello", "_world")).type.toBe<"hello_world">();
  });

  it("data-last returns template literal", () => {
    expect(pipe("hello" as const, Str.postfix("_world"))).type.toBe<"hello_world">();
  });
});

describe("equivalence", () => {
  it("data-first returns boolean", () => {
    expect(Str.equivalence("docs", "docs")).type.toBe<boolean>();
  });

  it("data-last returns string comparator", () => {
    expect(Str.equivalence("docs")).type.toBe<(self: string) => boolean>();
  });
});

describe("orderAsc", () => {
  it("is an ascending string order", () => {
    expect(Str.orderAsc).type.toBe<import("effect/Order").Order<string>>();
  });
});

describe("mapPrefix", () => {
  it("data-first returns prefixed array", () => {
    const arr = ["a", "b"] as const;
    expect(Str.mapPrefix("x_", arr)).type.toBe<A.NonEmptyReadonlyArray<"x_a" | "x_b">>();
  });

  it("data-last returns prefixed array", () => {
    const arr = ["a", "b"] as const;
    expect(pipe(arr, Str.mapPrefix("x_"))).type.toBe<A.NonEmptyReadonlyArray<"x_a" | "x_b">>();
  });
});

describe("mapPostfix", () => {
  it("data-first returns postfixed array", () => {
    const arr = ["a", "b"] as const;
    expect(Str.mapPostfix("_x", arr)).type.toBe<A.NonEmptyReadonlyArray<"a_x" | "b_x">>();
  });

  it("data-last returns postfixed array", () => {
    const arr = ["a", "b"] as const;
    expect(pipe(arr, Str.mapPostfix("_x"))).type.toBe<A.NonEmptyReadonlyArray<"a_x" | "b_x">>();
  });
});

describe("camelCase", () => {
  it("returns CamelCase type", () => {
    expect(Str.camelCase("foo_bar")).type.toBe<"fooBar">();
  });
});

describe("snakeCase", () => {
  it("returns SnakeCase type", () => {
    expect(Str.snakeCase("fooBar")).type.toBe<"foo_bar">();
  });
});

describe("kebabCase", () => {
  it("returns KebabCase type", () => {
    expect(Str.kebabCase("fooBar")).type.toBe<"foo-bar">();
  });
});

describe("screamingSnake", () => {
  it("returns ScreamingSnakeCase type", () => {
    expect(Str.screamingSnake("fooBar")).type.toBe<"FOO_BAR">();
  });
});

describe("pascalCase", () => {
  it("returns PascalCase type", () => {
    expect(Str.pascalCase("foo_bar")).type.toBe<"FooBar">();
  });
});

describe("pascalToSnake", () => {
  it("returns SnakeCase type", () => {
    expect(Str.pascalToSnake("FooBar")).type.toBe<"foo_bar">();
  });
});

describe("snakeToCamel", () => {
  it("returns CamelCase type", () => {
    expect(Str.snakeToCamel("foo_bar")).type.toBe<"fooBar">();
  });
});

describe("snakeToKebab", () => {
  it("returns KebabCase type", () => {
    expect(Str.snakeToKebab("foo_bar")).type.toBe<"foo-bar">();
  });
});

describe("camelToSnake", () => {
  it("returns SnakeCase type", () => {
    expect(Str.camelToSnake("fooBar")).type.toBe<"foo_bar">();
  });
});

describe("snakeToPascal", () => {
  it("returns PascalCase type", () => {
    expect(Str.snakeToPascal("foo_bar")).type.toBe<"FooBar">();
  });
});

describe("kebabToSnake", () => {
  it("returns SnakeCase type", () => {
    expect(Str.kebabToSnake("foo-bar")).type.toBe<"foo_bar">();
  });
});

describe("startsWith", () => {
  it("data-first narrows to intersection", () => {
    const str = "hello_world" as string;
    if (Str.startsWith(str, "hello")) {
      expect(str).type.toBe<string & `hello${string}`>();
    }
  });

  it("data-last returns type guard function", () => {
    expect(Str.startsWith("hello")).type.toBe<
      <const TStr extends string>(str: TStr) => str is TStr & `hello${string}`
    >();
  });

  it("preserves literal type in narrowing", () => {
    const str = "hello_world" as const;
    if (Str.startsWith(str, "hello")) {
      expect(str).type.toBe<"hello_world" & `hello${string}`>();
    }
  });
});

describe("endsWith", () => {
  it("data-first narrows to intersection", () => {
    const str = "hello_world" as string;
    if (Str.endsWith(str, "world")) {
      expect(str).type.toBe<string & `${string}world`>();
    }
  });

  it("data-last returns type guard function", () => {
    expect(Str.endsWith("world")).type.toBe<<const TStr extends string>(str: TStr) => str is TStr & `${string}world`>();
  });

  it("preserves literal type in narrowing", () => {
    const str = "hello_world" as const;
    if (Str.endsWith(str, "world")) {
      expect(str).type.toBe<"hello_world" & `${string}world`>();
    }
  });
});

describe("contains", () => {
  it("data-first narrows to intersection", () => {
    const str = "hello_world" as string;
    if (Str.contains(str, "lo_wo")) {
      expect(str).type.toBe<string & `${string}lo_wo${string}`>();
    }
  });

  it("data-last returns type guard function", () => {
    expect(Str.contains("lo_wo")).type.toBe<
      <const TStr extends string>(str: TStr) => str is TStr & `${string}lo_wo${string}`
    >();
  });

  it("preserves literal type in narrowing", () => {
    const str = "hello_world" as const;
    if (Str.contains(str, "lo_wo")) {
      expect(str).type.toBe<"hello_world" & `${string}lo_wo${string}`>();
    }
  });
});

describe("repeat", () => {
  it("data-first returns StringRepeat type", () => {
    expect(Str.repeat("ab", 3)).type.toBe<"ababab">();
  });

  it("data-last returns StringRepeat type", () => {
    expect(pipe("ab" as const, Str.repeat(3))).type.toBe<"ababab">();
  });
});

describe("replaceWith", () => {
  it("data-first returns string", () => {
    expect(Str.replaceWith("beep", "beep", (match) => Str.toUpperCase(match))).type.toBe<string>();
  });

  it("data-last returns string transformer", () => {
    expect(Str.replaceWith("beep", (match) => Str.toUpperCase(match))).type.toBe<(self: string) => string>();
  });
});

describe("replaceAllWith", () => {
  it("data-first returns string", () => {
    expect(Str.replaceAllWith("beep beep", /beep/g, (match) => Str.toUpperCase(match))).type.toBe<string>();
  });

  it("data-last returns string transformer", () => {
    expect(Str.replaceAllWith(/beep/g, (match) => Str.toUpperCase(match))).type.toBe<(self: string) => string>();
  });
});

describe("MatchEmptyResult", () => {
  it("resolves branches by static emptiness", () => {
    expect<Str.MatchEmptyResult<"", "fallback", number>>().type.toBe<"fallback">();
    expect<Str.MatchEmptyResult<"beep", "fallback", number>>().type.toBe<number>();
    expect<Str.MatchEmptyResult<string, "fallback", number>>().type.toBe<"fallback" | number>();
    expect<Str.MatchEmptyResult<"" | "beep", "fallback", number>>().type.toBe<"fallback" | number>();
  });
});

describe("matchEmpty", () => {
  it("data-first: empty literal input collapses to the onEmpty result without widening", () => {
    expect(Str.matchEmpty("", { onEmpty: () => "", onNonEmpty: () => 0 })).type.toBe<"">();
  });

  it("data-first: onNonEmpty is unreachable for the empty literal, so its parameter is never", () => {
    Str.matchEmpty("", {
      onEmpty: () => "",
      onNonEmpty: (s) => {
        expect(s).type.toBe<never>();
        return 0;
      },
    });
  });

  it("data-first: non-empty literal input collapses to the onNonEmpty result", () => {
    expect(Str.matchEmpty("beep", { onEmpty: () => "", onNonEmpty: (s) => s.length })).type.toBe<number>();
  });

  it("data-first: plain string input returns the union of both results", () => {
    expect(Str.matchEmpty("beep" as string, { onEmpty: () => "", onNonEmpty: (s) => s.length })).type.toBe<
      "" | number
    >();
  });

  it("data-first: onNonEmpty parameter excludes the empty literal", () => {
    Str.matchEmpty("beep" as "" | "beep", {
      onEmpty: () => "",
      onNonEmpty: (s) => {
        expect(s).type.toBe<"beep">();
        return s;
      },
    });
  });

  it("data-last: result adapts to each applied string", () => {
    const summarize = Str.matchEmpty({ onEmpty: () => "", onNonEmpty: (s) => s.length });
    expect(summarize("")).type.toBe<"">();
    expect(summarize("beep")).type.toBe<number>();
    expect(summarize("beep" as string)).type.toBe<"" | number>();
  });

  it("data-last: keeps precision through pipe", () => {
    expect(pipe("" as const, Str.matchEmpty({ onEmpty: () => 0, onNonEmpty: (s) => s.length }))).type.toBe<0>();
  });
});
