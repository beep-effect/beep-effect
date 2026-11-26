// What a number format code means, as far as this package reads one: whether it shows a date or time, and the text
// Excel would display for the formats decision X3 covers (dates and times, zero-padding, one plain number pattern,
// and General). A code it does not render is refused, never guessed, and a date format with a condition (`[>=2]`) is
// one of them. The General rule and the date tokens follow what the reader this package replaced (SheetJS SSF)
// displayed, with one departure: SheetJS calls a lowercase `general` a date, and this package reads General in any
// case as General, as Excel does.
//
// Notice: the format behaviour here follows SheetJS (https://sheetjs.com, Apache License 2.0), which is also this
// package's test oracle (test/oracle.property.test.ts). The code is this package's own.
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Str from "effect/String";
import {
  XlsxDateFormat,
  XlsxFixedFormat,
  XlsxGeneralFormat,
  XlsxOtherFormat,
  XlsxZeroPaddedFormat,
} from "../XlsxFormatKind.schema.ts";
import { maxSerial } from "../XlsxSerial.schema.ts";
import { partsOf, SerialParts } from "./serial.ts";
import type { XlsxFormatKind } from "../XlsxFormatKind.schema.ts";
import type { XlsxDateSystem } from "../XlsxSerial.schema.ts";

const builtins: ReadonlyArray<readonly [id: number, code: string]> = [
  [0, "General"],
  [1, "0"],
  [2, "0.00"],
  [3, "#,##0"],
  [4, "#,##0.00"],
  [9, "0%"],
  [10, "0.00%"],
  [11, "0.00E+00"],
  [12, "# ?/?"],
  [13, "# ??/??"],
  [14, "m/d/yy"],
  [15, "d-mmm-yy"],
  [16, "d-mmm"],
  [17, "mmm-yy"],
  [18, "h:mm AM/PM"],
  [19, "h:mm:ss AM/PM"],
  [20, "h:mm"],
  [21, "h:mm:ss"],
  [22, "m/d/yy h:mm"],
  [37, "#,##0 ;(#,##0)"],
  [38, "#,##0 ;[Red](#,##0)"],
  [39, "#,##0.00;(#,##0.00)"],
  [40, "#,##0.00;[Red](#,##0.00)"],
  [45, "mm:ss"],
  [46, "[h]:mm:ss"],
  [47, "mmss.0"],
  [48, "##0.0E+0"],
  [49, "@"],
];

/**
 * The code Excel has built in under each id.
 *
 * **Details**
 * The ids are ECMA-376 part 1, 18.8.30, as far as a file may leave them unwritten.
 */
export const builtinFormats: HashMap.HashMap<number, string> = HashMap.fromIterable(builtins);

/** Excel's own id for each built-in code; the list runs in rising id order, so the lowest id is the last one set. */
export const builtinIds: HashMap.HashMap<string, number> = HashMap.fromIterable(
  A.map(A.reverse(builtins), ([id, code]) => [code, id] as const)
);

const isGeneralAt = (code: string, at: number): boolean => Str.toLowerCase(Str.slice(at, at + 7)(code)) === "general";
const elapsed = /^\[(h+|m+|s+)\]$/i;
const numberRun = "0#?.,E+-%";

const blockEnd = (code: string, at: number): number => {
  let i = at + 1;
  while (i < code.length && code[i] !== "]") i += 1;
  return i + 1;
};

const quoteAt = (code: string, from: number): number => {
  let i = from;
  while (i < code.length && code[i] !== '"') i += 1;
  return i;
};

// decision: hot-paths-are-mutable-loops
type NextPieceStart = (code: string, at: number) => number;

const SHOWS_DATE = -1;

const past =
  (width: number): NextPieceStart =>
  (_code, at) =>
    at + width;

