import { compileAdaFaceOnnx, decodeFaceSafetensors, RecognizerGraphDimensions } from "@beep/repo-cli/test/Files";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as ort from "onnxruntime-node";
import alignerShapes from "./fixtures/photo-face/adaface-aligner-shapes.json" with { type: "json" };

const encodeHeader = S.encodeEffect(S.fromJsonString(S.Unknown));
const checkpoint = Effect.fn("test.faceCheckpoint")(function* (header: unknown, data = new Uint8Array()) {
  const json = yield* encodeHeader(header);
  const encoded = new TextEncoder().encode(json);
  const bytes = new Uint8Array(8 + encoded.length + data.length);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(encoded.length), true);
  bytes.set(encoded, 8);
  bytes.set(data, 8 + encoded.length);
  return bytes;
});
// Unit scales (BatchNorm variance, 1-D weights) are 1 so activations stay finite; the final
// feature bias counts up so the recognizer output is a recognizable 1..n sequence.
const isUnitScale = (name: string, shape: ReadonlyArray<number>) =>
  Str.endsWith("running_var")(name) || (Str.endsWith("weight")(name) && shape.length === 1);
const syntheticTensor = (name: string, shape: ReadonlyArray<number>): Float32Array => {
  const count = A.reduce(shape, 1, (a, b) => a * b);
  if (name === "model.net.feature.3.bias") return Float32Array.from(A.makeBy(count, (i) => i + 1));
  return new Float32Array(count).fill(isUnitScale(name, shape) ? 1 : 0);
};
const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const payload = new Uint8Array(A.reduce(chunks, 0, (total, chunk) => total + chunk.length));
  A.reduce(chunks, 0, (offset, chunk) => {
    payload.set(chunk, offset);
    return offset + chunk.length;
  });
  return payload;
};
const weights = Effect.fn("test.faceWeights")(function* (shapes: Readonly<Record<string, ReadonlyArray<number>>>) {
  const chunks: Array<Uint8Array> = [];
  const headers: Record<string, unknown> = {};
  let offset = 0;
  for (const [name, shape] of R.toEntries(shapes)) {
    const data = new Uint8Array(syntheticTensor(name, shape).buffer);
    headers[name] = { dtype: "F32", shape, data_offsets: [offset, offset + data.length] };
    offset += data.length;
    chunks.push(data);
  }
  return yield* checkpoint(headers, concatBytes(chunks));
});
const dimensions = RecognizerGraphDimensions.make({ gridSide: 4, patchSide: 2, heads: 2, headWidth: 4, blocks: 2 });
const recognizerShapes = (): Record<string, ReadonlyArray<number>> => {
  const { gridSide, patchSide, heads, headWidth, blocks } = dimensions;
  const width = heads * headWidth;
  const tokens = gridSide * gridSide;
  const shapes: Record<string, ReadonlyArray<number>> = {};
  const add = (name: string, shape: ReadonlyArray<number>) => {
    shapes[`model.net.${name}`] = shape;
  };
  const linear = (name: string, input: number, output: number, bias = true) => {
    add(`${name}.weight`, [output, input]);
    if (bias) add(`${name}.bias`, [output]);
  };
  const norm = (name: string) => {
    add(`${name}.weight`, [width]);
    add(`${name}.bias`, [width]);
  };
  add("patch_embed.proj.weight", [width, 3, patchSide, patchSide]);
  add("patch_embed.proj.bias", [width]);
  add("pos_embed", [1, tokens, width]);
  linear("keypoint_linear", 10, blocks * heads * 49);
  for (let i = 0; i < blocks; i++) {
    const prefix = `blocks.${i}`;
    norm(`${prefix}.norm1`);
    norm(`${prefix}.norm2`);
    linear(`${prefix}.attn.qkv`, width, 3 * width, false);
    linear(`${prefix}.attn.proj`, width, width);
    linear(`${prefix}.mlp.fc1`, width, 4 * width);
    linear(`${prefix}.mlp.fc2`, 4 * width, width);
  }
  norm("norm");
  linear("feature.0", tokens * width, 16, false);
  linear("feature.2", 16, width, false);
  for (const [name, size] of [
    ["feature.1", 16],
    ["feature.3", width],
  ] satisfies ReadonlyArray<readonly [string, number]>) {
    for (const suffix of ["weight", "bias", "running_mean", "running_var"]) add(`${name}.${suffix}`, [size]);
  }
  return shapes;
};
const execute = Effect.fn("test.runGeneratedOnnx")(function* (
  bytes: Uint8Array,
  inputs: ort.InferenceSession.FeedsType
) {
  const session = yield* Effect.acquireRelease(
    Effect.promise(() => ort.InferenceSession.create(bytes, { executionProviders: ["cpu"], intraOpNumThreads: 1 })),
    (session) => Effect.promise(() => session.release())
  );
  return yield* Effect.promise(() => session.run(inputs));
});

