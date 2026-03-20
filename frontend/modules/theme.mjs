function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function parseHexColor(color) {
    if (typeof color !== 'string') {
        return null;
    }

    const normalized = color.trim();
    if (!normalized.startsWith('#')) {
        return null;
    }

    const hex = normalized.slice(1);
    if (hex.length === 3) {
        const r = Number.parseInt(hex[0] + hex[0], 16);
        const g = Number.parseInt(hex[1] + hex[1], 16);
        const b = Number.parseInt(hex[2] + hex[2], 16);
        return [r, g, b];
    }

    if (hex.length === 6) {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return [r, g, b];
    }

    return null;
}

function rgbToHsl(red, green, blue) {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;

    if (max === min) {
        return [0, 0, lightness];
    }

    const delta = max - min;
    const saturation = lightness > 0.5
        ? delta / (2 - max - min)
        : delta / (max + min);

    let hue;
    switch (max) {
        case r:
            hue = (g - b) / delta + (g < b ? 6 : 0);
            break;
        case g:
            hue = (b - r) / delta + 2;
            break;
        default:
            hue = (r - g) / delta + 4;
            break;
    }

    return [hue / 6, saturation, lightness];
}

function hslToRgb(hue, saturation, lightness) {
    if (saturation === 0) {
        const gray = Math.round(lightness * 255);
        return [gray, gray, gray];
    }

    const q = lightness < 0.5
        ? lightness * (1 + saturation)
        : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;

    const hueToChannel = t => {
        let channelHue = t;
        if (channelHue < 0) {
            channelHue += 1;
        }
        if (channelHue > 1) {
            channelHue -= 1;
        }
        if (channelHue < 1 / 6) {
            return p + (q - p) * 6 * channelHue;
        }
        if (channelHue < 1 / 2) {
            return q;
        }
        if (channelHue < 2 / 3) {
            return p + (q - p) * (2 / 3 - channelHue) * 6;
        }
        return p;
    };

    const r = Math.round(hueToChannel(hue + 1 / 3) * 255);
    const g = Math.round(hueToChannel(hue) * 255);
    const b = Math.round(hueToChannel(hue - 1 / 3) * 255);
    return [r, g, b];
}

function rgbToHex(red, green, blue) {
    const toHex = channel => channel.toString(16).padStart(2, '0');
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

export function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function isLightTheme() {
    return getCurrentTheme() === 'light';
}

export function getCssColorVar(variableName, fallbackColor) {
    const resolved = getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim();

    return resolved || fallbackColor;
}

export function getSeriesStrokeForTheme(baseColor) {
    if (!isLightTheme()) {
        return baseColor;
    }

    const rgb = parseHexColor(baseColor);
    if (!rgb) {
        return baseColor;
    }

    const [hue, saturation, lightness] = rgbToHsl(...rgb);
    const adjustedSaturation = clamp(Math.max(saturation, 0.62), 0, 1);
    const adjustedLightness = clamp(Math.min(lightness * 0.74, 0.45), 0.18, 0.45);
    const [red, green, blue] = hslToRgb(hue, adjustedSaturation, adjustedLightness);

    return rgbToHex(red, green, blue);
}