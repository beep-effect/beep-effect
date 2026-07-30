/**
 * Zero-import in-page witness script for QA capture sessions.
 *
 * This file is deliberately outside the Effect world: it is bundled by
 * `Bun.build` into a browser IIFE served at `GET /witness.js` and injected
 * into pages under test (playwright `addInitScript` or a single JS eval in a
 * real Chrome session). It therefore uses only browser platform APIs,
 * declared module-locally below so the package never links the DOM lib.
 *
 * Privacy invariant: key-down capture records non-printable key identities
 * only (`event.key.length > 1`) — keystroke logging is impossible by
 * construction.
 *
 * Emitted NDJSON lines decode against the `ActionEvent` union in
 * `ActionEvent.models.ts`; keep the two in lockstep.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// Module-local structural declarations of the browser surface this script
// touches. They shadow any Node globals and erase at bundle time.

type WitnessRect = {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

interface WitnessElement {
  closest(selector: string): WitnessElement | null;
  contains(other: WitnessElement | null): boolean;
  getAttribute(name: string): string | null;
  getBoundingClientRect(): WitnessRect;
  readonly id: string;
  matches(selector: string): boolean;
  readonly parentElement: WitnessElement | null;
  readonly previousElementSibling: WitnessElement | null;
  readonly tagName: string;
}

interface WitnessOverlayElement {
  remove(): void;
  readonly style: { cssText: string };
}

type WitnessListenerOptions = {
  readonly capture?: boolean;
  readonly passive?: boolean;
};

interface WitnessPointerEvent {
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerId: number;
  readonly relatedTarget: WitnessElement | null;
  readonly target: WitnessElement | null;
  readonly timeStamp: number;
}

interface WitnessFocusEvent {
  readonly target: WitnessElement | null;
  readonly timeStamp: number;
}

interface WitnessKeyboardEvent {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly key: string;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly target: WitnessElement | null;
  readonly timeStamp: number;
}

interface WitnessTransitionEvent {
  readonly propertyName: string;
  readonly target: WitnessElement | null;
  readonly timeStamp: number;
}

interface WitnessAnimationEvent {
  readonly animationName: string;
  readonly target: WitnessElement | null;
  readonly timeStamp: number;
}

interface WitnessUiEvent {
  readonly target: WitnessElement | null;
  readonly timeStamp: number;
}

interface WitnessComputedStyle {
  readonly animationDuration: string;
  readonly transitionDuration: string;
}

interface WitnessScrollableElement extends WitnessElement {
  readonly scrollLeft: number;
  readonly scrollTop: number;
}

interface WitnessDocument {
  addEventListener(
    type: "pointerdown" | "pointermove" | "pointerout" | "pointerover" | "pointerup",
    listener: (event: WitnessPointerEvent) => void,
    options?: WitnessListenerOptions
  ): void;
  addEventListener(
    type: "focusin" | "focusout",
    listener: (event: WitnessFocusEvent) => void,
    options?: WitnessListenerOptions
  ): void;
  addEventListener(
    type: "keydown",
    listener: (event: WitnessKeyboardEvent) => void,
    options?: WitnessListenerOptions
  ): void;
  addEventListener(
    type: "transitioncancel" | "transitionend" | "transitionstart",
    listener: (event: WitnessTransitionEvent) => void,
    options?: WitnessListenerOptions
  ): void;
  addEventListener(
    type: "animationcancel" | "animationend" | "animationstart",
    listener: (event: WitnessAnimationEvent) => void,
    options?: WitnessListenerOptions
  ): void;
  addEventListener(type: "scroll", listener: (event: WitnessUiEvent) => void, options?: WitnessListenerOptions): void;
  readonly body: { appendChild(node: WitnessOverlayElement): void } | null;
  createElement(tagName: string): WitnessOverlayElement;
  readonly currentScript: { getAttribute(name: string): string | null; readonly src?: string } | null;
}

type WitnessConfigInput = {
  readonly beacon?: boolean;
  readonly collectorUrl?: string;
  readonly cursor?: boolean;
  readonly flushIntervalMs?: number;
  readonly maxBatch?: number;
  readonly moveIntervalMs?: number;
};

type WitnessApi = {
  readonly flush: () => void;
  readonly mark: (label: string) => void;
  readonly runSyncBeacon: () => Promise<void>;
};

interface WitnessWindow {
  readonly __BEEP_QA__?: WitnessConfigInput;
  __beepQa?: WitnessApi;
  addEventListener(type: "pagehide", listener: () => void): void;
}

declare const document: WitnessDocument;
declare const window: WitnessWindow;
declare const performance: { readonly timeOrigin: number; now(): number };
declare const navigator: { readonly sendBeacon?: (url: string, data: string) => boolean };
declare const fetch: (
  url: string,
  init: {
    readonly body: string;
    readonly headers: { readonly [name: string]: string };
    readonly keepalive: boolean;
    readonly method: string;
  }
) => Promise<unknown>;
declare const setTimeout: (handler: () => void, timeoutMs: number) => number;
declare const Promise: {
  withResolvers<T>(): { readonly promise: globalThis.Promise<T>; readonly resolve: (value: T) => void };
};
declare const setInterval: (handler: () => void, intervalMs: number) => number;
declare const requestAnimationFrame: (callback: () => void) => number;
declare const getComputedStyle: (element: WitnessElement) => WitnessComputedStyle;
declare const decodeURIComponent: (value: string) => string;

// The whole in-page witness is one IIFE by construction: it is bundled to a
// browser script and guarded by `window.__beepQa`, so its helpers cannot be
// hoisted to module scope without breaking the zero-import bundling contract.
// CRAP is coverage-driven (cyclomatic 13 against a threshold of 20) and this
// code is exercised by live capture rounds, not by Node unit tests.
// fallow-ignore-next-line complexity
(() => {
  if (window.__beepQa !== undefined) {
    return;
  }

  // Config priority: window.__BEEP_QA__ > script-src query params
  // (`/witness.js?collector=...&cursor=0`) > script data attributes.
  const scriptQueryParam = (name: string): string | null => {
    const script = document.currentScript;
    const src = script === null ? undefined : script.src;
    if (src === undefined) {
      return null;
    }
    const query = src.split("?")[1];
    if (query === undefined) {
      return null;
    }
    const pairs = query.split("&");
    for (const pair of pairs) {
      const separator = pair.indexOf("=");
      const key = separator === -1 ? pair : pair.slice(0, separator);
      if (key === name) {
        return separator === -1 ? "" : decodeURIComponent(pair.slice(separator + 1));
      }
    }
    return null;
  };

  const scriptParam = (name: string): string | null => {
    const fromQuery = scriptQueryParam(name);
    if (fromQuery !== null) {
      return fromQuery;
    }
    const script = document.currentScript;
    return script === null ? null : script.getAttribute(`data-${name}`);
  };

  const provided: WitnessConfigInput = window.__BEEP_QA__ === undefined ? {} : window.__BEEP_QA__;
  const flagParam = (name: string): boolean | undefined => {
    const raw = scriptParam(name);
    return raw === null ? undefined : raw !== "0" && raw !== "false";
  };

  const config = {
    beacon: provided.beacon ?? flagParam("beacon") ?? false,
    collectorUrl: provided.collectorUrl ?? scriptParam("collector") ?? "http://127.0.0.1:43117",
    cursor: provided.cursor ?? flagParam("cursor") ?? true,
    flushIntervalMs: provided.flushIntervalMs ?? 500,
    maxBatch: provided.maxBatch ?? 64,
    moveIntervalMs: provided.moveIntervalMs ?? 33,
  };

  const nowEpochMs = (): number => performance.timeOrigin + performance.now();
  const eventEpochMs = (timeStamp: number): number => performance.timeOrigin + timeStamp;

  let seq = 0;
  const nextSeq = (): number => {
    seq += 1;
    return seq;
  };

  const buffer: Array<string> = [];

  const send = (body: string, useBeacon: boolean): void => {
    const url = `${config.collectorUrl}/events`;
    if (useBeacon && navigator.sendBeacon !== undefined) {
      navigator.sendBeacon(url, body);
      return;
    }
    fetch(url, {
      body,
      headers: { "content-type": "text/plain;charset=UTF-8" },
      keepalive: true,
      method: "POST",
    }).catch(() => undefined);
  };

  const flushWith = (useBeacon: boolean): void => {
    if (buffer.length === 0) {
      return;
    }
    const body = buffer.join("\n");
    buffer.length = 0;
    send(body, useBeacon);
  };

  const flush = (): void => flushWith(false);

  const record = (event: { readonly [key: string]: unknown }): void => {
    buffer[buffer.length] = JSON.stringify(event);
    if (buffer.length >= config.maxBatch) {
      flush();
    }
  };

  setInterval(flush, config.flushIntervalMs);
  window.addEventListener("pagehide", () => flushWith(true));

  // --- deterministic selector builder ------------------------------------
  const attributeToken = (element: WitnessElement, name: string): string | null => {
    const value = element.getAttribute(name);
    return value === null || value === "" ? null : `[${name}="${value}"]`;
  };

  // Deterministic selector-priority ladder: each branch is one strategy and
  // the order IS the contract. CRAP is coverage-driven here (cyclomatic 10
  // against a threshold of 20); this file is a browser IIFE, not Node-testable.
  // fallow-ignore-next-line complexity
  const terminalToken = (element: WitnessElement): string | null => {
    const dataQa = attributeToken(element, "data-qa");
    if (dataQa !== null) {
      return dataQa;
    }
    if (element.id !== "") {
      return `#${element.id}`;
    }
    const testId = attributeToken(element, "data-testid");
    if (testId !== null) {
      return testId;
    }
    const panelId = attributeToken(element, "data-panel-id");
    if (panelId !== null) {
      return panelId;
    }
    const groupId = attributeToken(element, "data-group-id");
    if (groupId !== null) {
      return groupId;
    }
    const role = element.getAttribute("role");
    const ariaLabel = element.getAttribute("aria-label");
    if (role !== null && role !== "" && ariaLabel !== null && ariaLabel !== "") {
      return `${element.tagName.toLowerCase()}[role="${role}"][aria-label="${ariaLabel}"]`;
    }
    return null;
  };

  const nthOfTypeToken = (element: WitnessElement): string => {
    let index = 1;
    let sibling = element.previousElementSibling;
    while (sibling !== null) {
      if (sibling.tagName === element.tagName) {
        index += 1;
      }
      sibling = sibling.previousElementSibling;
    }
    return `${element.tagName.toLowerCase()}:nth-of-type(${index})`;
  };

  const selectorFor = (start: WitnessElement | null): string => {
    if (start === null) {
      return "document";
    }
    const segments: Array<string> = [];
    let current: WitnessElement | null = start;
    let depth = 0;
    while (current !== null && depth < 6) {
      const terminal = terminalToken(current);
      if (terminal !== null) {
        segments.unshift(terminal);
        return segments.join(" > ");
      }
      segments.unshift(nthOfTypeToken(current));
      current = current.parentElement;
      depth += 1;
    }
    return segments.join(" > ");
  };

  const rectOf = (element: WitnessElement | null): WitnessRect | undefined => {
    if (element === null) {
      return undefined;
    }
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width, x: rect.x, y: rect.y };
  };

  // --- cursor ring overlay ------------------------------------------------
  const overlayCss =
    "position:fixed;top:0;left:0;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #ff2d92;" +
    "border-radius:50%;background:rgba(255,45,146,0.15);pointer-events:none;z-index:2147483646;";
  let cursorRing: WitnessOverlayElement | null = null;

  const moveCursorRing = (x: number, y: number, pressed: boolean): void => {
    if (!config.cursor || document.body === null) {
      return;
    }
    if (cursorRing === null) {
      cursorRing = document.createElement("div");
      document.body.appendChild(cursorRing);
    }
    const scale = pressed ? "scale(0.7)" : "scale(1)";
    cursorRing.style.cssText = `${overlayCss}transform:translate(${x}px,${y}px) ${scale};`;
  };

  // --- pointer capture ----------------------------------------------------
  type PendingMove = {
    readonly pointerId: number;
    readonly tEpochMs: number;
    readonly x: number;
    readonly y: number;
  };
  let pendingMove: PendingMove | null = null;
  let lastMoveEmitMs = 0;

  const emitPendingMove = (): void => {
    if (pendingMove === null) {
      return;
    }
    record({
      kind: "pointer-move",
      pointerId: pendingMove.pointerId,
      seq: nextSeq(),
      tEpochMs: pendingMove.tEpochMs,
      x: pendingMove.x,
      y: pendingMove.y,
    });
    pendingMove = null;
  };

  document.addEventListener(
    "pointerdown",
    (event) => {
      moveCursorRing(event.clientX, event.clientY, true);
      record({
        button: event.button,
        kind: "pointer-down",
        pointerId: event.pointerId,
        rect: rectOf(event.target),
        selectorPath: selectorFor(event.target),
        seq: nextSeq(),
        tEpochMs: eventEpochMs(event.timeStamp),
        x: event.clientX,
        y: event.clientY,
      });
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "pointermove",
    (event) => {
      moveCursorRing(event.clientX, event.clientY, false);
      pendingMove = {
        pointerId: event.pointerId,
        tEpochMs: eventEpochMs(event.timeStamp),
        x: event.clientX,
        y: event.clientY,
      };
      const now = performance.now();
      if (now - lastMoveEmitMs >= config.moveIntervalMs) {
        lastMoveEmitMs = now;
        emitPendingMove();
      }
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "pointerup",
    (event) => {
      moveCursorRing(event.clientX, event.clientY, false);
      // Last-before-up: never lose the final throttled move of a gesture.
      emitPendingMove();
      record({
        button: event.button,
        kind: "pointer-up",
        pointerId: event.pointerId,
        rect: rectOf(event.target),
        selectorPath: selectorFor(event.target),
        seq: nextSeq(),
        tEpochMs: eventEpochMs(event.timeStamp),
        x: event.clientX,
        y: event.clientY,
      });
    },
    { capture: true, passive: true }
  );

  // --- delegated enter/leave on interactive elements ----------------------
  const interactiveSelector =
    "[data-qa], [data-testid], [data-panel-id], [data-group-id], button, a, input, select, textarea, [role], [tabindex]";

  const interactiveTargetOf = (target: WitnessElement | null): WitnessElement | null =>
    target === null ? null : target.closest(interactiveSelector);

  document.addEventListener(
    "pointerover",
    (event) => {
      const element = interactiveTargetOf(event.target);
      if (element === null || element.contains(event.relatedTarget)) {
        return;
      }
      record({
        kind: "pointer-enter",
        rect: rectOf(element),
        selectorPath: selectorFor(element),
        seq: nextSeq(),
        tEpochMs: eventEpochMs(event.timeStamp),
      });
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "pointerout",
    (event) => {
      const element = interactiveTargetOf(event.target);
      if (element === null || element.contains(event.relatedTarget)) {
        return;
      }
      record({
        kind: "pointer-leave",
        selectorPath: selectorFor(element),
        seq: nextSeq(),
        tEpochMs: eventEpochMs(event.timeStamp),
      });
    },
    { capture: true, passive: true }
  );

  // --- focus --------------------------------------------------------------
  document.addEventListener(
    "focusin",
    (event) => {
      record({
        kind: "focus-in",
        selectorPath: selectorFor(event.target),
        seq: nextSeq(),
        tEpochMs: eventEpochMs(event.timeStamp),
      });
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "focusout",
    (event) => {
      record({
        kind: "focus-out",
        selectorPath: selectorFor(event.target),
        seq: nextSeq(),
        tEpochMs: eventEpochMs(event.timeStamp),
      });
    },
    { capture: true, passive: true }
  );

  // --- non-printable keys only --------------------------------------------
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key.length <= 1) {
        return;
      }
      const modifiers: Array<string> = [];
      if (event.altKey) {
        modifiers[modifiers.length] = "Alt";
      }
      if (event.ctrlKey) {
        modifiers[modifiers.length] = "Control";
      }
      if (event.metaKey) {
        modifiers[modifiers.length] = "Meta";
      }
      if (event.shiftKey) {
        modifiers[modifiers.length] = "Shift";
      }
      record({
        key: event.key,
        kind: "key-down",
        modifiers,
        selectorPath: selectorFor(event.target),
        seq: nextSeq(),
        tEpochMs: eventEpochMs(event.timeStamp),
      });
    },
    { capture: true, passive: true }
  );

  // --- transitions / animations with computed durations -------------------
  const durationMsOf = (raw: string): number => {
    const first = raw.split(",")[0] ?? "";
    const trimmed = first.trim();
    if (trimmed.endsWith("ms")) {
      const value = Number.parseFloat(trimmed);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    }
    if (trimmed.endsWith("s")) {
      const value = Number.parseFloat(trimmed);
      return Number.isFinite(value) ? Math.max(0, value * 1000) : 0;
    }
    return 0;
  };

  const onTransition = (phase: string) => (event: WitnessTransitionEvent) => {
    if (event.target === null) {
      return;
    }
    record({
      durationMs: durationMsOf(getComputedStyle(event.target).transitionDuration),
      kind: "transition",
      phase,
      property: event.propertyName,
      selectorPath: selectorFor(event.target),
      seq: nextSeq(),
      tEpochMs: eventEpochMs(event.timeStamp),
    });
  };

  document.addEventListener("transitionstart", onTransition("start"), { capture: true, passive: true });
  document.addEventListener("transitionend", onTransition("end"), { capture: true, passive: true });
  document.addEventListener("transitioncancel", onTransition("cancel"), { capture: true, passive: true });

  const onAnimation = (phase: string) => (event: WitnessAnimationEvent) => {
    if (event.target === null) {
      return;
    }
    record({
      animationName: event.animationName,
      durationMs: durationMsOf(getComputedStyle(event.target).animationDuration),
      kind: "animation",
      phase,
      selectorPath: selectorFor(event.target),
      seq: nextSeq(),
      tEpochMs: eventEpochMs(event.timeStamp),
    });
  };

  document.addEventListener("animationstart", onAnimation("start"), { capture: true, passive: true });
  document.addEventListener("animationend", onAnimation("end"), { capture: true, passive: true });
  document.addEventListener("animationcancel", onAnimation("cancel"), { capture: true, passive: true });

  // --- scroll (throttled ~10 Hz) ------------------------------------------
  let lastScrollEmitMs = 0;
  const isScrollable = (target: WitnessElement | null): target is WitnessScrollableElement =>
    target !== null && "scrollTop" in target;

  document.addEventListener(
    "scroll",
    (event) => {
      const now = performance.now();
      if (now - lastScrollEmitMs < 100) {
        return;
      }
      lastScrollEmitMs = now;
      const scrollable = isScrollable(event.target) ? event.target : null;
      record({
        kind: "scroll",
        scrollLeft: scrollable === null ? 0 : scrollable.scrollLeft,
        scrollTop: scrollable === null ? 0 : scrollable.scrollTop,
        selectorPath: scrollable === null ? undefined : selectorFor(scrollable),
        seq: nextSeq(),
        tEpochMs: eventEpochMs(event.timeStamp),
      });
    },
    { capture: true, passive: true }
  );

  // --- markers ------------------------------------------------------------
  const mark = (label: string): void => {
    record({
      kind: "marker",
      label,
      seq: nextSeq(),
      tEpochMs: nowEpochMs(),
    });
    flush();
  };

  // --- sync beacon --------------------------------------------------------
  const beaconBaseCss = "position:fixed;top:0;left:0;width:128px;height:128px;pointer-events:none;z-index:2147483647;";

  const runSyncBeacon = (): globalThis.Promise<void> => {
    const { promise, resolve } = Promise.withResolvers<void>();
    if (document.body === null) {
      resolve(undefined);
      return promise;
    }
    const overlay = document.createElement("div");
    overlay.style.cssText = `${beaconBaseCss}background:#000;`;
    document.body.appendChild(overlay);
    const totalFlips = 8;
    let flipIndex = 0;
    const step = (): void => {
      if (flipIndex >= totalFlips) {
        overlay.remove();
        flush();
        resolve(undefined);
        return;
      }
      const currentFlip = flipIndex;
      const isWhite = currentFlip % 2 === 0;
      overlay.style.cssText = `${beaconBaseCss}background:${isWhite ? "#fff" : "#000"};`;
      requestAnimationFrame(() => {
        record({
          flipIndex: currentFlip,
          isWhite,
          kind: "beacon",
          seq: nextSeq(),
          tEpochMs: nowEpochMs(),
          tPaintEpochMs: nowEpochMs(),
        });
      });
      flipIndex += 1;
      setTimeout(step, 150);
    };
    step();
    return promise;
  };

  if (config.beacon) {
    setTimeout(() => {
      runSyncBeacon().catch(() => undefined);
    }, 50);
  }

  window.__beepQa = { flush, mark, runSyncBeacon };
})();
