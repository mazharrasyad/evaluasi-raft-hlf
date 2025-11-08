const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    const refreshButton = document.getElementById('refreshBlockComparisonButton');
    const updatedAtEl = document.getElementById('blockComparisonUpdatedAt');

    const metricElements = new Map();
    document.querySelectorAll('[data-block-metric-card]').forEach((card) => {
        if (!card || !(card instanceof HTMLElement)) {
            return;
        }

        const metricId = card.dataset.blockMetricCard;
        if (!metricId) {
            return;
        }

        const canvas = card.querySelector('[data-block-metric-canvas]');
        if (!(canvas instanceof HTMLCanvasElement)) {
            return;
        }

        const placeholder = card.querySelector('[data-chart-placeholder]');
        metricElements.set(metricId, {
            container: card,
            canvas,
            placeholder: placeholder instanceof HTMLElement ? placeholder : null,
        });
    });

    if (metricElements.size === 0) {
        return;
    }

    const COLOR_PALETTE = [
        '#38BDF8',
        '#6366F1',
        '#F97316',
        '#F59E0B',
        '#34D399',
        '#A855F7',
        '#F472B6',
        '#22D3EE',
        '#14B8A6',
        '#FACC15',
    ];

    const numberFormatter = new Intl.NumberFormat('id-ID');
    const decimalFormatter = new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
    const percentageFormatter = new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    });
    const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    function clampValue(value, min, max, fallback = null) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : null;
        }

        let clamped = value;

        if (typeof min === 'number' && Number.isFinite(min) && clamped < min) {
            clamped = min;
        }

        if (typeof max === 'number' && Number.isFinite(max) && clamped > max) {
            clamped = max;
        }

        return clamped;
    }

    function formatPercentageValue(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return null;
        }
        return `${percentageFormatter.format(value)}%`;
    }

    function computeBlockResourceUsage(block) {
        if (!block || typeof block !== 'object') {
            return null;
        }

        const throughput = Number.isFinite(block.throughput) ? block.throughput : null;
        const latencyMs = Number.isFinite(block.averageLatencyMs)
            ? block.averageLatencyMs
            : Number.isFinite(block.averageCommitTimeMs)
                ? block.averageCommitTimeMs
                : null;

        const normalizedThroughput = throughput !== null
            ? Math.min(Math.max(throughput / 10, 0), 1)
            : 0;
        const normalizedLatency = latencyMs !== null
            ? Math.min(Math.max(latencyMs / 750, 0), 1)
            : 0.25;

        let usage = 35 + (normalizedThroughput * 45) + (normalizedLatency * 20);

        if (typeof block.failureCount === 'number' && Number.isFinite(block.failureCount) && block.failureCount > 0) {
            usage += Math.min(block.failureCount * 2, 12);
        }

        if (block.lastStatus === 'error') {
            usage += 8;
        } else if (block.lastStatus === 'success') {
            usage -= 3;
        }

        return clampValue(usage, 25, 100, null);
    }

    function computeBlockFaultTolerance(block) {
        if (!block || typeof block !== 'object') {
            return null;
        }

        const successCount = Number.isFinite(block.successCount) ? block.successCount : 0;
        const failureCount = Number.isFinite(block.failureCount) ? block.failureCount : 0;
        const totalCount = Number.isFinite(block.totalCount)
            ? block.totalCount
            : successCount + failureCount;

        const throughput = Number.isFinite(block.throughput) ? block.throughput : null;
        const latencyMs = Number.isFinite(block.averageLatencyMs)
            ? block.averageLatencyMs
            : Number.isFinite(block.averageCommitTimeMs)
                ? block.averageCommitTimeMs
                : null;

        const totalAttempts = Math.max(totalCount, successCount + failureCount, 0);
        const failureRate = totalAttempts > 0
            ? Math.min(Math.max(failureCount / totalAttempts, 0), 1)
            : 0;

        const latencyImpact = latencyMs !== null
            ? Math.min(Math.max(latencyMs / 1000, 0), 1)
            : 0;

        let score = 100
            - (failureRate * 60)
            - (latencyImpact * 20);

        if (block.lastStatus === 'error') {
            score -= 12;
        } else if (block.lastStatus === 'processing') {
            score -= 5;
        }

        if (failureCount === 0 && successCount > 0) {
            score += 5;
        } else if (block.lastStatus === 'success') {
            score += 2;
        }

        if (throughput !== null && throughput > 15) {
            score += 2;
        }

        return clampValue(score, 40, 100, null);
    }

    function formatSuccessRate(block) {
        if (!block || typeof block !== 'object') {
            return null;
        }

        const successCount = Number.isFinite(block.successCount) ? block.successCount : 0;
        const failureCount = Number.isFinite(block.failureCount) ? block.failureCount : 0;
        const totalCount = Number.isFinite(block.totalCount)
            ? block.totalCount
            : successCount + failureCount;

        if (totalCount === 0) {
            return null;
        }

        return formatPercentageValue((successCount / totalCount) * 100);
    }

    function resolveBlockLatencyMs(block) {
        if (!block || typeof block !== 'object') {
            return null;
        }

        const candidates = [
            block.averageCommitTimeMs,
            block.averageLatencyMs,
        ];

        for (let index = 0; index < candidates.length; index += 1) {
            const value = candidates[index];
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value;
            }
        }

        return null;
    }

    let isLoading = false;
    const chartInstances = new Map();

    const BLOCK_METRICS = [
        {
            id: 'throughput',
            loadingMessage: 'Menyiapkan grafik throughput blok...',
            emptyMessage: 'Belum ada data throughput blok yang dapat divisualisasikan.',
            valueResolver(block) {
                if (!block || typeof block.throughput !== 'number') {
                    return null;
                }
                return Number.isFinite(block.throughput) ? block.throughput : null;
            },
            tickFormatter(value) {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return '';
                }
                return `${decimalFormatter.format(value)} tps`;
            },
            valueFormatter(value) {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return 'Tidak ada data';
                }
                return `${decimalFormatter.format(value)} transaksi/detik`;
            },
            tooltipExtras({ block }) {
                if (!block || typeof block !== 'object') {
                    return [];
                }

                const extras = [];
                if (Number.isFinite(block.successCount)) {
                    extras.push(`Berhasil: ${numberFormatter.format(block.successCount)}`);
                }
                if (Number.isFinite(block.failureCount) && block.failureCount > 0) {
                    extras.push(`Gagal: ${numberFormatter.format(block.failureCount)}`);
                }
                const latencyMs = resolveBlockLatencyMs(block);
                if (latencyMs !== null) {
                    extras.push(`Latency: ${decimalFormatter.format(latencyMs)} ms`);
                }
                return extras;
            },
        },
        {
            id: 'latency',
            loadingMessage: 'Menyiapkan grafik latensi blok...',
            emptyMessage: 'Belum ada data latensi blok yang dapat divisualisasikan.',
            valueResolver(block) {
                const latency = resolveBlockLatencyMs(block);
                return typeof latency === 'number' && Number.isFinite(latency) ? latency : null;
            },
            tickFormatter(value) {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return '';
                }
                return `${numberFormatter.format(Math.round(value))} ms`;
            },
            valueFormatter(value) {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return 'Tidak ada data';
                }
                return `${decimalFormatter.format(value)} ms`;
            },
            tooltipExtras({ block }) {
                if (!block || typeof block !== 'object') {
                    return [];
                }

                const extras = [];
                if (Number.isFinite(block.successCount)) {
                    extras.push(`Berhasil: ${numberFormatter.format(block.successCount)}`);
                }
                if (Number.isFinite(block.failureCount) && block.failureCount > 0) {
                    extras.push(`Gagal: ${numberFormatter.format(block.failureCount)}`);
                }
                if (Number.isFinite(block.throughput)) {
                    extras.push(`Throughput: ${decimalFormatter.format(block.throughput)} tps`);
                }
                return extras;
            },
        },
        {
            id: 'resourceUsage',
            loadingMessage: 'Menyiapkan grafik resource usage blok...',
            emptyMessage: 'Belum ada estimasi resource usage yang dapat divisualisasikan.',
            valueResolver(block) {
                const usage = computeBlockResourceUsage(block);
                return typeof usage === 'number' && Number.isFinite(usage) ? usage : null;
            },
            tickFormatter(value) {
                const label = formatPercentageValue(value);
                return label || '';
            },
            valueFormatter(value) {
                const label = formatPercentageValue(value);
                return label || 'Tidak ada data';
            },
            tooltipExtras({ block }) {
                if (!block || typeof block !== 'object') {
                    return [];
                }

                const extras = [];
                if (Number.isFinite(block.throughput)) {
                    extras.push(`Throughput: ${decimalFormatter.format(block.throughput)} tps`);
                }
                const latencyMs = resolveBlockLatencyMs(block);
                if (latencyMs !== null) {
                    extras.push(`Latency: ${decimalFormatter.format(latencyMs)} ms`);
                }
                const successRate = formatSuccessRate(block);
                if (successRate) {
                    extras.push(`Success rate: ${successRate}`);
                }
                return extras;
            },
        },
        {
            id: 'faultTolerance',
            loadingMessage: 'Menyiapkan grafik fault tolerance blok...',
            emptyMessage: 'Belum ada skor fault tolerance yang dapat divisualisasikan.',
            valueResolver(block) {
                const score = computeBlockFaultTolerance(block);
                return typeof score === 'number' && Number.isFinite(score) ? score : null;
            },
            tickFormatter(value) {
                const label = formatPercentageValue(value);
                return label || '';
            },
            valueFormatter(value) {
                const label = formatPercentageValue(value);
                return label || 'Tidak ada data';
            },
            tooltipExtras({ block }) {
                if (!block || typeof block !== 'object') {
                    return [];
                }

                const extras = [];
                if (Number.isFinite(block.successCount)) {
                    extras.push(`Berhasil: ${numberFormatter.format(block.successCount)}`);
                }
                if (Number.isFinite(block.failureCount) && block.failureCount > 0) {
                    extras.push(`Gagal: ${numberFormatter.format(block.failureCount)}`);
                }
                const successRate = formatSuccessRate(block);
                if (successRate) {
                    extras.push(`Success rate: ${successRate}`);
                }
                if (block.lastStatus) {
                    extras.push(`Status terakhir: ${String(block.lastStatus).toUpperCase()}`);
                }
                return extras;
            },
        },
    ];

    function isChartJsAvailable() {
        return typeof window !== 'undefined'
            && typeof window.Chart !== 'undefined';
    }

    if (isChartJsAvailable()) {
        window.Chart.defaults.font.family = 'Inter, sans-serif';
        window.Chart.defaults.color = '#E2E8F0';
        window.Chart.defaults.font.size = 13;
        window.Chart.defaults.plugins.legend.labels.usePointStyle = true;
    }

    function updateChartPlaceholderTone(placeholder, tone = 'info') {
        if (!placeholder) {
            return;
        }

        placeholder.classList.remove('text-textdark/70', 'text-rose-200', 'text-amber-200');
        placeholder.classList.remove('bg-surface/70', 'bg-rose-500/20', 'bg-amber-500/10');

        if (tone === 'error') {
            placeholder.classList.add('bg-rose-500/20', 'text-rose-200');
        } else if (tone === 'empty') {
            placeholder.classList.add('bg-amber-500/10', 'text-amber-200');
        } else {
            placeholder.classList.add('bg-surface/70', 'text-textdark/70');
        }
    }

    function setChartLoading(container, message) {
        if (!container) {
            return;
        }

        container.dataset.state = 'loading';
        const placeholder = container.querySelector('[data-chart-placeholder]');
        if (placeholder) {
            updateChartPlaceholderTone(placeholder, 'info');
            placeholder.textContent = message;
            placeholder.classList.remove('hidden');
        }

        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.classList.add('hidden');
        }
    }

    function setChartMessage(container, message, tone = 'info') {
        if (!container) {
            return;
        }

        container.dataset.state = tone;
        const placeholder = container.querySelector('[data-chart-placeholder]');
        if (placeholder) {
            updateChartPlaceholderTone(placeholder, tone);
            placeholder.textContent = message;
            placeholder.classList.remove('hidden');
        }

        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.classList.add('hidden');
        }
    }

    function setChartReady(container) {
        if (!container) {
            return;
        }

        container.dataset.state = 'ready';
        const placeholder = container.querySelector('[data-chart-placeholder]');
        if (placeholder) {
            placeholder.classList.add('hidden');
        }

        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.classList.remove('hidden');
        }
    }

    function hexToRgba(hex, alpha = 0.25) {
        if (typeof hex !== 'string') {
            return `rgba(56, 189, 248, ${alpha})`;
        }

        const normalized = hex.replace('#', '');
        if (normalized.length !== 6) {
            return `rgba(56, 189, 248, ${alpha})`;
        }

        const r = Number.parseInt(normalized.slice(0, 2), 16);
        const g = Number.parseInt(normalized.slice(2, 4), 16);
        const b = Number.parseInt(normalized.slice(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function formatDateTime(value) {
        if (!value) {
            return null;
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        try {
            return dateTimeFormatter.format(date);
        } catch (error) {
            console.error('Gagal memformat tanggal untuk perbandingan blok:', error);
            return null;
        }
    }

    function setUpdatedAtLabel(value) {
        if (!updatedAtEl) {
            return;
        }

        const formatted = formatDateTime(value);
        updatedAtEl.textContent = formatted ? `Terakhir diperbarui: ${formatted}` : '';
    }

    function resolveBlockLabel(block) {
        if (!block || typeof block !== 'object') {
            return null;
        }

        if (typeof block.label === 'string' && block.label.trim() !== '') {
            return block.label.trim();
        }

        if (typeof block.blockLabel === 'string' && block.blockLabel.trim() !== '') {
            return block.blockLabel.trim();
        }

        if (block.blockNumber !== undefined && block.blockNumber !== null) {
            return `#${block.blockNumber}`;
        }

        return null;
    }

    function resolveBlockNumber(block) {
        if (!block || typeof block !== 'object') {
            return null;
        }

        const { blockNumber, blockLabel } = block;

        if (typeof blockNumber === 'number' && Number.isFinite(blockNumber)) {
            return blockNumber;
        }

        if (typeof blockNumber === 'string') {
            const parsed = Number.parseInt(blockNumber, 10);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        if (typeof blockLabel === 'string') {
            const match = blockLabel.match(/-?\d+/);
            if (match) {
                const parsed = Number.parseInt(match[0], 10);
                if (Number.isFinite(parsed)) {
                    return parsed;
                }
            }
        }

        return null;
    }

    function getRelevantBlocks(network, limit = 12) {
        if (!network || typeof network !== 'object') {
            return [];
        }

        const blocks = Array.isArray(network.blocks) ? network.blocks : [];
        if (!limit || blocks.length <= limit) {
            return blocks.slice();
        }

        return blocks.slice(-limit);
    }

    function buildBlockAxisLabels(blocksPerNetwork, limit = 12) {
        const labelMap = new Map();

        blocksPerNetwork.forEach((blocks) => {
            blocks.forEach((block) => {
                const label = resolveBlockLabel(block);
                if (!label) {
                    return;
                }

                const number = resolveBlockNumber(block);
                if (!labelMap.has(label)) {
                    labelMap.set(label, { label, number });
                    return;
                }

                const current = labelMap.get(label);
                if (current && (current.number === null || current.number === undefined) && number !== null) {
                    labelMap.set(label, { label, number });
                }
            });
        });

        const sorted = Array.from(labelMap.values()).sort((a, b) => {
            const aNumber = typeof a.number === 'number' && Number.isFinite(a.number) ? a.number : null;
            const bNumber = typeof b.number === 'number' && Number.isFinite(b.number) ? b.number : null;

            if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
                return aNumber - bNumber;
            }

            if (aNumber !== null) {
                return -1;
            }

            if (bNumber !== null) {
                return 1;
            }

            return a.label.localeCompare(b.label);
        });

        const trimmed = typeof limit === 'number' && limit > 0
            ? sorted.slice(-limit)
            : sorted;

        return trimmed.map((entry) => entry.label);
    }

    function destroyMetricChart(metricId) {
        if (!chartInstances.has(metricId)) {
            return;
        }

        const instance = chartInstances.get(metricId);
        if (instance) {
            instance.destroy();
        }

        chartInstances.delete(metricId);
    }

    function destroyAllMetricCharts() {
        chartInstances.forEach((instance) => {
            if (instance) {
                instance.destroy();
            }
        });
        chartInstances.clear();
    }

    function getMetricElements(metricId) {
        return metricElements.get(metricId) || null;
    }

    function createBlockRenderContext(blocksPerNetwork) {
        let earliestTimestamp = null;

        blocksPerNetwork.forEach((blocks) => {
            (blocks || []).forEach((block) => {
                if (!block || !block.lastUpdatedAt) {
                    return;
                }

                const timestamp = Date.parse(block.lastUpdatedAt);
                if (!Number.isFinite(timestamp)) {
                    return;
                }

                if (earliestTimestamp === null || timestamp < earliestTimestamp) {
                    earliestTimestamp = timestamp;
                }
            });
        });

        return {
            earliestBlockTimestamp: earliestTimestamp,
        };
    }

    function formatMetricTooltip(metric, context, renderContext) {
        const datasetLabel = context.dataset.label || '';
        const value = typeof context.parsed.y === 'number' && Number.isFinite(context.parsed.y)
            ? context.parsed.y
            : null;
        const lookup = context.dataset.metaBlockLookup;
        const block = lookup instanceof Map ? lookup.get(context.label) : null;

        const formattedValue = metric.valueFormatter
            ? metric.valueFormatter(value)
            : (value !== null ? numberFormatter.format(value) : 'Tidak ada data');

        const baseLabel = datasetLabel
            ? `${datasetLabel}: ${formattedValue}`
            : formattedValue;

        const extras = typeof metric.tooltipExtras === 'function'
            ? metric.tooltipExtras({
                block,
                rawValue: value,
                formattedValue,
                renderContext,
                context,
            })
            : [];

        if (Array.isArray(extras) && extras.length > 0) {
            return [baseLabel, ...extras.filter((entry) => typeof entry === 'string' && entry.trim() !== '')];
        }

        return baseLabel;
    }

    function buildTooltipFooter(metric, items, renderContext) {
        if (typeof metric.tooltipFooter === 'function') {
            return metric.tooltipFooter(items, renderContext) || '';
        }

        if (!items || items.length === 0) {
            return '';
        }

        const item = items[0];
        const lookup = item.dataset.metaBlockLookup;
        const block = lookup instanceof Map ? lookup.get(item.label) : null;

        if (block && block.lastUpdatedAt) {
            const formatted = formatDateTime(block.lastUpdatedAt);
            if (formatted) {
                return `Terakhir diperbarui: ${formatted}`;
            }
        }

        return '';
    }

    function renderMetricChart(metric, networksWithBlocks, blocksPerNetwork, axisLabels, renderContext) {
        const elements = getMetricElements(metric.id);
        if (!elements) {
            return;
        }

        destroyMetricChart(metric.id);

        const datasets = networksWithBlocks.map((network, index) => {
            const relevantBlocks = blocksPerNetwork[index] || [];
            const blockLookup = new Map();

            relevantBlocks.forEach((block) => {
                const label = resolveBlockLabel(block);
                if (label) {
                    blockLookup.set(label, block);
                }
            });

            const data = axisLabels.map((label) => {
                const block = blockLookup.get(label);
                if (!block) {
                    return null;
                }

                const value = metric.valueResolver(block, renderContext);
                if (value === 0) {
                    return 0;
                }

                return typeof value === 'number' && Number.isFinite(value)
                    ? value
                    : null;
            });

            if (!data.some((entry) => entry !== null)) {
                return null;
            }

            const color = COLOR_PALETTE[index % COLOR_PALETTE.length];

            return {
                label: network.label || network.id || `Jaringan ${index + 1}`,
                data,
                backgroundColor: hexToRgba(color, 0.45),
                borderColor: color,
                borderWidth: 1.5,
                borderRadius: 6,
                maxBarThickness: 32,
                metaBlockLookup: blockLookup,
            };
        }).filter(Boolean);

        if (datasets.length === 0) {
            setChartMessage(elements.container, metric.emptyMessage, 'empty');
            return;
        }

        setChartReady(elements.container);

        const context = elements.canvas.getContext('2d');
        if (!context) {
            setChartMessage(elements.container, 'Kanvas grafik tidak tersedia.', 'error');
            return;
        }

        const yTickFormatter = typeof metric.tickFormatter === 'function'
            ? metric.tickFormatter
            : (value) => numberFormatter.format(value);

        const chart = new window.Chart(context, {
            type: 'bar',
            data: {
                labels: axisLabels,
                datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#94A3B8',
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.12)',
                        },
                        stacked: false,
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#94A3B8',
                            callback(value) {
                                return yTickFormatter(value);
                            },
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.12)',
                        },
                    },
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#E2E8F0',
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return formatMetricTooltip(metric, context, renderContext);
                            },
                            footer(items) {
                                return buildTooltipFooter(metric, items, renderContext);
                            },
                        },
                    },
                },
            },
        });

        chartInstances.set(metric.id, chart);
    }

    function renderBlockMetricCharts(networks) {
        destroyAllMetricCharts();

        const networksWithBlocks = Array.isArray(networks)
            ? networks.filter((network) => Array.isArray(network?.blocks) && network.blocks.length > 0)
            : [];

        if (networksWithBlocks.length === 0) {
            BLOCK_METRICS.forEach((metric) => {
                const elements = getMetricElements(metric.id);
                if (elements) {
                    setChartMessage(elements.container, metric.emptyMessage, 'empty');
                }
            });
            return;
        }

        if (!isChartJsAvailable()) {
            BLOCK_METRICS.forEach((metric) => {
                const elements = getMetricElements(metric.id);
                if (elements) {
                    setChartMessage(elements.container, 'Chart.js tidak tersedia untuk menampilkan grafik.', 'error');
                }
            });
            return;
        }

        const BLOCK_LIMIT = 24;
        const blocksPerNetwork = networksWithBlocks.map((network) => getRelevantBlocks(network, BLOCK_LIMIT * 2));
        const axisLabels = buildBlockAxisLabels(blocksPerNetwork, BLOCK_LIMIT);

        if (axisLabels.length === 0) {
            BLOCK_METRICS.forEach((metric) => {
                const elements = getMetricElements(metric.id);
                if (elements) {
                    setChartMessage(elements.container, metric.emptyMessage, 'empty');
                }
            });
            return;
        }

        const renderContext = createBlockRenderContext(blocksPerNetwork);

        BLOCK_METRICS.forEach((metric) => {
            renderMetricChart(metric, networksWithBlocks, blocksPerNetwork, axisLabels, renderContext);
        });
    }

    function setAllChartsLoading() {
        BLOCK_METRICS.forEach((metric) => {
            const elements = getMetricElements(metric.id);
            if (elements) {
                setChartLoading(elements.container, metric.loadingMessage);
            }
        });
    }

    function setAllChartsMessage(message, tone = 'info') {
        BLOCK_METRICS.forEach((metric) => {
            const elements = getMetricElements(metric.id);
            if (elements) {
                setChartMessage(elements.container, typeof message === 'function' ? message(metric) : message, tone);
            }
        });
    }

    async function loadBlockComparisonData() {
        if (isLoading) {
            return;
        }

        isLoading = true;
        setAllChartsLoading();
        setUpdatedAtLabel(null);

        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.classList.add('opacity-60', 'cursor-wait');
        }

        try {
            const response = await fetch('/api/simulations/summary', {
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Gagal mengambil data blok (status ${response.status})`);
            }

            const payload = await response.json();
            const networks = Array.isArray(payload?.networks) ? payload.networks : [];

            renderBlockMetricCharts(networks);
            setUpdatedAtLabel(payload?.updatedAt || payload?.fetchedAt || null);
        } catch (error) {
            console.error('Gagal memuat data perbandingan blok jaringan:', error);
            setAllChartsMessage('Tidak dapat memuat grafik perbandingan blok.', 'error');
        } finally {
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.classList.remove('opacity-60', 'cursor-wait');
            }
            isLoading = false;
        }
    }

    if (refreshButton) {
        refreshButton.addEventListener('click', (event) => {
            event.preventDefault();
            loadBlockComparisonData();
        });
    }

    loadBlockComparisonData();
});
