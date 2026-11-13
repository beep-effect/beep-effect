/**
 * Fixed ONNX inference graphs for the pinned CVLFace checkpoints.
 * Adapted from CVLFace 308142aa50adf2e187711354f7524635d3414f1e (MIT).
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MatchPersonError } from "./MatchPerson.errors.ts";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.onnx");
const TensorHeader = S.Struct({
  dtype: S.Literals(["F32", "I64"]),
  shape: S.Array(S.Natural),
  data_offsets: S.Tuple([S.Natural, S.Natural]),
}).pipe($I.annoteSchema("TensorHeader", { description: "Safetensors dtype, tensor dimensions and byte offsets." }));
const TensorHeaders = S.Record(S.String, S.Union([TensorHeader, S.Record(S.String, S.String)])).pipe(
  $I.annoteSchema("TensorHeaders", { description: "Safetensors tensor table with optional string metadata." })
);
const decodeHeaders = S.decodeUnknownEffect(S.fromJsonString(TensorHeaders));

// The small writer implements only the ONNX protobuf fields this fixed graph uses.
// ONNX IR v8, default-domain opset 17. Numeric tensor payloads are little endian.
const concat = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const output = new Uint8Array(A.reduce(parts, 0, (n, p) => n + p.length));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};
const varint = (input: number | bigint): Uint8Array => {
  let value = BigInt.asUintN(64, BigInt(input));
  const bytes: Array<number> = [];
  do {
    bytes.push(Number(value & BigInt(127)) | (value > BigInt(127) ? 128 : 0));
    value >>= BigInt(7);
  } while (value > BigInt(0));
  return Uint8Array.from(bytes);
};
const integer = (field: number, value: number) => concat([varint(field * 8), varint(value)]);
const bytes = (field: number, value: Uint8Array) => concat([varint(field * 8 + 2), varint(value.length), value]);
const text = (field: number, value: string) => bytes(field, new TextEncoder().encode(value));
const float = (field: number, value: number) => {
  const data = new Uint8Array(4);
  new DataView(data.buffer).setFloat32(0, value, true);
  return concat([varint(field * 8 + 5), data]);
};
const intAttribute = (name: string, value: number) => concat([text(1, name), integer(3, value), integer(20, 2)]);
const intsAttribute = (name: string, values: ReadonlyArray<number>) =>
  concat([text(1, name), ...A.map(values, (v) => integer(8, v)), integer(20, 7)]);
const floatAttribute = (name: string, value: number) => concat([text(1, name), float(2, value), integer(20, 1)]);
const stringAttribute = (name: string, value: string) => concat([text(1, name), text(4, value), integer(20, 3)]);
const valueInfo = (name: string, shape: ReadonlyArray<number>) =>
  concat([
    text(1, name),
    bytes(2, bytes(1, concat([integer(1, 1), bytes(2, concat(A.map(shape, (n) => bytes(1, integer(1, n)))))]))),
  ]);

class TensorSource extends S.Opaque<TensorSource, { readonly brand: unique symbol }>()(
  S.Struct({
    dtype: S.Literals(["F32", "I64"]),
    shape: S.Array(S.Natural),
    data: S.Uint8Array,
  }).pipe(
    $I.annoteSchema("TensorSource", { description: "Validated safetensors tensor shape and exact payload bytes." })
  )
) {}

class Graph {
  readonly nodes: Array<Uint8Array> = [];
  readonly initializers: Array<Uint8Array> = [];
  private used = HashMap.empty<string, string>();
  private serial = 0;
  readonly tensors: HashMap.HashMap<string, TensorSource>;
  constructor(tensors: HashMap.HashMap<string, TensorSource>) {
    this.tensors = tensors;
  }
  node(op: string, inputs: ReadonlyArray<string>, attributes: ReadonlyArray<Uint8Array> = []): string {
    const output = `v${this.serial++}`;
    this.nodes.push(
      concat([
        ...A.map(inputs, (s) => text(1, s)),
        text(2, output),
        text(4, op),
        ...A.map(attributes, (a) => bytes(5, a)),
      ])
    );
    return output;
  }
  tensor(name: string, shape: ReadonlyArray<number>, data: Uint8Array, dtype = 1): string {
    this.initializers.push(
      concat([...A.map(shape, (n) => integer(1, n)), integer(2, dtype), text(8, name), bytes(9, data)])
    );
    return name;
  }
  constant(values: ReadonlyArray<number>, shape: ReadonlyArray<number> = [values.length], int = false): string {
    const data = new Uint8Array(values.length * (int ? 8 : 4));
    const view = new DataView(data.buffer);
    for (let i = 0; i < values.length; i++) {
      const value = values[i] ?? 0;
      if (int) view.setBigInt64(i * 8, BigInt(value), true);
      else view.setFloat32(i * 4, value, true);
    }
    return this.tensor(`c${this.serial++}`, shape, data, int ? 7 : 1);
  }
  weight(name: string): string {
    const previous = HashMap.get(this.used, name);
    if (O.isSome(previous)) return previous.value;
    const value = HashMap.get(this.tensors, name);
    // Required tensor names are checked before graph construction by the Effect boundary.
    if (O.isNone(value)) return `MISSING:${name}`;
    this.used = HashMap.set(this.used, name, name);
    return this.tensor(name, value.value.shape, value.value.data, value.value.dtype === "F32" ? 1 : 7);
  }
  reshape(x: string, shape: ReadonlyArray<number>) {
    return this.node("Reshape", [x, this.constant(shape, [shape.length], true)]);
  }
  transpose(x: string, perm: ReadonlyArray<number>) {
    return this.node("Transpose", [x], [intsAttribute("perm", perm)]);
  }
  slice(x: string, start: number, end: number, axis: number) {
    return this.node("Slice", [
      x,
      this.constant([start], [1], true),
      this.constant([end], [1], true),
      this.constant([axis], [1], true),
    ]);
  }
  linear(x: string, prefix: string, bias = true): string {
    const product = this.node("MatMul", [x, this.transpose(this.weight(`${prefix}.weight`), [1, 0])]);
    return bias ? this.node("Add", [product, this.weight(`${prefix}.bias`)]) : product;
  }
  norm(x: string, prefix: string): string {
    return this.node(
      "LayerNormalization",
      [x, this.weight(`${prefix}.weight`), this.weight(`${prefix}.bias`)],
      [intAttribute("axis", -1), floatAttribute("epsilon", 1e-5)]
    );
  }
  batchNorm(x: string, prefix: string, epsilon = 1e-5): string {
    return this.node(
      "BatchNormalization",
      [
        x,
        this.weight(`${prefix}.weight`),
        this.weight(`${prefix}.bias`),
        this.weight(`${prefix}.running_mean`),
        this.weight(`${prefix}.running_var`),
      ],
      [floatAttribute("epsilon", epsilon)]
    );
  }
  conv(x: string, prefix: string, kernel: number, stride = 1, group = 1, bias = false): string {
    return this.node(
      "Conv",
      [x, this.weight(`${prefix}.weight`), ...(bias ? [this.weight(`${prefix}.bias`)] : [])],
      [
        intsAttribute("kernel_shape", [kernel, kernel]),
        intsAttribute("strides", [stride, stride]),
        intsAttribute("pads", [
          Math.floor(kernel / 2),
          Math.floor(kernel / 2),
          Math.floor(kernel / 2),
          Math.floor(kernel / 2),
        ]),
        intAttribute("group", group),
      ]
    );
  }
  convBn(x: string, prefix: string, kernel = 3, stride = 1, activate = true): string {
    const value = this.batchNorm(this.conv(x, `${prefix}.0`, kernel, stride), `${prefix}.1`);
    return activate ? this.node("LeakyRelu", [value], [floatAttribute("alpha", 0.1)]) : value;
  }
  depthwise(x: string, prefix: string, channels: number, stride: number): string {
    const depth = this.node(
      "LeakyRelu",
      [this.batchNorm(this.conv(x, `${prefix}.0`, 3, stride, channels), `${prefix}.1`)],
      [floatAttribute("alpha", 0.1)]
    );
    return this.node(
      "LeakyRelu",
      [this.batchNorm(this.conv(depth, `${prefix}.3`, 1), `${prefix}.4`)],
      [floatAttribute("alpha", 0.1)]
    );
  }
  resize(x: string, side: number): string {
    return this.node(
      "Resize",
      [x, "", "", this.constant([1, 64, side, side], [4], true)],
      [
        stringAttribute("mode", "nearest"),
        stringAttribute("coordinate_transformation_mode", "asymmetric"),
        stringAttribute("nearest_mode", "floor"),
      ]
    );
  }
  gelu(x: string): string {
    return this.node("Mul", [
      this.node("Mul", [x, this.constant([0.5], [])]),
      this.node("Add", [
        this.constant([1], []),
        this.node("Erf", [this.node("Div", [x, this.constant([Math.SQRT2], [])])]),
      ]),
    ]);
  }
  mlp(x: string, prefix: string): string {
    return this.linear(this.gelu(this.linear(x, `${prefix}.fc1`)), `${prefix}.fc2`);
  }
  mixer(x: string, prefix: string): string {
    const tokens = this.transpose(
      this.mlp(this.transpose(this.norm(x, `${prefix}.norm1`), [0, 2, 1]), `${prefix}.mlp_tokens`),
      [0, 2, 1]
    );
    const residual = this.node("Add", [x, tokens]);
    return this.node("Add", [residual, this.mlp(this.norm(residual, `${prefix}.norm2`), `${prefix}.mlp_channels`)]);
  }
  model(inputs: ReadonlyArray<Uint8Array>, output: string, shape: ReadonlyArray<number>): Uint8Array {
    this.nodes.push(concat([text(1, output), text(2, "output"), text(4, "Identity")]));
    const graph = concat([
      ...A.map(this.nodes, (n) => bytes(1, n)),
      text(2, "beep-cvlface-fixed-v1"),
      ...A.map(this.initializers, (n) => bytes(5, n)),
      ...A.map(inputs, (n) => bytes(11, n)),
      bytes(12, valueInfo("output", shape)),
    ]);
    return concat([integer(1, 8), text(2, "beep-photo-face"), bytes(7, graph), bytes(8, integer(2, 17))]);
  }
}

const buildAligner = (g: Graph): Uint8Array => {
  let x = g.convBn("images", "body.stage1.0", 3, 2);
  for (const [index, channels, stride] of [
    [1, 8, 1],
    [2, 16, 2],
    [3, 32, 1],
    [4, 32, 2],
    [5, 64, 1],
  ])
    x = g.depthwise(x, `body.stage1.${index}`, channels ?? 0, stride ?? 1);
  const stage1 = x;
  for (let i = 0; i < 6; i++) x = g.depthwise(x, `body.stage2.${i}`, i === 0 ? 64 : 128, i === 0 ? 2 : 1);
  const stage2 = x;
  x = g.depthwise(x, "body.stage3.0", 128, 2);
  x = g.depthwise(x, "body.stage3.1", 256, 1);
  const p3 = g.convBn(x, "fpn.output3", 1);
  const p2 = g.convBn(g.node("Add", [g.convBn(stage2, "fpn.output2", 1), g.resize(p3, 10)]), "fpn.merge2");
  const p1 = g.convBn(g.node("Add", [g.convBn(stage1, "fpn.output1", 1), g.resize(p2, 20)]), "fpn.merge1");
  const features = A.map([p1, p2, p3], (value, index) => {
    const prefix = `ssh${index + 1}`;
    const b3 = g.convBn(value, `${prefix}.conv3X3`, 3, 1, false);
    const b5input = g.convBn(value, `${prefix}.conv5X5_1`);
    const b5 = g.convBn(b5input, `${prefix}.conv5X5_2`, 3, 1, false);
    const b7 = g.convBn(g.convBn(b5input, `${prefix}.conv7X7_2`), `${prefix}.conv7x7_3`, 3, 1, false);
    return g.node("Relu", [g.node("Concat", [b3, b5, b7], [intAttribute("axis", 1)])]);
  });
  const head = (prefix: string, width: number) =>
    g.node(
      "Concat",
      A.map(features, (f, i) =>
        g.reshape(g.transpose(g.conv(f, `${prefix}.${i}.conv1x1`, 1, 1, 1, true), [0, 2, 3, 1]), [1, -1, width])
      ),
      [intAttribute("axis", 1)]
    );
  const boxes = head("BboxHead", 4);
  const classes = head("ClassHead", 2);
  const landmarks = head("LandmarkHead", 10);
  const centers: Array<number> = [];
  const sizes: Array<number> = [];
  for (const [step, small, large] of [
    [8, 64, 80],
    [16, 96, 112],
    [32, 128, 144],
  ]) {
    if (step === undefined || small === undefined || large === undefined) continue;
    for (let row = 0; row < Math.ceil(160 / step); row++)
      for (let column = 0; column < Math.ceil(160 / step); column++)
        for (const size of [small, large]) {
          centers.push(((column + 0.5) * step) / 160, ((row + 0.5) * step) / 160);
          sizes.push(size / 160, size / 160);
        }
  }
  const center = g.constant(centers, [1, 1050, 2]);
  const size = g.constant(sizes, [1, 1050, 2]);
  const decodeCenter = g.node("Add", [
    center,
    g.node("Mul", [g.node("Mul", [g.slice(boxes, 0, 2, 2), g.constant([0.1], [])]), size]),
  ]);
  const half = g.node("Div", [
    g.node("Mul", [size, g.node("Exp", [g.node("Mul", [g.slice(boxes, 2, 4, 2), g.constant([0.2], [])])])]),
    g.constant([2], []),
  ]);
  const decodedBoxes = g.node(
    "Concat",
    [g.node("Sub", [decodeCenter, half]), g.node("Add", [decodeCenter, half])],
    [intAttribute("axis", 2)]
  );
  const points = A.makeBy(5, (i) =>
    g.node("Add", [
      center,
      g.node("Mul", [g.node("Mul", [g.slice(landmarks, i * 2, i * 2 + 2, 2), g.constant([0.1], [])]), size]),
    ])
  );
  const combined = g.node("Concat", [decodedBoxes, classes, ...points], [intAttribute("axis", 2)]);
  let mixed = combined;
  for (let i = 0; i < 3; i++) mixed = g.mixer(mixed, `aggregator.${i}`);
  const weights = g.node("Softmax", [g.linear(mixed, "aggregator.3")], [intAttribute("axis", 1)]);
  const merged = g.node(
    "ReduceSum",
    [g.node("Mul", [weights, combined]), g.constant([1], [1], true)],
    [intAttribute("keepdims", 0)]
  );
  return g.model([valueInfo("images", [1, 3, 160, 160])], merged, [1, 16]);
};

const roundEven = (n: number) => (Math.abs(n % 1) === 0.5 ? Math.round(n / 2) * 2 : Math.round(n));
const bucket = (relative: number) => {
  const absolute = Math.abs(relative);
  if (absolute <= 1.9) return roundEven(relative);
  return Math.trunc(
    Math.sign(relative) * Math.min(3.8, roundEven(1.9 + (Math.log(absolute / 1.9) / Math.log(15.2 / 1.9)) * 1.9))
  );
};
const buildRecognizer = (g: Graph): Uint8Array => {
  // Patch projection has no padding, unlike the aligner's padded convolutions.
  const patch = g.node(
    "Conv",
    ["images", g.weight("patch_embed.proj.weight"), g.weight("patch_embed.proj.bias")],
    [intsAttribute("kernel_shape", [8, 8]), intsAttribute("strides", [8, 8])]
  );
  let x = g.node("Add", [g.transpose(g.reshape(patch, [1, 512, 196]), [0, 2, 1]), g.weight("pos_embed")]);
  const grid = A.flatten(A.makeBy(196, (i) => [((i % 14) + 0.5) / 14, (Math.floor(i / 14) + 0.5) / 14]));
  const relative = g.reshape(
    g.node("Sub", [g.constant(grid, [1, 196, 1, 2]), g.reshape("keypoints", [1, 1, 5, 2])]),
    [1, 196, 10]
  );
  const contexts = g.transpose(g.reshape(g.linear(relative, "keypoint_linear"), [1, 196, 384, 49]), [0, 2, 1, 3]);
  const ids = A.flatten(
    A.makeBy(196, (i) =>
      A.makeBy(
        196,
        (j) => (bucket(Math.floor(i / 14) - Math.floor(j / 14)) + 3) * 7 + bucket((i % 14) - (j % 14)) + 3 + i * 49
      )
    )
  );
  const indices = g.constant(ids, [196 * 196], true);
  for (let i = 0; i < 24; i++) {
    const prefix = `blocks.${i}`;
    const qkv = g.transpose(
      g.reshape(g.linear(g.norm(x, `${prefix}.norm1`), `${prefix}.attn.qkv`, false), [1, 196, 3, 16, 32]),
      [2, 0, 3, 1, 4]
    );
    const q = g.node("Mul", [g.reshape(g.slice(qkv, 0, 1, 0), [1, 16, 196, 32]), g.constant([32 ** -0.5], [])]);
    const k = g.reshape(g.slice(qkv, 1, 2, 0), [1, 16, 196, 32]);
    const v = g.reshape(g.slice(qkv, 2, 3, 0), [1, 16, 196, 32]);
    const context = g.reshape(g.slice(contexts, i * 16, (i + 1) * 16, 1), [1, 16, 196 * 49]);
    const rpe = g.reshape(g.node("Gather", [context, indices], [intAttribute("axis", 2)]), [1, 16, 196, 196]);
    const attention = g.node(
      "Softmax",
      [g.node("Add", [g.node("MatMul", [q, g.transpose(k, [0, 1, 3, 2])]), rpe])],
      [intAttribute("axis", -1)]
    );
    const output = g.reshape(g.transpose(g.node("MatMul", [attention, v]), [0, 2, 1, 3]), [1, 196, 512]);
    x = g.node("Add", [x, g.linear(output, `${prefix}.attn.proj`)]);
    const mlp = g.node("Clip", [
      g.linear(g.norm(x, `${prefix}.norm2`), `${prefix}.mlp.fc1`),
      g.constant([0], []),
      g.constant([6], []),
    ]);
    x = g.node("Add", [x, g.linear(mlp, `${prefix}.mlp.fc2`)]);
  }
  x = g.reshape(g.norm(x, "norm"), [1, 196 * 512]);
  x = g.batchNorm(g.linear(x, "feature.0", false), "feature.1", 2e-5);
  x = g.batchNorm(g.linear(x, "feature.2", false), "feature.3", 2e-5);
  return g.model([valueInfo("images", [1, 3, 112, 112]), valueInfo("keypoints", [1, 5, 2])], x, [1, 512]);
};

/**
 * Decode a checksum-verified safetensors payload and compile the fixed graph.
 *
 * **Example** (Reference the compiler)
 * ```ts
 * import { compileAdaFaceOnnx } from "./MatchPerson.onnx.ts"
 * console.log(typeof compileAdaFaceOnnx)
 * ```
 * @internal
 * @category inference
 * @since 0.0.0
 */
