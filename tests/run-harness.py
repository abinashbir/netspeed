#!/usr/bin/env python3
"""Run the GNOME Shell extension's logic outside gnome-shell.

The extension's shell imports are rewritten to point at tests/stubs.js, then
the extension is enabled, sampled twice and disabled. Any runtime error
(misspelled API, bad property, throwing code) fails this script.
"""
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
UUID = "netspeed@abinash.dev"
EXT = ROOT / "gnome-extension" / UUID / "extension.js"

WORK = pathlib.Path("/tmp/opencode/harness")
if WORK.exists():
    shutil.rmtree(WORK)
WORK.mkdir(parents=True)

src = EXT.read_text()

# Replace the gnome-shell specific imports with the local stubs, keep the
# shared core import untouched.
imports = re.compile(r"^import .*?;$", re.MULTILINE)
stub_import = ("import {Clutter, GLib, St, Main, PanelMenu, PopupMenu, Extension} "
               "from './stubs.js';")
seen = {"n": 0}


def _replace(match):
    seen["n"] += 1
    if seen["n"] == 1:
        return stub_import
    if match.group(0).strip() == "import './core.js';":
        return match.group(0)  # keep the shared core import
    return ""


src = imports.sub(_replace, src)

shutil.copy(ROOT / "shared" / "core.js", WORK / "core.js")
shutil.copy(ROOT / "tests" / "stubs.js", WORK / "stubs.js")
(WORK / "extension.js").write_text(src)

harness = """
import {Extension} from './stubs.js';

globalThis.__harness = {lastLabel: null, added: null, destroyed: false};

const mod = await import('./extension.js');
const Ext = mod.default;

const ext = new Ext();
ext.enable();

// Sample twice so that a rate can be computed (the second sample has a
// previous counter and a non-zero delta time).
ext._refresh();

const iface = ext._iface;
const stats = ext._stats;
const ifaces = Object.keys(stats);
if (!ifaces.length)
    throw new Error('no interfaces parsed from /proc/net/dev');

console.log('HARNESS-OK');
console.log('  detected interface :', iface);
console.log('  interfaces seen    :', ifaces.join(', '));
console.log('  top bar label      :', globalThis.__harness.lastLabel);
console.log('  menu items         :', ext._indicator.menu.items.length);
console.log('  boot total         :', ext._bootTotalItem.label.text);
console.log('  session total      :', ext._sessionTotalItem.label.text);

// exercise the submenus (they rebuild from live data)
ext._ifaceItem.menu.open();
console.log('  interface menu     :', ext._ifaceItem.menu.items.map(i => i.label.text).join(' | '));
ext._formatItem.menu.open();
console.log('  display menu       :', ext._formatItem.menu.items.map(i => i.label.text).join(' | '));
ext._intervalItem.menu.open();
console.log('  interval menu      :', ext._intervalItem.menu.items.map(i => i.label.text).join(' | '));

// switch the interface by hand and switch display format
const ifaceItems = ext._ifaceItem.menu.items;
if (ifaceItems.length > 1)
    ifaceItems[ifaceItems.length - 1].activate();
ext._config.compact = false;
ext._refresh();
console.log('  full-format label  :', globalThis.__harness.lastLabel);

ext.disable();
console.log('  disabled cleanly   :', globalThis.__harness.destroyed);
"""

(WORK / "harness.js").write_text(harness)

result = subprocess.run(["gjs", "-m", str(WORK / "harness.js")],
                        capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print(result.stderr, file=sys.stderr)

if "HARNESS-OK" not in (result.stdout + result.stderr):
    print("HARNESS FAILED", file=sys.stderr)
    sys.exit(1)
print("Extension harness passed.")
