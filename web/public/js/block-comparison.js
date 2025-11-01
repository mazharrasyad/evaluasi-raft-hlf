const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    const summaryGrid = document.getElementById('blockSummaryGrid');
    const statusEl = document.getElementById('blockComparisonStatus');
    const updatedAtEl = document.getElementById('blockComparisonUpdatedAt');
    const refreshButton = document.getElementById('refreshBlockComparisonButton');
    const blockCountContainer = document.querySelector('[data-block-count-chart]');
    const blockCountCanvas = document.getElementById('blockCountChart');
    const blockTimelineContainer = document.querySelector('[data-block-timeline-chart]');
    const blockTimelineCanvas = document.getElementById('blockTimelineChart');
    const highlightGrid = document.getElementById('blockHighlightGrid');
    const highlightElements = {
        latestLatency: document.getElementById('blockLatestLatencyValue'),
        averageLatency: document.getElementById('blockAverageLatencyValue'),
        throughput: document.getElementById('blockThroughputValue'),
        successCount: document.getElementById('blockSuccessCountValue'),
        failureCount: document.getElementById('blockFailureCountValue'),
        commitCode: document.getElementById('blockCommitCodeValue'),
        commitBlock: document.getElementById('blockCommitBlockValue'),
    };

    const PLACEHOLDER_VARIANTS = {
        info: 'border-white/10 bg-surface/60 text-textdark/70',
        error: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
        empty: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    };

    const SCOPE_BADGES = {
        'fabric-2': {
            label: 'Fabric 2',
            className: 'border-secondary/30 bg-secondary/15 text-secondary/90',
        },
        'fabric-3': {
            label: 'Fabric 3',
            className: 'border-accent/30 bg-accent/15 text-accent/90',
        },
    };

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

    let isLoading = false;
    let blockCountChartInstance = null;
    let blockTimelineChartInstance = null;

    const numberFormatter = new Intl.NumberFormat('id-ID');
    const decimalFormatter = new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const percentFormatter = new Intl.NumberFormat('id-ID', {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
    });
    const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

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

    function formatNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return numberFormatter.format(value);
        }
        return '0';
    }

    function formatPercent(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return percentFormatter.format(value);
        }
        return '—';
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

    function formatUpdatedAtLabel(value) {
        const formatted = formatDateTime(value);
        return formatted ? `Terakhir diperbarui: ${formatted}` : '';
    }

    function setUpdatedAtLabel(value) {
        if (!updatedAtEl) {
            return;
        }

        const label = formatUpdatedAtLabel(value);
        updatedAtEl.textContent = label;
    }

    function setStatus(message, tone = 'info') {
        if (!statusEl) {
            return;
        }

        statusEl.textContent = message || '';
        statusEl.classList.remove('text-textdark/50', 'text-rose-300', 'text-amber-300', 'text-primary/80');

        if (!message) {
            statusEl.classList.add('text-textdark/50');
            return;
        }

        if (tone === 'error') {
            statusEl.classList.add('text-rose-300');
        } else if (tone === 'warning') {
            statusEl.classList.add('text-amber-300');
        } else if (tone === 'success') {
            statusEl.classList.add('text-primary/80');
        } else {
            statusEl.classList.add('text-textdark/50');
        }
    }

    function createPlaceholderArticle(message, tone = 'info') {
        const article = document.createElement('article');
        const classes = PLACEHOLDER_VARIANTS[tone] || PLACEHOLDER_VARIANTS.info;
        article.className = `rounded-3xl border p-6 text-sm shadow-inner shadow-black/20 ${classes}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-3';

        const indicator = document.createElement('span');
        indicator.className = 'inline-flex h-3 w-3 rounded-full';

        if (tone === 'error') {
            indicator.classList.add('bg-rose-400');
        } else if (tone === 'empty') {
            indicator.classList.add('bg-amber-400');
        } else {
            indicator.classList.add('bg-primary/70', 'animate-ping');
        }

        const text = document.createElement('span');
        text.textContent = message;

        wrapper.append(indicator, text);
        article.append(wrapper);
        return article;
    }

    function showSummaryPlaceholder(message, tone = 'info') {
        if (!summaryGrid) {
            return;
        }

        summaryGrid.dataset.state = 'placeholder';
        summaryGrid.replaceChildren(createPlaceholderArticle(message, tone));
    }

    function getScopeBadge(scope) {
        if (!scope || !SCOPE_BADGES[scope]) {
            return null;
        }

        const { label, className } = SCOPE_BADGES[scope];
        const badge = document.createElement('span');
        badge.className = `inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] ${className}`;
        badge.textContent = label;
        return badge;
    }

    function createStat(label, value, hint = null) {
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-1';

        const dt = document.createElement('div');
        dt.className = 'text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-textdark/60';
        dt.textContent = label;

        const dd = document.createElement('div');
        dd.className = 'text-lg font-semibold text-textdark';
        dd.textContent = value;

        wrapper.append(dt, dd);

        if (hint) {
            const hintEl = document.createElement('p');
            hintEl.className = 'text-[0.7rem] text-textdark/60';
            hintEl.textContent = hint;
            wrapper.append(hintEl);
        }

        return wrapper;
    }

    const highlightDefaults = {
        latestLatency: '—',
        averageLatency: '—',
        throughput: '0,00 tx/detik',
        successCount: '0',
        failureCount: '0',
        commitCode: '—',
        commitBlock: '—',
    };

    function setHighlightValues(values = {}) {
        Object.entries(highlightDefaults).forEach(([key, fallback]) => {
            const element = highlightElements[key];
            if (!element) {
                return;
            }

            const value = values[key];
            if (typeof value === 'string' && value.trim() !== '') {
                element.textContent = value;
                return;
            }

            element.textContent = fallback;
        });
    }

    function resetHighlights() {
        if (highlightGrid) {
            highlightGrid.dataset.state = 'loading';
        }
        setHighlightValues({});
    }

    function getBlockTimestamp(block) {
        if (!block || typeof block !== 'object') {
            return Number.NaN;
        }

        const candidates = [block.lastUpdatedAt, block.lastCompletedAt];
        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }

            const parsed = Date.parse(candidate);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return Number.NaN;
    }

    function isNewerBlock(candidate, reference) {
        if (!candidate || typeof candidate !== 'object') {
            return false;
        }

        if (!reference || typeof reference !== 'object') {
            return true;
        }

        const candidateTime = getBlockTimestamp(candidate);
        const referenceTime = getBlockTimestamp(reference);
        const candidateTimeValid = Number.isFinite(candidateTime);
        const referenceTimeValid = Number.isFinite(referenceTime);

        if (candidateTimeValid || referenceTimeValid) {
            if (!referenceTimeValid) {
                return candidateTimeValid;
            }

            if (!candidateTimeValid) {
                return false;
            }

            if (candidateTime !== referenceTime) {
                return candidateTime > referenceTime;
            }
        }

        const candidateNumber = resolveBlockNumber(candidate);
        const referenceNumber = resolveBlockNumber(reference);

        if (candidateNumber !== null || referenceNumber !== null) {
            if (referenceNumber === null) {
                return candidateNumber !== null;
            }

            if (candidateNumber === null) {
                return false;
            }

            if (candidateNumber !== referenceNumber) {
                return candidateNumber > referenceNumber;
            }
        }

        const candidateLabel = resolveBlockLabel(candidate) || '';
        const referenceLabel = resolveBlockLabel(reference) || '';
        return candidateLabel.localeCompare(referenceLabel) >= 0;
    }

    function buildFallbackBlockFromNetwork(network) {
        if (!network || typeof network !== 'object') {
            return null;
        }

        const hasLabel = typeof network.lastBlockLabel === 'string' && network.lastBlockLabel.trim() !== '';
        const hasNumber = Number.isFinite(network.lastBlockNumber);
        const hasTimestamp = typeof network.lastBlockUpdatedAt === 'string'
            || typeof network.lastUpdatedAt === 'string'
            || typeof network.lastCompletedAt === 'string';
        const hasTransactionId = typeof network.lastTransactionId === 'string' && network.lastTransactionId.trim() !== '';
        const hasLatency = Number.isFinite(network.averageCommitTimeMs) || Number.isFinite(network.averageLatencyMs);

        if (!hasLabel && !hasNumber && !hasTimestamp && !hasTransactionId && !hasLatency) {
            return null;
        }

        return {
            blockLabel: hasLabel ? network.lastBlockLabel : null,
            blockNumber: hasNumber ? network.lastBlockNumber : null,
            lastUpdatedAt: network.lastBlockUpdatedAt || network.lastUpdatedAt || null,
            lastCompletedAt: network.lastCompletedAt || null,
            lastTransactionId: hasTransactionId ? network.lastTransactionId : null,
            averageCommitTimeMs: Number.isFinite(network.averageCommitTimeMs)
                ? network.averageCommitTimeMs
                : null,
            averageLatencyMs: Number.isFinite(network.averageLatencyMs)
                ? network.averageLatencyMs
                : null,
        };
    }

    function selectLatestBlockInfo(networks) {
        if (!Array.isArray(networks) || networks.length === 0) {
            return null;
        }

        let latestInfo = null;

        networks.forEach((network) => {
            if (!network || typeof network !== 'object') {
                return;
            }

            const blocks = Array.isArray(network.blocks) ? network.blocks : [];
            const candidates = [...blocks];

            if (candidates.length === 0) {
                const fallbackBlock = buildFallbackBlockFromNetwork(network);
                if (fallbackBlock) {
                    candidates.push(fallbackBlock);
                }
            }

            candidates.forEach((block) => {
                if (!block || typeof block !== 'object') {
                    return;
                }

                if (!latestInfo || isNewerBlock(block, latestInfo.block)) {
                    latestInfo = { block, network };
                }
            });
        });

        return latestInfo;
    }

    function formatLatencyValue(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return `${decimalFormatter.format(value)} ms`;
        }
        return '—';
    }

    function formatThroughputValue(value) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
            return `${decimalFormatter.format(value)} tx/detik`;
        }
        return highlightDefaults.throughput;
    }

    function formatTextValue(value) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed !== '' ? trimmed : '—';
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }

        return '—';
    }

    function updateHighlightValues(overall, networks) {
        const values = { ...highlightDefaults };

        const successCount = Number.isFinite(overall?.successCount) ? overall.successCount : 0;
        const failureCount = Number.isFinite(overall?.failureCount) ? overall.failureCount : 0;
        const averageLatencyMs = Number.isFinite(overall?.averageLatencyMs)
            ? overall.averageLatencyMs
            : null;
        const throughput = Number.isFinite(overall?.throughput) ? overall.throughput : null;

        let averageLatencyValue = averageLatencyMs;
        if (!Number.isFinite(averageLatencyValue) && Number.isFinite(overall?.averageCommitTimeMs)) {
            averageLatencyValue = overall.averageCommitTimeMs;
        }

        values.averageLatency = formatLatencyValue(averageLatencyValue);
        values.throughput = formatThroughputValue(throughput);
        values.successCount = formatNumber(successCount);
        values.failureCount = formatNumber(failureCount);

        const latestInfo = selectLatestBlockInfo(networks);

        if (latestInfo) {
            const { block, network } = latestInfo;
            let latestLatency = Number.isFinite(block?.averageCommitTimeMs)
                ? block.averageCommitTimeMs
                : (Number.isFinite(block?.averageLatencyMs) ? block.averageLatencyMs : null);

            if (!Number.isFinite(latestLatency)) {
                if (Number.isFinite(overall?.averageCommitTimeMs)) {
                    latestLatency = overall.averageCommitTimeMs;
                } else if (Number.isFinite(overall?.averageLatencyMs)) {
                    latestLatency = overall.averageLatencyMs;
                } else {
                    latestLatency = null;
                }
            }

            values.latestLatency = formatLatencyValue(latestLatency);
            values.commitCode = formatTextValue(block?.lastTransactionId || network?.lastTransactionId || null);
            values.commitBlock = formatTextValue(resolveBlockLabel(block) || network?.lastBlockLabel || null);
        } else {
            const fallbackLatency = Number.isFinite(overall?.averageCommitTimeMs)
                ? overall.averageCommitTimeMs
                : (Number.isFinite(overall?.averageLatencyMs) ? overall.averageLatencyMs : null);
            values.latestLatency = formatLatencyValue(fallbackLatency);
            values.commitCode = highlightDefaults.commitCode;
            values.commitBlock = highlightDefaults.commitBlock;
        }

        if (highlightGrid) {
            highlightGrid.dataset.state = 'ready';
        }

        setHighlightValues(values);
    }


    function destroyBlockCountChart() {
        if (blockCountChartInstance) {
            blockCountChartInstance.destroy();
            blockCountChartInstance = null;
        }
    }

    function destroyBlockTimelineChart() {
        if (blockTimelineChartInstance) {
            blockTimelineChartInstance.destroy();
            blockTimelineChartInstance = null;
        }
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

        if ([r, g, b].some((value) => Number.isNaN(value))) {
            return `rgba(56, 189, 248, ${alpha})`;
        }

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function renderSummaryCards(networks) {
        if (!summaryGrid) {
            return;
        }

        if (!Array.isArray(networks) || networks.length === 0) {
            showSummaryPlaceholder('Belum ada data blok jaringan yang tersedia.', 'empty');
            return;
        }

        summaryGrid.dataset.state = 'ready';
        summaryGrid.replaceChildren();

        networks.forEach((network, index) => {
            if (!network || typeof network !== 'object') {
                return;
            }

            const card = document.createElement('article');
            card.className = 'flex flex-col gap-4 rounded-3xl border border-white/10 bg-surfaceMuted/70 p-6 text-sm text-textdark/80 shadow-inner shadow-black/20';

            const header = document.createElement('div');
            header.className = 'flex items-start justify-between gap-3';

            const titleWrapper = document.createElement('div');
            titleWrapper.className = 'space-y-1';

            const title = document.createElement('h3');
            title.className = 'text-base font-semibold text-textdark';
            title.textContent = network.label || network.id || `Jaringan ${index + 1}`;
            titleWrapper.append(title);

            const badge = getScopeBadge(network.scope);
            if (badge) {
                titleWrapper.append(badge);
            }

            header.append(titleWrapper);

            if (typeof network.hasSimulationData === 'boolean') {
                const statusBadge = document.createElement('span');
                statusBadge.className = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em]';

                if (network.hasSimulationData) {
                    statusBadge.classList.add('border-emerald-400/40', 'bg-emerald-400/15', 'text-emerald-200');
                    statusBadge.textContent = 'Aktif';
                } else {
                    statusBadge.classList.add('border-white/15', 'bg-white/5', 'text-textdark/60');
                    statusBadge.textContent = 'Belum aktif';
                }

                header.append(statusBadge);
            }

            const stats = document.createElement('div');
            stats.className = 'grid grid-cols-1 gap-4';

            const blockCount = Number.isFinite(network.blockCount) ? network.blockCount : 0;
            const totalTransactions = Number.isFinite(network.totalCount) ? network.totalCount : 0;
            const successRate = Number.isFinite(network.successRate) ? network.successRate : null;
            const lastBlockLabel = network.lastBlockLabel || 'Belum ada blok';
            const lastBlockUpdated = formatDateTime(network.lastBlockUpdatedAt || network.lastUpdatedAt);

            stats.append(
                createStat('Total Blok', formatNumber(blockCount), 'Blok unik yang tercatat'),
            );
            stats.append(
                createStat('Total Transaksi', formatNumber(totalTransactions), `${formatNumber(Number.isFinite(network.successCount) ? network.successCount : 0)} berhasil`),
            );
            stats.append(
                createStat('Rasio Keberhasilan', formatPercent(successRate), successRate !== null ? 'Proporsi transaksi berhasil' : 'Belum tersedia'),
            );

            const lastBlockStat = createStat('Blok Terakhir', lastBlockLabel, lastBlockUpdated ? `Diperbarui ${lastBlockUpdated}` : 'Belum ada pembaruan blok');
            stats.append(lastBlockStat);

            card.append(header, stats);
            summaryGrid.append(card);
        });
    }

    function resolveBlockLabel(block) {
        if (!block || typeof block !== 'object') {
            return null;
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

    function renderBlockCountChart(networks) {
        if (!blockCountContainer || !blockCountCanvas) {
            return;
        }

        destroyBlockCountChart();

        if (!Array.isArray(networks) || networks.length === 0) {
            setChartMessage(blockCountContainer, 'Belum ada data blok yang siap divisualisasikan.', 'empty');
            return;
        }

        if (!isChartJsAvailable()) {
            setChartMessage(blockCountContainer, 'Chart.js tidak tersedia untuk menampilkan grafik.', 'error');
            return;
        }

        const labels = networks.map((network, index) => network?.label || network?.id || `Jaringan ${index + 1}`);
        const data = networks.map((network) => (Number.isFinite(network?.blockCount) ? network.blockCount : 0));

        const backgroundColors = labels.map((_, index) => hexToRgba(COLOR_PALETTE[index % COLOR_PALETTE.length], 0.45));
        const borderColors = labels.map((_, index) => COLOR_PALETTE[index % COLOR_PALETTE.length]);

        setChartReady(blockCountContainer);

        const context = blockCountCanvas.getContext('2d');
        if (!context) {
            setChartMessage(blockCountContainer, 'Kanvas grafik tidak tersedia.', 'error');
            return;
        }

        blockCountChartInstance = new window.Chart(context, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Total blok',
                        data,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 1.5,
                        borderRadius: 8,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            color: '#94A3B8',
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.15)',
                        },
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#94A3B8',
                            callback(value) {
                                return numberFormatter.format(value);
                            },
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.15)',
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const label = context.dataset.label || 'Total blok';
                                const value = Number.isFinite(context.parsed.y) ? context.parsed.y : 0;
                                return `${label}: ${numberFormatter.format(value)} blok`;
                            },
                        },
                    },
                },
            },
        });
    }

    function renderBlockTimelineChart(networks) {
        if (!blockTimelineContainer || !blockTimelineCanvas) {
            return;
        }

        destroyBlockTimelineChart();

        const networksWithBlocks = Array.isArray(networks)
            ? networks.filter((network) => Array.isArray(network?.blocks) && network.blocks.length > 0)
            : [];

        if (networksWithBlocks.length === 0) {
            setChartMessage(blockTimelineContainer, 'Belum ada blok yang dapat divisualisasikan.', 'empty');
            return;
        }

        if (!isChartJsAvailable()) {
            setChartMessage(blockTimelineContainer, 'Chart.js tidak tersedia untuk menampilkan grafik.', 'error');
            return;
        }

        const BLOCK_LIMIT = 12;
        const blocksPerNetwork = networksWithBlocks.map((network) => getRelevantBlocks(network, BLOCK_LIMIT * 2));
        const axisLabels = buildBlockAxisLabels(blocksPerNetwork, BLOCK_LIMIT);

        if (axisLabels.length === 0) {
            setChartMessage(blockTimelineContainer, 'Belum ada blok yang dapat divisualisasikan.', 'empty');
            return;
        }

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
                    return 0;
                }

                const total = Number.isFinite(block.totalCount) ? block.totalCount : 0;
                return total;
            });

            const color = COLOR_PALETTE[index % COLOR_PALETTE.length];

            return {
                label: network.label || network.id || `Jaringan ${index + 1}`,
                data,
                borderColor: color,
                backgroundColor: hexToRgba(color, 0.25),
                tension: 0.35,
                fill: false,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBorderWidth: 1.5,
                pointBackgroundColor: color,
                pointBorderColor: '#0F172A',
                metaBlockLookup: blockLookup,
            };
        });

        setChartReady(blockTimelineContainer);

        const context = blockTimelineCanvas.getContext('2d');
        if (!context) {
            setChartMessage(blockTimelineContainer, 'Kanvas grafik tidak tersedia.', 'error');
            return;
        }

        blockTimelineChartInstance = new window.Chart(context, {
            type: 'line',
            data: {
                labels: axisLabels,
                datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
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
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#94A3B8',
                            callback(value) {
                                return numberFormatter.format(value);
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
                                const datasetLabel = context.dataset.label || '';
                                const value = Number.isFinite(context.parsed.y) ? context.parsed.y : 0;
                                const label = datasetLabel ? `${datasetLabel}: ${numberFormatter.format(value)} transaksi` : `${numberFormatter.format(value)} transaksi`;

                                const lookup = context.dataset.metaBlockLookup;
                                const block = lookup instanceof Map ? lookup.get(context.label) : null;
                                if (block && (Number.isFinite(block.successCount) || Number.isFinite(block.failureCount))) {
                                    const success = Number.isFinite(block.successCount) ? numberFormatter.format(block.successCount) : null;
                                    const failure = Number.isFinite(block.failureCount) ? numberFormatter.format(block.failureCount) : null;
                                    const parts = [];
                                    if (success) {
                                        parts.push(`${success} sukses`);
                                    }
                                    if (failure && failure !== '0') {
                                        parts.push(`${failure} gagal`);
                                    }
                                    if (parts.length > 0) {
                                        return `${label} (${parts.join(', ')})`;
                                    }
                                }

                                return label;
                            },
                            footer(items) {
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
                            },
                        },
                    },
                },
            },
        });
    }

    async function loadBlockComparisonData() {
        if (isLoading) {
            return;
        }

        isLoading = true;
        setStatus('Memuat data perbandingan blok jaringan...', 'info');
        destroyBlockCountChart();
        destroyBlockTimelineChart();
        showSummaryPlaceholder('Menyiapkan ringkasan blok jaringan...', 'info');
        setChartLoading(blockCountContainer, 'Menyiapkan visualisasi total blok per jaringan...');
        setChartLoading(blockTimelineContainer, 'Menyiapkan visualisasi distribusi blok terbaru...');
        resetHighlights();

        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.classList.add('opacity-60', 'cursor-wait');
        }

        try {
            const response = await fetch('/api/simulations/summary', {
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Gagal mengambil data blok (status ${response.status})`);
            }

            const payload = await response.json();
            const networks = Array.isArray(payload?.networks) ? payload.networks : [];

            renderSummaryCards(networks);
            renderBlockCountChart(networks);
            renderBlockTimelineChart(networks);
            updateHighlightValues(payload?.overall || null, networks);
            setUpdatedAtLabel(payload?.updatedAt || payload?.fetchedAt || null);

            const fetchedLabel = formatDateTime(payload?.fetchedAt);
            const statusMessage = fetchedLabel
                ? `Berhasil dimuat: ${fetchedLabel}`
                : 'Data perbandingan blok jaringan berhasil dimuat.';
            setStatus(statusMessage, 'success');
        } catch (error) {
            console.error('Gagal memuat data perbandingan blok jaringan:', error);
            setStatus('Gagal memuat data perbandingan blok jaringan.', 'error');
            showSummaryPlaceholder('Tidak dapat memuat data blok jaringan.', 'error');
            setChartMessage(blockCountContainer, 'Tidak dapat memuat grafik blok jaringan.', 'error');
            setChartMessage(blockTimelineContainer, 'Tidak dapat memuat grafik distribusi blok.', 'error');
            if (highlightGrid) {
                highlightGrid.dataset.state = 'error';
            }
            setHighlightValues({});
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
