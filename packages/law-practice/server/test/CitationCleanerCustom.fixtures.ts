/** Controlled host callbacks adapted from the pinned clean.py source probe.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationCleanerFailure, CitationCleanerProduced } from "../src/internal/Citation/CleanerPipeline.ts";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { CitationCleanerObject, CitationCleanerWork } from "../src/internal/Citation/CleanerPipeline.ts";

/** Explicit source scenes that do not invoke native HTML.
 * @internal @category testing @since 0.0.0
 */
export const controlledLiteralScenes = [
  "repeated-callback",
  "callback-raises",
  "return-none",
  "none-to-text",
  "none-to-builtin",
  "return-int",
  "int-to-text",
  "int-to-builtin",
  "return-bytes",
  "bytes-to-text",
  "bytes-to-builtin",
  "return-host",
  "host-to-text",
  "live-list-value",
  "return-text-subclass",
  "empty-text-subclass",
  "subclass-to-builtin",
  "unknown-stops",
  "steps-empty-string",
  "state-across-runs",
  "registry-replace",
  "registry-delete",
  "registry-add",
  "registry-noncallable",
];
type Body = (
  value: CitationCleanerObject,
  work: CitationCleanerWork
) => Effect.Effect<CitationCleanerProduced, CitationCleanerFailure | CitationSafetyLimitExceeded>;
const fail = () => CitationCleanerFailure.make({ reason: "callback-failed" });
const Hex = S.Uint8ArrayFromHex;
const HostStrings = S.Array(S.String);
/** Run source callback bodies independently of the expected observation data.
 * @internal @category testing @since 0.0.0
 */
