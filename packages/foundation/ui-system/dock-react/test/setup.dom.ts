import { ControllableResizeObserver } from "@beep/dock-react/internal/ResizeObserverHarness";

globalThis.ResizeObserver = ControllableResizeObserver;

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: TestPointerEvent });
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value: (): void => undefined,
});
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: (): void => undefined,
});
