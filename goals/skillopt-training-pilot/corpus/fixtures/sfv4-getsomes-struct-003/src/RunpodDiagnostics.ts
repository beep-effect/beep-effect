import * as O from "effect/Option";
import * as R from "effect/Record";

export interface RunpodDiagnostics {
  readonly podId?: string;
  readonly status?: string;
  readonly gpuCount?: number;
}

export type RunpodPod = {
  readonly id?: string | null;
  readonly status?: string | null;
  readonly gpuCount?: number | null;
};

export const diagnosticsForPod = (pod: RunpodPod): Partial<RunpodDiagnostics> => {
  const options: Readonly<Record<string, O.Option<unknown>>> = {
    podId: O.fromNullishOr(pod.id),
    status: O.fromNullishOr(pod.status),
    gpuCount: O.fromNullishOr(pod.gpuCount),
  };

  return R.getSomes(options) as Partial<RunpodDiagnostics>;
};
