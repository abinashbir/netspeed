# Network Speed Indicator

A network speed indicator for Fedora that shows, live in the top bar:

```
↓1.2M/s  ↑340K/s  ⇅4.7G
```

| symbol | meaning |
|---|---|
| `↓` | current download speed |
| `↑` | current upload speed |
| `⇅` | total data consumed on that interface since boot |

There are **two front-ends** that share **one core** (`shared/core.js`), so
both show exactly the same numbers:

| front-end | shell | status |
|---|---|---|
| `gnome-extension/netspeed@abinash.dev` | GNOME Shell 51 (your current session) | installed, needs a log out / log in to appear |
| `dms-plugin/netspeed` | DankMaterialShell (the GNOME-free shell you have installed) | installed, enable it in the DMS settings |

---

## How it measures

`/proc/net/dev` - the kernel's own byte counters per network interface.
Column 0 after the `:` is received bytes, column 8 is transmitted bytes.
The core diffs two readings and divides by the elapsed time.

* `auto` mode picks the busiest **non-virtual** interface (`lo`, `docker`,
  `veth`, `br-`, `tun`, `wg`, ... are skipped) - on this machine
  `wlp0s20f3`.
* VPN/tunnel interfaces can still be picked by hand from the menu.
* Values are smoothed (exponential moving average) so the bar does not
  flicker on every TCP burst.
* Units are 1024-based: B/s, KB/s, MB/s, GB/s.

---

## Install

### GNOME Shell (works right now on your session)

```bash
bash scripts/install-gnome.sh
```

Then **log out and log back in** (GNOME only picks up newly installed
extensions at login). The indicator appears in the top bar, on the right.

Click it for a menu:

* **Interface** - `auto` or a specific one (`wlp0s20f3`, `lo`, ...)
* **Display** - compact (`↓1.2M/s`) or full (`↓1.2 MB/s`)
* **Update every** - 1 / 2 / 5 seconds
* total since boot, total for this session, and a session counter reset

Settings are remembered in `~/.config/netspeed-indicator.json`.

If something goes wrong after logging in:

```bash
journalctl --user -f | grep -i netspeed
gnome-extensions info netspeed@abinash.dev
```

### DankMaterialShell

```bash
bash scripts/install-dms.sh
```

Then in DMS:

1. **Settings -> Plugins -> enable "Network Speed"**
2. **Settings -> Appearance -> DankBar Layout -> add "Network Speed"**
   to the left / center / right section you want
3. `dms restart` if the bar does not refresh immediately

---

## Layout

```
speed_indicater/
├── shared/
│   └── core.js                       # THE core: parsing, rate math, formatting
├── gnome-extension/netspeed@abinash.dev/
│   ├── metadata.json
│   ├── extension.js                  # top bar indicator + menu
│   ├── stylesheet.css
│   └── core.js                       # installed copy of shared/core.js
├── dms-plugin/netspeed/
│   ├── plugin.json
│   ├── BandwidthWidget.qml           # DMS bar pill
│   ├── Settings.qml
│   └── core.js                       # installed copy of shared/core.js
├── scripts/
│   ├── install-gnome.sh
│   └── install-dms.sh
└── tests/
    ├── test-core.js                  # unit tests for the core
    ├── stubs.js                      # fake GNOME Shell APIs
    ├── run-harness.py                # runs the extension logic outside the shell
    └── check.sh                      # runs everything
```

`shared/core.js` is copied verbatim into both front-ends at install time,
so there is exactly one implementation of the measuring logic.

---

## Tests

```bash
bash tests/check.sh
```

* `tests/test-core.js` - 21 unit tests for parsing, rates and formatting
  (run with `gjs -m`, GJS is already installed on Fedora).
* `tests/run-harness.py` - executes the real `extension.js` against fake
  GNOME Shell APIs, so mistakes in the indicator logic are caught without
  needing a shell restart. This is how the "submenu crashed" bug was found.
* `tests/run-dms-test.sh` - loads the real `BandwidthWidget.qml` in
  Quickshell (the same QML engine DMS uses) with mock `qs.*` modules and
  checks that it samples the counters and that both bar pills build.

All three pass on this machine.
