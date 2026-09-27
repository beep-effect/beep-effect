import { fileURLToPath } from "node:url";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";
import * as Str from "effect/String";

const PlatformLayer = Layer.mergeAll(NodeServices.layer);

export const TestLayer = TSMorphServiceLive.pipe(Layer.provideMerge(PlatformLayer));

export const REPO_ROOT = Str.replace(/\/$/, "")(fileURLToPath(new URL("../../../../..", import.meta.url)));

export const WORKSPACE_ROOT = Str.replace(/\/$/, "")(fileURLToPath(new URL("..", import.meta.url)));
