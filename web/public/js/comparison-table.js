(function () {
    if (typeof window === 'undefined') {
        return;
    }

    const stateContainer = document.getElementById('comparisonState');
    const stateSections = stateContainer
        ? {
            loading: stateContainer.querySelector('[data-state-loading]'),
            empty: stateContainer.querySelector('[data-state-empty]'),
            error: stateContainer.querySelector('[data-state-error]'),
        }
        : {};
    const stateErrorMessage = stateContainer?.querySelector('[data-state-error-message]') || null;
    const retryButton = stateContainer?.querySelector('[data-state-retry]') || null;

    const table = document.getElementById('comparisonTable');
    const tableBody = document.getElementById('comparisonTableBody');

    const summaryFetchedAtEl = document.querySelector('[data-summary-fetched-at]');
    const summaryTimestampEl = document.querySelector('[data-summary-timestamp]');
    const chartUpdatedAtEl = document.querySelector('[data-chart-updated-at]');

    const refreshButton = document.getElementById('refreshSummaryButton');

    const chartWrapper = document.getElementById('comparisonChartWrapper');
    const chartCanvas = document.getElementById('comparisonChart');
    const chartEmptyState = chartWrapper?.querySelector('[data-chart-empty]') || null;
    const chartUnavailableState = chartWrapper?.querySelector('[data-chart-unavailable]') || null;
    const chartEmptyMessageEl = chartEmptyState?.querySelector('span:nth-of-type(2)') || null;
    const chartUnavailableMessageEl = chartUnavailableState?.querySelector('span:nth-of-type(2)') || null;

    const numberFormatter = new Intl.NumberFormat('id-ID');
    const decimalFormatter = new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const percentFormatter = new Intl.NumberFormat('id-ID', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'long',
        timeStyle: 'short',
    });

    const scopeLabels = {
        'fabric-2': 'Fabric 2',
        'fabric-3': 'Fabric 3',
    };

    function getScopeLabel(scope) {
        if (!scope) {
            return '—';
        }

        return scopeLabels[scope] || scope;
    }

    function toggleSection(element, shouldShow) {
        if (!element) {
            return;
        }
        element.classList.toggle('hidden', !shouldShow);
    }

    function setState(state, options = {}) {
        if (!stateContainer) {
            return;
        }

        if (state === 'ready') {
            stateContainer.classList.add('hidden');
            stateContainer.dataset.state = 'ready';
            Object.values(stateSections).forEach(section => {
                if (section) {
                    section.classList.add('hidden');
                }
            });
            return;
        }

        stateContainer.classList.remove('hidden');
        stateContainer.dataset.state = state;

        Object.entries(stateSections).forEach(([key, section]) => {
            toggleSection(section, key === state);
        });

        if (state === 'error' && stateErrorMessage) {
            const message = options.errorMessage
                ? String(options.errorMessage)
                : 'Gagal memuat ringkasan jaringan.';
            stateErrorMessage.textContent = message;
        }
    }

    function formatCount(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return '0';
        }
        return numberFormatter.format(value);
    }

    function formatLatency(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return '—';
        }
        return `${decimalFormatter.format(value)} ms`;
    }

    function formatSuccessRate(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return '—';
        }
        return percentFormatter.format(Math.max(0, Math.min(value, 1)));
    }

    function formatTimestamp(value) {
        if (!value) {
            return 'Belum ada pembaruan.';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return 'Belum ada pembaruan.';
        }
        return dateTimeFormatter.format(date);
    }

    function formatDuration(value) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            return '—';
        }

        if (value < 1000) {
            return `${decimalFormatter.format(value)} ms`;
        }

        const seconds = value / 1000;
        if (seconds < 60) {
            return `${decimalFormatter.format(seconds)} dtk`;
        }

        const minutes = seconds / 60;
        if (minutes < 60) {
            return `${decimalFormatter.format(minutes)} mnt`;
        }

        const hours = minutes / 60;
        if (hours < 24) {
            return `${decimalFormatter.format(hours)} jam`;
        }

        const days = hours / 24;
        return `${decimalFormatter.format(days)} hari`;
    }

    function formatThroughput(value) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            return '—';
        }
        return `${decimalFormatter.format(value)} tx/detik`;
    }

    function formatByteSize(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return '—';
        }

        if (value === 0) {
            return '0 B';
        }

        if (value < 0) {
            return '—';
        }

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        let normalizedValue = value;

        while (normalizedValue >= 1024 && unitIndex < units.length - 1) {
            normalizedValue /= 1024;
            unitIndex += 1;
        }

        return `${decimalFormatter.format(normalizedValue)} ${units[unitIndex]}`;
    }

    function formatObservationWindow(network) {
        if (!network || typeof network !== 'object') {
            return 'Belum ada data';
        }

        const durationLabel = formatDuration(network.observationDurationMs);
        if (durationLabel === '—') {
            return 'Belum ada data';
        }

        const lastCompletedLabel = formatTimestamp(network.lastCompletedAt);
        const sanitizedLastLabel = lastCompletedLabel === 'Belum ada pembaruan.'
            ? '—'
            : lastCompletedLabel;

        return `${durationLabel} — Terakhir: ${sanitizedLastLabel}`;
    }

    const chartMetrics = [
        {
            key: 'successRate',
            label: 'Rasio sukses',
            direction: 'higher',
            formatter: formatSuccessRate,
        },
        {
            key: 'averageLatencyMs',
            label: 'Latensi rata-rata',
            direction: 'lower',
            formatter: formatLatency,
        },
        {
            key: 'averageCommitTimeMs',
            label: 'Commit rata-rata',
            direction: 'lower',
            formatter: formatLatency,
        },
        {
            key: 'throughput',
            label: 'Throughput (tx/detik)',
            direction: 'higher',
            formatter: formatThroughput,
        },
    ];

    const chartPalette = [
        { background: 'rgba(56, 189, 248, 0.25)', border: 'rgba(56, 189, 248, 0.85)' },
        { background: 'rgba(99, 102, 241, 0.25)', border: 'rgba(99, 102, 241, 0.85)' },
        { background: 'rgba(249, 115, 22, 0.25)', border: 'rgba(249, 115, 22, 0.85)' },
        { background: 'rgba(14, 165, 233, 0.25)', border: 'rgba(14, 165, 233, 0.85)' },
        { background: 'rgba(236, 72, 153, 0.25)', border: 'rgba(236, 72, 153, 0.85)' },
    ];

    let comparisonChartInstance = null;

    function isChartJsAvailable() {
        return typeof window !== 'undefined'
            && typeof window.Chart !== 'undefined'
            && typeof window.Chart === 'function';
    }

    function showChartCanvas(shouldShow) {
        if (chartCanvas) {
            chartCanvas.classList.toggle('hidden', !shouldShow);
        }
    }

    function showChartEmpty(shouldShow, message) {
        if (chartEmptyState) {
            chartEmptyState.classList.toggle('hidden', !shouldShow);
        }
        if (chartEmptyMessageEl && typeof message === 'string') {
            chartEmptyMessageEl.textContent = message;
        }
    }

    function showChartUnavailable(shouldShow, message) {
        if (chartUnavailableState) {
            chartUnavailableState.classList.toggle('hidden', !shouldShow);
        }
        if (chartUnavailableMessageEl && typeof message === 'string') {
            chartUnavailableMessageEl.textContent = message;
        }
    }

    function destroyComparisonChart() {
        if (comparisonChartInstance) {
            comparisonChartInstance.destroy();
            comparisonChartInstance = null;
        }
    }

    function coerceNumeric(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return null;
    }

    function normalizeMetricValues(metric, values) {
        const validValues = values.filter(value => typeof value === 'number' && Number.isFinite(value));

        if (validValues.length === 0) {
            return values.map(() => 0);
        }

        if (metric.direction === 'higher') {
            const max = Math.max(...validValues);
            if (max === 0) {
                return values.map(value => (typeof value === 'number' && Number.isFinite(value) ? 1 : 0));
            }
            return values.map(value => {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return 0;
                }
                return Math.max(0, Math.min(1, value / max));
            });
        }

        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        if (max === min) {
            return values.map(value => (typeof value === 'number' && Number.isFinite(value) ? 1 : 0));
        }

        return values.map(value => {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return 0;
            }

            const ratio = (value - min) / (max - min);
            const normalized = 1 - ratio;
            return Math.max(0, Math.min(1, normalized));
        });
    }

    function formatChartMetricValue(metric, value) {
        if (typeof metric?.formatter === 'function' && typeof value === 'number' && Number.isFinite(value)) {
            return metric.formatter(value);
        }

        if (metric?.key === 'successRate') {
            return formatSuccessRate(value);
        }

        if (metric?.key === 'throughput') {
            return formatThroughput(value);
        }

        return typeof value === 'number' && Number.isFinite(value)
            ? decimalFormatter.format(value)
            : '—';
    }

    function prepareChartData(networks) {
        if (!Array.isArray(networks) || networks.length === 0) {
            return null;
        }

        const metricValuesPerNetwork = networks.map(network => chartMetrics.map(metric => coerceNumeric(network?.[metric.key])));
        const normalizedValuesPerMetric = chartMetrics.map((metric, metricIndex) => {
            const metricValues = metricValuesPerNetwork.map(values => values[metricIndex]).map(value => {
                if (metric.key === 'successRate' && typeof value === 'number' && value > 0 && value <= 1) {
                    return value;
                }
                return typeof value === 'number' && Number.isFinite(value)
                    ? value
                    : null;
            });
            return normalizeMetricValues(metric, metricValues);
        });

        const datasets = networks.map((network, networkIndex) => {
            const palette = chartPalette[networkIndex % chartPalette.length];
            const normalizedValues = normalizedValuesPerMetric.map(values => values[networkIndex]);
            const originalValues = metricValuesPerNetwork[networkIndex];

            return {
                label: network.label || `Jaringan ${networkIndex + 1}`,
                data: normalizedValues,
                originalValues,
                fill: true,
                borderWidth: 2,
                borderColor: palette.border,
                backgroundColor: palette.background,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBorderWidth: 1.5,
                tension: 0.3,
            };
        });

        return {
            labels: chartMetrics.map(metric => metric.label),
            datasets,
        };
    }

    function updateComparisonChart(networks) {
        if (!chartWrapper || !chartCanvas) {
            return;
        }

        if (!Array.isArray(networks) || networks.length === 0) {
            destroyComparisonChart();
            showChartCanvas(false);
            showChartUnavailable(false);
            showChartEmpty(true, 'Belum ada data simulasi yang dapat divisualisasikan.');
            return;
        }

        if (!isChartJsAvailable()) {
            destroyComparisonChart();
            showChartCanvas(false);
            showChartEmpty(false);
            showChartUnavailable(true, 'Chart.js tidak tersedia sehingga grafik perbandingan tidak dapat ditampilkan.');
            return;
        }

        const context = chartCanvas.getContext('2d');
        if (!context) {
            return;
        }

        const preparedData = prepareChartData(networks);

        if (!preparedData || !preparedData.datasets.some(dataset => Array.isArray(dataset.data) && dataset.data.some(value => value > 0))) {
            destroyComparisonChart();
            showChartCanvas(false);
            showChartUnavailable(false);
            showChartEmpty(true, 'Data simulasi belum memiliki metrik yang dapat divisualisasikan.');
            return;
        }

        showChartUnavailable(false);
        showChartEmpty(false);
        showChartCanvas(true);

        if (comparisonChartInstance) {
            comparisonChartInstance.data.labels = preparedData.labels;
            comparisonChartInstance.data.datasets = preparedData.datasets;
            comparisonChartInstance.update();
            return;
        }

        if (typeof window.Chart.defaults === 'object') {
            if (window.Chart.defaults.font) {
                window.Chart.defaults.font.family = 'Inter, sans-serif';
                window.Chart.defaults.font.size = 13;
            }
            window.Chart.defaults.color = '#E2E8F0';
        }

        comparisonChartInstance = new window.Chart(context, {
            type: 'radar',
            data: preparedData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        suggestedMin: 0,
                        suggestedMax: 1,
                        ticks: {
                            stepSize: 0.25,
                            showLabelBackdrop: false,
                            color: 'rgba(226, 232, 240, 0.7)',
                        },
                        angleLines: {
                            color: 'rgba(148, 163, 184, 0.25)',
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.2)',
                        },
                        pointLabels: {
                            color: '#E2E8F0',
                            font: {
                                size: 12,
                            },
                        },
                    },
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const dataset = context?.dataset || {};
                                const metric = chartMetrics[context.dataIndex];
                                const originalValues = Array.isArray(dataset.originalValues)
                                    ? dataset.originalValues
                                    : [];
                                const originalValue = originalValues[context.dataIndex];
                                const formattedValue = formatChartMetricValue(metric, originalValue);
                                return `${dataset.label}: ${formattedValue}`;
                            },
                        },
                    },
                },
            },
        });
    }

    function clearTable() {
        if (tableBody) {
            tableBody.innerHTML = '';
        }
    }

    function renderTable(networks) {
        if (!table || !tableBody) {
            return;
        }

        clearTable();

        if (!Array.isArray(networks) || networks.length === 0) {
            table.classList.add('hidden');
            setState('empty');
            updateComparisonChart([]);
            return;
        }

        networks.forEach((network) => {
            const row = document.createElement('tr');
            row.className = 'transition hover:bg-surfaceMuted/60';

            const blockCount = typeof network.blockCount === 'number'
                ? network.blockCount
                : 0;
            const blockLabel = network.lastBlockLabel || '—';
            const summaryUpdatedLabel = formatTimestamp(network.lastUpdatedAt);
            const blockUpdatedLabelRaw = network.lastBlockUpdatedAt
                ? formatTimestamp(network.lastBlockUpdatedAt)
                : null;
            const blockUpdatedLabel = blockUpdatedLabelRaw
                && blockUpdatedLabelRaw !== summaryUpdatedLabel
                && blockUpdatedLabelRaw !== 'Belum ada pembaruan.'
                ? blockUpdatedLabelRaw
                : null;
            const scopeLabel = getScopeLabel(network.scope);
            const channelLabel = network.channel || '—';
            const dataStatusLabel = network.hasSimulationData === false ? 'Belum ada data' : 'Tersedia';

            row.innerHTML = `
                <td class="px-4 py-3 text-sm font-semibold text-textdark">${network.label || 'Jaringan'}</td>
                <td class="px-4 py-3 text-sm text-textdark/80">${scopeLabel}</td>
                <td class="px-4 py-3 text-sm text-textdark/80">${channelLabel}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-textdark tabular-nums">${formatCount(blockCount)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-textdark tabular-nums">${formatCount(network.totalCount)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-emerald-300 tabular-nums">${formatCount(network.successCount)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-rose-300 tabular-nums">${formatCount(network.failureCount)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-primary">${formatSuccessRate(network.successRate)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-amber-200">${formatLatency(network.averageLatencyMs)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-secondary">${formatLatency(network.averageCommitTimeMs)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-primary">${formatThroughput(network.throughput)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-textdark">${formatByteSize(network.averagePayloadSizeBytes)}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-textdark">${formatByteSize(network.averageResultSizeBytes)}</td>
                <td class="px-4 py-3 text-left text-sm text-textdark/80">${formatObservationWindow(network)}</td>
                <td class="px-4 py-3 text-left text-sm font-semibold text-textdark">${blockLabel}</td>
                <td class="px-4 py-3 text-left text-sm text-textdark/80">${summaryUpdatedLabel}</td>
                <td class="px-4 py-3 text-left text-sm text-textdark/80">${blockUpdatedLabel || '—'}</td>
                <td class="px-4 py-3 text-left text-sm text-textdark/80">${dataStatusLabel}</td>
            `;

            tableBody.appendChild(row);
        });

        table.classList.remove('hidden');
        setState('ready');
        updateComparisonChart(networks);
    }

    function updateSummaryTimestamp(updatedAt) {
        if (!summaryTimestampEl) {
            return;
        }
        summaryTimestampEl.textContent = formatTimestamp(updatedAt);
    }

    function updateChartUpdatedAt(updatedAt) {
        if (!chartUpdatedAtEl) {
            return;
        }

        if (!updatedAt) {
            chartUpdatedAtEl.textContent = 'Belum ada data';
            return;
        }

        const formatted = formatTimestamp(updatedAt);
        chartUpdatedAtEl.textContent = formatted === 'Belum ada pembaruan.'
            ? 'Belum ada data'
            : formatted;
    }

    function updateFetchedAt(timestamp) {
        if (!summaryFetchedAtEl) {
            return;
        }
        if (!timestamp) {
            summaryFetchedAtEl.textContent = 'Belum ada data';
            return;
        }
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
            summaryFetchedAtEl.textContent = 'Belum ada data';
            return;
        }
        summaryFetchedAtEl.textContent = dateTimeFormatter.format(date);
    }

    function setRefreshButtonState(loading) {
        if (!refreshButton) {
            return;
        }
        refreshButton.disabled = !!loading;
        refreshButton.classList.toggle('opacity-60', !!loading);
    }

    let isLoading = false;

    async function loadSummary() {
        if (isLoading) {
            return;
        }
        isLoading = true;
        setRefreshButtonState(true);
        setState('loading');

        try {
            const response = await fetch('/api/simulations/summary', {
                headers: {
                    Accept: 'application/json',
                },
                cache: 'no-store',
            });

            if (!response.ok) {
                const message = `Server mengembalikan status ${response.status}.`;
                throw new Error(message);
            }

            const data = await response.json();

            updateFetchedAt(data?.fetchedAt);
            updateSummaryTimestamp(data?.updatedAt);
            updateChartUpdatedAt(data?.updatedAt);
            renderTable(Array.isArray(data?.networks) ? data.networks : []);
        } catch (error) {
            console.error('Gagal memuat ringkasan simulasi:', error);
            const message = error instanceof Error ? error.message : 'Gagal memuat ringkasan jaringan.';
            clearTable();
            if (table) {
                table.classList.add('hidden');
            }
            updateComparisonChart([]);
            updateChartUpdatedAt(null);
            setState('error', { errorMessage: message });
        } finally {
            setRefreshButtonState(false);
            isLoading = false;
        }
    }

    if (refreshButton) {
        refreshButton.addEventListener('click', (event) => {
            event.preventDefault();
            loadSummary();
        });
    }

    if (retryButton) {
        retryButton.addEventListener('click', (event) => {
            event.preventDefault();
            loadSummary();
        });
    }

    loadSummary();
})();
