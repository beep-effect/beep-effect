import { dual } from "effect/Function";

const observers = new Set<ControllableResizeObserver>();

type ResizeDimensions = {
  readonly width: number;
  readonly height: number;
};

type Dual2<Self, That, Result> = {
  (self: Self, that: That): Result;
  (that: That): (self: Self) => Result;
};

export const activeResizeObserverCount = (): number => observers.size;

export class ControllableResizeObserver implements ResizeObserver {
  readonly targets = new Set<Element>();
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.add(this);
  }

  observe = (target: Element): void => {
    this.targets.add(target);
  };

  unobserve = (target: Element): void => {
    this.targets.delete(target);
  };

  disconnect = (): void => {
    this.targets.clear();
    observers.delete(this);
  };
}

export const resize: Dual2<Element, ResizeDimensions, void> = dual(
  2,
  (target: Element, { width, height }: ResizeDimensions): void => {
    const size = { blockSize: height, inlineSize: width };
    const entry: ResizeObserverEntry = {
      target,
      contentRect: new DOMRectReadOnly(0, 0, width, height),
      borderBoxSize: [size],
      contentBoxSize: [size],
      devicePixelContentBoxSize: [size],
    };
    for (const observer of observers) {
      if (observer.targets.has(target)) observer.callback([entry], observer);
    }
  }
);
