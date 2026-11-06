#!/usr/bin/env python3
"""Freeze pinned HTML byte parsing and non-text builtin dispatch observations."""
import argparse
import ctypes
import locale
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *a: subprocess.check_output(['git', '-C', str(root), *a], text=True).strip()
    assert git('rev-parse', 'HEAD') == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert git('rev-parse', 'HEAD^{tree}') == 'a35a58fac03400f71a93a93485b77f1d56f2b02f' and not git('status', '--porcelain')
    assert sys.version_info[:3] == (3, 11, 15) and os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    sys.path.insert(0, str(root))
    import lxml.html
    from lxml import etree
    from eyecite.clean import clean_text, cleaners_lookup, html
    assert etree.LIBXML_VERSION == etree.LIBXML_COMPILED_VERSION == (2, 12, 3)
    library = ctypes.CDLL(etree.__file__)
    assert ctypes.c_int.in_dll(library, '_libiconv_version').value == 0x111
    library.locale_charset.restype = ctypes.c_char_p
    assert library.locale_charset() == b'UTF-8' and locale.setlocale(locale.LC_CTYPE) == 'C.UTF-8'
    aliases = []
    Callback = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_uint, ctypes.POINTER(ctypes.c_char_p), ctypes.c_void_p)
    @Callback
    def receive_aliases(count, names, context):
        aliases.append([names[i].decode('ascii') for i in range(count)])
        return 0
    library.libiconvlist.argtypes = [Callback, ctypes.c_void_p]
    library.libiconvlist(receive_aliases, None)
    assert len(aliases) == 111 and sum(map(len, aliases)) == 347
    inventory = b''.join(b''.join(name.encode('ascii') + b'\0' for name in group) + b'\0' for group in aliases)
    converter = {'name': 'GNU libiconv', 'version': '1.17', 'sourceArchiveSha256': '8f74213b56238c85a50a5329f77e06198771e70dd9a739779f4c02f65d971313', 'localeCharset': 'UTF-8', 'localeCType': 'C.UTF-8', 'encodingGroups': aliases, 'inventorySha256': hashlib.sha256(inventory).hexdigest()}
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    artifacts = {}
    def intern(value):
        digest = hashlib.sha256(json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest()
        assert digest not in artifacts or artifacts[digest] == value
        artifacts[digest] = value
        return digest
    def observe(thunk):
        try:
            result = thunk()
            return {'kind': 'success', 'text': intern(result), 'type': type(result).__module__ + '.' + type(result).__name__}
        except Exception as error:
            return {'kind': 'error', 'type': type(error).__module__ + '.' + type(error).__name__, 'message': intern(str(error))}
    inputs = []
    def add(name, value):
        inputs.append((name, value))
    add('empty', b'')
    for byte in range(256):
        add(f'content-{byte:02x}', b'<div>' + bytes([byte]) + b'</div>')
        add(f'prefix-{byte:02x}', bytes([byte]) + b'<html><head>A<title>B</title>C</head>T<head>D<title>E</title>F</head>U<body>V</body>W')
    for name, value in [
        ('ascii', b'<div>A</div>'), ('utf8-undeclared', '<div>café 😀</div>'.encode()),
        ('utf8-meta', '<meta charset="utf-8"><div>café 😀</div>'.encode()),
        ('utf8-bom', b'\xef\xbb\xbf' + '<div>café 😀</div>'.encode()),
        ('invalid-utf8', b'<meta charset="utf-8"><div>\xff\xc0\xaf\xed\xa0\x80</div>'),
        ('nul', b'<div>A\x00B</div>'), ('ascii-declaration', b'<?xml version="1.0" encoding="ASCII"?><div>A</div>'),
        ('unknown-encoding', b'<meta charset="not-a-codec"><div>\xe9</div>'),
        ('unknown-declaration', b'<?xml version="1.0" encoding="not-a-codec"?><div>\xe9</div>'),
        ('external-doctype', b'<!DOCTYPE html SYSTEM "file:///never-open-this"><div>A</div>'),
        ('depth-256', b'<div>' * 256 + b'VISIBLE' + b'</div>' * 256),
    ]: add(name, value)
    text = '<html><head>A<title>B</title>C</head>T<head>D<title>E</title>F</head>U<body>café 😀</body>W'
    for encoding, bom in [('utf-16-le', b'\xff\xfe'), ('utf-16-be', b'\xfe\xff'), ('utf-32-le', b'\xff\xfe\0\0'), ('utf-32-be', b'\0\0\xfe\xff')]:
        add(encoding + '-bare', text.encode(encoding))
        add(encoding + '-bom', bom + text.encode(encoding))
    samples = [
        ('windows-1252', 'café € “x”'), ('iso-8859-1', 'café'), ('iso-8859-15', '€ café'),
        ('shift_jis', '日本語'), ('euc-jp', '日本語'), ('iso-2022-jp', '日本語'),
        ('gb2312', '中文'), ('gb18030', '中文😀'), ('big5', '中文'), ('euc-kr', '한국어'),
        ('koi8-r', 'Русский'), ('windows-1251', 'Русский'), ('ibm866', 'Русский'),
        ('ibm850', 'café'), ('iso-8859-7', 'Ελληνικά'), ('iso-8859-8', 'עברית'),
        ('iso-8859-9', 'Türkçe'), ('tis-620', 'ภาษาไทย'), ('macintosh', 'café'),
    ]
    for encoding, value in samples:
        encoded = value.encode(encoding)
        for mode in ['meta', 'http-equiv', 'xml']:
            declaration = (f'<meta charset="{encoding}">' if mode == 'meta' else f'<meta http-equiv="Content-Type" content="text/html; charset={encoding}">' if mode == 'http-equiv' else f'<?xml version="1.0" encoding="{encoding}"?>').encode()
            add(encoding + '-' + mode, declaration + b'<div>' + encoded + b'</div>')
    rows = []
    for name, value in inputs:
        outcome = observe(lambda: html(value))
        diagnostics = [{'domain': e.domain_name, 'type': e.type_name, 'level': e.level_name, 'resourceLimit': e.type_name in ['ERR_NAME_TOO_LONG', 'ERR_NO_MEMORY', 'XPATH_MEMORY_ERROR'] or e.message.startswith('Excessive depth in document:') or 'Huge input lookup' in e.message} for e in lxml.html.html_parser.error_log]
        rows.append({'name': name, 'hex': value.hex(), 'fullHtml': bool(lxml.html._looks_like_full_html_bytes(value)), 'outcome': outcome, 'diagnostics': diagnostics})
    hooks = []
    class Host:
        def __str__(self): hooks.append('str'); return 'HOST'
        def __bytes__(self): hooks.append('bytes'); return b'HOST'
        def __len__(self): hooks.append('len'); return 4
    class Text(str):
        def __str__(self): hooks.append('str'); return 'OVERRIDE'
        def __len__(self): hooks.append('len'); return 999
    controls = []
    values = [('none', None), ('zero', 0), ('integer', 42), ('list', ['A']), ('bytes', b'<div>A</div>'), ('bytearray', bytearray(b'<div>A</div>')), ('memoryview', memoryview(b'<div>A</div>')), ('host', Host()), ('text-subclass', Text('<div>A</div>'))]
    for cleaner in cleaners_lookup:
        for name, value in values:
            hooks.clear()
            outcome = observe(lambda: clean_text('INPUT', [lambda _: value, cleaner]))
            controls.append({'name': cleaner + ':' + name, 'cleaner': cleaner, 'valueKind': name, 'outcome': outcome, 'hooks': list(hooks)})
    report = {'schemaVersion': 'citation-html-bytes/v1', 'scope': 'source byte parsing and non-text dispatch only; target composition remains separate', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'), 'python': '3.11.15', 'pythonHashSeed': '0', 'producerSha256': sha(Path(__file__)), 'converter': converter, 'cleanSourceSha256': sha(root / 'eyecite/clean.py'), 'lxmlHtmlSourceSha256': sha(Path(lxml.html.__file__)), 'licenseSha256': sha(root / 'LICENSE'), 'lockSha256': sha(root / 'uv.lock'), 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'lxml']}, 'libxmlRuntime': list(etree.LIBXML_VERSION), 'artifacts': [{'sha256': k, 'value': artifacts[k]} for k in sorted(artifacts)], 'cases': rows, 'nonTextCases': controls}
    assert not git('status', '--porcelain')
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(rows)} byte outcomes / {len(controls)} non-text dispatch observations / {len(artifacts)} full strings')


if __name__ == '__main__':
    main()
