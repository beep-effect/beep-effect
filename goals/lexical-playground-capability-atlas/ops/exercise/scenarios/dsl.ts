import type { Page } from "playwright-core";

export type AriaRole = Parameters<Page["getByRole"]>[0];

export type LocatorSpec = Readonly<
  | {
      kind: "css";
      selector: string;
      nth?: number;
    }
  | {
      exact?: boolean;
      kind: "role";
      name?: string;
      nameMatch?: "prefix";
      nth?: number;
      role: AriaRole;
      scope?: string;
    }
  | {
      exact?: boolean;
      kind: "text";
      nth?: number;
      text: string;
    }
  | {
      kind: "placeholder";
      placeholder: string;
      nth?: number;
    }
  | {
      id: string;
      kind: "test-id";
      nth?: number;
    }
>;

export type QueryValue = boolean | number | string;
export type Query = Readonly<Record<string, QueryValue>>;

export type ClickOptions = Readonly<{
  button?: "left" | "middle" | "right";
  downloadSlot?: string;
  force?: boolean;
  input?: "mouse" | "touch";
  modifiers?: ReadonlyArray<"Alt" | "Control" | "Meta" | "Shift">;
  position?: Readonly<{ x: number; y: number }>;
  upload?: Readonly<
    | {
        content: string;
        fileName: string;
        mimeType: string;
      }
    | {
        fromDownloadSlot: string;
      }
  >;
}>;

export type Step = Readonly<
  | {
      action: "goto";
      path: string;
      query?: Query;
    }
  | {
      action: "reload";
    }
  | {
      action: "click";
      locator: LocatorSpec;
      options?: ClickOptions;
    }
  | {
      action: "hover";
      locator: LocatorSpec;
    }
  | {
      action: "drag";
      delta?: Readonly<{ x: number; y: number }>;
      source: LocatorSpec;
      target?: LocatorSpec;
    }
  | {
      action: "keyboard";
      keys: string;
      locator?: LocatorSpec;
    }
  | {
      action: "type";
      locator: LocatorSpec;
      mode?: "fill" | "insert";
      text: string;
    }
  | {
      action: "expect-selector";
      locator: LocatorSpec;
      state?: "attached" | "detached" | "hidden" | "visible";
    }
  | {
      action: "expect-text";
      exact?: boolean;
      locator: LocatorSpec;
      text: string;
    }
  | {
      action: "expect-attr";
      attribute: string;
      locator: LocatorSpec;
      value: string | null;
    }
  | {
      action: "screenshot";
      label: string;
    }
  | {
      action: "clipboard-copy";
      locator: LocatorSpec;
    }
  | {
      action: "clipboard-paste";
      locator: LocatorSpec;
      payload?: Readonly<{
        mimeType: "text/html" | "text/plain";
        text: string;
      }>;
    }
  | {
      action: "file-paste";
      dataUri: string;
      fileName: string;
      locator: LocatorSpec;
      mimeType: string;
    }
  | {
      action: "clipboard-verify";
      locator: LocatorSpec;
    }
  | {
      action: "paste-verify";
      locator: LocatorSpec;
    }
  | {
      action: "export-verify";
      downloadSlot: string;
    }
  | {
      action: "set-viewport";
      height: number;
      width: number;
    }
  | {
      action: "touch-swipe";
      delta: Readonly<{ x: number; y: number }>;
      locator: LocatorSpec;
    }
  | {
      action: "mark-manual";
      reason: string;
    }
>;

export type NetworkExpectation = "authorized-provider" | "none" | "rejected" | "user-initiated";

export type Scenario = Readonly<{
  activationExercise: string;
  group: string;
  id: string;
  manualReason?: string;
  networkExpectation: NetworkExpectation;
  scripted: boolean;
  steps: ReadonlyArray<Step>;
  title: string;
}>;

export const css = (selector: string, nth?: number): LocatorSpec => ({ kind: "css", nth, selector });

export const role = (
  roleName: AriaRole,
  name?: string,
  options: Readonly<{ exact?: boolean; nameMatch?: "prefix"; nth?: number; scope?: string }> = {}
): LocatorSpec => ({
  exact: options.exact,
  kind: "role",
  name,
  nameMatch: options.nameMatch,
  nth: options.nth,
  role: roleName,
  scope: options.scope,
});

export const text = (value: string, options: Readonly<{ exact?: boolean; nth?: number }> = {}): LocatorSpec => ({
  exact: options.exact,
  kind: "text",
  nth: options.nth,
  text: value,
});

export const placeholder = (value: string, nth?: number): LocatorSpec => ({
  kind: "placeholder",
  nth,
  placeholder: value,
});

export const testId = (id: string, nth?: number): LocatorSpec => css(`[data-test-id="${id}"]`, nth);

export const goto = (path = "/", query?: Query): Step => ({ action: "goto", path, query });
export const reload = (): Step => ({ action: "reload" });
export const click = (locator: LocatorSpec, options?: ClickOptions): Step => ({ action: "click", locator, options });
export const hover = (locator: LocatorSpec): Step => ({ action: "hover", locator });
export const drag = (
  source: LocatorSpec,
  options: Readonly<{ delta?: Readonly<{ x: number; y: number }>; target?: LocatorSpec }>
): Step => ({ action: "drag", delta: options.delta, source, target: options.target });
export const keyboard = (keys: string, locator?: LocatorSpec): Step => ({ action: "keyboard", keys, locator });
export const type = (locator: LocatorSpec, value: string, mode: "fill" | "insert" = "insert"): Step => ({
  action: "type",
  locator,
  mode,
  text: value,
});
export const expectSelector = (
  locator: LocatorSpec,
  state: "attached" | "detached" | "hidden" | "visible" = "visible"
): Step => ({ action: "expect-selector", locator, state });
export const expectText = (locator: LocatorSpec, value: string, exact = false): Step => ({
  action: "expect-text",
  exact,
  locator,
  text: value,
});
export const expectAttr = (locator: LocatorSpec, attribute: string, value: string | null): Step => ({
  action: "expect-attr",
  attribute,
  locator,
  value,
});
export const screenshot = (label: string): Step => ({ action: "screenshot", label });
export const clipboardCopy = (locator: LocatorSpec): Step => ({ action: "clipboard-copy", locator });
export const clipboardPaste = (
  locator: LocatorSpec,
  payload?: Readonly<{ mimeType: "text/html" | "text/plain"; text: string }>
): Step => ({ action: "clipboard-paste", locator, payload });
export const filePaste = (
  locator: LocatorSpec,
  payload: Readonly<{ dataUri: string; fileName: string; mimeType: string }>
): Step => ({ action: "file-paste", locator, ...payload });
export const clipboardVerify = (locator: LocatorSpec): Step => ({ action: "clipboard-verify", locator });
export const pasteVerify = (locator: LocatorSpec): Step => ({ action: "paste-verify", locator });
export const exportVerify = (downloadSlot: string): Step => ({ action: "export-verify", downloadSlot });
export const setViewport = (width: number, height: number): Step => ({ action: "set-viewport", height, width });
export const touchSwipe = (locator: LocatorSpec, delta: Readonly<{ x: number; y: number }>): Step => ({
  action: "touch-swipe",
  delta,
  locator,
});
export const markManual = (reason: string): Step => ({ action: "mark-manual", reason });

export const defineScenario = (scenario: Scenario): Scenario => scenario;
