import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import * as S from "effect/Schema";

import { Disposable } from "./Lifecycle.models.ts";

const $I = $ScratchpadId.create("dockview/Event.models");

export interface Event<T> {
  (listener: (event: T) => unknown): Disposable;
}

export class EmitterOptions extends S.Class<EmitterOptions>($I`EmitterOptions`)(
  {
    replay: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("EmitterOptions", {
    description: "Options for creating an event emitter",
  })
) {}

export const Event = {
  any:
    <T>(...children: ReadonlyArray<Event<T>>): Event<T> =>
    (listener) => {
      const disposables = A.map(children, (child) => child(listener));

      return {
        dispose: () => {
          A.forEach(disposables, (disposable) => {
            disposable.dispose();
          });
        },
      };
    },
};

export class DockviewEvent extends S.Class<DockviewEvent>($I`DockviewEvent`)(
  {
    _: S.Struct({
      defaultPrevented: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false), S.mutableKey),
    }).pipe(S.mutableKey),
  },
  $I.annote("DockviewEvent", {
    description: "Event that can be listened to",
  })
) {
  get defaultPrevented() {
    return this._.defaultPrevented;
  }

  readonly preventDefault = () => {
    this._.defaultPrevented = true;
  };
}

export class AcceptableEvent extends S.Class<AcceptableEvent>($I`AcceptableEvent`)(
  {
    _: S.Struct({
      isAccepted: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false), S.mutableKey),
    }).pipe(S.mutableKey),
  },
  $I.annote("AcceptableEvent", {
    description: "Event that can be listened to and accepted",
  })
) {
  get isAccepted() {
    return this._.isAccepted;
  }

  readonly accept = () => {
    this._.isAccepted = true;
  };
}
