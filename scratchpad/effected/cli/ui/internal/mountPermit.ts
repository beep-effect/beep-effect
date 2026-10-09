import { Semaphore } from "effect";

/**
 * One Ink mount at a time, process-wide: a `CliUi.run` screen, or one run of a live view.
 *
 * @remarks
 * Ink keys its instances by stdout and owns raw mode on the one terminal, so concurrent mounts are meaningless, and
 * serializing them keeps each mount's save-and-restore of Ink's colour level well nested.
 *
 * @internal
 */
export const mountPermit = Semaphore.makeUnsafe(1);