const dateMarkSteps: { readonly [character: string]: NextPieceStart } = {
  G: (code, at) => (isGeneralAt(code, at) ? at + 7 : at + 1),
  g: (code, at) => (isGeneralAt(code, at) ? at + 7 : SHOWS_DATE),
  '"': (code, at) => quoteAt(code, at + 1) + 1,
  "\\": past(2),
  _: past(2),
  "*": past(2),
  "[": (code, at) => {
    const end = blockEnd(code, at);
    return elapsed.test(Str.slice(at, end)(code)) ? SHOWS_DATE : end;
  },
  "0": (code, at) => numberRunEnd(code, at + 1),
  "#": (code, at) => numberRunEnd(code, at + 1),
  ".": (code, at) => numberRunEnd(code, at + 1),
  A: (code, at) => ampmMark(code, at),
  a: (code, at) => ampmMark(code, at),
  B: (code, at) => eraMark(code, at),
  b: (code, at) => eraMark(code, at),
};

const numberRunEnd: NextPieceStart = (code, at) => {
  let i = at;
  while (i < code.length && Str.includes(code[i] ?? " ")(numberRun)) i += 1;
  return i;
};

const ampmMark: NextPieceStart = (code, at) => {
  const upper = Str.toUpperCase(Str.slice(at, at + 5)(code));
  return upper === "AM/PM" || Str.startsWith("A/P")(upper) ? SHOWS_DATE : at + 1;
};

const eraMark: NextPieceStart = (code, at) => (code[at + 1] === "1" || code[at + 1] === "2" ? SHOWS_DATE : at + 1);

const dateMarkStep: NextPieceStart = (code, at) => {
  const c = code[at] ?? "";
  const step = dateMarkSteps[c];
  if (step !== undefined) return step(code, at);
  return Str.includes(c)("MDYHSEmdyhseg") ? SHOWS_DATE : at + 1;
};

/**
 * Whether a format code shows its number as a date or a time: it has a year, month, day, hour or second letter, an
 * AM/PM mark or an elapsed-time block outside quotes, escapes and the word General.
 *
 * **Gotchas**
 * The word General is read without regard to case, as `classify` reads it; a lone `g` is an era, so a date.
 */
export const isDateFormat = (code: string): boolean => {
  let i = 0;
  while (i < code.length) {
    i = dateMarkStep(code, i);
    if (i === SHOWS_DATE) return true;
  }
  return false;
};

