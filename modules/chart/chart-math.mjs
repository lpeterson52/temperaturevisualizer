import { getClosestIndexForUnixSeconds } from '../data.mjs';

export function nearlyEqual(a, b, epsilon = 1e-9) {
    return Math.abs(a - b) <= epsilon;
}

export function computeVisibleYRange(
    dataset,
    minSeconds,
    maxSeconds,
    options = {},
) {
    const {
        defaultMin = -1,
        defaultMax = 1,
        epsilon = 1e-9,
        rangePad = 1,
    } = options;

    if (!dataset?.timestamps?.length) {
        return { min: defaultMin, max: defaultMax };
    }

    const minIndex = Math.max(0, getClosestIndexForUnixSeconds(dataset.timestamps, minSeconds));
    const maxIndex = Math.min(
        dataset.timestamps.length - 1,
        getClosestIndexForUnixSeconds(dataset.timestamps, maxSeconds),
    );

    if (minIndex < 0 || maxIndex < 0 || minIndex > maxIndex) {
        return { min: defaultMin, max: defaultMax };
    }

    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;

    dataset.seriesData.forEach((seriesValues, seriesIndex) => {
        if (!dataset.seriesVisible[seriesIndex]) {
            return;
        }

        for (let index = minIndex; index <= maxIndex; index += 1) {
            const value = seriesValues[index];
            if (!Number.isFinite(value)) {
                continue;
            }

            if (value < globalMin) {
                globalMin = value;
            }
            if (value > globalMax) {
                globalMax = value;
            }
        }
    });

    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
        return { min: defaultMin, max: defaultMax };
    }

    if (nearlyEqual(globalMin, globalMax, epsilon)) {
        globalMin -= rangePad;
        globalMax += rangePad;
    }

    const margin = (globalMax - globalMin) * 0.05;
    let nextMin = globalMin - margin;
    let nextMax = globalMax + margin;

    if (nearlyEqual(nextMin, nextMax, epsilon)) {
        nextMin -= rangePad;
        nextMax += rangePad;
    }

    nextMin = Math.round(nextMin * 100) / 100;
    nextMax = Math.round(nextMax * 100) / 100;

    if (nextMin >= nextMax) {
        nextMin -= rangePad;
        nextMax += rangePad;
    }

    return { min: nextMin, max: nextMax };
}
