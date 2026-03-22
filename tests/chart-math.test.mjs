import test from 'node:test';
import assert from 'node:assert/strict';

import { computeVisibleYRange } from '../modules/chart/chart-math.mjs';

test('computeVisibleYRange fits the visible Celsius series in the current viewport', () => {
    const range = computeVisibleYRange(
        {
            timestamps: new Float64Array([0, 60, 120]),
            seriesData: [
                new Float64Array([10, 11, 12]),
                new Float64Array([5, 6, 7]),
            ],
            seriesVisible: [true, false],
        },
        0,
        120,
    );

    assert.deepEqual(range, { min: 9.9, max: 12.1 });
});

test('computeVisibleYRange falls back when no series are visible', () => {
    const range = computeVisibleYRange(
        {
            timestamps: new Float64Array([0, 60, 120]),
            seriesData: [new Float64Array([10, 11, 12])],
            seriesVisible: [false],
        },
        0,
        120,
    );

    assert.deepEqual(range, { min: -1, max: 1 });
});