export const compileAdaFaceOnnx = Effect.fn("Files.compileAdaFaceOnnx")(function* (
  payload: Uint8Array,
  component: "aligner" | "recognizer"
) {
  if (payload.length < 8) return yield* MatchPersonError.modelIntegrity("Truncated safetensors header.");
  const size = Number(new DataView(payload.buffer, payload.byteOffset, 8).getBigUint64(0, true));
  if (!Number.isSafeInteger(size) || size < 2 || size > payload.length - 8)
    return yield* MatchPersonError.modelIntegrity("Invalid safetensors header length.");
  const headers = yield* decodeHeaders(new TextDecoder().decode(payload.subarray(8, 8 + size))).pipe(
    Effect.mapError((cause) => MatchPersonError.modelIntegrity("Invalid safetensors tensor table.", cause))
  );
  let tensors = HashMap.empty<string, TensorSource>();
  for (const [name, header] of R.toEntries(headers)) {
    if (name === "__metadata__") continue;
    if (!S.is(TensorHeader)(header)) return yield* MatchPersonError.modelIntegrity(`Invalid tensor header: ${name}`);
    const [start, end] = header.data_offsets;
    const expected = A.reduce(header.shape, 1, (a, b) => a * b) * (header.dtype === "F32" ? 4 : 8);
    if (!Str.startsWith("model.net.")(name) || end - start !== expected || end > payload.length - 8 - size)
      return yield* MatchPersonError.modelIntegrity(`Invalid tensor bounds or name: ${name}`);
    tensors = HashMap.set(
      tensors,
      Str.slice(10)(name),
      TensorSource.make({
        dtype: header.dtype,
        shape: header.shape,
        data: payload.subarray(8 + size + start, 8 + size + end),
      })
    );
  }
  const graph = new Graph(tensors);
  const model = component === "aligner" ? buildAligner(graph) : buildRecognizer(graph);
  // Missing inputs remain visible in the encoded graph; reject before caching or execution.
  if (A.some(graph.nodes, (node) => Str.includes("MISSING:")(new TextDecoder().decode(node))))
    return yield* MatchPersonError.modelIntegrity(`Missing required ${component} tensors.`);
  return model;
});
