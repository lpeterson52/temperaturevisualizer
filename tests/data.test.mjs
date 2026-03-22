import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getXAxisTicks,
    parseBackendTimestamp,
    transformApiResult,
} from '../modules/data.mjs';

test('parseBackendTimestamp parses backend timestamps without relying on Date string parsing', () => {
    const timestamp = parseBackendTimestamp('02/22/2026 00:10:36');

    assert.equal(timestamp.getFullYear(), 2026);
    assert.equal(timestamp.getMonth(), 1);
    assert.equal(timestamp.getDate(), 22);
    assert.equal(timestamp.getHours(), 0);
    assert.equal(timestamp.getMinutes(), 10);
    assert.equal(timestamp.getSeconds(), 36);
});

test('transformApiResult builds aligned chart data for all configured tank series', () => {
    const result = transformApiResult([
        {
            'Date-Time': '02/22/2026 00:00:36',
            'Tank A1 Warm (C)': 14.6496,
            'Tank A1 Cool (C)': 14.804,
        },
        {
            'Date-Time': '02/22/2026 00:10:36',
            'Tank A1 Warm (C)': 14.6299,
            'Tank A1 Cool (C)': 14.7249,
        },
    ]);

    assert.equal(result.labels.length, 2);
    assert.equal(result.timestamps.length, 2);
    assert.equal(result.seriesMeta.length, 32);
    assert.equal(result.seriesData.length, 32);
    assert.equal(result.seriesData[0][0], 14.6496);
    assert.equal(result.seriesData[1][1], 14.7249);
    assert.equal(result.seriesVisible.every(value => value === false), true);
});

test('getXAxisTicks produces ascending ticks across the visible range', () => {
    const minSeconds = parseBackendTimestamp('02/22/2026 00:00:36').getTime() / 1000;
    const maxSeconds = parseBackendTimestamp('02/22/2026 04:00:36').getTime() / 1000;
    const ticks = getXAxisTicks(minSeconds, maxSeconds, 640);

    assert.ok(ticks.length > 0);
    assert.ok(ticks.every((tick, index) => index === 0 || tick.value > ticks[index - 1].value));
    assert.equal(typeof ticks[0].label, 'string');
});
