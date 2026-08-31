/**
 * Semantic projections for HTML elements whose effective state depends on
 * defaults, microsyntax classification, or tree context.
 *
 * @packageDocumentation \@beep/html/Html.form-control
 * @since 0.0.0
 */

import { $HtmlId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Match, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { HTML_INPUT_ATTRIBUTE_APPLICABILITY, HtmlInputStateName, HtmlTag } from "./Html.meta.ts";
import type { HtmlConditionalInputAttributeName } from "./Html.meta.ts";
import type { Button, Input } from "./Html.model.ts";

const $I = $HtmlId.create("Html.form-control");

/**
 * Closed semantic projection of an input element's effective type state.
 *
 * **Details**
 *
 * This view is additive: it does not replace or re-encode {@link Input}. The
 * discriminant records the state after applying HTML's missing-value default.
 * State-specific attribute applicability remains a contextual conformance rule.
 *
 * **Example** (Construct a file input state)
 *
 * ```ts import.meta.vitest name="Construct a file input state"
 * import { InputState } from "@beep/html"
 *
 * const state = InputState.cases.file.make({})
 * state.state // => "file"
 * ```
 *
 * @invariant `state` is exactly one of the 22 standard input type states.
 * @see {@link https://html.spec.whatwg.org/multipage/input.html#states-of-the-type-attribute} for the normative input-state algorithm.
 * @category models
 * @since 0.0.0
 */
export const InputState = HtmlInputStateName.toTaggedUnion("state")({
  hidden: {},
  text: {},
  search: {},
  tel: {},
  url: {},
  email: {},
  password: {},
  date: {},
  month: {},
  week: {},
  time: {},
  "datetime-local": {},
  number: {},
  range: {},
  color: {},
  checkbox: {},
  radio: {},
  file: {},
  submit: {},
  image: {},
  reset: {},
  button: {},
}).pipe(
  $I.annoteSchema("InputState", {
    description: "Tagged semantic projection of an input element's effective type state.",
  })
);

/**
 * Runtime input-state projection represented by {@link InputState}.
 *
 * @see {@link InputState} for case constructors, guards, and exhaustive matching.
 * @category models
 * @since 0.0.0
 */
export type InputState = typeof InputState.Type;

const makeInputState: (state: HtmlInputStateName) => InputState = HtmlInputStateName.$match({
  hidden: () => InputState.cases.hidden.make({}),
  text: () => InputState.cases.text.make({}),
  search: () => InputState.cases.search.make({}),
  tel: () => InputState.cases.tel.make({}),
  url: () => InputState.cases.url.make({}),
  email: () => InputState.cases.email.make({}),
  password: () => InputState.cases.password.make({}),
  date: () => InputState.cases.date.make({}),
  month: () => InputState.cases.month.make({}),
  week: () => InputState.cases.week.make({}),
  time: () => InputState.cases.time.make({}),
  "datetime-local": () => InputState.cases["datetime-local"].make({}),
  number: () => InputState.cases.number.make({}),
  range: () => InputState.cases.range.make({}),
  color: () => InputState.cases.color.make({}),
  checkbox: () => InputState.cases.checkbox.make({}),
  radio: () => InputState.cases.radio.make({}),
  file: () => InputState.cases.file.make({}),
  submit: () => InputState.cases.submit.make({}),
  image: () => InputState.cases.image.make({}),
  reset: () => InputState.cases.reset.make({}),
  button: () => InputState.cases.button.make({}),
});

/**
 * Resolves an input node to its effective, exhaustively matchable state.
 *
 * **Details**
 *
 * An absent `type` remains absent on the original node and resolves to the Text
 * state only in this semantic view, preserving the generated wire/default shape.
 *
 * **Example** (Resolve the missing type default)
 *
 * ```ts import.meta.vitest name="Resolve the missing type default"
 * import { resolveInputState } from "@beep/html"
 * import { Input } from "@beep/html/Html.model"
 *
 * resolveInputState(Input.make({})).state // => "text"
 * ```
 *
 * @invariant A missing `type` resolves to `text`; an explicit type resolves to its corresponding state.
 * @see {@link https://html.spec.whatwg.org/multipage/input.html#attr-input-type} for the missing and invalid value defaults.
 * @category normalization
 * @since 0.0.0
 */
export const resolveInputState = (input: Input.Type): InputState =>
  pipe(
    input.type,
    O.getOrElse(() => HtmlInputStateName.Enum.text),
    makeInputState
  );

/**
 * Returns the conditional attributes applicable to an effective input state.
 *
 * **Details**
 *
 * The implementation exhaustively matches every state and reads the generated,
 * source-backed applicability registry used by runtime conformance validation.
 *
 * **Example** (Read file-state attributes)
 *
 * ```ts import.meta.vitest name="Read file-state attributes"
 * import { inputStateAllowedAttributes, InputState } from "@beep/html"
 *
 * inputStateAllowedAttributes(InputState.cases.file.make({})).includes("accept") // => true
 * ```
 *
 * @returns The generated conditional-attribute allowlist for the supplied state.
 * @invariant Every {@link InputState} member is handled explicitly.
 * @see {@link https://html.spec.whatwg.org/multipage/input.html#input-type-attr-summary} for the state applicability summary.
 * @category getters
 * @since 0.0.0
 */
export const inputStateAllowedAttributes: (state: InputState) => ReadonlyArray<HtmlConditionalInputAttributeName> =
  InputState.match({
    hidden: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.hidden,
    text: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.text,
    search: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.search,
    tel: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.tel,
    url: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.url,
    email: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.email,
    password: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.password,
    date: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.date,
    month: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.month,
    week: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.week,
    time: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.time,
    "datetime-local": () => HTML_INPUT_ATTRIBUTE_APPLICABILITY["datetime-local"],
    number: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.number,
    range: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.range,
    color: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.color,
    checkbox: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.checkbox,
    radio: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.radio,
    file: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.file,
    submit: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.submit,
    image: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.image,
    reset: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.reset,
    button: () => HTML_INPUT_ATTRIBUTE_APPLICABILITY.button,
  });

const ButtonStateName = LiteralKit(["submit", "nonSubmit"]).pipe(
  $I.annoteSchema("ButtonStateName", {
    description: "Effective submit and non-submit states of an HTML button.",
  })
);

const ButtonSubmitBasis = LiteralKit(["explicit-submit", "auto"]).pipe(
  $I.annoteSchema("ButtonSubmitBasis", {
    description: "Reasons that an HTML button is an effective submit button.",
  })
);

const ButtonNonSubmitBasis = LiteralKit([
  "explicit-reset",
  "explicit-button",
  "auto-command",
  "auto-commandfor",
  "auto-command-and-commandfor",
  "auto-select-parent",
]).pipe(
  $I.annoteSchema("ButtonNonSubmitBasis", {
    description: "Reasons that an HTML button is not an effective submit button.",
  })
);

/**
 * Contextual semantic projection of an HTML button's effective submit state.
 *
 * **Details**
 *
 * The two `state` cases correlate their `basis` values at the type and decode
 * boundaries. Auto-state context is resolved separately so the generated flat
 * {@link Button} encoding remains unchanged.
 *
 * **Example** (Construct a contextual non-submit state)
 *
 * ```ts import.meta.vitest name="Construct a contextual non-submit state"
 * import { ButtonState } from "@beep/html"
 *
 * const state = ButtonState.cases.nonSubmit.make({ basis: "auto-select-parent" })
 * state.state // => "nonSubmit"
 * ```
 *
 * @invariant Submit cases cannot carry non-submit reasons, and non-submit cases cannot carry submit reasons.
 * @see {@link https://html.spec.whatwg.org/multipage/form-elements.html#attr-button-type} for the effective submit-button rules.
 * @category models
 * @since 0.0.0
 */
export const ButtonState = ButtonStateName.toTaggedUnion("state")({
  submit: {
    basis: ButtonSubmitBasis.annotateKey({
      description: "Whether submit behavior comes from explicit type=submit or the Auto state.",
    }),
  },
  nonSubmit: {
    basis: ButtonNonSubmitBasis.annotateKey({
      description: "The explicit or contextual reason the button is not a submit button.",
    }),
  },
}).pipe(
  $I.annoteSchema("ButtonState", {
    description: "Tagged semantic projection of an HTML button's effective submit state.",
  })
);

/**
 * Runtime button-state projection represented by {@link ButtonState}.
 *
 * @see {@link ButtonState} for correlated case constructors and exhaustive matching.
 * @category models
 * @since 0.0.0
 */
export type ButtonState = typeof ButtonState.Type;

const resolveAutoButtonState: {
  (button: Button, immediateParent: O.Option<HtmlTag>): ButtonState;
  (immediateParent: O.Option<HtmlTag>): (button: Button) => ButtonState;
} = dual(
  2,
  (button: Button, immediateParent: O.Option<HtmlTag>): ButtonState =>
    Match.value({
      hasCommand: O.isSome(button.command),
      hasCommandFor: O.isSome(button.commandfor),
      parentIsSelect: O.contains(immediateParent, HtmlTag.Enum.select),
    }).pipe(
      Match.when({ hasCommand: true, hasCommandFor: true }, () =>
        ButtonState.cases.nonSubmit.make({ basis: "auto-command-and-commandfor" })
      ),
      Match.when({ hasCommand: true }, () => ButtonState.cases.nonSubmit.make({ basis: "auto-command" })),
      Match.when({ hasCommandFor: true }, () => ButtonState.cases.nonSubmit.make({ basis: "auto-commandfor" })),
      Match.when({ parentIsSelect: true }, () => ButtonState.cases.nonSubmit.make({ basis: "auto-select-parent" })),
      Match.orElse(() => ButtonState.cases.submit.make({ basis: "auto" }))
    )
);

/**
 * Resolves a button node and its immediate parent to an effective submit state.
 *
 * **Details**
 *
 * A missing `type` is the Auto state. Auto is submit only when `command` and
 * `commandfor` are both absent and the immediate parent is not `select`.
 * Explicit `submit`, `reset`, and `button` values take precedence over context.
 *
 * **Example** (Resolve a select-owned auto button)
 *
 * ```ts import.meta.vitest name="Resolve a select-owned auto button"
 * import { resolveButtonState } from "@beep/html"
 * import { Button } from "@beep/html/Html.model"
 * import * as O from "effect/Option"
 *
 * resolveButtonState(Button.make({ children: [] }), O.some("select")).state // => "nonSubmit"
 * ```
 *
 * @param immediateParent - The direct HTML-element parent, or `None` at a root or non-HTML boundary.
 * @invariant The result applies the WHATWG Auto-state submit predicate without rewriting the button's `type` field.
 * @see {@link https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element} for the normative parent and command conditions.
 * @category normalization
 * @since 0.0.0
 */
export const resolveButtonState: {
  (button: Button, immediateParent: O.Option<HtmlTag>): ButtonState;
  (immediateParent: O.Option<HtmlTag>): (button: Button) => ButtonState;
} = dual(
  2,
  (button: Button, immediateParent: O.Option<HtmlTag>): ButtonState =>
    pipe(
      button.type,
      O.match({
        onNone: () => resolveAutoButtonState(button, immediateParent),
        onSome: (type): ButtonState =>
          Match.value(type).pipe(
            Match.when("submit", () => ButtonState.cases.submit.make({ basis: "explicit-submit" })),
            Match.when("reset", () => ButtonState.cases.nonSubmit.make({ basis: "explicit-reset" })),
            Match.when("button", () => ButtonState.cases.nonSubmit.make({ basis: "explicit-button" })),
            Match.exhaustive
          ),
      })
    )
);
