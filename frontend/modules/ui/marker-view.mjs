import { formatDurationBetweenSeconds, formatTimeAxisLabel } from '../data.mjs';
import { getSeriesStrokeForTheme } from '../theme.mjs';

function buildMarkerSection(state, marker, dotClassName, dimmed = false) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'marker-section';
    if (dimmed) {
        sectionEl.style.opacity = '0.5';
    }

    const headerEl = document.createElement('div');
    headerEl.className = 'marker-header';

    const dotEl = document.createElement('span');
    dotEl.className = `marker-dot ${dotClassName}`;

    const timeEl = document.createElement('span');
    timeEl.className = 'marker-time';
    timeEl.textContent = formatTimeAxisLabel(
        state.dataset.timestamps[marker.labelIndex],
        1,
    );

    headerEl.append(dotEl, timeEl);
    sectionEl.appendChild(headerEl);

    const valuesEl = document.createElement('div');
    valuesEl.className = 'marker-values';

    state.dataset.seriesData.forEach((seriesValues, seriesIndex) => {
        if (!state.dataset.seriesVisible[seriesIndex]) {
            return;
        }

        const value = seriesValues[marker.labelIndex];
        if (!Number.isFinite(value)) {
            return;
        }

        const chipEl = document.createElement('span');
        chipEl.className = 'marker-chip';
        chipEl.style.color = getSeriesStrokeForTheme(state.dataset.seriesMeta[seriesIndex].stroke);
        chipEl.textContent = `${value.toFixed(2)} °C`;
        valuesEl.appendChild(chipEl);
    });

    if (valuesEl.childNodes.length > 0) {
        sectionEl.appendChild(valuesEl);
    }

    return sectionEl;
}

function buildDeltaElement(deltaText, dimmed = false) {
    const deltaEl = document.createElement('div');
    deltaEl.className = 'marker-info marker-delta';
    if (dimmed) {
        deltaEl.style.opacity = '0.5';
    }

    const labelEl = document.createElement('span');
    labelEl.textContent = 'Δt: ';
    const valueEl = document.createElement('span');
    valueEl.textContent = deltaText;

    deltaEl.append(labelEl, valueEl);
    return deltaEl;
}

export function createMarkerView({ barEl, contentEl }) {
    function render(state) {
        if (!barEl || !contentEl) {
            return;
        }

        const { a: markerA, b: markerB, previewIndex } = state.markers;
        if (!markerA) {
            barEl.style.display = 'none';
            contentEl.textContent = '';
            return;
        }

        const fragment = document.createDocumentFragment();
        fragment.appendChild(buildMarkerSection(state, markerA, 'marker-a'));

        if (markerB) {
            fragment.appendChild(buildMarkerSection(state, markerB, 'marker-b'));
            fragment.appendChild(
                buildDeltaElement(
                    formatDurationBetweenSeconds(
                        state.dataset.timestamps[markerA.labelIndex],
                        state.dataset.timestamps[markerB.labelIndex],
                    ),
                ),
            );
        } else {
            const previewTimestamp = state.dataset.timestamps[previewIndex];
            if (
                previewIndex >= 0 &&
                previewIndex < state.dataset.timestamps.length &&
                Number.isFinite(previewTimestamp)
            ) {
                fragment.appendChild(
                    buildMarkerSection(state, { labelIndex: previewIndex }, 'marker-b', true),
                );
                fragment.appendChild(
                    buildDeltaElement(
                        formatDurationBetweenSeconds(
                            state.dataset.timestamps[markerA.labelIndex],
                            previewTimestamp,
                        ),
                        true,
                    ),
                );
            }
        }

        barEl.style.display = 'flex';
        contentEl.textContent = '';
        contentEl.appendChild(fragment);
    }

    return { render };
}
