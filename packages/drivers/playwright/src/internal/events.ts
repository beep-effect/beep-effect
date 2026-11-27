/** @internal */
export type PatchedEvents<Original, Events> = Original & {
  on<K extends keyof Events>(event: K, listener: (arg: Events[K]) => void): PatchedEvents<Original, Events>;
  off<K extends keyof Events>(event: K, listener: (arg: Events[K]) => void): PatchedEvents<Original, Events>;
  once<K extends keyof Events>(event: K, listener: (arg: Events[K]) => void): PatchedEvents<Original, Events>;
};
