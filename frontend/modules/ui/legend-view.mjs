import { TANK_LETTERS } from '../config.mjs';
import { isLightTheme, getSeriesStrokeForTheme } from '../theme.mjs';

function createLegendItem(meta, isVisible, seriesIndex) {
    const displayColor = getSeriesStrokeForTheme(meta.stroke);
    const itemEl = document.createElement('div');
    itemEl.className = `legend-item${isVisible ? ' active' : ''}`;
    itemEl.dataset.seriesIndex = String(seriesIndex);
    itemEl.setAttribute('role', 'button');
    itemEl.tabIndex = 0;
    itemEl.style.setProperty('--tank-color', displayColor);

    const colorSwatchEl = document.createElement('span');
    colorSwatchEl.style.cssText = `
        display:inline-block;
        width:8px;
        height:8px;
        flex-shrink:0;
        background:${displayColor};
        border-radius:2px;
        opacity:${isVisible ? 1 : (isLightTheme() ? 0.55 : 0.3)};
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = meta.legendLabel;

    itemEl.append(colorSwatchEl, labelEl);
    return itemEl;
}

export function createLegendView({ containerEl, onToggleSeries }) {
    const handleActivation = event => {
        const targetEl = event.target.closest('[data-series-index]');
        if (!targetEl || !containerEl.contains(targetEl)) {
            return;
        }

        const seriesIndex = Number.parseInt(targetEl.dataset.seriesIndex ?? '-1', 10);
        if (seriesIndex >= 0) {
            onToggleSeries(seriesIndex);
        }
    };

    containerEl?.addEventListener('click', handleActivation);
    containerEl?.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        const targetEl = event.target.closest('[data-series-index]');
        if (!targetEl || !containerEl.contains(targetEl)) {
            return;
        }

        event.preventDefault();
        handleActivation(event);
    });

    function render(state) {
        if (!containerEl) {
            return;
        }

        containerEl.textContent = '';
        if (!state.dataset.seriesMeta.length) {
            return;
        }

        const fragment = document.createDocumentFragment();

        TANK_LETTERS.forEach(letter => {
            const groupEl = document.createElement('div');
            groupEl.className = 'legend-letter-group';

            const headerEl = document.createElement('div');
            headerEl.className = 'legend-letter-header';
            headerEl.textContent = `Tank ${letter}`;
            groupEl.appendChild(headerEl);

            const gridEl = document.createElement('div');
            gridEl.className = 'legend-tank-grid';

            state.dataset.seriesMeta.forEach((meta, seriesIndex) => {
                if (meta.letter !== letter) {
                    return;
                }

                gridEl.appendChild(
                    createLegendItem(meta, state.dataset.seriesVisible[seriesIndex], seriesIndex),
                );
            });

            groupEl.appendChild(gridEl);
            fragment.appendChild(groupEl);
        });

        containerEl.appendChild(fragment);
    }

    return { render };
}
