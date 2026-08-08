/**
 * MUI X date/time pickers backed by Effect `DateTime`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

/**
 * MUI X date/time pickers backed by Effect `DateTime`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { applyTimezone, createDateTimeWithTimezone, createInvalidDateTime } from "@beep/schema/DateTimeUtcFromValid";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { DateTime, Result } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { DatePickerProps } from "@mui/x-date-pickers/DatePicker";
import type { DateTimePickerProps } from "@mui/x-date-pickers/DateTimePicker";
import type { LocalizationProviderProps } from "@mui/x-date-pickers/LocalizationProvider";
import type {
  AdapterFormats,
  AdapterOptions,
  DateBuilderReturnType,
  FieldFormatTokenMap,
  PickersTimezone,
} from "@mui/x-date-pickers/models";
import type { TimePickerProps } from "@mui/x-date-pickers/TimePicker";

declare module "@mui/x-date-pickers/models" {
  interface PickerValidDateLookup {
    "effect-datetime": DateTime.DateTime;
  }
}

const formatTokenMap: FieldFormatTokenMap = {
  y: { sectionType: "year", contentType: "digit", maxLength: 4 },
  yy: { sectionType: "year", contentType: "digit", maxLength: 2 },
  yyy: { sectionType: "year", contentType: "digit", maxLength: 4 },
  yyyy: { sectionType: "year", contentType: "digit", maxLength: 4 },
  YYYY: { sectionType: "year", contentType: "digit", maxLength: 4 },
  M: { sectionType: "month", contentType: "digit", maxLength: 2 },
  MM: { sectionType: "month", contentType: "digit", maxLength: 2 },
  MMM: { sectionType: "month", contentType: "letter" },
  MMMM: { sectionType: "month", contentType: "letter" },
  L: { sectionType: "month", contentType: "digit", maxLength: 2 },
  LL: { sectionType: "month", contentType: "digit", maxLength: 2 },
  LLL: { sectionType: "month", contentType: "letter" },
  LLLL: { sectionType: "month", contentType: "letter" },
  d: { sectionType: "day", contentType: "digit", maxLength: 2 },
  dd: { sectionType: "day", contentType: "digit", maxLength: 2 },
  do: { sectionType: "day", contentType: "digit-with-letter" },
  D: { sectionType: "day", contentType: "digit", maxLength: 2 },
  DD: { sectionType: "day", contentType: "digit", maxLength: 2 },
  E: { sectionType: "weekDay", contentType: "letter" },
  EE: { sectionType: "weekDay", contentType: "letter" },
  EEE: { sectionType: "weekDay", contentType: "letter" },
  EEEE: { sectionType: "weekDay", contentType: "letter" },
  e: { sectionType: "weekDay", contentType: "digit", maxLength: 2 },
  ee: { sectionType: "weekDay", contentType: "digit", maxLength: 2 },
  eee: { sectionType: "weekDay", contentType: "letter" },
  eeee: { sectionType: "weekDay", contentType: "letter" },
  H: { sectionType: "hours", contentType: "digit", maxLength: 2 },
  HH: { sectionType: "hours", contentType: "digit", maxLength: 2 },
  h: { sectionType: "hours", contentType: "digit", maxLength: 2 },
  hh: { sectionType: "hours", contentType: "digit", maxLength: 2 },
  m: { sectionType: "minutes", contentType: "digit", maxLength: 2 },
  mm: { sectionType: "minutes", contentType: "digit", maxLength: 2 },
  s: { sectionType: "seconds", contentType: "digit", maxLength: 2 },
  ss: { sectionType: "seconds", contentType: "digit", maxLength: 2 },
  a: "meridiem",
  aa: "meridiem",
  A: "meridiem",
  AA: "meridiem",
  S: { sectionType: "seconds", contentType: "digit", maxLength: 1 },
  SS: { sectionType: "seconds", contentType: "digit", maxLength: 2 },
  SSS: { sectionType: "seconds", contentType: "digit", maxLength: 3 },
};

const defaultFormats: AdapterFormats = {
  year: "yyyy",
  month: "LLLL",
  monthShort: "LLL",
  dayOfMonth: "d",
  dayOfMonthFull: "do",
  weekday: "EEEE",
  weekdayShort: "EEE",
  hours24h: "HH",
  hours12h: "hh",
  meridiem: "aa",
  minutes: "mm",
  seconds: "ss",
  fullDate: "PP",
  keyboardDate: "P",
  shortDate: "MMM d",
  normalDate: "d MMMM",
  normalDateWithWeekday: "EEE, MMM d",
  fullTime12h: "hh:mm aa",
  fullTime24h: "HH:mm",
  keyboardDateTime12h: "P hh:mm aa",
  keyboardDateTime24h: "P HH:mm",
};

const weekStartForLocale = (locale: string | undefined): 0 | 1 => {
  const mondayLocales = [
    "de",
    "fr",
    "es",
    "it",
    "pt",
    "ru",
    "pl",
    "nl",
    "sv",
    "da",
    "no",
    "fi",
    "cs",
    "sk",
    "hu",
    "ro",
    "bg",
    "el",
    "uk",
    "tr",
    "hr",
    "sl",
    "et",
    "lv",
    "lt",
    "vi",
  ];
  const localePrefix = pipe(
    locale ?? "en",
    Str.split("-"),
    A.head,
    O.map(Str.toLowerCase),
    O.getOrElse(() => "en")
  );
  return A.some(mondayLocales, (value) => value === localePrefix) ? 1 : 0;
};

const isBeforeDateTime = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
  value.epochMilliseconds < comparing.epochMilliseconds;

const isAfterDateTime = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
  value.epochMilliseconds > comparing.epochMilliseconds;

type FormatOptionRule = {
  readonly pattern: RegExp;
  readonly patch: Intl.DateTimeFormatOptions;
};

const dateStyleFormats: Partial<Record<string, Intl.DateTimeFormatOptions["dateStyle"]>> = {
  P: "short",
  PP: "medium",
};

const formatOptionRuleGroups = [
  [
    { pattern: /yyyy|YYYY/u, patch: { year: "numeric" } },
    { pattern: /yy|YY/u, patch: { year: "2-digit" } },
  ],
  [
    { pattern: /MMMM|LLLL/u, patch: { month: "long" } },
    { pattern: /MMM|LLL/u, patch: { month: "short" } },
    { pattern: /MM|LL/u, patch: { month: "2-digit" } },
    { pattern: /[ML]/u, patch: { month: "numeric" } },
  ],
  [
    { pattern: /dd|DD/u, patch: { day: "2-digit" } },
    { pattern: /[dD]/u, patch: { day: "numeric" } },
  ],
  [
    { pattern: /EEEE|eeee/u, patch: { weekday: "long" } },
    { pattern: /EEE|eee|E/u, patch: { weekday: "short" } },
  ],
  [
    { pattern: /HH|H/u, patch: { hour: "2-digit", hour12: false } },
    { pattern: /hh|h/u, patch: { hour: "2-digit", hour12: true } },
  ],
  [{ pattern: /mm|m/u, patch: { minute: "2-digit" } }],
  [{ pattern: /ss|s/u, patch: { second: "2-digit" } }],
] satisfies ReadonlyArray<ReadonlyArray<FormatOptionRule>>;

const dateStyleOptions = (formatString: string): O.Option<Intl.DateTimeFormatOptions> => {
  const dateStyle = dateStyleFormats[formatString];
  return dateStyle === undefined ? O.none() : O.some({ dateStyle });
};

const formatPatchForGroup = (
  formatString: string,
  rules: ReadonlyArray<FormatOptionRule>
): Intl.DateTimeFormatOptions =>
  pipe(
    rules,
    A.findFirst((rule) => rule.pattern.test(formatString)),
    O.map((rule) => rule.patch),
    O.getOrElse((): Intl.DateTimeFormatOptions => ({}))
  );

const formatStringToIntlOptions = (formatString: string): Intl.DateTimeFormatOptions =>
  pipe(
    dateStyleOptions(formatString),
    O.getOrElse(() =>
      pipe(
        formatOptionRuleGroups,
        A.reduce({} as Intl.DateTimeFormatOptions, (options, rules) => ({
          ...options,
          ...formatPatchForGroup(formatString, rules),
        }))
      )
    )
  );

const fallbackMeridiem = (value: DateTime.DateTime): string => (DateTime.getPart(value, "hour") < 12 ? "AM" : "PM");

const formatMeridiem = (value: DateTime.DateTime, locale: string, formatString: string): string =>
  Result.getOrElse(
    Result.try(() => {
      const meridiem = pipe(
        new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true }).formatToParts(DateTime.toDate(value)),
        A.findFirst((part) => part.type === "dayPeriod"),
        O.map((part) => part.value),
        O.getOrElse(() => fallbackMeridiem(value))
      );

      return formatString === "A" || formatString === "AA" ? Str.toUpperCase(meridiem) : meridiem;
    }),
    () => fallbackMeridiem(value)
  );

type ExactFormatTokenHandler = (value: DateTime.DateTime, locale: string) => string;

const formatPaddedPart = (width: number, value: number): string => pipe(`${value}`, Str.padStart(width, "0"));

const formatTwoDigitPart = (value: number): string => formatPaddedPart(2, value);

const getHour12 = (value: DateTime.DateTime): number => {
  const hour = DateTime.getPart(value, "hour") % 12;
  return hour === 0 ? 12 : hour;
};

const exactFormatTokenHandlers: Record<string, ExactFormatTokenHandler> = {
  y: (value) => `${DateTime.getPart(value, "year")}`,
  yy: (value) => formatTwoDigitPart(DateTime.getPart(value, "year") % 100),
  yyy: (value) => formatPaddedPart(4, DateTime.getPart(value, "year")),
  yyyy: (value) => formatPaddedPart(4, DateTime.getPart(value, "year")),
  YYYY: (value) => formatPaddedPart(4, DateTime.getPart(value, "year")),
  M: (value) => `${DateTime.getPart(value, "month")}`,
  MM: (value) => formatTwoDigitPart(DateTime.getPart(value, "month")),
  L: (value) => `${DateTime.getPart(value, "month")}`,
  LL: (value) => formatTwoDigitPart(DateTime.getPart(value, "month")),
  d: (value) => `${DateTime.getPart(value, "day")}`,
  dd: (value) => formatTwoDigitPart(DateTime.getPart(value, "day")),
  D: (value) => `${DateTime.getPart(value, "day")}`,
  DD: (value) => formatTwoDigitPart(DateTime.getPart(value, "day")),
  H: (value) => `${DateTime.getPart(value, "hour")}`,
  HH: (value) => formatTwoDigitPart(DateTime.getPart(value, "hour")),
  h: (value) => `${getHour12(value)}`,
  hh: (value) => value.pipe(getHour12, formatTwoDigitPart),
  m: (value) => `${DateTime.getPart(value, "minute")}`,
  mm: (value) => formatTwoDigitPart(DateTime.getPart(value, "minute")),
  s: (value) => `${DateTime.getPart(value, "second")}`,
  ss: (value) => formatTwoDigitPart(DateTime.getPart(value, "second")),
  a: (value, locale) => formatMeridiem(value, locale, "a"),
  aa: (value, locale) => formatMeridiem(value, locale, "aa"),
  A: (value, locale) => formatMeridiem(value, locale, "A"),
  AA: (value, locale) => formatMeridiem(value, locale, "AA"),
  S: (value) => `${Math.floor(DateTime.getPart(value, "millisecond") / 100)}`,
  SS: (value) => formatTwoDigitPart(Math.floor(DateTime.getPart(value, "millisecond") / 10)),
  SSS: (value) => formatPaddedPart(3, DateTime.getPart(value, "millisecond")),
};

const formatExactToken = (value: DateTime.DateTime, locale: string, formatString: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(exactFormatTokenHandlers[formatString]),
    O.map((formatter) => formatter(value, locale))
  );

/**
 * MUI X adapter that lets pickers read and write Effect `DateTime` values.
 *
 * **Details**
 *
 * Effect `DateTime.DateTime` is the canonical value that crosses the public
 * picker boundary. This adapter performs the MUI-specific month indexing,
 * timezone, formatting, and JavaScript `Date` conversions internally so
 * application state does not need to store `Date`.
 *
 * **Example** (Verify month index boundary)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { AdapterEffectDateTime } from "@beep/ui/components/effect-date-time-picker"
 *
 * const adapter = new AdapterEffectDateTime({ locale: "en-US" })
 * const value = DateTime.makeUnsafe("2024-02-03T04:05:06.007Z")
 *
 * const readAdapterBoundary = () => {
 *   const effectMonth = DateTime.getPart(value, "month")
 *   const pickerMonth = adapter.getMonth(value)
 *   const calendarYear = adapter.formatByString(value, "yyyy")
 *
 *   return { calendarYear, effectMonth, pickerMonth }
 * }
 *
 * const boundary = readAdapterBoundary()
 *
 * if (boundary.effectMonth !== 2 || boundary.pickerMonth !== 1 || boundary.calendarYear !== "2024") {
 *   throw new Error("unexpected Effect DateTime adapter boundary")
 * }
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export class AdapterEffectDateTime {
  public isMUIAdapter = true;
  public isTimezoneCompatible = true;
  public lib = "effect-datetime";
  public locale?: string;
  public formats: AdapterFormats;
  public escapedCharacters = { start: "'", end: "'" };
  public formatTokenMap = formatTokenMap;

  private readonly weekStartsOn: 0 | 1;

  constructor(options?: AdapterOptions<string, never> | undefined) {
    this.locale = options?.locale ?? "en-US";
    this.formats = { ...defaultFormats, ...options?.formats };
    this.weekStartsOn = weekStartForLocale(this.locale);
  }

  private toAdapterMonth(effectMonth: number): number {
    return effectMonth - 1;
  }

  private fromAdapterMonth(adapterMonth: number): number {
    return adapterMonth + 1;
  }

  private getDateTimePart(value: DateTime.DateTime, part: keyof DateTime.DateTime.PartsWithWeekday): number {
    return DateTime.getPart(value, part);
  }

  private formatStringToIntlOptions(formatString: string): Intl.DateTimeFormatOptions {
    return formatStringToIntlOptions(formatString);
  }

  public date = <T extends string | null | undefined>(
    value?: T,
    timezone: PickersTimezone = "default"
  ): DateBuilderReturnType<T> => {
    if (value === undefined) {
      return applyTimezone(DateTime.nowUnsafe(), timezone) as DateBuilderReturnType<T>;
    }

    return createDateTimeWithTimezone(value, timezone) as DateBuilderReturnType<T>;
  };

  public getInvalidDate = (): DateTime.DateTime => createInvalidDateTime();

  public toJsDate = (value: DateTime.DateTime): Date => DateTime.toDate(value);

  public getTimezone = (value: DateTime.DateTime | null): PickersTimezone => {
    if (value === null) {
      return "default";
    }
    if (DateTime.isZoned(value)) {
      return DateTime.zoneToString(value.zone);
    }
    return "UTC";
  };

  public setTimezone = (value: DateTime.DateTime, timezone: PickersTimezone): DateTime.DateTime =>
    applyTimezone(value, timezone);

  public parse = (value: string, _format: string): DateTime.DateTime | null => {
    if (value === "") {
      return null;
    }

    return pipe(DateTime.make(value), O.getOrNull);
  };

  public format = (value: DateTime.DateTime, formatKey: keyof AdapterFormats): string =>
    this.formatByString(value, this.formats[formatKey]);

  public formatByString = (value: DateTime.DateTime | null | undefined, formatString: string): string => {
    if (!this.isValid(value)) {
      return "Invalid Date";
    }

    const date = DateTime.toDate(value);
    const locale = this.locale ?? "en-US";
    return pipe(
      formatExactToken(value, locale, formatString),
      O.getOrElse(() => {
        const options = this.formatStringToIntlOptions(formatString);

        return Result.getOrElse(
          Result.try(() => new Intl.DateTimeFormat(locale, options).format(date)),
          () => date.toISOString()
        );
      })
    );
  };

  public formatNumber = (numberToFormat: string): string => {
    const rtlLocales = ["ar", "he", "fa", "ur"];
    const localePrefix = pipe(
      this.locale ?? "en",
      Str.split("-"),
      A.head,
      O.map(Str.toLowerCase),
      O.getOrElse(() => "en")
    );

    if (A.some(rtlLocales, (value) => value === localePrefix)) {
      return Result.getOrElse(
        Result.try(() => new Intl.NumberFormat(this.locale).format(Number(numberToFormat))),
        () => numberToFormat
      );
    }

    return numberToFormat;
  };

  public expandFormat = (format: string): string => {
    const expansions: Record<string, string> = {
      P: "MM/dd/yyyy",
      PP: "MMM d, yyyy",
      PPP: "MMMM d, yyyy",
      PPPP: "EEEE, MMMM d, yyyy",
      p: "h:mm aa",
      pp: "h:mm:ss aa",
      ppp: "h:mm:ss aa",
      pppp: "h:mm:ss aa",
    };

    return format.replace(/P{1,4}|p{1,4}/gu, (match) => expansions[match] ?? match);
  };

  public isValid = (value: DateTime.DateTime | null | undefined): value is DateTime.DateTime =>
    DateTime.isDateTime(value) && !Number.isNaN(value.epochMilliseconds);

  public getCurrentLocaleCode = (): string => this.locale ?? "en-US";

  public is12HourCycleInCurrentLocale = (): boolean => {
    const locale = this.getCurrentLocaleCode();
    return pipe(
      Result.try(() => new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle),
      Result.map((hourCycle) => hourCycle === "h12" || hourCycle === "h11"),
      Result.getOrElse(() => pipe(locale, Str.startsWith("en")))
    );
  };

  public getYear = (value: DateTime.DateTime): number => this.getDateTimePart(value, "year");

  public getMonth = (value: DateTime.DateTime): number => this.toAdapterMonth(this.getDateTimePart(value, "month"));

  public getDate = (value: DateTime.DateTime): number => this.getDateTimePart(value, "day");

  public getHours = (value: DateTime.DateTime): number => this.getDateTimePart(value, "hour");

  public getMinutes = (value: DateTime.DateTime): number => this.getDateTimePart(value, "minute");

  public getSeconds = (value: DateTime.DateTime): number => this.getDateTimePart(value, "second");

  public getMilliseconds = (value: DateTime.DateTime): number => this.getDateTimePart(value, "millisecond");

  public getDayOfWeek = (value: DateTime.DateTime): number => {
    const weekDay = this.getDateTimePart(value, "weekDay");
    return ((weekDay - this.weekStartsOn + 7) % 7) + 1;
  };

  public setYear = (value: DateTime.DateTime, year: number): DateTime.DateTime => DateTime.setParts(value, { year });

  public setMonth = (value: DateTime.DateTime, month: number): DateTime.DateTime =>
    DateTime.setParts(value, { month: this.fromAdapterMonth(month) });

  public setDate = (value: DateTime.DateTime, date: number): DateTime.DateTime =>
    DateTime.setParts(value, { day: date });

  public setHours = (value: DateTime.DateTime, hours: number): DateTime.DateTime =>
    DateTime.setParts(value, { hour: hours });

  public setMinutes = (value: DateTime.DateTime, minutes: number): DateTime.DateTime =>
    DateTime.setParts(value, { minute: minutes });

  public setSeconds = (value: DateTime.DateTime, seconds: number): DateTime.DateTime =>
    DateTime.setParts(value, { second: seconds });

  public setMilliseconds = (value: DateTime.DateTime, milliseconds: number): DateTime.DateTime =>
    DateTime.setParts(value, { millisecond: milliseconds });

  public isEqual = (value: DateTime.DateTime | null, comparing: DateTime.DateTime | null): boolean => {
    if (value === null && comparing === null) {
      return true;
    }
    return value !== null && comparing !== null && value.epochMilliseconds === comparing.epochMilliseconds;
  };

  public isSameYear = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
    this.getYear(value) === this.getYear(comparing);

  public isSameMonth = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
    this.isSameYear(value, comparing) && this.getMonth(value) === this.getMonth(comparing);

  public isSameDay = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
    this.isSameMonth(value, comparing) && this.getDate(value) === this.getDate(comparing);

  public isSameHour = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
    this.isSameDay(value, comparing) && this.getHours(value) === this.getHours(comparing);

  public isAfter = isAfterDateTime;

  public isAfterYear = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
    this.getYear(value) > this.getYear(comparing);

  public isAfterDay = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
    isAfterDateTime(this.startOfDay(value), this.endOfDay(comparing));

  public isBefore = isBeforeDateTime;

  public isBeforeYear = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
    this.getYear(value) < this.getYear(comparing);

  public isBeforeDay = (value: DateTime.DateTime, comparing: DateTime.DateTime): boolean =>
    isBeforeDateTime(this.endOfDay(value), this.startOfDay(comparing));

  public isWithinRange = (value: DateTime.DateTime, [start, end]: [DateTime.DateTime, DateTime.DateTime]): boolean =>
    DateTime.between(value, { minimum: start, maximum: end });

  public startOfYear = (value: DateTime.DateTime): DateTime.DateTime => DateTime.startOf(value, "year");

  public startOfMonth = (value: DateTime.DateTime): DateTime.DateTime => DateTime.startOf(value, "month");

  public startOfWeek = (value: DateTime.DateTime): DateTime.DateTime =>
    DateTime.startOf(value, "week", { weekStartsOn: this.weekStartsOn });

  public startOfDay = (value: DateTime.DateTime): DateTime.DateTime => DateTime.startOf(value, "day");

  public endOfYear = (value: DateTime.DateTime): DateTime.DateTime => DateTime.endOf(value, "year");

  public endOfMonth = (value: DateTime.DateTime): DateTime.DateTime => DateTime.endOf(value, "month");

  public endOfWeek = (value: DateTime.DateTime): DateTime.DateTime =>
    DateTime.endOf(value, "week", { weekStartsOn: this.weekStartsOn });

  public endOfDay = (value: DateTime.DateTime): DateTime.DateTime => DateTime.endOf(value, "day");

  public addYears = (value: DateTime.DateTime, amount: number): DateTime.DateTime =>
    DateTime.add(value, { years: amount });

  public addMonths = (value: DateTime.DateTime, amount: number): DateTime.DateTime =>
    DateTime.add(value, { months: amount });

  public addWeeks = (value: DateTime.DateTime, amount: number): DateTime.DateTime =>
    DateTime.add(value, { weeks: amount });

  public addDays = (value: DateTime.DateTime, amount: number): DateTime.DateTime =>
    DateTime.add(value, { days: amount });

  public addHours = (value: DateTime.DateTime, amount: number): DateTime.DateTime =>
    DateTime.add(value, { hours: amount });

  public addMinutes = (value: DateTime.DateTime, amount: number): DateTime.DateTime =>
    DateTime.add(value, { minutes: amount });

  public addSeconds = (value: DateTime.DateTime, amount: number): DateTime.DateTime =>
    DateTime.add(value, { seconds: amount });

  public getDaysInMonth = (value: DateTime.DateTime): number => this.getDate(this.endOfMonth(value));

  public getWeekArray = (value: DateTime.DateTime): DateTime.DateTime[][] => {
    const start = this.startOfWeek(this.startOfMonth(value));
    const end = this.endOfWeek(this.endOfMonth(value));
    const weeks: DateTime.DateTime[][] = [];
    let current = start;

    while (current.epochMilliseconds <= end.epochMilliseconds) {
      const currentWeekIndex = Math.floor(
        (current.epochMilliseconds - start.epochMilliseconds) / (7 * 24 * 60 * 60 * 1000)
      );
      weeks[currentWeekIndex] ??= [];
      weeks[currentWeekIndex].push(current);
      current = this.addDays(current, 1);

      const lastWeek = weeks[weeks.length - 1];
      if (weeks.length >= 6 && lastWeek !== undefined && lastWeek.length >= 7) {
        break;
      }
    }

    return weeks;
  };

  public getWeekNumber = (value: DateTime.DateTime): number => {
    const startOfWeekValue = DateTime.startOf(value, "week", { weekStartsOn: 1 });
    const startOfYear = DateTime.startOf(value, "year");
    const jan1WeekDay = DateTime.getPart(startOfYear, "weekDay");
    const isoWeekDay = jan1WeekDay === 0 ? 7 : jan1WeekDay;
    const daysToFirstThursday = isoWeekDay <= 4 ? 4 - isoWeekDay : 11 - isoWeekDay;
    const firstThursday = DateTime.add(startOfYear, { days: daysToFirstThursday });
    const firstIsoWeekStart = DateTime.startOf(firstThursday, "week", { weekStartsOn: 1 });
    const weekNumber =
      Math.floor(
        (startOfWeekValue.epochMilliseconds - firstIsoWeekStart.epochMilliseconds) / (7 * 24 * 60 * 60 * 1000)
      ) + 1;

    if (weekNumber < 1) {
      return this.getWeekNumber(DateTime.subtract(startOfYear, { days: 1 }));
    }

    return weekNumber;
  };

  public getYearRange = ([start, end]: [DateTime.DateTime, DateTime.DateTime]): DateTime.DateTime[] => {
    const startDate = this.startOfYear(start);
    const endDate = this.endOfYear(end);
    const years: DateTime.DateTime[] = [];
    let current = startDate;

    while (current.epochMilliseconds <= endDate.epochMilliseconds) {
      years.push(current);
      current = this.addYears(current, 1);
    }

    return years;
  };
}

type EffectDateTimeLocalizationProviderProps = Omit<
  LocalizationProviderProps<string>,
  "dateAdapter" | "dateLibInstance"
>;

/**
 * Localization provider preconfigured for MUI pickers that consume Effect
 * `DateTime` values.
 *
 * **Example** (Localized invoice date field)
 *
 * ```tsx
 * import * as React from "react"
 * import { DateTime } from "effect"
 * import { DatePicker } from "@mui/x-date-pickers/DatePicker"
 * import { EffectDateTimeLocalizationProvider } from "@beep/ui/components/effect-date-time-picker"
 *
 * export function LocalizedInvoiceDateField() {
 *   const [invoiceDate, setInvoiceDate] = React.useState<DateTime.DateTime | null>(
 *     DateTime.makeUnsafe("2024-02-03T00:00:00.000Z")
 *   )
 *
 *   return (
 *     <EffectDateTimeLocalizationProvider adapterLocale="en-GB">
 *       <DatePicker label="Invoice date" value={invoiceDate} onChange={setInvoiceDate} />
 *     </EffectDateTimeLocalizationProvider>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EffectDateTimeLocalizationProvider(props: EffectDateTimeLocalizationProviderProps) {
  return <LocalizationProvider {...props} dateAdapter={AdapterEffectDateTime} />;
}

type ControlledPickerProps<TProps> = Omit<TProps, "value" | "defaultValue" | "onChange"> & {
  readonly defaultValue?: DateTime.DateTime | null | undefined;
  readonly onValueChange?: ((value: DateTime.DateTime | null) => void) | undefined;
  readonly value?: DateTime.DateTime | null | undefined;
};

/**
 * Date picker wrapper whose controlled value is an Effect `DateTime`.
 *
 * **Example** (Controlled birthday date field)
 *
 * ```tsx
 * import * as React from "react"
 * import { DateTime } from "effect"
 * import { EffectDatePicker } from "@beep/ui/components/effect-date-time-picker"
 *
 * export function BirthdayField() {
 *   const [birthday, setBirthday] = React.useState<DateTime.DateTime | null>(
 *     DateTime.makeUnsafe("1990-06-15T00:00:00.000Z")
 *   )
 *
 *   return <EffectDatePicker label="Birthday" value={birthday} onValueChange={setBirthday} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EffectDatePicker({
  defaultValue,
  onValueChange,
  value,
  ...props
}: ControlledPickerProps<DatePickerProps>) {
  return (
    <EffectDateTimeLocalizationProvider>
      <DatePicker
        {...props}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        {...(value !== undefined ? { value } : {})}
        onChange={(nextValue) => onValueChange?.(nextValue)}
      />
    </EffectDateTimeLocalizationProvider>
  );
}

/**
 * Date-time picker wrapper whose controlled value is an Effect `DateTime`.
 *
 * **Example** (Timezone-aware appointment picker)
 *
 * ```tsx
 * import * as React from "react"
 * import { DateTime } from "effect"
 * import { EffectDateTimePicker } from "@beep/ui/components/effect-date-time-picker"
 *
 * export function AppointmentStartsAtField() {
 *   const [startsAt, setStartsAt] = React.useState<DateTime.DateTime | null>(
 *     DateTime.makeUnsafe("2024-02-03T09:30:00.000Z")
 *   )
 *
 *   return (
 *     <EffectDateTimePicker
 *       label="Starts at"
 *       timezone="America/Chicago"
 *       value={startsAt}
 *       onValueChange={setStartsAt}
 *     />
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EffectDateTimePicker({
  defaultValue,
  onValueChange,
  value,
  ...props
}: ControlledPickerProps<DateTimePickerProps>) {
  return (
    <EffectDateTimeLocalizationProvider>
      <DateTimePicker
        {...props}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        {...(value !== undefined ? { value } : {})}
        onChange={(nextValue) => onValueChange?.(nextValue)}
      />
    </EffectDateTimeLocalizationProvider>
  );
}

/**
 * Time picker wrapper whose controlled value is an Effect `DateTime`.
 *
 * **Example** (Controlled reminder time field)
 *
 * ```tsx
 * import * as React from "react"
 * import { DateTime } from "effect"
 * import { EffectTimePicker } from "@beep/ui/components/effect-date-time-picker"
 *
 * export function ReminderTimeField() {
 *   const [reminderTime, setReminderTime] = React.useState<DateTime.DateTime | null>(
 *     DateTime.makeUnsafe("2024-02-03T14:15:00.000Z")
 *   )
 *
 *   return <EffectTimePicker label="Reminder time" value={reminderTime} onValueChange={setReminderTime} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EffectTimePicker({
  defaultValue,
  onValueChange,
  value,
  ...props
}: ControlledPickerProps<TimePickerProps>) {
  return (
    <EffectDateTimeLocalizationProvider>
      <TimePicker
        {...props}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        {...(value !== undefined ? { value } : {})}
        onChange={(nextValue) => onValueChange?.(nextValue)}
      />
    </EffectDateTimeLocalizationProvider>
  );
}
