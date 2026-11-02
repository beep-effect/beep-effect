import * as FileSystem from "effect/FileSystem";

/** Preserve native handle methods while changing only the synthetic fault boundary. */
export const claimFileFault = (input: {
  readonly handle: FileSystem.File;
  readonly sync?: FileSystem.File["sync"];
  readonly writeAll?: FileSystem.File["writeAll"];
}): FileSystem.File => ({
  [FileSystem.FileTypeId]: FileSystem.FileTypeId,
  stat: input.handle.stat,
  sync: input.sync ?? input.handle.sync,
  seek: (offset, from) => input.handle.seek(offset, from),
  read: (buffer, options) => input.handle.read(buffer, options),
  readAlloc: (size, options) => input.handle.readAlloc(size, options),
  truncate: (length) => input.handle.truncate(length),
  write: (buffer) => input.handle.write(buffer),
  writeAll: input.writeAll ?? ((buffer) => input.handle.writeAll(buffer)),
});
