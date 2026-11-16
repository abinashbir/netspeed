#!/usr/bin/env bash
# Run every test for the network speed indicator.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0

echo "== core unit tests =="
if gjs -m "$ROOT/tests/test-core.js" 2>&1 | grep -v "^Gjs-Console-Message: .*PASS"; then
    :
fi
if ! gjs -m "$ROOT/tests/test-core.js" >/dev/null 2>&1; then
    echo "core unit tests FAILED"
    FAILED=1
fi

echo
echo "== extension harness (runs extension.js outside gnome-shell) =="
if ! python3 "$ROOT/tests/run-harness.py" 2>&1 | grep -E "HARNESS-OK|HARNESS FAILED|passed|Error"; then
    :
fi
if ! python3 "$ROOT/tests/run-harness.py" >/dev/null 2>&1; then
    echo "extension harness FAILED"
    FAILED=1
fi

echo
echo "== DMS plugin in a real QML engine (Quickshell) =="
if ! bash "$ROOT/tests/run-dms-test.sh"; then
    FAILED=1
fi

echo
if [ "$FAILED" -eq 0 ]; then
    echo "All tests passed."
else
    echo "Some tests FAILED."
fi
exit "$FAILED"
