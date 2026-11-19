// What a number format code means, as far as this package reads one: whether it shows a date or time, and the text
// Excel would display for the formats decision X3 covers (dates and times, zero-padding, one plain number pattern,
// and General). A code it does not render is refused, never guessed. The General rule and the date tokens follow
// what the reader this package replaced (SheetJS SSF) displayed, so a swap changes no displayed text.
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

/** The format codes Excel has built in (ECMA-376 part 1, 18.8.30), as far as a file may leave them unwritten. */
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

/** The code Excel has built in under each id. */
export const builtinFormats: HashMap.HashMap<number, string> = HashMap.fromIterable(builtins);

/** Excel's own id for each built-in code; the list runs in rising id order, so the lowest id is the last one set. */
export const builtinIds: HashMap.HashMap<string, number> = HashMap.fromIterable(
  A.map(A.reverse(builtins), ([id, code]) => [code, id] as const)
);

const isGeneralAt = (code: string, at: number): boolean => Str.toLowerCase(Str.slice(at, at + 7)(code)) === "general";
const elapsed = /^\[(h+|m+|s+)\]$/i;
const numberRun = "0#?.,E+-%";

/** The end of the bracketed block that opens at `at`, one past its `]`. */
const blockEnd = (code: string, at: number): number => {
  let i = at + 1;
  while (i < code.length && code[i] !== "]") i += 1;
  return i + 1;
};

/**
 * Whether a format code shows its number as a date or a time: it has a year, month, day, hour or second letter, an
 * AM/PM mark or an elapsed-time block outside quotes, escapes and the word General.
 */
// crispen: the scanners of a format code (this one, `literalFrom`, `firstSection`, `dateTokens`) are cursor
// loops: a code is read once per style and once per displayed value, and each step depends on the character before.
export const isDateFormat = (code: string): boolean => {
  let i = 0;
  while (i < code.length) {
    const c = code[i] ?? "";
    if (c === "G" && isGeneralAt(code, i)) i += 7;
    else if (c === '"') {
      i += 1;
      while (i < code.length && code[i] !== '"') i += 1;
      i += 1;
    } else if (c === "\\" || c === "_") i += 2;
    else if (c === "*") i += 2;
    else if (c === "[") {
      const end = blockEnd(code, i);
      if (elapsed.test(Str.slice(i, end)(code))) return true;
      i = end;
    } else if (c === "0" || c === "#" || c === ".") {
      i += 1;
      while (i < code.length && Str.includes(code[i] ?? " ")(numberRun)) i += 1;
    } else if (c === "A" || c === "a") {
      const upper = Str.toUpperCase(Str.slice(i, i + 5)(code));
      if (upper === "AM/PM" || Str.startsWith("A/P")(upper)) return true;
      i += 1;
    } else if ((c === "B" || c === "b") && (code[i + 1] === "1" || code[i + 1] === "2")) return true;
    else if (Str.includes(c)("MDYHSEmdyhseg")) return true;
    else i += 1;
  }
  return false;
};

