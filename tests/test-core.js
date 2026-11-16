// Unit tests for the shared core. Run with:  gjs -m tests/test-core.js
import '../shared/core.js';

const Core = globalThis.NetDevCore;

let failures = 0;

function check(name, actual, expected) {
    const ok = actual === expected;
    if (!ok)
        failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        got:      ${actual}\n        expected: ${expected}`}`);
}

const SAMPLE = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo:  217253    1900    0    0    0     0          0         0   217253    1900    0    0    0     0       0          0
  eth0: 1000000    1000    0    0    0     0          0         0  2000000    2000    0    0    0     0       0          0
 wlp0s20f3: 5000     50    0    0    0     0          0         0    7000     70    0    0    0     0       0          0
`;

const stats = Core.parseNetDev(SAMPLE);

check('parses three interfaces', Object.keys(stats).length, 3);
check('reads rx bytes', stats.eth0.rx, 1000000);
check('reads tx bytes', stats.eth0.tx, 2000000);
check('ignores the loopback noise', stats.lo.rx, 217253);
check('parses wlan interface', stats.wlp0s20f3.tx, 7000);
check('handles empty input', Object.keys(Core.parseNetDev('')).length, 0);

check('auto picks the busiest interface', Core.pickInterface(stats, 'auto'), 'eth0');
check('explicit interface wins', Core.pickInterface(stats, 'wlp0s20f3'), 'wlp0s20f3');
check('unknown interface falls back to auto', Core.pickInterface(stats, 'nope'), 'eth0');

const rates = Core.computeRates({rx: 1000, tx: 2000}, {rx: 3000, tx: 2500}, 1000);
check('computes download rate (2000 bytes over 1s)', rates.rxBps, 2000);
check('computes upload rate (500 bytes over 1s)', rates.txBps, 500);
check('no negative rates', Core.computeRates({rx: 5000, tx: 5000}, {rx: 1000, tx: 1000}, 1000).rxBps, 0);
check('zero interval is safe', Core.computeRates({rx: 1, tx: 1}, {rx: 2, tx: 2}, 0).rxBps, 0);

check('formats bytes', Core.formatBytes(1536), '1.5 KB');
check('formats big bytes', Core.formatBytes(5 * 1024 * 1024 * 1024), '5.0 GB');
check('formats small bytes', Core.formatBytes(512), '512 B');
check('formats rate', Core.formatRate(1536), '1.5 KB/s');
check('formats compact rate', Core.formatRateCompact(1536), '1.5K/s');
check('formats compact rate above 10', Core.formatRateCompact(12 * 1024 * 1024), '12M/s');
check('formats compact bytes', Core.formatBytesCompact(5 * 1024 * 1024 * 1024), '5.0G');
check('smoothing keeps the first value', Core.smooth(null, 42, 0.5), 42);
check('smoothing moves towards the new value', Math.round(Core.smooth(100, 200, 0.5)), 150);

console.log(failures === 0 ? '\nAll core tests passed.' : `\n${failures} test(s) FAILED.`);
if (failures > 0)
    throw new Error(`${failures} failing test(s)`);