const zeroPadded = /^0{2,}$/;
const plain = /^(#,##0|0)(?:\.(0+))?(%?)$/;
const bareLiteral = "$-+/():!^&'~{}<>= €";

type Piece = readonly [text: string, next: number];

const noLiteral: Piece = ["", -1];

const literalAt = (code: string, at: number): Piece => {
  const c = code[at] ?? "";
  if (c === '"') return quotedAt(code, at);
  if (c === "\\" && at + 1 < code.length) return [code[at + 1] ?? "", at + 2];
  if (c === "[" && code[at + 1] === "$") return currencyAt(code, at);
  return Str.includes(c)(bareLiteral) ? [c, at + 1] : noLiteral;
};

const quotedAt = (code: string, at: number): Piece => {
  const close = quoteAt(code, at + 1);
  return close >= code.length ? noLiteral : [Str.slice(at + 1, close)(code), close + 1];
};

const currencyAt = (code: string, at: number): Piece => {
  const end = blockEnd(code, at);
  const inside = Str.slice(at + 2, end - 1)(code);
  return [
    O.match(Str.indexOf("-")(inside), { onNone: () => inside, onSome: (dash) => Str.slice(0, dash)(inside) }),
    end,
  ];
};

const literalFrom = (code: string, at: number): readonly [text: string, next: number] => {
  let text = "";
  let i = at;
  while (i < code.length) {
    const [piece, next] = literalAt(code, i);
    if (next === -1) return [text, i];
    text += piece;
    i = next;
  }
  return [text, i];
};

const other = (): XlsxFormatKind => XlsxOtherFormat.make({});

/**
 * What a format code is. A code with sections, colours, conditions, fractions or exponents is `Other`, and so is a
 * zero-padded or plain pattern past the bounds its schema holds: the kind is the one thing `shown` renders from.
 */
export const classify = (code: string): XlsxFormatKind => {
  if (code === "" || Str.toLowerCase(code) === "general") return XlsxGeneralFormat.make({});
  if (isDateFormat(code)) return XlsxDateFormat.make({});
  if (zeroPadded.test(code)) return O.getOrElse(XlsxZeroPaddedFormat.makeOption({ width: code.length }), other);
  return fixedOf(code);
};

const patternEnd = (code: string, start: number): number => {
  let end = start;
  while (end < code.length && Str.includes(code[end] ?? " ")("#,0.%")) end += 1;
  return end;
};

const fixedOf = (code: string): XlsxFormatKind => {
  const [prefix, start] = literalFrom(code, 0);
  const end = patternEnd(code, start);
  const [suffix, rest] = literalFrom(code, end);
  const found = plain.exec(Str.slice(start, end)(code));
  if (found === null || rest !== code.length) return other();
  return O.getOrElse(
    XlsxFixedFormat.makeOption({
      decimals: (found[2] ?? "").length,
      thousands: found[1] === "#,##0",
      percent: found[3] === "%",
      prefix,
      suffix,
    }),
    other
  );
};

const stripDecimal = (text: string): string =>
  Str.includes(".")(text) ? Str.replace(/(?:\.0*|(\.\d*[1-9])0+)$/, "$1")(text) : text;

const normalizeExponent = (text: string): string =>
  Str.includes("E")(text)
    ? Str.replace(/(E[+-])(\d)$/, "$10$2")(Str.replace(/(?:\.0*|(\.\d*[1-9])0+)E/, "$1E")(text))
    : text;

/**
 * A number as the General format shows it: an integer in full, otherwise at most eleven characters (twelve with a
 * minus sign), as a decimal when one fits and in scientific form with six significant digits when none does.
 */
export const renderGeneral = (value: number): string => {
  if (Number.isInteger(value) && Math.abs(value) < 2_147_483_648) return String(value);
  return stripDecimal(normalizeExponent(Str.toUpperCase(generalText(value))));
};

const generalText = (value: number): string => {
  const width = value < 0 ? 12 : 11;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  if (magnitude >= -4 && magnitude <= -1) return value.toPrecision(10 + magnitude);
  if (Math.abs(magnitude) <= 9) return nearText(value, width);
  if (magnitude === 10) return Str.slice(0, 12)(value.toFixed(10));
  return farText(value, width);
};

const nearText = (value: number, width: number): string => {
  const exact = stripDecimal(value.toFixed(12));
  if (exact.length <= width) return exact;
  const rounded = value.toPrecision(10);
  return rounded.length <= width ? rounded : value.toExponential(5);
};

const farText = (value: number, width: number): string => {
  const exact = stripDecimal(value.toFixed(11));
  return exact.length > width || exact === "0" || exact === "-0" ? value.toPrecision(6) : exact;
};

const grouped = (digits: string): string => {
  const first = digits.length % 3;
  const groups: Array<string> = first === 0 ? [] : [Str.slice(0, first)(digits)];
  for (let i = first; i < digits.length; i += 3) groups.push(Str.slice(i, i + 3)(digits));
  return A.join(groups, ",");
};

const signOf = (value: number): string => (value < 0 ? "-" : "");

/** A number under a `ZeroPadded` or `Fixed` format, when it is small enough to write out in digits. */
export const renderNumber: {
  (value: number): (kind: XlsxZeroPaddedFormat | XlsxFixedFormat) => O.Option<string>;
  (kind: XlsxZeroPaddedFormat | XlsxFixedFormat, value: number): O.Option<string>;
} = dual(
  2,
  (kind: XlsxZeroPaddedFormat | XlsxFixedFormat, value: number): O.Option<string> =>
    kind.kind === "ZeroPadded" ? zeroPaddedText(kind, value) : fixedText(kind, value)
);

const zeroPaddedText = (kind: XlsxZeroPaddedFormat, value: number): O.Option<string> => {
  const whole = Math.round(Math.abs(value));
  return whole < 1e21 ? O.some(`${signOf(value)}${Str.padStart(kind.width, "0")(String(whole))}`) : O.none();
};

const fixedText = (kind: XlsxFixedFormat, value: number): O.Option<string> => {
  const scaled = Math.round(Math.abs(value) * (kind.percent ? 100 : 1) * 10 ** kind.decimals);
  if (!(scaled < 1e21)) return O.none();
  const digits = Str.padStart(kind.decimals + 1, "0")(String(scaled));
  const whole = Str.slice(0, digits.length - kind.decimals)(digits);
  const decimals = kind.decimals === 0 ? "" : `.${Str.slice(digits.length - kind.decimals)(digits)}`;
  const shown = kind.thousands ? grouped(whole) : whole;
  return O.some(`${signOf(value)}${kind.prefix}${shown}${decimals}${kind.percent ? "%" : ""}${kind.suffix}`);
};

// decision: hot-paths-are-mutable-loops
type DateField = "y" | "m" | "d" | "h" | "M" | "s";

type DateToken =
  | { readonly t: "text"; readonly v: string }
  | { readonly [F in DateField]: { readonly t: F; readonly n: number } }[DateField]
  | { readonly t: "ampm"; readonly short: boolean; readonly am: string; readonly pm: string };

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dateLiteral = ",$-+/():!^&'~{}<>=€ ";

const sectionStep: NextPieceStart = (code, at) => {
  const c = code[at];
  if (c === '"') return quoteAt(code, at + 1) + 1;
  if (c === "\\") return at + 2;
  if (c === "[") return blockEnd(code, at);
  return at + 1;
};

const isConditionAt = (code: string, at: number): boolean =>
  code[at] === "[" && Str.includes(code[at + 1] ?? " ")("<>=");

const firstSection = (code: string): readonly [section: string, sections: number, conditional: boolean] => {
  let cut = -1;
  let sections = 1;
  let conditional = false;
  for (let i = 0; i < code.length; i = sectionStep(code, i)) {
    conditional = conditional || isConditionAt(code, i);
    if (code[i] !== ";") continue;
    if (cut === -1) cut = i;
    sections += 1;
  }
  return [cut === -1 ? code : Str.slice(0, cut)(code), sections, conditional];
};

const UNRENDERED = -1;

class DateScan {
  readonly out: Array<DateToken> = [];
  private previousField = "";
  private readonly section: string;

  constructor(section: string) {
    this.section = section;
  }

  run(): O.Option<ReadonlyArray<DateToken>> {
    let i = 0;
    while (i < this.section.length) {
      i = this.step(i);
      if (i === UNRENDERED) return O.none();
    }
    minutesBeforeSeconds(this.out);
    return O.some(this.out);
  }

  private step(at: number): number {
    const c = this.section[at] ?? "";
    if (c === '"') return this.quoted(at);
    if (c === "\\") return this.text(this.section[at + 1] ?? "", at + 2);
    if (c === "_") return this.text(" ", at + 2);
    if (c === "*") return at + 2;
    if (c === "[") return this.block(at);
    return this.letter(at, c);
  }

  private letter(at: number, c: string): number {
    const lower = Str.toLowerCase(c);
    if (lower === "a") return this.ampm(at, c);
    if (isDateLetter(lower)) return this.field(at, lower);
    return Str.includes(c)(dateLiteral) || Str.includes(c)("cfijklopqrtuvwxzP") ? this.text(c, at + 1) : UNRENDERED;
  }

  private token(token: DateToken, next: number): number {
    this.out.push(token);
    return next;
  }

  private text(v: string, next: number): number {
    return this.token({ t: "text", v }, next);
  }

  private quoted(at: number): number {
    const close = quoteAt(this.section, at + 1);
    return this.text(Str.slice(at + 1, close)(this.section), close + 1);
  }

  private block(at: number): number {
    const end = blockEnd(this.section, at);
    return elapsed.test(Str.slice(at, end)(this.section)) ? UNRENDERED : end;
  }

  private ampm(at: number, c: string): number {
    const upper = Str.toUpperCase(Str.slice(at, at + 5)(this.section));
    this.previousField = "a";
    if (upper === "AM/PM") return this.token({ t: "ampm", short: false, am: "AM", pm: "PM" }, at + 5);
    if (Str.startsWith("A/P")(upper)) {
      return this.token({ t: "ampm", short: true, am: c, pm: this.section[at + 2] ?? "P" }, at + 3);
    }
    return this.text(c, at + 1);
  }

  private field(at: number, lower: "y" | "m" | "d" | "h" | "s"): number {
    let j = at + 1;
    while (j < this.section.length && Str.toLowerCase(this.section[j] ?? "") === lower) j += 1;
    this.out.push({ t: lower === "m" && this.previousField === "h" ? "M" : lower, n: j - at });
    this.previousField = lower;
    return j;
  }
}

const minutesBeforeSeconds = (out: Array<DateToken>): void => {
  let after = "";
  for (let k = out.length - 1; k >= 0; k -= 1) {
    const token = out[k];
    if (token === undefined || token.t === "text" || token.t === "ampm") continue;
    if (token.t === "m" && after === "s") out[k] = { t: "M", n: token.n };
    else after = token.t;
  }
};

const dateTokens = (section: string): O.Option<ReadonlyArray<DateToken>> => new DateScan(section).run();

const isDateLetter = (letter: string): letter is "y" | "m" | "d" | "h" | "s" =>
  letter === "y" || letter === "m" || letter === "d" || letter === "h" || letter === "s";

const padded = (value: number, width: number): string => Str.padStart(width, "0")(String(value));

const roundedToShownSecond = (parts: SerialParts, system: XlsxDateSystem): SerialParts => {
  if (parts.millisecond < 500) return parts;
  let { hour, minute, second } = parts;
  second += 1;
  if (second >= 60) {
    second = 0;
    minute += 1;
  }
  if (minute >= 60) {
    minute = 0;
    hour += 1;
  }
  if (hour < 24) return SerialParts.make({ ...parts, hour, minute, second, millisecond: 0 });
  return SerialParts.make({ ...partsOf(parts.days + 1, system), hour: 0, minute, second, millisecond: 0 });
};

const twoDigits = (value: number, n: number): O.Option<string> => (n > 2 ? O.none() : O.some(padded(value, n)));

const tokenText = (parts: SerialParts, twelve: boolean): ((token: DateToken) => O.Option<string>) =>
  Match.type<DateToken>().pipe(
    Match.discriminatorsExhaustive("t")({
      text: (token) => O.some(token.v),
      ampm: (token) => O.some(parts.hour >= 12 ? token.pm : token.am),
      y: (token) => O.some(token.n <= 2 ? padded(parts.year % 100, 2) : padded(parts.year % 10_000, 4)),
      m: (token) => {
        const name = months[parts.month - 1] ?? "";
        return O.some(
          token.n <= 2
            ? padded(parts.month, token.n)
            : token.n === 3
              ? Str.slice(0, 3)(name)
              : token.n === 5
                ? Str.slice(0, 1)(name)
                : name
        );
      },
      d: (token) => {
        const name = weekdays[parts.weekday] ?? "";
        return O.some(token.n <= 2 ? padded(parts.day, token.n) : token.n === 3 ? Str.slice(0, 3)(name) : name);
      },
      h: (token) => twoDigits(twelve ? 1 + ((parts.hour + 11) % 12) : parts.hour, token.n),
      M: (token) => twoDigits(parts.minute, token.n),
      s: (token) => twoDigits(parts.second, token.n),
    })
  );

/**
 * A serial as a date format shows it, none for a format this package does not render (elapsed time, fractions of a
 * second, eras, a condition such as `[>=2]` that chooses the section by the serial, or a zero under a format with a
 * section of its own for zero) and none past the system's last serial, where Excel shows `#####`.
 *
 * **Details**
 * Only the code's first section, the one a positive number is shown with, is rendered. A time is shown rounded to
 * the second from the millisecond `partsOf` keeps, carried into the minute, hour and day.
 */
export const renderDate: {
  (serial: number, system: XlsxDateSystem): (code: string) => O.Option<string>;
  (code: string, serial: number, system: XlsxDateSystem): O.Option<string>;
} = dual(3, (code: string, serial: number, system: XlsxDateSystem): O.Option<string> => {
  const [section, sections, conditional] = firstSection(code);
  if (conditional || serial > maxSerial(system) || (sections >= 3 && serial === 0)) return O.none();
  return O.flatMap(dateTokens(section), (tokens) => {
    const timed = A.some(tokens, (token) => token.t === "h" || token.t === "M" || token.t === "s");
    const twelve = A.some(tokens, (token) => token.t === "ampm");
    const exact = partsOf(serial, system);
    const parts = timed ? roundedToShownSecond(exact, system) : exact;
    return O.map(O.all(A.map(tokens, tokenText(parts, twelve))), A.join(""));
  });
});
