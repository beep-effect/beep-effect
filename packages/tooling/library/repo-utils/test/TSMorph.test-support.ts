import * as NodeURL from "node:url";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";

const PlatformLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layerDigest);

export const TestLayer = TSMorphServiceLive.pipe(Layer.provideMerge(PlatformLayer));

export const REPO_ROOT = Str.replace(/\/$/, "")(NodeURL.fileURLToPath(new URL("../../../../..", import.meta.url)));

export const WORKSPACE_ROOT = Str.replace(/\/$/, "")(NodeURL.fileURLToPath(new URL("..", import.meta.url)));
