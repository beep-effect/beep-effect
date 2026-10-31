/**
 * Owned streaming filesystem adapter, executed only by the scoped discovery service.
 * @packageDocumentation
 */
/**
 * Python stdlib directory iterator with bounded depth, entries and output records.
 * **Example** Internal process input; never a shell command or user-supplied program.
 * @category internal
 */
export const transcriptDirectoryHelper = `
import json, os, stat, sys
root, max_depth, max_entries = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
stack = []
skipped = False

def emit(kind, relative=""):
    print(json.dumps({"kind": kind, "relative": relative}, ensure_ascii=True), flush=True)

def identity(path):
    value = os.stat(path, follow_symlinks=False)
    if not stat.S_ISDIR(value.st_mode) or os.path.realpath(path) != path:
        raise ValueError("changed")
    return value.st_dev, value.st_ino

def enter(path):
    before = identity(path)
    iterator = os.scandir(path)
    try:
        if identity(path) != before:
            raise ValueError("changed")
    except BaseException:
        iterator.close()
        raise
    stack.append((path, before, iterator))

try:
    enter(root)
    count = 0
    while stack:
        path, original, iterator = stack[-1]
        if identity(path) != original:
            raise ValueError("changed")
        entry = next(iterator, None)
        if entry is None:
            iterator.close()
            stack.pop()
            emit("directory-end")
            continue
        count += 1
        relative = os.path.relpath(entry.path, root)
        if count > max_entries:
            emit("overflow")
            break
        try:
            path_bytes = entry.path.encode("utf-8", errors="strict")
        except UnicodeEncodeError:
            emit("other")
            continue
        if len(path_bytes) > 4096 or len(relative) > 4096:
            emit("overflow")
            break
        if entry.is_symlink():
            emit("link")
        elif entry.is_dir(follow_symlinks=False):
            if len(stack) >= max_depth:
                emit("overflow")
                break
            try:
                enter(entry.path)
            except OSError:
                # An unreadable child keeps the root incomplete without hiding readable siblings.
                skipped = True
                emit("other")
                continue
            emit("directory")
        elif entry.is_file(follow_symlinks=False):
            emit("file", relative)
        else:
            emit("other")
    else:
        emit("unavailable" if skipped else "complete")
except ValueError:
    emit("changed")
except (OSError, UnicodeError):
    emit("unavailable")
finally:
    for _, _, iterator in reversed(stack):
        iterator.close()
`;
