"use client";

import * as O from "effect/Option";
import { Atom } from "effect/reactivity";

/**
 * Resolves to `true` after the client tree has mounted.
 */
export const clientMountedAtom = Atom.make((get) => {
  const current = get.self<boolean>();
  if (O.isSome(current)) {
    return current.value;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const timer = window.setTimeout(() => get.setSelf(true), 0);
  get.addFinalizer(() => window.clearTimeout(timer));

  return false;
});

/**
 * Tracks a browser media query from an Atom-managed listener.
 */
export const mediaQueryAtom = Atom.family((query: string) =>
  Atom.make((get) => {
    const current = get.self<boolean>();
    if (O.isSome(current)) {
      return current.value;
    }

    if (typeof window === "undefined" || window.matchMedia === undefined) {
      return false;
    }

    const mediaQueryList = window.matchMedia(query);
    const update = () => get.setSelf(mediaQueryList.matches);
    const timer = window.setTimeout(update, 0);

    mediaQueryList.addEventListener("change", update);
    get.addFinalizer(() => {
      window.clearTimeout(timer);
      mediaQueryList.removeEventListener("change", update);
    });

    return false;
  })
);
