#!/usr/bin/env python3
"""Exercise SSH notification wrappers without a network, device, agent, or notification."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile

parent = Path.home() / '.cache/beep/ssh-touch-check'
parent.mkdir(parents=True, exist_ok=True)
for wrapper in map(Path, sys.argv[1:]):
    with tempfile.TemporaryDirectory(dir=parent) as temporary:
        home = Path(temporary)
        binary = home / 'bin'
        binary.mkdir()
        (home / '.ssh').mkdir()
        alerts = home / '.local/bin'
        alerts.mkdir(parents=True)
        events = home / 'events'
        calls = home / 'calls'
        mock = binary / 'ssh'
        mock.write_text('''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
if '-G' in sys.argv:
 print('controlpath '+os.environ['MOCK_SOCKET'])
elif '-O' in sys.argv:
 sys.exit(0 if os.environ['MOCK_REUSE']=='true' else 255)
else:
 with Path(os.environ['MOCK_CALLS']).open('a') as out:out.write(json.dumps(sys.argv[1:])+'\\n')
''')
        mock.chmod(0o700)
        for name in ['ssh-add', 'ssh-keygen']:
            target = binary / name
            target.write_text('#!/bin/sh\nprintf "%s\\n" "256 $MOCK_KEY_FINGERPRINT fixture (ED25519-SK)"\n')
            target.chmod(0o700)
        alert = alerts / 'yubikey-touch-alert'
        alert.write_text('#!/bin/sh\nprintf "%s\\n" "$1" >> "$MOCK_EVENTS"\n')
        alert.chmod(0o700)
        handles = []
        for suffix in ['dankserver', 'tbk-worker']:
            key_suffix = suffix.replace('-', '_') if suffix == 'tbk-worker' else suffix
            (home / '.ssh' / ('id_ed25519_sk_' + key_suffix)).write_text('inert fixture')
            (home / '.ssh' / ('id_ed25519_sk_' + key_suffix + '.pub')).write_text('inert fixture')
            handle = socket.socket(socket.AF_UNIX)
            handle.bind(str(home / '.ssh' / ('agent-' + suffix + '.sock')))
            handles.append(handle)
        environment = {**os.environ, 'HOME': str(home), 'PATH': str(binary) + os.pathsep + os.environ['PATH'],
                       'MOCK_KEY_FINGERPRINT': 'SHA256:bVUwE95rPZDRHE6byIIJdOkfc90OHj1dFC1sc1Rz1HA' if 'ubuntu' in wrapper.name else 'SHA256:/MMPLM/N77AYZ6fGapAV83I/ALH9IyF5h2xmVwpgnPU',
                       'MOCK_SOCKET': str(home / 'control socket'), 'MOCK_CALLS': str(calls), 'MOCK_EVENTS': str(events)}
        try:
            for reuse, arguments, expected_starts in [('true', ['echo', 'fixture'], 0),
                                                       ('false', ['echo', 'fixture'], 1),
                                                       ('false', ['-G'], 0), ('false', ['echo', '-G'], 1), ('false', ['-o', 'ConnectTimeout=1', '-G'], 0)]:
                events.write_text('')
                calls.write_text('')
                result = subprocess.run(['bash', str(wrapper.resolve()), *arguments], env={**environment, 'MOCK_REUSE': reuse},
                                        capture_output=True, text=True, timeout=15)
                assert result.returncode == 0, wrapper.name + ': wrapper failed'
                assert events.read_text().splitlines().count('start') == expected_starts, wrapper.name + ': incorrect alerts'
                if reuse == 'true':
                    invocation = json.loads(calls.read_text().splitlines()[0])
                    assert 'ProxyCommand=false' in invocation and 'ControlMaster=no' in invocation
                    assert environment['MOCK_SOCKET'] in invocation
            print('PASS: ' + wrapper.name + ': reused channel quiet; fresh authentication announced; config probe quiet; no fallback dial')
        finally:
            for handle in handles:
                handle.close()