export const makeControlledLiteralScene = Effect.fn("CleanerCustomTest.scene")(function* (scene: string) {
  const h = yield* makeCitationCleanerRegistryHarness();
  let callbacks = HashMap.empty<number, Body>();
  let names = HashMap.empty<number, string>();
  let counts = HashMap.empty<number, number>();
  let views = HashMap.empty<number, () => S.Json>();
  let slots = HashMap.empty<number, number>();
  let events = A.empty<S.Json>();
  const slot = (value: CitationCleanerObject) => {
    const found = HashMap.get(slots, value.slot);
    if (O.isSome(found)) return found.value;
    const next = HashMap.size(slots);
    slots = HashMap.set(slots, value.slot, next);
    return next;
  };
  const present = Effect.fn("CleanerCustomTest.present")(function* (
    value: CitationCleanerObject
  ): Effect.fn.Return<S.Json, CitationCleanerFailure> {
    const text = yield* h.values.getText(value);
    if (O.isSome(text))
      return { kind: "text", text: text.value.text, subtype: text.value.subtype === "plain" ? "plain" : "marked" };
    const bytes = yield* h.values.getBytes(value);
    if (O.isSome(bytes))
      return { kind: "bytes", hex: yield* S.encodeEffect(Hex)(bytes.value).pipe(Effect.mapError(fail)) };
    return (yield* Effect.fromOption(HashMap.get(views, value.slot), fail))();
  });
  const emit = Effect.fn("CleanerCustomTest.emit")(function* (value: CitationCleanerObject, work: CitationCleanerWork) {
    const native = yield* h.values.getUnicode(value);
    const charges =
      O.isSome(native) && native.value.utf16Units > 0 ? [yield* work.reserveText(native.value.utf16Units)] : [];
    return CitationCleanerProduced.make({ value, charges });
  });
  const emitText = Effect.fn("CleanerCustomTest.emitText")(function* (text: string, work: CitationCleanerWork) {
    const charges = Str.length(text) > 0 ? [yield* work.reserveText(Str.length(text))] : [];
    const value = yield* h.values.text(text);
    return CitationCleanerProduced.make({ value, charges });
  });
  const asText = (value: CitationCleanerObject) =>
    h.values.getText(value).pipe(
      Effect.flatMap((text) => Effect.fromOption(text, fail)),
      Effect.map((text) => text.text)
    );
  const callback = Effect.fn("CleanerCustomTest.callback")(function* (name: string, body: Body) {
    const ref = yield* h.values.retainHost(name);
    names = HashMap.set(names, ref.slot, name);
    callbacks = HashMap.set(callbacks, ref.slot, body);
    return ref;
  });
  const retain = Effect.fn("CleanerCustomTest.retain")(function* (
    host: unknown,
    view: (ref: CitationCleanerObject) => S.Json
  ) {
    const ref = yield* h.values.retainHost(host);
    views = HashMap.set(views, ref.slot, () => view(ref));
    return ref;
  });
  const suffix = yield* callback("suffix", (value, work) =>
    asText(value).pipe(Effect.flatMap((text) => emitText(`${text}!`, work)))
  );
  let steps = A.empty<CitationCleanerObject>();
  if (scene === "repeated-callback") steps = [suffix, suffix];
  else if (scene === "callback-raises") steps = [yield* callback("raise", () => Effect.fail(fail())), suffix];
  else if (Str.startsWith("return-none")(scene) || Str.startsWith("none-to")(scene)) {
    const value = yield* retain(null, () => ({ kind: "none" }));
    steps = [yield* callback("none", (_input, work) => emit(value, work))];
    if (scene === "none-to-text") steps.push(yield* callback("restore", (_input, work) => emitText("RESTORED", work)));
    if (scene === "none-to-builtin") steps.push(yield* h.values.text("inline_whitespace"));
  } else if (Str.startsWith("return-int")(scene) || Str.startsWith("int-to")(scene)) {
    const value = yield* retain(7, () => ({ kind: "int", value: "7" }));
    steps = [yield* callback("int", (_input, work) => emit(value, work))];
    if (scene === "int-to-text") steps.push(yield* callback("restore", (_input, work) => emitText("RESTORED", work)));
    if (scene === "int-to-builtin") steps.push(yield* h.values.text("underscores"));
  } else if (Str.startsWith("return-bytes")(scene) || Str.startsWith("bytes-to")(scene)) {
    const value = yield* h.values.bytes(new TextEncoder().encode("A__B"));
    steps = [yield* callback("bytes", (_input, work) => emit(value, work))];
    if (scene === "bytes-to-text")
      steps.push(
        yield* callback(
          "decode",
          Effect.fn("CleanerCustomTest.decodeBytes")(function* (input, work) {
            const bytes = yield* Effect.fromOption(yield* h.values.getBytes(input), fail);
            const text = yield* Effect.try({
              try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
              catch: fail,
            });
            return yield* emitText(text, work);
          })
        )
      );
    if (scene === "bytes-to-builtin") steps.push(yield* h.values.text("all_whitespace"));
  } else if (scene === "return-host" || scene === "host-to-text") {
    const value = yield* retain({ sourceHost: true }, (ref) => ({ kind: "host", slot: slot(ref) }));
    steps = [yield* callback("host", (_input, work) => emit(value, work))];
    if (scene === "host-to-text")
      steps.push(
        yield* callback("consume", (input, work) =>
          input === value ? emitText("SAME-HOST", work) : Effect.fail(fail())
        )
      );
  } else if (scene === "live-list-value") {
    const items = ["A"];
    const value = yield* retain(items, (ref) => ({
      kind: "list",
      slot: slot(ref),
      items: A.map(items, (text) => ({ kind: "text", text, subtype: "plain" })),
    }));
    steps = [
      yield* callback("list", (_input, work) => emit(value, work)),
      yield* callback("mutate", (input, work) => {
        if (input !== value) return Effect.fail(fail());
        // This source callback mutates the retained host list in place.
        items.push("B");
        return emit(input, work);
      }),
      yield* callback(
        "join",
        Effect.fn("CleanerCustomTest.joinList")(function* (input, work) {
          const host = yield* Effect.fromOption(yield* h.values.getHost(input), fail);
          const contents = yield* S.decodeUnknownEffect(HostStrings)(host).pipe(Effect.mapError(fail));
          return yield* emitText(A.join(contents, ""), work);
        })
      ),
    ];
  } else if (scene === "return-text-subclass")
    steps = [
      yield* callback(
        "marked",
        Effect.fn("CleanerCustomTest.marked")(function* (_input, work) {
          const charge = yield* work.reserveText(6);
          return CitationCleanerProduced.make({
            value: yield* h.values.subclass("MARKED", "marked-source-text"),
            charges: [charge],
          });
        })
      ),
    ];
  else if (scene === "subclass-to-builtin") steps = [yield* h.values.text("underscores")];
  else if (scene === "unknown-stops") steps = [yield* h.values.text("invalid"), suffix];
  else if (scene === "state-across-runs") {
    steps = [
      yield* callback("suffix", (value, work) =>
        asText(value).pipe(
          Effect.flatMap((text) =>
            emitText(`${text}${O.getOrElse(HashMap.get(counts, A.getUnsafe(steps, 0).slot), () => 0)}`, work)
          )
        )
      ),
    ];
  } else if (Str.startsWith("registry-")(scene)) {
    const html = yield* h.values.text("html");
    const added = yield* h.values.text("added");
    const replacement = yield* callback("registered", (value, work) =>
      asText(value).pipe(Effect.flatMap((text) => emitText(`${text}:REGISTERED`, work)))
    );
    const noncallable = yield* retain(7, () => ({ kind: "int", value: "7" }));
    const update = yield* callback(
      "update-registry",
      Effect.fn("CleanerCustomTest.updateRegistry")(function* (value, work) {
        if (scene === "registry-delete") yield* h.registry.remove(html);
        else
          yield* h.registry.set(
            scene === "registry-add" ? added : html,
            scene === "registry-noncallable" ? noncallable : replacement
          );
        return yield* emit(value, work);
      })
    );
    steps = [update, scene === "registry-add" ? added : html];
  } else if (scene !== "empty-text-subclass" && scene !== "steps-empty-string") return yield* fail();
  h.select(steps);
  h.hooks({
    callable: (value) => Effect.succeed(HashMap.has(callbacks, value.slot)),
    hash: (value) => Effect.succeed(BigInt(value.slot + 100)),
    equal: h.values.same,
    invoke: Effect.fn("CleanerCustomTest.invoke")(function* (fn, value, work) {
      const body = yield* Effect.fromOption(HashMap.get(callbacks, fn.slot), () =>
        CitationCleanerFailure.make({ reason: "not-callable" })
      );
      const name = yield* Effect.fromOption(HashMap.get(names, fn.slot), fail);
      const call = O.getOrElse(HashMap.get(counts, fn.slot), () => 0) + 1;
      counts = HashMap.set(counts, fn.slot, call);
      events = A.append(events, { kind: "callback-enter", name, call, value: yield* present(value) });
      const result = yield* body(value, work);
      events = A.append(events, { kind: "callback-return", name, value: yield* present(result.value) });
      return result;
    }),
  });
  return {
    h,
    present,
    events: Effect.sync(() => events),
    source: (text: string) =>
      scene === "empty-text-subclass" || scene === "subclass-to-builtin"
        ? h.values.subclass(text, "marked-source-input")
        : h.registry.runtime.fromText(text),
  };
});
