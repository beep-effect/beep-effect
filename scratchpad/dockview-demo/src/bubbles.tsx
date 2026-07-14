/** @effect-diagnostics strictEffectProvide:skip-file */
import type { FontMetrics } from "@beep/pretext";
import { PretextCapture, PretextCaptureRequest } from "@beep/pretext";
import { PretextCaptureLive } from "@beep/pretext/browser";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { createRoot } from "react-dom/client";
import { BubbleConstraints, bubbleBox, ChatMessage } from "../../bubbles/Bubble.ts";
import "./demo.css";

const font = "16px Arial";
const lineHeight = 20;
const constraints = BubbleConstraints.make({ maxWidth: 320, padding: 10 });

const messages: ReadonlyArray<ChatMessage> = [
  ChatMessage.make({ id: "m1", author: "user", text: "How wide should this bubble be?" }),
  ChatMessage.make({ id: "m2", author: "agent", text: "Exactly as wide as its widest measured line, plus padding." }),
  ChatMessage.make({ id: "m3", author: "user", text: "Short one." }),
  ChatMessage.make({
    id: "m4",
    author: "agent",
    text: "Long messages clamp at the maximum content width and grow downward instead, one measured line at a time, with no DOM oracle involved anywhere.",
  }),
  ChatMessage.make({ id: "m5", author: "user", text: "So the box is pure arithmetic?" }),
  ChatMessage.make({
    id: "m6",
    author: "agent",
    text: "Pure arithmetic over cached word advances. Agents can see it.",
  }),
];

const distinctWords = A.dedupe(A.flatMap(messages, (message) => Str.split(message.text, " ")));

const Bubble = ({ message, metrics }: { readonly message: ChatMessage; readonly metrics: FontMetrics }) =>
  O.match(bubbleBox(metrics, message, constraints), {
    onNone: () => <p className="bubble-caption">unmeasured: {message.text}</p>,
    onSome: (box) => (
      <div className={`bubble-row bubble-row-${message.author}`}>
        <div
          className={`bubble bubble-${message.author}`}
          style={{ width: box.width, height: box.height, padding: constraints.padding }}
        >
          {message.text}
        </div>
        <p className="bubble-caption">
          {box.width}×{box.height}
        </p>
      </div>
    ),
  });

const App = ({ metrics }: { readonly metrics: FontMetrics }) => (
  <main className="demo-shell">
    <header className="demo-header">
      <h1>Bubble shrinkwrap — computable workspace geometry</h1>
      <p>
        Every bubble box below is computed headlessly: <code>lineStats</code> over live-captured word advances, width =
        min(maxWidth, widest line) + padding, height = lines × line-height. The border is the math; the text just has to
        fit. <a href="/">Dock demo</a>
      </p>
    </header>
    <section className="bubbles-stage">
      {A.map(messages, (message) => (
        <Bubble key={message.id} message={message} metrics={metrics} />
      ))}
    </section>
  </main>
);

const boot = Effect.gen(function* () {
  const capture = yield* PretextCapture;
  const snapshot = yield* capture.captureFontMetrics(
    PretextCaptureRequest.make({ font, lineHeight, words: distinctWords })
  );
  const host = document.getElementById("root");
  if (P.isNull(host)) return yield* Effect.die(new Error("Missing #root mount node"));
  createRoot(host).render(<App metrics={snapshot.metrics} />);
});

void Effect.runPromise(boot.pipe(Effect.provide(PretextCaptureLive)));