const zeroPadded = /^0{2,}$/;
const plain = /^(#,##0|0)(?:\.(0+))?(%?)$/;
const bareLiteral = "$-+/():!^&'~{}<>= €";

/** Reads the literal text at the start of `code` from `at`: quoted, escaped, a currency block or bare signs. */
const literalFrom = (code: string, at: number): readonly [text: string, next: number] => {
  let text = "";
  let i = at;
  while (i < code.length) {
    const c = code[i] ?? "";
    if (c === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') j += 1;
      if (j >= code.length) return [text, i];
      text += Str.slice(i + 1, j)(code);
      i = j + 1;
    } else if (c === "\\" && i + 1 < code.length) {
      text += code[i + 1] ?? "";
      i += 2;
    } else if (c === "[" && code[i + 1] === "$") {
      const end = blockEnd(code, i);
      const inside = Str.slice(i + 2, end - 1)(code);
      text += O.match(Str.indexOf("-")(inside), { onNone: () => inside, onSome: (dash) => Str.slice(0, dash)(inside) });
      i = end;
    } else if (Str.includes(c)(bareLiteral)) {
      text += c;
      i += 1;
    } else return [text, i];
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
  const [prefix, start] = literalFrom(code, 0);
  let end = start;
  while (end < code.length && Str.includes(code[end] ?? " ")("#,0.%")) end += 1;
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
  const width = value < 0 ? 12 : 11;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  let text: string;
  if (magnitude >= -4 && magnitude <= -1) text = value.toPrecision(10 + magnitude);
  else if (Math.abs(magnitude) <= 9) {
    const exact = stripDecimal(value.toFixed(12));
    const rounded = value.toPrecision(10);
    text = exact.length <= width ? exact : rounded.length <= width ? rounded : value.toExponential(5);
  } else if (magnitude === 10) text = Str.slice(0, 12)(value.toFixed(10));
  else {
    const exact = stripDecimal(value.toFixed(11));
    text = exact.length > width || exact === "0" || exact === "-0" ? value.toPrecision(6) : exact;
  }
  return stripDecimal(normalizeExponent(Str.toUpperCase(text)));
};

const grouped = (digits: string): string => {
  const first = digits.length % 3;
  const groups: Array<string> = first === 0 ? [] : [Str.slice(0, first)(digits)];
  for (let i = first; i < digits.length; i += 3) groups.push(Str.slice(i, i + 3)(digits));
  return A.join(groups, ",");
};

/** A number under a `ZeroPadded` or `Fixed` format, when it is small enough to write out in digits. */
export const renderNumber: {
  (value: number): (kind: XlsxZeroPaddedFormat | XlsxFixedFormat) => O.Option<string>;
  (kind: XlsxZeroPaddedFormat | XlsxFixedFormat, value: number): O.Option<string>;
} = dual(2, (kind: XlsxZeroPaddedFormat | XlsxFixedFormat, value: number): O.Option<string> => {
  const sign = value < 0 ? "-" : "";
  const size = Math.abs(value);
  if (kind.kind === "ZeroPadded") {
    const whole = Math.round(size);
    return whole < 1e21 ? O.some(`${sign}${Str.padStart(kind.width, "0")(String(whole))}`) : O.none();
  }
  const scaled = Math.round(size * (kind.percent ? 100 : 1) * 10 ** kind.decimals);
  if (!(scaled < 1e21)) return O.none();
  const digits = Str.padStart(kind.decimals + 1, "0")(String(scaled));
  const whole = Str.slice(0, digits.length - kind.decimals)(digits);
  const decimals = kind.decimals === 0 ? "" : `.${Str.slice(digits.length - kind.decimals)(digits)}`;
  return O.some(
    `${sign}${kind.prefix}${kind.thousands ? grouped(whole) : whole}${decimals}${kind.percent ? "%" : ""}${kind.suffix}`
  );
});

// crispen: kept as plain types, not schemas — a token list is built and thrown away on every displayed date (the
// oracle test renders 100k+), and nothing outside this file sees a token; make it a `LiteralKit` tagged union if a
// token ever crosses a module boundary.
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

/** The first section of a format code: what a positive number is shown with. */
const firstSection = (code: string): readonly [section: string, sections: number] => {
  let i = 0;
  let cut = -1;
  let sections = 1;
  while (i < code.length) {
    const c = code[i] ?? "";
    if (c === '"') {
      i += 1;
      while (i < code.length && code[i] !== '"') i += 1;
    } else if (c === "\\") i += 1;
    else if (c === "[") i = blockEnd(code, i) - 1;
    else if (c === ";") {
      if (cut === -1) cut = i;
      sections += 1;
    }
    i += 1;
  }
  return [cut === -1 ? code : Str.slice(0, cut)(code), sections];
};

/** The tokens of a date format, none when it holds something this package does not render. */
const dateTokens = (section: string): O.Option<ReadonlyArray<DateToken>> => {
  const out: Array<DateToken> = [];
  let last = "";
  let i = 0;
  while (i < section.length) {
    const c = section[i] ?? "";
    const lower = Str.toLowerCase(c);
    if (c === '"') {
      let j = i + 1;
      while (j < section.length && section[j] !== '"') j += 1;
      out.push({ t: "text", v: Str.slice(i + 1, j)(section) });
      i = j + 1;
    } else if (c === "\\") {
      out.push({ t: "text", v: section[i + 1] ?? "" });
      i += 2;
    } else if (c === "_") {
      out.push({ t: "text", v: " " });
      i += 2;
    } else if (c === "*") i += 2;
    else if (c === "[") {
      const end = blockEnd(section, i);
      if (elapsed.test(Str.slice(i, end)(section))) return O.none();
      i = end;
    } else if (lower === "a") {
      const upper = Str.toUpperCase(Str.slice(i, i + 5)(section));
      if (upper === "AM/PM") {
        out.push({ t: "ampm", short: false, am: "AM", pm: "PM" });
        i += 5;
      } else if (Str.startsWith("A/P")(upper)) {
        out.push({ t: "ampm", short: true, am: c, pm: section[i + 2] ?? "P" });
        i += 3;
      } else {
        out.push({ t: "text", v: c });
        i += 1;
      }
      last = "a";
    } else if (isDateLetter(lower)) {
      let j = i + 1;
      while (j < section.length && Str.toLowerCase(section[j] ?? "") === lower) j += 1;
      out.push({ t: lower === "m" && last === "h" ? "M" : lower, n: j - i });
      last = lower;
      i = j;
    } else if (Str.includes(c)(dateLiteral) || Str.includes(c)("cfijklopqrtuvwxzP")) {
      out.push({ t: "text", v: c });
      i += 1;
    } else return O.none();
  }
  // A month letter just before seconds is minutes: "mm:ss".
  let after = "";
  for (let k = out.length - 1; k >= 0; k -= 1) {
    const token = out[k];
    if (token === undefined || token.t === "text" || token.t === "ampm") continue;
    if (token.t === "m" && after === "s") out[k] = { t: "M", n: token.n };
    else after = token.t;
  }
  return O.some(out);
};

const isDateLetter = (letter: string): letter is "y" | "m" | "d" | "h" | "s" =>
  letter === "y" || letter === "m" || letter === "d" || letter === "h" || letter === "s";

const padded = (value: number, width: number): string => Str.padStart(width, "0")(String(value));

/**
 * The calendar fields rounded to the second from the millisecond `partsOf` keeps, and carried, as a format with a
 * time in it shows them.
 */
const rounded = (parts: SerialParts, system: XlsxDateSystem): SerialParts => {
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

/** A two-digit-at-most time field, none when the format asks for more digits than Excel shows. */
const twoDigits = (value: number, n: number): O.Option<string> => (n > 2 ? O.none() : O.some(padded(value, n)));

/** One token's text for the calendar fields, none for a token this package does not render. */
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
/**
 * A serial as a date format shows it, none for a format this package does not render (elapsed time, fractions of a
 * second, eras, or a zero under a format with a section of its own for zero) and none past the system's last
 * serial, where Excel shows `#####`.
 */
export const renderDate: {
  (serial: number, system: XlsxDateSystem): (code: string) => O.Option<string>;
  (code: string, serial: number, system: XlsxDateSystem): O.Option<string>;
} = dual(3, (code: string, serial: number, system: XlsxDateSystem): O.Option<string> => {
  const [section, sections] = firstSection(code);
  if (serial > maxSerial(system) || (sections >= 3 && serial === 0)) return O.none();
  return O.flatMap(dateTokens(section), (tokens) => {
    const timed = A.some(tokens, (token) => token.t === "h" || token.t === "M" || token.t === "s");
    const twelve = A.some(tokens, (token) => token.t === "ampm");
    const exact = partsOf(serial, system);
    const parts = timed ? rounded(exact, system) : exact;
    return O.map(O.all(A.map(tokens, tokenText(parts, twelve))), A.join(""));
  });
});
