import { ChatClient, CreateThreadAtomInput, EditTarget, StreamingTurn } from "@beep/agents-client";
import { ClientObservabilityLive } from "@beep/agents-client/ClientObservability";
import { expect } from "tstyche";
import type { TurnRequest } from "@beep/agents-client";
import type { Layer } from "effect";

// Public atoms/services/models are exported and not collapsed to `never`.
expect(ChatClient).type.not.toBe<never>();
expect(CreateThreadAtomInput).type.not.toBe<never>();
expect(StreamingTurn).type.not.toBe<never>();
expect(EditTarget).type.not.toBe<never>();

// The streaming turn request is the tagged union the runTurn driver consumes.
expect<TurnRequest["_tag"]>().type.toBe<"send" | "edit">();

// The env-gated client observability layer requires nothing.
expect(ClientObservabilityLive).type.toBe<Layer.Layer<never>>();
