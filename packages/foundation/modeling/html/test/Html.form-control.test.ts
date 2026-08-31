import { inspectConformance } from "@beep/html";
import {
  ButtonState,
  InputState,
  inputStateAllowedAttributes,
  resolveButtonState,
  resolveInputState,
} from "@beep/html/Html.form-control";
import {
  HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES,
  HTML_INPUT_ATTRIBUTE_APPLICABILITY,
  HtmlConditionalInputAttributeName,
  HtmlInputStateName,
  HtmlTag,
} from "@beep/html/Html.meta";
import { Button, Input, Select } from "@beep/html/Html.model";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const InputStateArbitrary = S.toArbitrary(InputState)(fc);
const ButtonStateArbitrary = S.toArbitrary(ButtonState)(fc);

describe("HTML form-control semantic states", () => {
  it("keeps both applicability axes inside their generated finite domains", () => {
    const states = R.keys(HTML_INPUT_ATTRIBUTE_APPLICABILITY);
    const applicableAttributes = A.flatten(R.values(HTML_INPUT_ATTRIBUTE_APPLICABILITY));

    expect(states).toHaveLength(HtmlInputStateName.Options.length);
    expect(A.every(HtmlInputStateName.Options, (state) => A.contains(states, state))).toBe(true);
    expect(A.every(states, S.is(HtmlInputStateName))).toBe(true);
    expect(HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES).toEqual(HtmlConditionalInputAttributeName.Options);
    expect(A.every(applicableAttributes, S.is(HtmlConditionalInputAttributeName))).toBe(true);
    expect(S.is(HtmlInputStateName)("unsupported")).toBe(false);
    expect(S.is(HtmlConditionalInputAttributeName)("nonstandard")).toBe(false);
  });

  it("normalizes every input type while preserving the missing wire state", () => {
    const missing = Input.make({});
    expect(O.isNone(missing.type)).toBe(true);
    expect(resolveInputState(missing)).toStrictEqual(InputState.cases.text.make({}));

    const states = R.keys(HTML_INPUT_ATTRIBUTE_APPLICABILITY);
    expect(states).toHaveLength(22);
    A.forEach(states, (state) => {
      const input = Result.getOrThrow(S.decodeResult(Input)({ _tag: "input", type: state }));
      const semanticState = resolveInputState(input);
      expect(semanticState.state).toBe(state);
      expect(inputStateAllowedAttributes(semanticState)).toStrictEqual(HTML_INPUT_ATTRIBUTE_APPLICABILITY[state]);
    });
  });

  it("correlates button submit state with explicit and Auto-state context", () => {
    const noParent = O.none<HtmlTag>();
    const selectParent = O.some(HtmlTag.Enum.select);

    expect(resolveButtonState(Button.make({ children: [] }), noParent)).toStrictEqual(
      ButtonState.cases.submit.make({ basis: "auto" })
    );
    expect(resolveButtonState(Button.make({ children: [] }), selectParent)).toStrictEqual(
      ButtonState.cases.nonSubmit.make({ basis: "auto-select-parent" })
    );
    expect(resolveButtonState(Button.make({ children: [], command: O.some("show-modal") }), noParent)).toStrictEqual(
      ButtonState.cases.nonSubmit.make({ basis: "auto-command" })
    );
    expect(resolveButtonState(Button.make({ children: [], commandfor: O.some("target") }), noParent)).toStrictEqual(
      ButtonState.cases.nonSubmit.make({ basis: "auto-commandfor" })
    );
    expect(
      resolveButtonState(
        Button.make({ children: [], command: O.some("show-modal"), commandfor: O.some("target") }),
        noParent
      )
    ).toStrictEqual(ButtonState.cases.nonSubmit.make({ basis: "auto-command-and-commandfor" }));
    expect(
      resolveButtonState(
        Button.make({ children: [], command: O.some("show-modal"), type: O.some("submit") }),
        selectParent
      )
    ).toStrictEqual(ButtonState.cases.submit.make({ basis: "explicit-submit" }));
    expect(resolveButtonState(Button.make({ children: [], type: O.some("reset") }), noParent)).toStrictEqual(
      ButtonState.cases.nonSubmit.make({ basis: "explicit-reset" })
    );
    expect(resolveButtonState(Button.make({ children: [], type: O.some("button") }), noParent)).toStrictEqual(
      ButtonState.cases.nonSubmit.make({ basis: "explicit-button" })
    );
  });

  it("uses the semantic views in contextual runtime conformance", () => {
    expect(inspectConformance(Button.make({ children: [], formaction: O.some("/submit") }))).toStrictEqual([]);

    const selectIssues = inspectConformance(
      Select.make({
        children: [Button.make({ children: [], formaction: O.some("/submit") })],
      })
    );
    expect(
      A.some(
        selectIssues,
        (issue) => issue.rule === "attributeRelationship" && A.contains(issue.path, "attributes.formaction")
      )
    ).toBe(true);

    expect(
      A.some(
        inspectConformance(Input.make({ pattern: O.some("[0-9]+"), type: O.some("file") })),
        (issue) => issue.rule === "attributeRelationship" && A.contains(issue.path, "attributes.pattern")
      )
    ).toBe(true);
  });

  it("rejects impossible discriminants and correlated button bases", () => {
    const validInput: InputState = InputState.cases.email.make({});
    const validButton: ButtonState = ButtonState.cases.submit.make({ basis: "auto" });
    // @ts-expect-error -- unsupported is not one of the standard input states.
    const invalidInput: InputState = { state: "unsupported" };
    // @ts-expect-error -- command presence is correlated with the nonSubmit case.
    const invalidButton: ButtonState = { state: "submit", basis: "auto-command" };

    expect(validInput.state).toBe("email");
    expect(validButton.state).toBe("submit");
    expect(invalidInput.state).toBe("unsupported");
    expect(invalidButton.basis).toBe("auto-command");
    expect(Result.isFailure(S.decodeUnknownResult(InputState)({ state: "unsupported" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(ButtonState)({ state: "submit", basis: "auto-command" }))).toBe(true);
  });

  it("round-trips schema-derived input and button semantic states", () => {
    fc.assert(
      fc.property(InputStateArbitrary, (state) => {
        const encoded = Result.getOrThrow(S.encodeResult(InputState)(state));
        const decoded = Result.getOrThrow(S.decodeResult(InputState)(encoded));
        expect(Eq.equals(decoded, state)).toBe(true);
      }),
      fcRuns(25)
    );
    fc.assert(
      fc.property(ButtonStateArbitrary, (state) => {
        const encoded = Result.getOrThrow(S.encodeResult(ButtonState)(state));
        const decoded = Result.getOrThrow(S.decodeResult(ButtonState)(encoded));
        expect(Eq.equals(decoded, state)).toBe(true);
      }),
      fcRuns(25)
    );
  });
});
