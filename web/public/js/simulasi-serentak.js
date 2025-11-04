const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    const form = document.getElementById('broadcastSimulationForm');
    const countInput = document.getElementById('simulationBatchCount');
    const submitButton = document.getElementById('broadcastSubmitButton');
    const statusEl = document.getElementById('broadcastStatus');
    const statusIndicator = statusEl
        ? statusEl.querySelector('[data-status-indicator]')
        : null;
    const statusMessage = statusEl
        ? statusEl.querySelector('[data-status-message]')
        : null;
    const resultsContainer = document.getElementById('broadcastResults');
    const updatedAtEl = document.getElementById('realtimeUpdatedAt');
    const snapshotContainer = document.getElementById('networkSnapshot');
    const metricCards = Array.from(document.querySelectorAll('[data-metric-card]'));

    if (!form || !countInput || !statusEl || !resultsContainer || metricCards.length === 0 || !snapshotContainer) {
        return;
    }

    const numberFormatter = new Intl.NumberFormat('id-ID');
    const decimalFormatter = new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
    const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const COLOR_PALETTE = [
        '#38BDF8',
        '#6366F1',
        '#F97316',
        '#F59E0B',
        '#34D399',
        '#A855F7',
        '#F472B6',
        '#22D3EE',
    ];

    const STATUS_VARIANTS = {
        idle: {
            container: ['border-white/10', 'bg-surfaceMuted/70', 'text-textdark/70'],
            indicator: ['bg-primary/60', 'shadow-[0_0_0_4px_rgba(56,189,248,0.25)]'],
        },
        info: {
            container: ['border-white/10', 'bg-surface/70', 'text-textdark/70'],
            indicator: ['bg-primary/60', 'shadow-[0_0_0_4px_rgba(56,189,248,0.25)]'],
        },
        progress: {
            container: ['border-highlight/40', 'bg-highlight/15', 'text-highlight/80'],
            indicator: ['bg-highlight/70', 'shadow-[0_0_0_4px_rgba(249,115,22,0.25)]'],
        },
        success: {
            container: ['border-emerald-400/40', 'bg-emerald-500/10', 'text-emerald-200'],
            indicator: ['bg-emerald-400', 'shadow-[0_0_0_4px_rgba(16,185,129,0.25)]'],
        },
        error: {
            container: ['border-rose-400/40', 'bg-rose-500/10', 'text-rose-200'],
            indicator: ['bg-rose-400', 'shadow-[0_0_0_4px_rgba(244,63,94,0.25)]'],
        },
    };

    const RESULT_VARIANTS = {
        success: {
            container: ['border-emerald-400/40', 'bg-emerald-500/10', 'text-emerald-200'],
            badge: ['border-emerald-400/40', 'bg-emerald-500/20', 'text-emerald-100'],
        },
        warning: {
            container: ['border-amber-400/40', 'bg-amber-500/10', 'text-amber-200'],
            badge: ['border-amber-400/40', 'bg-amber-500/20', 'text-amber-100'],
        },
        error: {
            container: ['border-rose-400/40', 'bg-rose-500/10', 'text-rose-200'],
            badge: ['border-rose-400/40', 'bg-rose-500/20', 'text-rose-100'],
        },
        default: {
            container: ['border-white/10', 'bg-surface/70', 'text-textdark/70'],
            badge: ['border-white/10', 'bg-white/5', 'text-textdark/70'],
        },
    };

    const MAX_POINTS = 24;
    const SUMMARY_POLL_INTERVAL = 5000;

    let isSubmitting = false;
    const metricElements = new Map();
    const metricStates = new Map();
    let pollTimeoutId = null;
    let isFetchingSummary = false;

    function clampMetric(value, min, max, fallback = null) {
        if (!Number.isFinite(value)) {
            return fallback ?? null;
        }

        if (typeof min === 'number' && value < min) {
            return min;
        }

        if (typeof max === 'number' && value > max) {
            return max;
        }

        return value;
    }

    function computeResourceUsagePercentage({ stats, throughputSnapshot, latencyMs, fallback = null }) {
        const normalizedThroughput = Number.isFinite(throughputSnapshot)
            ? Math.min(Math.max(throughputSnapshot / 10, 0), 1)
            : 0;
        const normalizedLatency = Number.isFinite(latencyMs)
            ? Math.min(Math.max(latencyMs / 750, 0), 1)
            : 0.25;

        let usage = 35 + (normalizedThroughput * 45) + (normalizedLatency * 20);

        if (stats?.lastStatus === 'error') {
            usage += 8;
        } else if (stats?.lastStatus === 'success') {
            usage -= 3;
        }

        return clampMetric(usage, 25, 100, fallback);
    }

    function computeFaultToleranceScore({ stats, latencyMs, fallback = null }) {
        const totalAttempts = Math.max(
            Number(stats?.totalCount) || 0,
            (Number(stats?.successCount) || 0) + (Number(stats?.failureCount) || 0),
        );
        const failureRate = totalAttempts > 0
            ? Math.min(Math.max((Number(stats?.failureCount) || 0) / totalAttempts, 0), 1)
            : 0;
        const latencyImpact = Number.isFinite(latencyMs)
            ? Math.min(Math.max(latencyMs / 1000, 0), 1)
            : 0;
        const statusPenalty = stats?.lastStatus === 'error'
            ? 0.12
            : stats?.lastStatus === 'processing'
                ? 0.05
                : 0;

        let score = 100
            - (failureRate * 60)
            - (latencyImpact * 20)
            - (statusPenalty * 100);

        if (stats?.failureCount === 0 && stats?.successCount > 0) {
            score += 5;
        } else if (stats?.lastStatus === 'success') {
            score += 2;
        }

        return clampMetric(score, 40, 100, fallback);
    }

    function hasNetworkActivity(network) {
        if (!network || typeof network !== 'object') {
            return false;
        }

        const totalCount = Number.isFinite(network.totalCount) ? network.totalCount : 0;
        const successCount = Number.isFinite(network.successCount) ? network.successCount : 0;
        const failureCount = Number.isFinite(network.failureCount) ? network.failureCount : 0;
        const blockCount = Number.isFinite(network.blockCount) ? network.blockCount : 0;

        return totalCount > 0 || successCount > 0 || failureCount > 0 || blockCount > 0;
    }

    const METRIC_DEFINITIONS = {
        throughput: {
            key: 'throughput',
            formatTick: value => (Number.isFinite(value) ? decimalFormatter.format(value) : '—'),
            formatValue: value => (Number.isFinite(value) ? `${decimalFormatter.format(value)} tx/detik` : '—'),
            getValue: (network) => {
                if (!hasNetworkActivity(network)) {
                    return null;
                }
                const value = Number(network?.throughput);
                return Number.isFinite(value) ? value : null;
            },
        },
        latency: {
            key: 'latency',
            formatTick: value => (Number.isFinite(value) ? `${decimalFormatter.format(value)} ms` : '—'),
            formatValue: value => (Number.isFinite(value) ? `${decimalFormatter.format(value)} ms` : '—'),
            getValue: (network) => {
                if (!hasNetworkActivity(network)) {
                    return null;
                }
                const candidates = [network?.averageLatencyMs, network?.averageCommitTimeMs];
                for (let index = 0; index < candidates.length; index += 1) {
                    const value = Number(candidates[index]);
                    if (Number.isFinite(value)) {
                        return value;
                    }
                }
                return null;
            },
        },
        'resource-usage': {
            key: 'resource-usage',
            formatTick: value => (Number.isFinite(value) ? `${decimalFormatter.format(value)}%` : '—'),
            formatValue: value => (Number.isFinite(value) ? `${decimalFormatter.format(value)}%` : '—'),
            getValue: (network) => {
                if (!hasNetworkActivity(network)) {
                    return null;
                }
                const throughputValue = Number(network?.throughput);
                const latencyMs = Number.isFinite(network?.averageCommitTimeMs)
                    ? Number(network.averageCommitTimeMs)
                    : Number(network?.averageLatencyMs);
                return computeResourceUsagePercentage({
                    stats: network,
                    throughputSnapshot: Number.isFinite(throughputValue) ? throughputValue : null,
                    latencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
                    fallback: null,
                });
            },
        },
        'fault-tolerance': {
            key: 'fault-tolerance',
            formatTick: value => (Number.isFinite(value) ? `${decimalFormatter.format(value)}%` : '—'),
            formatValue: value => (Number.isFinite(value) ? `${decimalFormatter.format(value)}%` : '—'),
            getValue: (network) => {
                if (!hasNetworkActivity(network)) {
                    return null;
                }
                const latencyMs = Number.isFinite(network?.averageCommitTimeMs)
                    ? Number(network.averageCommitTimeMs)
                    : Number(network?.averageLatencyMs);
                return computeFaultToleranceScore({
                    stats: network,
                    latencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
                    fallback: null,
                });
            },
        },
    };

    metricCards.forEach((card) => {
        const metricKey = card.getAttribute('data-metric-card');
        if (!metricKey || !METRIC_DEFINITIONS[metricKey]) {
            return;
        }
        const placeholder = card.querySelector('[data-metric-placeholder]');
        const canvas = card.querySelector('[data-metric-canvas]');
        if (!canvas) {
            return;
        }
        metricElements.set(metricKey, { card, placeholder, canvas });
    });

    const metricKeys = Array.from(metricElements.keys());

    if (metricKeys.length === 0) {
        return;
    }

    function updateStatus(message, variant = 'info') {
        if (!statusEl || !statusMessage || !statusIndicator) {
            return;
        }

        const variantConfig = STATUS_VARIANTS[variant] || STATUS_VARIANTS.info;
        statusEl.dataset.variant = variant;
        statusEl.className = 'flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm shadow-inner shadow-black/20 transition';
        statusEl.classList.add(...variantConfig.container);

        statusIndicator.className = 'h-2.5 w-2.5 rounded-full transition';
        statusIndicator.classList.add(...variantConfig.indicator);

        statusMessage.textContent = message;
    }

    function setSubmitDisabled(disabled) {
        if (!submitButton) {
            return;
        }

        submitButton.disabled = disabled;
        submitButton.classList.toggle('opacity-60', disabled);
        submitButton.classList.toggle('cursor-wait', disabled);
    }

    function generateRecordId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return `broadcast-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    function createSimulationRecord(index, total) {
        const now = new Date();
        return {
            id: generateRecordId(),
            type: 'broadcastSimulation',
            source: 'simulasi-serentak',
            batchIndex: index + 1,
            batchSize: total,
            issuedAt: now.toISOString(),
            payload: {
                kategori: 'pelaporan-kesehatan',
                judul: `Simulasi Pelaporan ${index + 1}`,
                timestamp: now.toISOString(),
                data: {
                    pasien: `Pasien-${(index + 1).toString().padStart(2, '0')}`,
                    suhu: 36 + Math.random() * 2,
                    tekananSistolik: 100 + Math.floor(Math.random() * 30),
                    tekananDiastolik: 70 + Math.floor(Math.random() * 20),
                    catatan: 'Data simulasi yang dikirim secara serentak.',
                },
            },
        };
    }

    async function submitSimulationRecord(record) {
        const response = await fetch('/api/simulations/records', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ record }),
        });

        const raw = await response.text();
        let payload = null;

        if (raw) {
            try {
                payload = JSON.parse(raw);
            } catch (error) {
                console.error('Gagal mengurai respons simulasi:', error);
            }
        }

        if (!response.ok) {
            const message = payload?.error || `Server mengembalikan status ${response.status}`;
            const error = new Error(message);
            error.payload = payload;
            throw error;
        }

        return payload || {};
    }

    function selectResultVariant(status) {
        if (!status) {
            return RESULT_VARIANTS.default;
        }

        const normalized = String(status).toLowerCase();
        if (normalized === 'success' || normalized === 'healthy') {
            return RESULT_VARIANTS.success;
        }

        if (normalized.includes('fail') || normalized === 'error') {
            return RESULT_VARIANTS.error;
        }

        if (normalized === 'partial' || normalized.includes('pending')) {
            return RESULT_VARIANTS.warning;
        }

        return RESULT_VARIANTS.default;
    }

    function formatLatency(latencyMs) {
        if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs)) {
            return '—';
        }
        return `${decimalFormatter.format(latencyMs)} ms`;
    }

    function renderResults(results) {
        if (!resultsContainer) {
            return;
        }

        resultsContainer.innerHTML = '';

        if (!Array.isArray(results) || results.length === 0) {
            const emptyState = document.createElement('p');
            emptyState.className = 'rounded-2xl border border-dashed border-white/10 bg-surface/60 px-4 py-3 text-sm text-textdark/60';
            emptyState.textContent = 'Belum ada hasil pengiriman simulasi yang ditampilkan.';
            resultsContainer.appendChild(emptyState);
            return;
        }

        const latestByNetwork = new Map();
        results.forEach((result) => {
            if (!result || typeof result !== 'object') {
                return;
            }
            const key = result.targetId || result.label || `network-${latestByNetwork.size + 1}`;
            latestByNetwork.set(key, result);
        });

        const sortedResults = Array.from(latestByNetwork.values())
            .sort((a, b) => {
                const labelA = a?.label || a?.targetId || '';
                const labelB = b?.label || b?.targetId || '';
                return labelA.localeCompare(labelB);
            });

        sortedResults.forEach((result) => {
            const variant = selectResultVariant(result?.status);
            const container = document.createElement('article');
            container.className = 'rounded-2xl border px-4 py-4 shadow-inner shadow-black/15 transition';
            container.classList.add(...variant.container);

            const header = document.createElement('div');
            header.className = 'flex items-start justify-between gap-3';

            const titleWrapper = document.createElement('div');
            titleWrapper.className = 'space-y-1';

            const title = document.createElement('p');
            title.className = 'text-sm font-semibold';
            title.textContent = result?.label || result?.targetId || 'Jaringan';
            titleWrapper.appendChild(title);

            const statusText = document.createElement('p');
            statusText.className = 'text-xs opacity-80';
            statusText.textContent = `Status: ${result?.status || 'unknown'}`;
            titleWrapper.appendChild(statusText);

            const badge = document.createElement('span');
            badge.className = 'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em]';
            badge.classList.add(...variant.badge);
            badge.textContent = result?.channel || 'Channel';

            header.appendChild(titleWrapper);
            header.appendChild(badge);
            container.appendChild(header);

            if (result?.message) {
                const message = document.createElement('p');
                message.className = 'mt-3 text-xs opacity-80';
                message.textContent = result.message;
                container.appendChild(message);
            }

            const metaList = document.createElement('dl');
            metaList.className = 'mt-4 grid grid-cols-2 gap-3 text-[11px] uppercase tracking-[0.2em] opacity-80';

            const latencyLabel = document.createElement('dt');
            latencyLabel.textContent = 'Latensi';
            const latencyValue = document.createElement('dd');
            latencyValue.className = 'text-base normal-case tracking-normal';
            latencyValue.textContent = formatLatency(result?.latencyMs);

            const blockLabel = document.createElement('dt');
            blockLabel.textContent = 'Blok';
            const blockValue = document.createElement('dd');
            blockValue.className = 'text-base normal-case tracking-normal';
            const blockNumber = result?.commitStatus?.blockNumber ?? result?.blockNumber ?? null;
            if (blockNumber === null || blockNumber === undefined) {
                blockValue.textContent = '—';
            } else if (typeof blockNumber === 'number' && Number.isFinite(blockNumber)) {
                blockValue.textContent = `#${numberFormatter.format(blockNumber)}`;
            } else {
                blockValue.textContent = `#${blockNumber}`;
            }

            metaList.appendChild(latencyLabel);
            metaList.appendChild(latencyValue);
            metaList.appendChild(blockLabel);
            metaList.appendChild(blockValue);

            if (result?.transactionId) {
                const txLabel = document.createElement('dt');
                txLabel.textContent = 'Tx';
                const txValue = document.createElement('dd');
                txValue.className = 'text-xs normal-case tracking-normal break-all';
                txValue.textContent = result.transactionId;
                metaList.appendChild(txLabel);
                metaList.appendChild(txValue);
            }

            container.appendChild(metaList);
            resultsContainer.appendChild(container);
        });
    }

    function ensureMetricState(metricKey) {
        if (!metricStates.has(metricKey)) {
            metricStates.set(metricKey, {
                chart: null,
                datasets: new Map(),
                hasData: false,
                elements: metricElements.get(metricKey) || null,
            });
        }
        return metricStates.get(metricKey);
    }

    function ensureMetricChart(metricKey) {
        const metricDefinition = METRIC_DEFINITIONS[metricKey];
        if (!metricDefinition) {
            return null;
        }

        const state = ensureMetricState(metricKey);
        if (!state.elements || !state.elements.canvas) {
            return null;
        }

        if (state.chart) {
            return state.chart;
        }

        if (typeof window.Chart !== 'function') {
            return null;
        }

        const context = state.elements.canvas.getContext('2d');
        state.chart = new window.Chart(context, {
            type: 'line',
            data: {
                labels: [],
                datasets: [],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => metricDefinition.formatTick(value),
                            color: '#E2E8F0',
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.12)',
                        },
                    },
                    x: {
                        ticks: {
                            color: '#E2E8F0',
                        },
                        grid: {
                            display: false,
                        },
                    },
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#E2E8F0',
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const datasetLabel = context.dataset?.label || 'Jaringan';
                                const value = context.parsed?.y;
                                const formatted = Number.isFinite(value)
                                    ? metricDefinition.formatValue(value)
                                    : '—';
                                return `${datasetLabel}: ${formatted}`;
                            },
                        },
                    },
                },
            },
        });

        return state.chart;
    }

    function ensureMetricDataset(metricKey, network) {
        if (!network) {
            return null;
        }

        const state = ensureMetricState(metricKey);
        const chart = ensureMetricChart(metricKey);
        if (!state || !chart) {
            return null;
        }

        const key = network.id || network.targetId || network.label || `network-${state.datasets.size + 1}`;
        if (state.datasets.has(key)) {
            return state.datasets.get(key);
        }

        const color = COLOR_PALETTE[state.datasets.size % COLOR_PALETTE.length];
        const dataset = {
            label: network.label || key,
            datasetId: key,
            borderColor: color,
            backgroundColor: `${color}33`,
            tension: 0.3,
            fill: false,
            data: [],
        };

        const existingLabelCount = chart.data.labels.length;
        if (existingLabelCount > 1) {
            dataset.data = new Array(existingLabelCount - 1).fill(null);
        }

        chart.data.datasets.push(dataset);
        state.datasets.set(key, dataset);
        return dataset;
    }

    function normalizeBlockValue(blockValue) {
        if (typeof blockValue === 'number' && Number.isFinite(blockValue)) {
            return blockValue;
        }
        if (typeof blockValue === 'string') {
            const parsed = Number.parseInt(blockValue, 10);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
        return null;
    }

    function updateMetricChart(metricKey, networks, label) {
        const metricDefinition = METRIC_DEFINITIONS[metricKey];
        if (!metricDefinition) {
            return;
        }

        const chart = ensureMetricChart(metricKey);
        if (!chart) {
            return;
        }

        const state = ensureMetricState(metricKey);
        const labels = chart.data.labels;
        labels.push(label);
        if (labels.length > MAX_POINTS) {
            labels.shift();
        }

        const seenDatasets = new Set();
        networks.forEach((network) => {
            const dataset = ensureMetricDataset(metricKey, network);
            if (!dataset) {
                return;
            }

            const value = metricDefinition.getValue(network);
            const lastValue = dataset.data.length > 0
                ? dataset.data[dataset.data.length - 1]
                : null;
            const nextValue = Number.isFinite(value)
                ? value
                : (Number.isFinite(lastValue) ? lastValue : null);

            dataset.data.push(nextValue);
            if (dataset.data.length > labels.length) {
                dataset.data.shift();
            }
            while (dataset.data.length < labels.length) {
                const fillValue = dataset.data.length > 0
                    ? dataset.data[dataset.data.length - 1]
                    : null;
                dataset.data.push(fillValue);
            }
            seenDatasets.add(dataset.datasetId);
        });

        state.datasets.forEach((dataset) => {
            if (!seenDatasets.has(dataset.datasetId)) {
                const fallback = dataset.data.length > 0
                    ? dataset.data[dataset.data.length - 1]
                    : null;
                dataset.data.push(fallback);
                if (dataset.data.length > labels.length) {
                    dataset.data.shift();
                }
                while (dataset.data.length < labels.length) {
                    const fillValue = dataset.data.length > 0
                        ? dataset.data[dataset.data.length - 1]
                        : null;
                    dataset.data.push(fillValue);
                }
            }
        });

        if (!state.hasData) {
            const hasFiniteData = Array.from(state.datasets.values()).some(currentDataset => (
                Array.isArray(currentDataset.data)
                && currentDataset.data.some(dataPoint => Number.isFinite(dataPoint))
            ));

            if (hasFiniteData) {
                state.hasData = true;
                if (state.elements?.placeholder) {
                    state.elements.placeholder.classList.add('hidden');
                }
                if (state.elements?.canvas) {
                    state.elements.canvas.classList.remove('hidden');
                }
            }
        }

        chart.update('none');
    }

    function updateMetricCharts(networks) {
        if (!Array.isArray(networks) || networks.length === 0) {
            return;
        }

        const label = timeFormatter.format(new Date());
        metricKeys.forEach((metricKey) => {
            updateMetricChart(metricKey, networks, label);
        });
    }

    function renderSnapshot(networks) {
        if (!snapshotContainer) {
            return;
        }

        snapshotContainer.innerHTML = '';

        if (!Array.isArray(networks) || networks.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'rounded-2xl border border-dashed border-white/10 bg-surface/60 px-4 py-3 text-sm text-textdark/60';
            empty.textContent = 'Belum ada data blok yang tercatat.';
            snapshotContainer.appendChild(empty);
            return;
        }

        networks
            .slice()
            .sort((a, b) => (a?.label || '').localeCompare(b?.label || ''))
            .forEach((network) => {
                const card = document.createElement('article');
                card.className = 'rounded-2xl border border-white/10 bg-surface/60 p-4 shadow-inner shadow-black/15';

                const header = document.createElement('div');
                header.className = 'flex items-start justify-between gap-2';

                const titleWrapper = document.createElement('div');
                titleWrapper.className = 'space-y-1';

                const title = document.createElement('h4');
                title.className = 'text-sm font-semibold text-textdark';
                title.textContent = network?.label || network?.id || 'Jaringan';
                titleWrapper.appendChild(title);

                const meta = document.createElement('p');
                meta.className = 'text-[11px] uppercase tracking-[0.28em] text-textdark/50';
                meta.textContent = network?.scope ? network.scope.replace('-', ' ').toUpperCase() : 'FABRIC';
                titleWrapper.appendChild(meta);

                const blockCount = normalizeBlockValue(network?.blockCount);
                const badge = document.createElement('span');
                badge.className = 'inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/80';
                badge.textContent = `${numberFormatter.format(blockCount ?? 0)} blok`;

                header.appendChild(titleWrapper);
                header.appendChild(badge);
                card.appendChild(header);

                const details = document.createElement('dl');
                details.className = 'mt-4 grid grid-cols-2 gap-3 text-xs text-textdark/70';

                const lastBlockLabel = network?.lastBlockLabel || null;
                const lastBlockNumber = normalizeBlockValue(network?.lastBlockNumber);

                const blockLabel = document.createElement('dt');
                blockLabel.className = 'uppercase tracking-[0.25em] text-[10px] text-textdark/50';
                blockLabel.textContent = 'Blok terakhir';
                const blockValue = document.createElement('dd');
                blockValue.className = 'text-sm font-medium text-textdark';
                if (lastBlockLabel) {
                    blockValue.textContent = lastBlockLabel;
                } else if (lastBlockNumber !== null) {
                    blockValue.textContent = `#${numberFormatter.format(lastBlockNumber)}`;
                } else {
                    blockValue.textContent = '—';
                }

                const statusLabel = document.createElement('dt');
                statusLabel.className = 'uppercase tracking-[0.25em] text-[10px] text-textdark/50';
                statusLabel.textContent = 'Status komit';
                const statusValue = document.createElement('dd');
                statusValue.className = 'text-sm font-medium text-textdark';
                statusValue.textContent = network?.lastStatus || 'unknown';

                const timeLabel = document.createElement('dt');
                timeLabel.className = 'uppercase tracking-[0.25em] text-[10px] text-textdark/50';
                timeLabel.textContent = 'Pembaruan';
                const timeValue = document.createElement('dd');
                timeValue.className = 'text-sm font-medium text-textdark';
                const timestamp = network?.lastCompletedAt || network?.lastUpdatedAt || network?.updatedAt;
                if (timestamp) {
                    try {
                        timeValue.textContent = dateTimeFormatter.format(new Date(timestamp));
                    } catch (error) {
                        timeValue.textContent = timestamp;
                    }
                } else {
                    timeValue.textContent = '—';
                }

                details.appendChild(blockLabel);
                details.appendChild(blockValue);
                details.appendChild(statusLabel);
                details.appendChild(statusValue);
                details.appendChild(timeLabel);
                details.appendChild(timeValue);

                card.appendChild(details);
                snapshotContainer.appendChild(card);
            });
    }

    function setUpdatedAt(timestamp) {
        if (!updatedAtEl) {
            return;
        }

        if (!timestamp) {
            updatedAtEl.textContent = '';
            return;
        }

        try {
            const formatted = dateTimeFormatter.format(new Date(timestamp));
            updatedAtEl.textContent = `Pembaruan terakhir: ${formatted}`;
        } catch (error) {
            updatedAtEl.textContent = `Pembaruan terakhir: ${timestamp}`;
        }
    }

    function scheduleNextPoll(delay = SUMMARY_POLL_INTERVAL) {
        if (pollTimeoutId) {
            window.clearTimeout(pollTimeoutId);
        }
        pollTimeoutId = window.setTimeout(fetchSummaryAndRender, delay);
    }

    async function fetchSummaryAndRender() {
        if (isFetchingSummary) {
            return;
        }
        isFetchingSummary = true;

        if (pollTimeoutId) {
            window.clearTimeout(pollTimeoutId);
            pollTimeoutId = null;
        }

        try {
            const response = await fetch('/api/simulations/summary', {
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Gagal memuat ringkasan simulasi (status ${response.status})`);
            }

            const payload = await response.json();
            const networks = Array.isArray(payload?.networks) ? payload.networks : [];

            renderSnapshot(networks);
            updateMetricCharts(networks);
            setUpdatedAt(payload?.updatedAt || payload?.fetchedAt || null);
        } catch (error) {
            console.error('Gagal memperbarui ringkasan simulasi:', error);
        } finally {
            isFetchingSummary = false;
            scheduleNextPoll();
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (isSubmitting) {
            return;
        }

        const count = Number.parseInt(countInput.value, 10);
        if (!Number.isFinite(count) || count < 1 || count > 20) {
            updateStatus('Masukkan jumlah catatan antara 1 hingga 20.', 'error');
            return;
        }

        isSubmitting = true;
        setSubmitDisabled(true);
        updateStatus('Mengirim data simulasi ke seluruh jaringan...', 'progress');

        const aggregatedResults = [];

        try {
            for (let index = 0; index < count; index += 1) {
                const record = createSimulationRecord(index, count);
                const payload = await submitSimulationRecord(record);
                const results = Array.isArray(payload?.results) ? payload.results : [];
                aggregatedResults.push(...results);
                updateStatus(`Batch ${index + 1} dari ${count} selesai dikirim.`, 'progress');
            }

            renderResults(aggregatedResults);

            const networkCount = new Set(aggregatedResults.map(result => result?.targetId)).size;
            const summaryMessage = networkCount > 0
                ? `Seluruh ${count} catatan simulasi berhasil dikirim ke ${networkCount} jaringan.`
                : `Seluruh ${count} catatan simulasi berhasil diproses.`;
            updateStatus(summaryMessage, 'success');

            fetchSummaryAndRender();
        } catch (error) {
            console.error('Gagal menjalankan simulasi serentak:', error);
            const message = error instanceof Error && error.message
                ? error.message
                : 'Terjadi kesalahan saat mengirim simulasi.';
            updateStatus(message, 'error');
        } finally {
            isSubmitting = false;
            setSubmitDisabled(false);
        }
    }

    form.addEventListener('submit', handleSubmit);

    renderResults([]);
    renderSnapshot([]);
    scheduleNextPoll(500);
});