describe("safetensors boundary", () => {
  it.effect("decodes float, int64, scalar and metadata from a sliced buffer", () =>
    Effect.gen(function* () {
      const data = new Uint8Array(12);
      new DataView(data.buffer).setFloat32(0, 3.5, true);
      new DataView(data.buffer).setBigInt64(4, BigInt(-7), true);
      const payload = yield* checkpoint(
        {
          __metadata__: { source: "synthetic" },
          "model.net.scalar": { dtype: "F32", shape: [], data_offsets: [0, 4] },
          "model.net.counter": { dtype: "I64", shape: [1], data_offsets: [4, 12] },
        },
        data
      );
      const padded = new Uint8Array(payload.length + 3);
      padded.set(payload, 3);
      const decoded = yield* decodeFaceSafetensors(padded.subarray(3));
      expect(HashMap.size(decoded)).toBe(2);
      const scalar = O.getOrThrow(HashMap.get(decoded, "scalar"));
      expect(scalar.shape).toEqual([]);
      expect(new DataView(scalar.data.buffer, scalar.data.byteOffset).getFloat32(0, true)).toBe(3.5);
      expect(O.getOrThrow(HashMap.get(decoded, "counter")).dtype).toBe("I64");
    })
  );
  it.effect("rejects truncated and impossible header lengths", () =>
    Effect.gen(function* () {
      const invalid = [new Uint8Array(7)];
      for (const length of [BigInt(1), BigInt(3), BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)]) {
        const bytes = new Uint8Array(10);
        new DataView(bytes.buffer).setBigUint64(0, length, true);
        invalid.push(bytes);
      }
      const malformed = new Uint8Array(10);
      new DataView(malformed.buffer).setBigUint64(0, BigInt(2), true);
      malformed.set([123, 33], 8);
      invalid.push(malformed);
      for (const bytes of invalid)
        expect((yield* decodeFaceSafetensors(bytes).pipe(Effect.flip))._tag).toBe("MatchPersonModelIntegrityError");
    })
  );
  it.effect("rejects bad dtype, shape, offsets, names and non-tensor records", () =>
    Effect.gen(function* () {
      const headers = [
        { dtype: "F64", shape: [1], data_offsets: [0, 8] },
        { dtype: "F32", shape: [-1], data_offsets: [0, 4] },
        { dtype: "F32", shape: [0.5], data_offsets: [0, 4] },
        { dtype: "F32", shape: [1], data_offsets: [4, 0] },
        { dtype: "F32", shape: [1], data_offsets: [0, 3] },
        { dtype: "F32", shape: [1], data_offsets: [4, 8] },
        { dtype: "F32", shape: [1], data_offsets: [-1, 3] },
        { description: "not a tensor" },
      ];
      for (const header of headers) {
        const bytes = yield* checkpoint({ "model.net.bad": header }, new Uint8Array(4));
        const error = yield* decodeFaceSafetensors(bytes).pipe(Effect.flip);
        expect(error._tag).toBe("MatchPersonModelIntegrityError");
      }
      const bytes = yield* checkpoint({ bad: { dtype: "F32", shape: [1], data_offsets: [0, 4] } }, new Uint8Array(4));
      const error = yield* decodeFaceSafetensors(bytes).pipe(Effect.flip);
      expect(error.message).toContain("bounds or name");
    })
  );
  it.effect("rejects missing graph weights with the component in the typed error", () =>
    Effect.gen(function* () {
      const bytes = yield* checkpoint({});
      for (const component of ["aligner", "recognizer"] satisfies ReadonlyArray<"aligner" | "recognizer">) {
        const error = yield* compileAdaFaceOnnx(bytes, component).pipe(Effect.flip);
        expect(error.message).toContain(`Missing required ${component} tensors`);
      }
    })
  );
});

describe("generated ONNX graphs on the native CPU runtime", () => {
  it.effect(
    "executes the full DFA graph with two megabytes of synthetic weights",
    () =>
      Effect.gen(function* () {
        const payload = yield* weights(R.map(alignerShapes, (header) => header.shape));
        expect(payload.length).toBeLessThan(3_000_000);
        const bytes = yield* compileAdaFaceOnnx(payload, "aligner");
        const outputs = yield* execute(bytes, {
          images: new ort.Tensor("float32", new Float32Array(3 * 160 * 160), [1, 3, 160, 160]),
        });
        expect(outputs.output?.dims).toEqual([1, 16]);
        const data = outputs.output?.data;
        expect(data).toBeInstanceOf(Float32Array);
        if (!(data instanceof Float32Array)) return yield* Effect.die("Expected float output");
        expect(A.every(A.fromIterable(data), Number.isFinite)).toBe(true);
        expect(Number(outputs.output?.data[6])).toBeCloseTo(0.5, 5);
        expect(Number(outputs.output?.data[4])).toBe(0);
      }),
    { timeout: 30_000 }
  );
  it.effect(
    "executes reduced KP-RPE attention, buckets, residuals and feature layers",
    () =>
      Effect.gen(function* () {
        const payload = yield* weights(recognizerShapes());
        expect(payload.length).toBeLessThan(100_000);
        const bytes = yield* compileAdaFaceOnnx(payload, "recognizer", dimensions);
        const outputs = yield* execute(bytes, {
          images: new ort.Tensor("float32", new Float32Array(3 * 8 * 8).fill(0.25), [1, 3, 8, 8]),
          keypoints: new ort.Tensor("float32", new Float32Array(10).fill(0.5), [1, 5, 2]),
        });
        expect(outputs.output?.dims).toEqual([1, 8]);
        const data = outputs.output?.data;
        expect(data).toBeInstanceOf(Float32Array);
        if (!(data instanceof Float32Array)) return yield* Effect.die("Expected float output");
        expect(A.fromIterable(data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      }),
    { timeout: 30_000 }
  );
});
