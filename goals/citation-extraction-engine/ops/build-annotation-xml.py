#!/usr/bin/env python3
"""Link a small XML query against the already authenticated complete parser archives."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk', required=True, type=Path)
    parser.add_argument('--output-directory', required=True, type=Path)
    parser.add_argument('--replacement-iconv', type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    base = repo / 'packages/law-practice/server/assets/citation-html'
    source = repo / 'packages/law-practice/server/assets/citation-xml/kernel.c'
    receipt = json.loads((base / 'build-receipt.json').read_text())
    bundle = base / 'kernel-relink.tar.xz'
    assert sha(bundle) == receipt['relinkArchiveSha256']
    assert (args.sdk / 'VERSION').read_text().strip() == receipt['sdkVersion']
    sdk = args.sdk.resolve()
    exports = ['xml_version', 'xml_balance', 'malloc', 'free']
    args.output_directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='citation-xml-build-') as temp:
        work = Path(temp)
        with tarfile.open(bundle) as archive:
            for member in archive.getmembers():
                if member.name in ['crt1-reactor.o', 'libxml2.a', 'libiconv.a', 'libc.a', 'libclang_rt.builtins.a']:
                    archive.extract(member, work, filter='data')
        if args.replacement_iconv is not None:
            shutil.copyfile(args.replacement_iconv, work / 'libiconv.a')
        shutil.copyfile(source, work / 'kernel.c')
        compile_args = [str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '--no-wasm-opt', '-O2', '-ffile-prefix-map=' + str(work) + '=/citation-xml-build', '-c', str(work / 'kernel.c'), '-o', str(work / 'kernel.o')]
        subprocess.run(compile_args, check=True)
        link = [str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '--no-wasm-opt', '-O2', '-mexec-model=reactor', '-nostdlib']
        link += [str(work / name) for name in ['crt1-reactor.o', 'kernel.o', 'libxml2.a', 'libiconv.a', 'libc.a', 'libclang_rt.builtins.a']]
        link += ['-Wl,--export=' + name for name in exports]
        link += ['-Wl,--max-memory=536870912', '-o', str(work / 'kernel.wasm')]
        subprocess.run(link, check=True)
        raw = (work / 'kernel.wasm').read_bytes()
        assert b'/home/' not in raw and str(work).encode() not in raw
        (args.output_directory / 'kernel.wasm').write_bytes(raw)
        out = {'schemaVersion': 'citation-annotation-xml-build/v1', 'kernelSourceSha256': sha(source),
               'producerSha256': sha(Path(__file__)), 'parserRelinkArchiveSha256': sha(bundle),
               'parserBuildReceiptSha256': sha(base / 'build-receipt.json'), 'sdkVersion': receipt['sdkVersion'],
               'clangSha256': sha(sdk / 'bin/clang'), 'replacementIconvSha256': sha(args.replacement_iconv) if args.replacement_iconv else None, 'target': 'wasm32-wasip1', 'exports': exports,
               'memoryMaximumBytes': 536870912, 'wasmBytes': len(raw), 'wasmSha256': hashlib.sha256(raw).hexdigest()}
        (args.output_directory / 'build-receipt.json').write_text(json.dumps(out, indent=2) + '\n')
        print(json.dumps({'bytes': out['wasmBytes'], 'sha256': out['wasmSha256']}))


if __name__ == '__main__':
    main()
