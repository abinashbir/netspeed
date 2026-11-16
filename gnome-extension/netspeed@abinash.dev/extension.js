// Network Speed Indicator - GNOME Shell extension.
//
// Shows in the top bar:  ↓ download   ↑ upload   ⇅ total consumed
// Data comes from /proc/net/dev via the shared core (shared/core.js),
// which is copied next to this file at install time.
//
// Settings live in ~/.config/netspeed-indicator.json (no GSettings schema
// needed, so the extension works on any GNOME 51 install as-is).

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import './core.js';

const Core = globalThis.NetDevCore;

const ROLE = 'netspeed-indicator';
const NETDEV_PATH = '/proc/net/dev';
const CONFIG_PATH = GLib.build_filenamev([GLib.get_user_config_dir(), 'netspeed-indicator.json']);
const DECODER = new TextDecoder('utf-8');

const DEFAULT_CONFIG = {
    interface: 'auto',
    interval: 1,
    compact: true,
};

export default class NetworkSpeedIndicator extends Extension {
    enable() {
        this._config = this._loadConfig();
        this._iface = this._config.interface;
        this._stats = {};
        this._prev = null;
        this._lastSample = 0;
        this._sessionRx = 0;
        this._sessionTx = 0;
        this._rxBps = 0;
        this._txBps = 0;
        this._timerId = 0;

        this._indicator = new PanelMenu.Button(0.5, 'Network Speed', false);
        this._label = new St.Label({
            text: '↓— ↑— ⇅—',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._label.add_style_class_name('netspeed-label');
        this._indicator.add_child(this._label);

        Main.panel.addToStatusArea(ROLE, this._indicator, 0, 'right');

        this._buildMenu();
        this._refresh();
        this._startTimer();
    }

    disable() {
        this._stopTimer();
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._label = null;
    }

    // ── timer ───────────────────────────────────────────────────────────

    _startTimer() {
        this._stopTimer();
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, this._config.interval,
            () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _stopTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
    }

    // ── menu ────────────────────────────────────────────────────────────

    _buildMenu() {
        const menu = this._indicator.menu;

        this._ifaceItem = new PopupMenu.PopupSubMenuMenuItem('Interface');
        this._ifaceItem.menu.connect('open-state-changed', (menu, open) => {
            if (open)
                this._fillInterfaceMenu(this._ifaceItem);
        });
        menu.addMenuItem(this._ifaceItem);

        this._formatItem = new PopupMenu.PopupSubMenuMenuItem('Display');
        this._formatItem.menu.connect('open-state-changed', (menu, open) => {
            if (open)
                this._fillFormatMenu(this._formatItem);
        });
        menu.addMenuItem(this._formatItem);

        this._intervalItem = new PopupMenu.PopupSubMenuMenuItem('Update every');
        this._intervalItem.menu.connect('open-state-changed', (menu, open) => {
            if (open)
                this._fillIntervalMenu(this._intervalItem);
        });
        menu.addMenuItem(this._intervalItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._ifaceInfoItem = new PopupMenu.PopupMenuItem('Interface: —', {reactive: false});
        menu.addMenuItem(this._ifaceInfoItem);
        this._bootTotalItem = new PopupMenu.PopupMenuItem('Total used since boot: —', {reactive: false});
        menu.addMenuItem(this._bootTotalItem);
        this._sessionTotalItem = new PopupMenu.PopupMenuItem('Used this session: —', {reactive: false});
        menu.addMenuItem(this._sessionTotalItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const resetItem = new PopupMenu.PopupMenuItem('Reset session counter');
        resetItem.connect('activate', () => {
            this._sessionRx = 0;
            this._sessionTx = 0;
            this._refresh();
        });
        menu.addMenuItem(resetItem);

        menu.addMenuItem(new PopupMenu.PopupMenuItem(
            'Network Speed Indicator v1 - rates read from /proc/net/dev', {reactive: false}));
    }

    _checkItem(parent, label, isActive, activate) {
        const item = new PopupMenu.PopupMenuItem(`${isActive() ? '✓ ' : '   '}${label}`);
        item.connect('activate', () => {
            activate();
            parent.menu.close();
            this._refresh();
        });
        parent.menu.addMenuItem(item);
        return item;
    }

    _fillInterfaceMenu(subMenu) {
        const menu = subMenu.menu;
        menu.removeAll();

        this._checkItem(subMenu, 'Automatic (busiest interface)', () => this._iface === 'auto', () => {
            this._iface = 'auto';
            this._config.interface = 'auto';
            this._saveConfig();
            this._prev = null;
        });

        const names = Core.listInterfaces(this._stats);
        for (const name of names) {
            this._checkItem(subMenu, name, () => this._iface === name, () => {
                this._iface = name;
                this._config.interface = name;
                this._saveConfig();
                this._prev = null;
            });
        }
    }

    _fillFormatMenu(subMenu) {
        const menu = subMenu.menu;
        menu.removeAll();

        this._checkItem(subMenu, 'Compact  (↓1.2M/s)', () => this._config.compact, () => {
            this._config.compact = true;
            this._saveConfig();
        });
        this._checkItem(subMenu, 'Full  (↓1.2 MB/s)', () => !this._config.compact, () => {
            this._config.compact = false;
            this._saveConfig();
        });
    }

    _fillIntervalMenu(subMenu) {
        const menu = subMenu.menu;
        menu.removeAll();

        for (const seconds of [1, 2, 5]) {
            this._checkItem(subMenu, `${seconds} second${seconds > 1 ? 's' : ''}`,
                () => this._config.interval === seconds, () => {
                    this._config.interval = seconds;
                    this._saveConfig();
                    this._startTimer();
                });
        }
    }

    // ── sampling ────────────────────────────────────────────────────────

    _refresh() {
        const [ok, content] = GLib.file_get_contents(NETDEV_PATH);
        if (!ok)
            return;

        this._stats = Core.parseNetDev(DECODER.decode(content));

        const iface = Core.pickInterface(this._stats, this._iface);
        if (!iface) {
            this._label.set_text('↓— ↑— ⇅—');
            return;
        }

        const curr = this._stats[iface];
        const now = GLib.get_monotonic_time();
        const dtMs = this._lastSample ? (now - this._lastSample) / 1000 : 0;

        if (this._prev && dtMs > 0) {
            const rates = Core.computeRates(this._prev, curr, dtMs);
            this._rxBps = Core.smooth(this._rxBps, rates.rxBps);
            this._txBps = Core.smooth(this._txBps, rates.txBps);
            this._sessionRx += Math.max(0, curr.rx - this._prev.rx);
            this._sessionTx += Math.max(0, curr.tx - this._prev.tx);
        }

        this._prev = curr;
        this._lastSample = now;

        this._updateLabel(iface, curr);
    }

    _updateLabel(iface, curr) {
        const total = curr.rx + curr.tx;
        const sessionTotal = this._sessionRx + this._sessionTx;

        if (this._config.compact) {
            this._label.set_text(
                `↓${Core.formatRateCompact(this._rxBps)} ` +
                `↑${Core.formatRateCompact(this._txBps)} ` +
                `⇅${Core.formatBytesCompact(total)}`);
        } else {
            this._label.set_text(
                `↓${Core.formatRate(this._rxBps)} ` +
                `↑${Core.formatRate(this._txBps)} ` +
                `⇅${Core.formatBytes(total)}`);
        }

        this._ifaceInfoItem.label.set_text(`Interface: ${iface}`);
        this._bootTotalItem.label.set_text(`Total used since boot: ${Core.formatBytes(total)}`);
        this._sessionTotalItem.label.set_text(`Used this session: ${Core.formatBytes(sessionTotal)}`);
    }

    // ── config file ─────────────────────────────────────────────────────

    _loadConfig() {
        const config = Object.assign({}, DEFAULT_CONFIG);
        try {
            const [ok, content] = GLib.file_get_contents(CONFIG_PATH);
            if (ok) {
                const parsed = JSON.parse(DECODER.decode(content));
                for (const key of Object.keys(DEFAULT_CONFIG)) {
                    if (parsed[key] !== undefined)
                        config[key] = parsed[key];
                }
            }
        } catch (e) {
            // keep defaults
        }
        return config;
    }

    _saveConfig() {
        try {
            GLib.file_set_contents(CONFIG_PATH, JSON.stringify(this._config, null, 2));
        } catch (e) {
            // ignore: the indicator still works, it just will not remember
        }
    }
}
