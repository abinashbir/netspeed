// .pragma library
//
// NetDevCore - the shared core of the network speed indicator.
//
// It is deliberately written in a conservative ES5-flavoured subset so that
// the exact same file can be used by BOTH front-ends:
//
//   * GNOME Shell extension (GJS, ES modules):
//         import './core.js';            // side-effect import
//         const Core = globalThis.NetDevCore;
//
//   * DankMaterialShell / Quickshell plugin (QML):
//         import "core.js" as Core;
//         Core.NetDevCore.parseNetDev(text)
//
// Data source: /proc/net/dev, the kernel's own per-interface byte counters.
//
//   wlp0s20f3: 123456789 1000 0 0 0 0 0 0   987654321 900 0 0 0 0 0 0
//              ^ rx bytes                              ^ tx bytes

var NetDevCore = (function () {
    'use strict';

    // Interfaces that are usually not the one a human cares about.
    // Note: wg0 / tun0 are listed here only to keep them out of "auto"
    // detection - you can still pick them by hand, which is what you want
    // when the VPN tunnel is the interesting number.
    var VIRTUAL_PREFIXES = [
        'lo', 'docker', 'veth', 'br-', 'virbr', 'bond', 'tun', 'tap',
        'wg', 'zt', 'dummy', 'cni', 'flannel', 'kube', 'podman', 'nm-'
    ];

    function isVirtual(name) {
        for (var i = 0; i < VIRTUAL_PREFIXES.length; i++) {
            if (name.indexOf(VIRTUAL_PREFIXES[i]) === 0)
                return true;
        }
        return false;
    }

    // /proc/net/dev -> { "eth0": {rx: <bytes>, tx: <bytes>}, ... }
    function parseNetDev(text) {
        var stats = {};
        if (!text)
            return stats;

        var lines = String(text).split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line)
                continue;

            var colon = line.indexOf(':');
            if (colon < 0)
                continue;

            var name = line.substring(0, colon).trim();
            var fields = line.substring(colon + 1).trim().split(/\s+/);

            // rx: bytes packets errs drop fifo frame compressed multicast
            // tx: bytes packets errs drop fifo colls carrier compressed
            if (fields.length < 16)
                continue;

            var rx = parseInt(fields[0], 10);
            var tx = parseInt(fields[8], 10);
            if (isNaN(rx) || isNaN(tx))
                continue;

            stats[name] = {rx: rx, tx: tx};
        }
        return stats;
    }

    // Interface names, busiest first.
    function listInterfaces(stats) {
        var names = [];
        for (var name in stats) {
            if (Object.prototype.hasOwnProperty.call(stats, name))
                names.push(name);
        }
        names.sort(function (a, b) {
            return (stats[b].rx + stats[b].tx) - (stats[a].rx + stats[a].tx);
        });
        return names;
    }

    // preferred: 'auto' or an explicit interface name.
    function pickInterface(stats, preferred) {
        if (preferred && preferred !== 'auto' && stats[preferred])
            return preferred;

        var names = listInterfaces(stats);
        var i;
        for (i = 0; i < names.length; i++) {
            if (!isVirtual(names[i]))
                return names[i];
        }
        for (i = 0; i < names.length; i++) {
            if (names[i] !== 'lo')
                return names[i];
        }
        return names.length ? names[0] : null;
    }

    // prev/curr are {rx, tx} byte counters, dtMs the elapsed milliseconds.
    function computeRates(prev, curr, dtMs) {
        if (!prev || !curr || !dtMs || dtMs <= 0)
            return {rxBps: 0, txBps: 0};

        return {
            rxBps: Math.max(0, (curr.rx - prev.rx) / (dtMs / 1000)),
            txBps: Math.max(0, (curr.tx - prev.tx) / (dtMs / 1000))
        };
    }

    // Exponential smoothing so the panel does not flicker on every burst.
    function smooth(prev, next, alpha) {
        if (prev === null || prev === undefined)
            return next;
        var a = (alpha === undefined || alpha === null) ? 0.35 : alpha;
        return prev * (1 - a) + next * a;
    }

    function formatBytes(bytes, digits) {
        var b = Number(bytes) || 0;
        var d = (digits === undefined || digits === null) ? 1 : digits;
        if (b < 1024)
            return Math.round(b) + ' B';

        var units = ['KB', 'MB', 'GB', 'TB', 'PB'];
        var value = b / 1024;
        var i = 0;
        while (value >= 1024 && i < units.length - 1) {
            value /= 1024;
            i++;
        }
        return value.toFixed(d) + ' ' + units[i];
    }

    function formatRate(bytesPerSec, digits) {
        var b = Number(bytesPerSec) || 0;
        var d = (digits === undefined || digits === null) ? 1 : digits;
        if (b < 1024)
            return Math.round(b) + ' B/s';

        var units = ['KB/s', 'MB/s', 'GB/s', 'TB/s'];
        var value = b / 1024;
        var i = 0;
        while (value >= 1024 && i < units.length - 1) {
            value /= 1024;
            i++;
        }
        return value.toFixed(d) + ' ' + units[i];
    }

    // Compact form for the top bar: "0B/s", "1.2K/s", "12M/s".
    function formatRateCompact(bytesPerSec) {
        var b = Number(bytesPerSec) || 0;
        if (b < 1024)
            return Math.round(b) + 'B/s';

        var units = ['K/s', 'M/s', 'G/s'];
        var value = b / 1024;
        var i = 0;
        while (value >= 1024 && i < units.length - 1) {
            value /= 1024;
            i++;
        }
        if (value < 10)
            return value.toFixed(1) + units[i];
        return Math.round(value) + units[i];
    }

    // Compact form for a byte total: "0B", "1.2K", "12M", "4.7G".
    function formatBytesCompact(bytes) {
        var b = Number(bytes) || 0;
        if (b < 1024)
            return Math.round(b) + 'B';

        var units = ['K', 'M', 'G', 'T'];
        var value = b / 1024;
        var i = 0;
        while (value >= 1024 && i < units.length - 1) {
            value /= 1024;
            i++;
        }
        if (value < 10)
            return value.toFixed(1) + units[i];
        return Math.round(value) + units[i];
    }

    return {
        parseNetDev: parseNetDev,
        listInterfaces: listInterfaces,
        pickInterface: pickInterface,
        computeRates: computeRates,
        smooth: smooth,
        formatBytes: formatBytes,
        formatRate: formatRate,
        formatRateCompact: formatRateCompact,
        formatBytesCompact: formatBytesCompact,
        isVirtual: isVirtual
    };
})();

if (typeof globalThis !== 'undefined')
    globalThis.NetDevCore = NetDevCore;
