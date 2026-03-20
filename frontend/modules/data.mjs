import { STAT_PERCENTILES, TANK_SERIES } from './config.mjs';

const BACKEND_TIMESTAMP_PATTERN =
    /^(?<month>\d{2})\/(?<day>\d{2})\/(?<year>\d{4}) (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NICE_TIME_INTERVALS_MINUTES = [
    1, 2, 5, 10, 15, 20, 30,
    60, 120, 180, 240, 360, 480, 720,
    1440, 2880, 4320, 7200, 10080,
    20160, 43200,
];

export function getTodayIsoDate(now = new Date()) {
    return now.toISOString().split('T')[0];
}

export function validateDateRange(startDate, endDate, todayIso = getTodayIsoDate()) {
    if (!startDate || !endDate) {
        return 'Start date and end date are required.';
    }
    if (endDate > todayIso) {
        return 'End date cannot be later than today.';
    }
    if (endDate < startDate) {
        return 'End date must be after the start date.';
    }
    return null;
}

export function parseBackendTimestamp(value) {
    if (typeof value !== 'string') {
        throw new TypeError(`Expected backend timestamp string, received ${typeof value}.`);
    }

    const match = value.match(BACKEND_TIMESTAMP_PATTERN);
    if (!match?.groups) {
        throw new Error(`Invalid backend timestamp: ${value}`);
    }

    const year = Number(match.groups.year);
    const month = Number(match.groups.month);
    const day = Number(match.groups.day);
    const hour = Number(match.groups.hour);
    const minute = Number(match.groups.minute);
    const second = Number(match.groups.second);
    const date = new Date(year, month - 1, day, hour, minute, second);

    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second
    ) {
        throw new Error(`Invalid backend timestamp: ${value}`);
    }

    return date;
}

export function toUnixSeconds(value) {
    return parseBackendTimestamp(value).getTime() / 1000;
}

function normalizeNumericValue(value) {
    if (value == null || value === '') {
        return Number.NaN;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
}

export function transformApiResult(rows) {
    if (!Array.isArray(rows)) {
        throw new TypeError('Expected an array of API result rows.');
    }

    const rowCount = rows.length;
    const labels = new Array(rowCount);
    const timestamps = new Float64Array(rowCount);
    const seriesData = TANK_SERIES.map(() => new Float64Array(rowCount));

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = rows[rowIndex] ?? {};
        const label = row['Date-Time'];
        labels[rowIndex] = label;
        timestamps[rowIndex] = toUnixSeconds(label);

        for (let seriesIndex = 0; seriesIndex < TANK_SERIES.length; seriesIndex += 1) {
            const series = TANK_SERIES[seriesIndex];
            seriesData[seriesIndex][rowIndex] = normalizeNumericValue(row[series.sourceKey]);
        }
    }

    return {
        labels,
        timestamps,
        seriesData,
        seriesMeta: TANK_SERIES.map(({ sourceKey, ...meta }) => ({ ...meta })),
        seriesVisible: new Array(TANK_SERIES.length).fill(false),
    };
}

export function getClosestIndexForUnixSeconds(timestamps, targetSeconds) {
    if (!timestamps?.length) {
        return -1;
    }

    let low = 0;
    let high = timestamps.length - 1;

    while (low < high) {
        const mid = (low + high) >> 1;
        if (timestamps[mid] < targetSeconds) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    if (low > 0) {
        const highDistance = Math.abs(timestamps[low] - targetSeconds);
        const lowDistance = Math.abs(timestamps[low - 1] - targetSeconds);
        if (lowDistance < highDistance) {
            return low - 1;
        }
    }

    return low;
}

export function cleanFloat(value) {
    return Number.parseFloat(value.toPrecision(12));
}

export function calcTimeStepSize(minSeconds, maxSeconds, pixelWidth) {
    const targetStepPixels = 100;
    const durationMinutes = (maxSeconds - minSeconds) / 60;

    if (durationMinutes <= 0 || pixelWidth <= 0) {
        return 1;
    }

    const approximateStepMinutes = durationMinutes / (pixelWidth / targetStepPixels);
    for (const intervalMinutes of NICE_TIME_INTERVALS_MINUTES) {
        if (intervalMinutes >= approximateStepMinutes) {
            return intervalMinutes;
        }
    }

    return NICE_TIME_INTERVALS_MINUTES[NICE_TIME_INTERVALS_MINUTES.length - 1];
}

export function formatTimeAxisLabel(unixSeconds, stepMinutes) {
    const date = new Date(unixSeconds * 1000);
    const month = MONTHS[date.getMonth()];
    const day = date.getDate();
    let hours = date.getHours();
    const amPm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    if (stepMinutes >= 1440) {
        return `${month} ${day}`;
    }

    if (stepMinutes >= 60) {
        return `${month} ${day}, ${hours}${amPm}`;
    }

    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${hours}:${minutes}${amPm}`;
}

export function getXAxisTicks(minSeconds, maxSeconds, pixelWidth) {
    if (pixelWidth <= 0 || maxSeconds <= minSeconds) {
        return [];
    }
    
    const stepMinutes = calcTimeStepSize(minSeconds, maxSeconds, pixelWidth);
    const stepSeconds = stepMinutes * 60;
    const ticks = [];
    let stepPositionSeconds = Math.ceil(cleanFloat(minSeconds / stepSeconds)) * stepSeconds;
    let iterations = 0;

    while (iterations < 2000 && stepPositionSeconds <= maxSeconds) {
        ticks.push({
            value: stepPositionSeconds,
            label: formatTimeAxisLabel(stepPositionSeconds, stepMinutes),
        });
        stepPositionSeconds = cleanFloat(stepPositionSeconds + stepSeconds);
        iterations += 1;
    }

    return ticks;
}

export function formatTooltipTime(unixSeconds) {
    const date = new Date(unixSeconds * 1000);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const amPm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${amPm}`;
}

export function formatDurationBetweenSeconds(startSeconds, endSeconds) {
    const totalSeconds = Math.abs(Math.round(endSeconds - startSeconds));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];

    if (days) {
        parts.push(`${days}d`);
    }
    if (hours) {
        parts.push(`${hours}h`);
    }
    if (minutes) {
        parts.push(`${minutes}m`);
    }
    parts.push(`${seconds}s`);

    return parts.join(' ');
}

export function formatAxisTemperature(value, unit) {
    if (value == null || Number.isNaN(value)) {
        return '';
    }

    return `${Number(value).toFixed(1)}° ${unit}`;
}

export function getStatPercentiles() {
    return STAT_PERCENTILES;
}
