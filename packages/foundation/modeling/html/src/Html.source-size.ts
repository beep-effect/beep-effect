/**
 * WHATWG author-conformance validation for responsive-image source sizes.
 *
 * @packageDocumentation \@beep/html/Html.source-size
 * @since 0.0.0
 */

import { $HtmlId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import {
  isFunctionNode,
  isSimpleBlockNode,
  isTokenNode,
  isWhiteSpaceOrCommentNode,
  isWhitespaceNode,
  parseCommaSeparatedListOfComponentValues,
} from "@csstools/css-parser-algorithms";
import {
  isTokenComma,
  isTokenDelim,
  isTokenDimension,
  isTokenEOF,
  isTokenIdent,
  isTokenNumber,
  isTokenOpenParen,
  isTokenWhiteSpaceOrComment,
  tokenize,
} from "@csstools/css-tokenizer";
import {
  isGeneralEnclosed,
  isMediaQueryWithoutType,
  parseFromTokens as parseMediaQueryListFromTokens,
} from "@csstools/media-query-list-parser";
import { Match, Number as N, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { toAsciiLowerCase } from "./Html.foreign.ts";
import type { ComponentValue, FunctionNode, SimpleBlockNode } from "@csstools/css-parser-algorithms";
import type { CSSToken } from "@csstools/css-tokenizer";

// cspell:words cqmax cqmin dpcm dppx dvmax dvmin lvmax lvmin rcap svmax svmin vmax vmin

const $I = $HtmlId.create("Html.source-size");

const LENGTH_UNITS = [
  "cap",
  "ch",
  "cm",
  "cqb",
  "cqh",
  "cqi",
  "cqmax",
  "cqmin",
  "cqw",
  "dvb",
  "dvh",
  "dvi",
  "dvmax",
  "dvmin",
  "dvw",
  "em",
  "ex",
  "ic",
  "in",
  "lh",
  "lvb",
  "lvh",
  "lvi",
  "lvmax",
  "lvmin",
  "lvw",
  "mm",
  "pc",
  "pt",
  "px",
  "q",
  "rcap",
  "rch",
  "rem",
  "rex",
  "ric",
  "rlh",
  "svb",
  "svh",
  "svi",
  "svmax",
  "svmin",
  "svw",
  "vb",
  "vh",
  "vi",
  "vmax",
  "vmin",
  "vw",
];
const ANGLE_UNITS = ["deg", "grad", "rad", "turn"];
const TIME_UNITS = ["ms", "s"];
const FREQUENCY_UNITS = ["hz", "khz"];
const RESOLUTION_UNITS = ["dpcm", "dpi", "dppx", "x"];
const FLEX_UNITS = ["fr"];
const CALC_KEYWORDS = ["-infinity", "e", "infinity", "nan", "pi"];
const ROUNDING_STRATEGIES = ["down", "line-width", "nearest", "to-zero", "up"];

type NumericType = readonly [
  length: number,
  angle: number,
  time: number,
  frequency: number,
  resolution: number,
  flex: number,
];

interface CalculationCursor {
  readonly nodes: ReadonlyArray<ComponentValue>;
  position: number;
}

const makeNumericType = (
  length: number,
  angle: number,
  time: number,
  frequency: number,
  resolution: number,
  flex: number
): NumericType => [length, angle, time, frequency, resolution, flex];

const NUMBER_TYPE = makeNumericType(0, 0, 0, 0, 0, 0);
const LENGTH_TYPE = makeNumericType(1, 0, 0, 0, 0, 0);
const ANGLE_TYPE = makeNumericType(0, 1, 0, 0, 0, 0);
const TIME_TYPE = makeNumericType(0, 0, 1, 0, 0, 0);
const FREQUENCY_TYPE = makeNumericType(0, 0, 0, 1, 0, 0);
const RESOLUTION_TYPE = makeNumericType(0, 0, 0, 0, 1, 0);
const FLEX_TYPE = makeNumericType(0, 0, 0, 0, 0, 1);

const numericTypeEquivalent = (self: NumericType, that: NumericType): boolean =>
  N.Equivalence(self[0], that[0]) &&
  N.Equivalence(self[1], that[1]) &&
  N.Equivalence(self[2], that[2]) &&
  N.Equivalence(self[3], that[3]) &&
  N.Equivalence(self[4], that[4]) &&
  N.Equivalence(self[5], that[5]);

const multiplyNumericTypes = (self: NumericType, that: NumericType): NumericType =>
  makeNumericType(
    self[0] + that[0],
    self[1] + that[1],
    self[2] + that[2],
    self[3] + that[3],
    self[4] + that[4],
    self[5] + that[5]
  );

const divideNumericTypes = (self: NumericType, that: NumericType): NumericType =>
  makeNumericType(
    self[0] - that[0],
    self[1] - that[1],
    self[2] - that[2],
    self[3] - that[3],
    self[4] - that[4],
    self[5] - that[5]
  );

const isNumberType = (type: NumericType): boolean => numericTypeEquivalent(type, NUMBER_TYPE);
const isLengthType = (type: NumericType): boolean => numericTypeEquivalent(type, LENGTH_TYPE);
const isAngleType = (type: NumericType): boolean => numericTypeEquivalent(type, ANGLE_TYPE);

const isBaseNumericType = (type: NumericType): boolean =>
  isNumberType(type) ||
  isLengthType(type) ||
  isAngleType(type) ||
  numericTypeEquivalent(type, TIME_TYPE) ||
  numericTypeEquivalent(type, FREQUENCY_TYPE) ||
  numericTypeEquivalent(type, RESOLUTION_TYPE) ||
  numericTypeEquivalent(type, FLEX_TYPE);

const SourceSizeIssueCode = LiteralKit([
  "invalidAuto",
  "invalidCss",
  "invalidList",
  "invalidMediaCondition",
  "invalidSourceSize",
]).pipe(
  $I.annoteSchema("SourceSizeIssueCode", {
    description: "Stable reason code for a responsive-image source-size author-conformance failure.",
  })
);
type SourceSizeIssueCode = typeof SourceSizeIssueCode.Type;

/**
 * A diagnostic produced while validating a responsive-image source-size list.
 *
 * @example
 * ```ts
 * import { inspectSourceSizeList } from "@beep/html/Html.source-size"
 * import { Result } from "effect"
 *
 * const result = inspectSourceSizeList("10%")
 * if (Result.isFailure(result)) console.log(result.failure[0]?.code)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class SourceSizeIssue extends S.Class<SourceSizeIssue>($I`SourceSizeIssue`)(
  {
    code: SourceSizeIssueCode.annotateKey({
      description: "Stable machine-readable source-size failure reason.",
    }),
    entryIndex: S.Option(S.Int.check(S.isGreaterThanOrEqualTo(0))).annotateKey({
      description: "Zero-based source-size entry index, when an individual entry caused the failure.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Human-readable explanation of the author-conformance failure.",
    }),
  },
  $I.annote("SourceSizeIssue", {
    description: "Diagnostic produced while validating a responsive-image source-size list.",
  })
) {}

/**
 * Successful structural analysis of a responsive-image source-size list.
 *
 * @example
 * ```ts
 * import { inspectSourceSizeList } from "@beep/html/Html.source-size"
 * import { Result } from "effect"
 *
 * const result = inspectSourceSizeList("auto, 100vw")
 * if (Result.isSuccess(result)) console.log(result.success.usesAuto) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceSizeAnalysis extends S.Class<SourceSizeAnalysis>($I`SourceSizeAnalysis`)(
  {
    entryCount: S.Int.check(S.isGreaterThan(0)).annotateKey({
      description: "Number of entries in the conforming source-size list.",
    }),
    usesAuto: S.Boolean.annotateKey({
      description: "Whether the list starts with the exact author-level auto source-size entry.",
    }),
  },
  $I.annote("SourceSizeAnalysis", {
    description: "Successful structural analysis of a responsive-image source-size list.",
  })
) {}

const issueMessage = (code: SourceSizeIssueCode): string =>
  Match.value(code).pipe(
    Match.when("invalidAuto", () => "The auto source size is not in its required exact first-entry form."),
    Match.when("invalidCss", () => "The source-size list contains invalid or unterminated CSS syntax."),
    Match.when(
      "invalidList",
      () => "The source-size list does not have the required conditional entries and final fallback."
    ),
    Match.when(
      "invalidMediaCondition",
      () => "The source-size entry does not start with an author-valid media condition."
    ),
    Match.when(
      "invalidSourceSize",
      () => "The source-size value is not a nonnegative length or an allowed CSS math length."
    ),
    Match.exhaustive
  );

const failure = (
  code: SourceSizeIssueCode,
  entryIndex?: number
): Result.Result<SourceSizeAnalysis, A.NonEmptyReadonlyArray<SourceSizeIssue>> =>
  Result.fail([
    SourceSizeIssue.make({
      code,
      entryIndex: O.fromUndefinedOr(entryIndex),
      message: issueMessage(code),
    }),
  ]);

const unitNumericType = (unit: string): O.Option<NumericType> => {
  const normalized = toAsciiLowerCase(unit);

  if (A.contains(LENGTH_UNITS, normalized)) return O.some(LENGTH_TYPE);
  if (A.contains(ANGLE_UNITS, normalized)) return O.some(ANGLE_TYPE);
  if (A.contains(TIME_UNITS, normalized)) return O.some(TIME_TYPE);
  if (A.contains(FREQUENCY_UNITS, normalized)) return O.some(FREQUENCY_TYPE);
  if (A.contains(RESOLUTION_UNITS, normalized)) return O.some(RESOLUTION_TYPE);
  if (A.contains(FLEX_UNITS, normalized)) return O.some(FLEX_TYPE);

  return O.none();
};

const tokenNumericType = (node: ComponentValue): O.Option<NumericType> => {
  if (!isTokenNode(node)) return O.none();

  const token = node.value;
  if (isTokenNumber(token)) return O.some(NUMBER_TYPE);
  if (isTokenDimension(token)) return unitNumericType(token[4].unit);
  if (isTokenIdent(token) && A.contains(CALC_KEYWORDS, toAsciiLowerCase(token[4].value))) {
    return O.some(NUMBER_TYPE);
  }

  return O.none();
};

const skipIgnorable = (cursor: CalculationCursor): boolean => {
  let skippedWhitespace = false;
  let node = cursor.nodes[cursor.position];

  while (node !== undefined && isWhiteSpaceOrCommentNode(node)) {
    if (isWhitespaceNode(node)) skippedWhitespace = true;
    cursor.position += 1;
    node = cursor.nodes[cursor.position];
  }

  return skippedWhitespace;
};

const delimiter = (node: ComponentValue | undefined): O.Option<string> =>
  node !== undefined && isTokenNode(node) && isTokenDelim(node.value) ? O.some(node.value[4].value) : O.none();

const trimIgnorable = (nodes: ReadonlyArray<ComponentValue>): ReadonlyArray<ComponentValue> => {
  let start = 0;
  let end = nodes.length;

  while (start < end && pipe(nodes[start], O.fromUndefinedOr, O.exists(isWhiteSpaceOrCommentNode))) start += 1;
  while (end > start && pipe(nodes[end - 1], O.fromUndefinedOr, O.exists(isWhiteSpaceOrCommentNode))) end -= 1;

  return pipe(nodes, A.drop(start), A.take(end - start));
};

const splitArguments = (nodes: ReadonlyArray<ComponentValue>): ReadonlyArray<ReadonlyArray<ComponentValue>> => {
  const arguments_: Array<ReadonlyArray<ComponentValue>> = [];
  let current: Array<ComponentValue> = [];

  for (const node of nodes) {
    if (isTokenNode(node) && isTokenComma(node.value)) {
      arguments_.push(current);
      current = [];
    } else {
      current.push(node);
    }
  }

  arguments_.push(current);
  return arguments_;
};

const keywordArgument = (nodes: ReadonlyArray<ComponentValue>): O.Option<string> => {
  const trimmed = trimIgnorable(nodes);
  if (trimmed.length !== 1) return O.none();

  const node = trimmed[0];
  return node !== undefined && isTokenNode(node) && isTokenIdent(node.value)
    ? O.some(toAsciiLowerCase(node.value[4].value))
    : O.none();
};

const parseCalculation = (nodes: ReadonlyArray<ComponentValue>): O.Option<NumericType> => {
  const cursor: CalculationCursor = { nodes, position: 0 };
  skipIgnorable(cursor);
  const parsed = parseSum(cursor);
  if (O.isNone(parsed)) return O.none();

  skipIgnorable(cursor);
  return cursor.position === nodes.length ? parsed : O.none();
};

const parseConsistentCalculations = (
  arguments_: ReadonlyArray<ReadonlyArray<ComponentValue>>
): O.Option<NumericType> => {
  let expected = O.none<NumericType>();

  for (const argument of arguments_) {
    const parsed = parseCalculation(argument);
    if (O.isNone(parsed) || !isBaseNumericType(parsed.value)) return O.none();

    if (O.isSome(expected) && !numericTypeEquivalent(expected.value, parsed.value)) return O.none();
    expected = parsed;
  }

  return expected;
};

const parseExactCalculations = (
  arguments_: ReadonlyArray<ReadonlyArray<ComponentValue>>,
  count: number
): O.Option<ReadonlyArray<NumericType>> => {
  if (arguments_.length !== count) return O.none();

  const parsed: Array<NumericType> = [];
  for (const argument of arguments_) {
    const type = parseCalculation(argument);
    if (O.isNone(type) || !isBaseNumericType(type.value)) return O.none();
    parsed.push(type.value);
  }

  return O.some(parsed);
};

const parseComparisonFunction = (
  name: string,
  arguments_: ReadonlyArray<ReadonlyArray<ComponentValue>>
): O.Option<NumericType> => {
  if (Str.Equivalence(name, "clamp")) {
    if (arguments_.length !== 3) return O.none();

    const types: Array<NumericType> = [];
    for (let index = 0; index < arguments_.length; index += 1) {
      const argument = arguments_[index];
      if (argument === undefined) return O.none();
      const keyword = keywordArgument(argument);
      const allowsNone = index === 0 || index === 2;
      if (
        allowsNone &&
        pipe(
          keyword,
          O.exists((value) => Str.Equivalence(value, "none"))
        )
      )
        continue;
      if (O.isSome(keyword)) return O.none();

      const parsed = parseCalculation(argument);
      if (O.isNone(parsed) || !isBaseNumericType(parsed.value)) return O.none();
      types.push(parsed.value);
    }

    const first = A.head(types);
    return pipe(
      first,
      O.filter((type) => A.every(types, (candidate) => numericTypeEquivalent(type, candidate)))
    );
  }

  if (arguments_.length === 0) return O.none();
  return parseConsistentCalculations(arguments_);
};

const parseRoundFunction = (arguments_: ReadonlyArray<ReadonlyArray<ComponentValue>>): O.Option<NumericType> => {
  if (arguments_.length === 0) return O.none();

  const firstKeyword = pipe(A.head(arguments_), O.flatMap(keywordArgument));
  const hasStrategy = pipe(
    firstKeyword,
    O.exists((value) => A.contains(ROUNDING_STRATEGIES, value))
  );
  const strategy = hasStrategy ? firstKeyword : O.some("nearest");
  const calculations = hasStrategy ? A.drop(arguments_, 1) : arguments_;
  if (calculations.length < 1 || calculations.length > 2) return O.none();

  const parsed = parseExactCalculations(calculations, calculations.length);
  if (O.isNone(parsed)) return O.none();

  const first = A.head(parsed.value);
  if (O.isNone(first)) return O.none();
  if (parsed.value.length === 2 && !numericTypeEquivalent(first.value, parsed.value[1] ?? NUMBER_TYPE)) return O.none();

  const isLineWidth = pipe(
    strategy,
    O.exists((value) => Str.Equivalence(value, "line-width"))
  );
  if (isLineWidth) return isLengthType(first.value) ? first : O.none();
  if (parsed.value.length === 1) return isNumberType(first.value) ? first : O.none();
  return first;
};

const parseMathFunction = (node: FunctionNode): O.Option<NumericType> => {
  if (isTokenEOF(node.endToken)) return O.none();

  const arguments_ = splitArguments(node.value);
  const name = toAsciiLowerCase(node.getName());

  return Match.value(name).pipe(
    Match.when("calc", () => {
      if (arguments_.length !== 1) return O.none();
      return pipe(parseCalculation(arguments_[0] ?? A.empty()), O.filter(isBaseNumericType));
    }),
    Match.when(
      (value) => Str.Equivalence(value, "min") || Str.Equivalence(value, "max") || Str.Equivalence(value, "clamp"),
      () => parseComparisonFunction(name, arguments_)
    ),
    Match.when("round", () => parseRoundFunction(arguments_)),
    Match.when(
      (value) => Str.Equivalence(value, "mod") || Str.Equivalence(value, "rem"),
      () => {
        const parsed = parseExactCalculations(arguments_, 2);
        if (O.isNone(parsed)) return O.none();
        const [left, right] = parsed.value;
        return left !== undefined && right !== undefined && numericTypeEquivalent(left, right)
          ? O.some(left)
          : O.none();
      }
    ),
    Match.when(
      (value) => Str.Equivalence(value, "sin") || Str.Equivalence(value, "cos") || Str.Equivalence(value, "tan"),
      () => {
        const parsed = parseExactCalculations(arguments_, 1);
        if (O.isNone(parsed)) return O.none();
        const argument = A.head(parsed.value);
        return pipe(
          argument,
          O.filter((type) => isNumberType(type) || isAngleType(type)),
          O.map(() => NUMBER_TYPE)
        );
      }
    ),
    Match.when(
      (value) => Str.Equivalence(value, "asin") || Str.Equivalence(value, "acos") || Str.Equivalence(value, "atan"),
      () => {
        const parsed = parseExactCalculations(arguments_, 1);
        return pipe(
          parsed,
          O.flatMap(A.head),
          O.filter(isNumberType),
          O.map(() => ANGLE_TYPE)
        );
      }
    ),
    Match.when("atan2", () => {
      const parsed = parseExactCalculations(arguments_, 2);
      if (O.isNone(parsed)) return O.none();
      const [left, right] = parsed.value;
      return left !== undefined && right !== undefined && numericTypeEquivalent(left, right)
        ? O.some(ANGLE_TYPE)
        : O.none();
    }),
    Match.when("pow", () => {
      const parsed = parseExactCalculations(arguments_, 2);
      return pipe(
        parsed,
        O.filter((types) => A.every(types, isNumberType)),
        O.map(() => NUMBER_TYPE)
      );
    }),
    Match.when("sqrt", () => {
      const parsed = parseExactCalculations(arguments_, 1);
      return pipe(
        parsed,
        O.flatMap(A.head),
        O.filter(isNumberType),
        O.map(() => NUMBER_TYPE)
      );
    }),
    Match.when("hypot", () => {
      if (arguments_.length === 0) return O.none();
      return parseConsistentCalculations(arguments_);
    }),
    Match.when("log", () => {
      if (arguments_.length < 1 || arguments_.length > 2) return O.none();
      const parsed = parseExactCalculations(arguments_, arguments_.length);
      return pipe(
        parsed,
        O.filter((types) => A.every(types, isNumberType)),
        O.map(() => NUMBER_TYPE)
      );
    }),
    Match.when("exp", () => {
      const parsed = parseExactCalculations(arguments_, 1);
      return pipe(
        parsed,
        O.flatMap(A.head),
        O.filter(isNumberType),
        O.map(() => NUMBER_TYPE)
      );
    }),
    Match.when("abs", () => {
      const parsed = parseExactCalculations(arguments_, 1);
      return pipe(parsed, O.flatMap(A.head));
    }),
    Match.when("sign", () => {
      const parsed = parseExactCalculations(arguments_, 1);
      return pipe(
        parsed,
        O.flatMap(A.head),
        O.map(() => NUMBER_TYPE)
      );
    }),
    Match.orElse(O.none<NumericType>)
  );
};

const parseParenthesizedCalculation = (node: SimpleBlockNode): O.Option<NumericType> =>
  isTokenOpenParen(node.startToken) && !isTokenEOF(node.endToken) ? parseCalculation(node.value) : O.none();

const parseAtomic = (cursor: CalculationCursor): O.Option<NumericType> => {
  const node = cursor.nodes[cursor.position];
  if (node === undefined) return O.none();

  cursor.position += 1;
  if (isFunctionNode(node)) return parseMathFunction(node);
  if (isSimpleBlockNode(node)) return parseParenthesizedCalculation(node);
  return tokenNumericType(node);
};

const parseProduct = (cursor: CalculationCursor): O.Option<NumericType> => {
  const initial = parseAtomic(cursor);
  if (O.isNone(initial)) return O.none();

  let current = initial.value;
  while (cursor.position < cursor.nodes.length) {
    const checkpoint = cursor.position;
    skipIgnorable(cursor);
    const operator = delimiter(cursor.nodes[cursor.position]);
    const isProductOperator = pipe(
      operator,
      O.exists((value) => Str.Equivalence(value, "*") || Str.Equivalence(value, "/"))
    );
    if (!isProductOperator) {
      cursor.position = checkpoint;
      return O.some(current);
    }

    cursor.position += 1;
    skipIgnorable(cursor);
    const right = parseAtomic(cursor);
    if (O.isNone(right)) return O.none();

    current = pipe(
      operator,
      O.exists((value) => Str.Equivalence(value, "*"))
    )
      ? multiplyNumericTypes(current, right.value)
      : divideNumericTypes(current, right.value);
  }

  return O.some(current);
};

const parseSum = (cursor: CalculationCursor): O.Option<NumericType> => {
  const initial = parseProduct(cursor);
  if (O.isNone(initial)) return O.none();

  let current = initial.value;
  while (cursor.position < cursor.nodes.length) {
    const checkpoint = cursor.position;
    const hasLeadingSpace = skipIgnorable(cursor);
    const operator = delimiter(cursor.nodes[cursor.position]);
    const isSumOperator = pipe(
      operator,
      O.exists((value) => Str.Equivalence(value, "+") || Str.Equivalence(value, "-"))
    );
    if (!isSumOperator) {
      cursor.position = checkpoint;
      return O.some(current);
    }

    cursor.position += 1;
    const hasTrailingSpace = skipIgnorable(cursor);
    if (!hasLeadingSpace || !hasTrailingSpace) return O.none();

    const right = parseProduct(cursor);
    if (O.isNone(right) || !numericTypeEquivalent(current, right.value)) return O.none();
    current = right.value;
  }

  return O.some(current);
};

type SourceSizeValue = "auto" | "length";

const sourceSizeValue = (node: ComponentValue): O.Option<SourceSizeValue> => {
  if (isTokenNode(node)) {
    const token = node.value;
    if (isTokenIdent(token) && Str.Equivalence(toAsciiLowerCase(token[4].value), "auto")) return O.some("auto");
    if (isTokenNumber(token) && N.Equivalence(token[4].value, 0)) return O.some("length");
    if (isTokenDimension(token)) {
      return pipe(
        unitNumericType(token[4].unit),
        O.filter(isLengthType),
        O.filter(() => !N.isLessThan(token[4].value, 0)),
        O.map((): SourceSizeValue => "length")
      );
    }
    return O.none();
  }

  if (!isFunctionNode(node)) return O.none();
  return pipe(
    parseMathFunction(node),
    O.filter(isLengthType),
    O.map((): SourceSizeValue => "length")
  );
};

const componentTokens = (nodes: ReadonlyArray<ComponentValue>): Array<CSSToken> =>
  A.flatMap(nodes, (node) => node.tokens());

const isAuthorMediaCondition = (nodes: ReadonlyArray<ComponentValue>): boolean => {
  let hasParseError = false;
  const queries = parseMediaQueryListFromTokens(componentTokens(nodes), {
    onParseError: () => {
      hasParseError = true;
    },
    preserveInvalidMediaQueries: true,
  });
  if (hasParseError || queries.length !== 1) return false;

  const query = queries[0];
  if (query === undefined || !isMediaQueryWithoutType(query)) return false;

  let hasGeneralEnclosed = false;
  query.walk(({ node }) => {
    if (isGeneralEnclosed(node)) {
      hasGeneralEnclosed = true;
      return false;
    }
  });
  return !hasGeneralEnclosed;
};

const hasExactAutoPrefix = (input: string): boolean => {
  const normalized = toAsciiLowerCase(input);
  return Str.Equivalence(normalized, "auto") || Str.startsWith("auto,")(normalized);
};

const isAutoComponent = (node: ComponentValue): boolean =>
  isTokenNode(node) && isTokenIdent(node.value) && Str.Equivalence(toAsciiLowerCase(node.value[4].value), "auto");

/**
 * Validates a WHATWG responsive-image source-size list and returns the
 * context-free facts needed by element-level conformance rules.
 *
 * This checks CSS tokenization, list structure, media-condition author
 * grammar, nonnegative literal lengths, CSS math syntax and numeric typing,
 * the percentage ban, and the exact first-entry form of `auto`. Whether an
 * element is allowed to use `auto`, or requires a sizes attribute for a width
 * `srcset`, remains an element/tree relationship check.
 *
 * @example
 * ```ts
 * import { inspectSourceSizeList } from "@beep/html/Html.source-size"
 * import { Result } from "effect"
 *
 * const result = inspectSourceSizeList("(max-width: 30em) 100vw, 50vw")
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const inspectSourceSizeList = (
  input: string
): Result.Result<SourceSizeAnalysis, A.NonEmptyReadonlyArray<SourceSizeIssue>> => {
  let hasParseError = false;
  const tokens = tokenize(
    { css: input },
    {
      onParseError: () => {
        hasParseError = true;
      },
    }
  );
  const entries = parseCommaSeparatedListOfComponentValues(tokens, {
    onParseError: () => {
      hasParseError = true;
    },
  });
  if (hasParseError) return failure("invalidCss");
  if (entries.length === 0) return failure("invalidList");

  const meaningfulTokens = A.filter(tokens, (token) => !isTokenEOF(token) && !isTokenWhiteSpaceOrComment(token));
  if (pipe(A.last(meaningfulTokens), O.exists(isTokenComma))) return failure("invalidList", entries.length - 1);

  const autoEntryIndex = A.findFirstIndex(entries, (entry) => A.some(entry, isAutoComponent));
  if (O.isSome(autoEntryIndex) && !hasExactAutoPrefix(input)) return failure("invalidAuto", autoEntryIndex.value);

  let usesAuto = false;
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const rawEntry = entries[entryIndex];
    if (rawEntry === undefined) return failure("invalidList", entryIndex);
    const entry = trimIgnorable(rawEntry);
    if (entry.length === 0) return failure("invalidList", entryIndex);

    const valueNode = A.last(entry);
    if (O.isNone(valueNode)) return failure("invalidList", entryIndex);

    const value = sourceSizeValue(valueNode.value);
    if (O.isNone(value)) return failure("invalidSourceSize", entryIndex);

    const isLastEntry = entryIndex === entries.length - 1;
    if (Str.Equivalence(value.value, "auto")) {
      if (entryIndex !== 0 || entry.length !== 1) return failure("invalidAuto", entryIndex);
      usesAuto = true;
      continue;
    }

    if (isLastEntry) {
      if (entry.length !== 1) return failure("invalidList", entryIndex);
      continue;
    }

    const mediaCondition = trimIgnorable(A.take(entry, entry.length - 1));
    if (mediaCondition.length === 0) return failure("invalidList", entryIndex);
    if (!isAuthorMediaCondition(mediaCondition)) return failure("invalidMediaCondition", entryIndex);
  }

  if (usesAuto && !hasExactAutoPrefix(input)) return failure("invalidAuto", 0);

  return Result.succeed(SourceSizeAnalysis.make({ entryCount: entries.length, usesAuto }));
};
