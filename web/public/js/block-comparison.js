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
    const latestLatencyChartContainer = document.querySelector('[data-latest-latency-chart]');
    const latestLatencyChartCanvas = document.getElementById('latestLatencyChart');
    const averageLatencyChartContainer = document.querySelector('[data-average-latency-chart]');
    const averageLatencyChartCanvas = document.getElementById('averageLatencyChart');
    const throughputChartContainer = document.querySelector('[data-throughput-chart]');
    const throughputChartCanvas = document.getElementById('throughputChart');
    const successCommitChartContainer = document.querySelector('[data-success-commit-chart]');
    const successCommitChartCanvas = document.getElementById('successCommitChart');
    const failedCommitChartContainer = document.querySelector('[data-failed-commit-chart]');
    const failedCommitChartCanvas = document.getElementById('failedCommitChart');

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
    const metricChartInstances = new Map();

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

    function showHighlightPlaceholder(message, tone = 'info') {
        if (!highlightGrid) {
            return;
        }

        highlightGrid.dataset.state = tone === 'error' ? 'error' : 'placeholder';
        highlightGrid.replaceChildren(createPlaceholderArticle(message, tone));
    }

    function resetHighlights() {
        showHighlightPlaceholder('Menyiapkan sorotan performa blok...', 'info');
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
        return '0,00 tx/detik';
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

    function createHighlightMetric(label, value, options = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-1';

        if (options.fullWidth) {
            wrapper.classList.add('sm:col-span-2');
        }

        const labelEl = document.createElement('p');
        labelEl.className = 'text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-textdark/60';
        labelEl.textContent = label;

        const valueEl = document.createElement('p');
        const baseValueClasses = options.size === 'base'
            ? ['text-base', 'font-semibold', 'text-textdark']
            : ['text-lg', 'font-semibold', 'text-textdark'];
        valueEl.className = '';
        baseValueClasses.forEach((className) => valueEl.classList.add(className));

        if (options.valueClass) {
            options.valueClass.split(' ').forEach((className) => {
                if (className && className.trim() !== '') {
                    valueEl.classList.add(className.trim());
                }
            });
        }

        valueEl.textContent = value;

        wrapper.append(labelEl, valueEl);

        if (options.hint) {
            const hintEl = document.createElement('p');
            hintEl.className = 'text-[0.65rem] text-textdark/60';
            hintEl.textContent = options.hint;
            wrapper.append(hintEl);
        }

        return wrapper;
    }

    function createHighlightCard({ title, subtitle, badge, metrics, tone = 'default' } = {}) {
        const article = document.createElement('article');
        article.className = 'flex flex-col gap-6 rounded-3xl border border-white/10 bg-surfaceMuted/60 p-6 shadow-inner shadow-black/20 transition';

        if (tone === 'inactive') {
            article.classList.add('opacity-60');
        }

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-3';

        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'space-y-1';

        const heading = document.createElement('h3');
        heading.className = 'text-lg font-semibold text-textdark';
        heading.textContent = title || 'Sorotan Komit';
        titleWrapper.append(heading);

        if (subtitle) {
            const subtitleEl = document.createElement('p');
            subtitleEl.className = 'text-xs text-textdark/60';
            subtitleEl.textContent = subtitle;
            titleWrapper.append(subtitleEl);
        }

        header.append(titleWrapper);

        if (badge instanceof HTMLElement) {
            header.append(badge);
        }

        article.append(header);

        const metricsWrapper = document.createElement('div');
        metricsWrapper.className = 'grid grid-cols-1 gap-4 sm:grid-cols-2';

        if (Array.isArray(metrics)) {
            metrics.forEach((metric) => {
                if (!metric || typeof metric !== 'object') {
                    return;
                }

                const metricEl = createHighlightMetric(metric.label, metric.value, metric.options || metric);
                metricsWrapper.append(metricEl);
            });
        }

        article.append(metricsWrapper);

        return article;
    }

    function selectLatestBlockForNetwork(network) {
        if (!network || typeof network !== 'object') {
            return null;
        }

        const blocks = Array.isArray(network.blocks) ? network.blocks : [];
        if (blocks.length === 0) {
            return buildFallbackBlockFromNetwork(network);
        }

        return blocks.reduce((latest, block) => {
            if (!latest) {
                return block;
            }
            return isNewerBlock(block, latest) ? block : latest;
        }, null);
    }

    function getLatestLatencyMs(network, overall) {
        if (!network || typeof network !== 'object') {
            return null;
        }

        const latestBlock = selectLatestBlockForNetwork(network);
        let latestLatency = null;

        if (latestBlock && typeof latestBlock === 'object') {
            if (Number.isFinite(latestBlock.averageCommitTimeMs)) {
                latestLatency = latestBlock.averageCommitTimeMs;
            } else if (Number.isFinite(latestBlock.averageLatencyMs)) {
                latestLatency = latestBlock.averageLatencyMs;
            }
        }

        if (!Number.isFinite(latestLatency)) {
            if (Number.isFinite(network.averageCommitTimeMs)) {
                latestLatency = network.averageCommitTimeMs;
            } else if (Number.isFinite(network.averageLatencyMs)) {
                latestLatency = network.averageLatencyMs;
            } else if (overall && typeof overall === 'object') {
                if (Number.isFinite(overall.averageCommitTimeMs)) {
                    latestLatency = overall.averageCommitTimeMs;
                } else if (Number.isFinite(overall.averageLatencyMs)) {
                    latestLatency = overall.averageLatencyMs;
                }
            }
        }

        return Number.isFinite(latestLatency) ? latestLatency : null;
    }

    function getAverageLatencyMs(network, overall) {
        if (!network || typeof network !== 'object') {
            return null;
        }

        let value = Number.isFinite(network.averageLatencyMs)
            ? network.averageLatencyMs
            : null;

        if (!Number.isFinite(value)) {
            value = Number.isFinite(network.averageCommitTimeMs)
                ? network.averageCommitTimeMs
                : null;
        }

        if (!Number.isFinite(value) && overall && typeof overall === 'object') {
            if (Number.isFinite(overall.averageLatencyMs)) {
                value = overall.averageLatencyMs;
            } else if (Number.isFinite(overall.averageCommitTimeMs)) {
                value = overall.averageCommitTimeMs;
            }
        }

        return Number.isFinite(value) ? value : null;
    }

    function getThroughputValue(network, overall) {
        if (!network || typeof network !== 'object') {
            return null;
        }

        if (Number.isFinite(network.throughput)) {
            return network.throughput;
        }

        const successCount = Number.isFinite(network.successCount) ? network.successCount : null;
        const durationMs = Number.isFinite(network.observationDurationMs) ? network.observationDurationMs : null;

        if (successCount === 0) {
            return 0;
        }

        if (successCount !== null && durationMs !== null) {
            if (durationMs === 0) {
                return successCount;
            }

            if (durationMs > 0) {
                return successCount / (durationMs / 1000);
            }

            return null;
        }

        if (overall && typeof overall === 'object' && Number.isFinite(overall.throughput)) {
            return overall.throughput;
        }

        return null;
    }

    function getCommitSuccessCount(network) {
        if (!network || typeof network !== 'object') {
            return 0;
        }

        const value = Number.isFinite(network.successCount) ? network.successCount : 0;
        return value;
    }

    function getCommitFailureCount(network) {
        if (!network || typeof network !== 'object') {
            return 0;
        }

        const value = Number.isFinite(network.failureCount) ? network.failureCount : 0;
        return value;
    }

    const metricChartDefinitions = [
        {
            key: 'latest-latency',
            container: latestLatencyChartContainer,
            canvas: latestLatencyChartCanvas,
            datasetLabel: 'Latensi terbaru',
            loadingMessage: 'Menyiapkan visualisasi latensi terbaru per jaringan...',
            emptyMessage: 'Belum ada data latensi terbaru yang siap divisualisasikan.',
            errorMessage: 'Tidak dapat memuat grafik latensi terbaru.',
            valueExtractor: (network, overall) => getLatestLatencyMs(network, overall),
            tickFormatter: (value) => decimalFormatter.format(value),
            tooltipFormatter: (value) => `${decimalFormatter.format(value)} ms`,
        },
        {
            key: 'average-latency',
            container: averageLatencyChartContainer,
            canvas: averageLatencyChartCanvas,
            datasetLabel: 'Rata-rata latensi',
            loadingMessage: 'Menyiapkan visualisasi rata-rata latensi per jaringan...',
            emptyMessage: 'Belum ada data rata-rata latensi yang siap divisualisasikan.',
            errorMessage: 'Tidak dapat memuat grafik rata-rata latensi.',
            valueExtractor: (network, overall) => getAverageLatencyMs(network, overall),
            tickFormatter: (value) => decimalFormatter.format(value),
            tooltipFormatter: (value) => `${decimalFormatter.format(value)} ms`,
        },
        {
            key: 'throughput',
            container: throughputChartContainer,
            canvas: throughputChartCanvas,
            datasetLabel: 'Throughput',
            loadingMessage: 'Menyiapkan visualisasi throughput per jaringan...',
            emptyMessage: 'Belum ada data throughput yang siap divisualisasikan.',
            errorMessage: 'Tidak dapat memuat grafik throughput.',
            valueExtractor: (network, overall) => getThroughputValue(network, overall),
            tickFormatter: (value) => decimalFormatter.format(value),
            tooltipFormatter: (value) => `${decimalFormatter.format(value)} tx/detik`,
        },
        {
            key: 'commit-success',
            container: successCommitChartContainer,
            canvas: successCommitChartCanvas,
            datasetLabel: 'Commit berhasil',
            loadingMessage: 'Menyiapkan visualisasi commit berhasil per jaringan...',
            emptyMessage: 'Belum ada data commit berhasil yang siap divisualisasikan.',
            errorMessage: 'Tidak dapat memuat grafik commit berhasil.',
            valueExtractor: (network) => getCommitSuccessCount(network),
            tickFormatter: (value) => numberFormatter.format(value),
            tooltipFormatter: (value) => `${numberFormatter.format(value)} commit sukses`,
        },
        {
            key: 'commit-failure',
            container: failedCommitChartContainer,
            canvas: failedCommitChartCanvas,
            datasetLabel: 'Commit gagal',
            loadingMessage: 'Menyiapkan visualisasi commit gagal per jaringan...',
            emptyMessage: 'Belum ada data commit gagal yang siap divisualisasikan.',
            errorMessage: 'Tidak dapat memuat grafik commit gagal.',
            valueExtractor: (network) => getCommitFailureCount(network),
            tickFormatter: (value) => numberFormatter.format(value),
            tooltipFormatter: (value) => `${numberFormatter.format(value)} commit gagal`,
        },
    ];

    function formatHighlightValues(values = {}) {
        const successCount = Number.isFinite(values.successCount) ? values.successCount : 0;
        const failureCount = Number.isFinite(values.failureCount) ? values.failureCount : 0;

        return {
            latestLatency: formatLatencyValue(values.latestLatency),
            averageLatency: formatLatencyValue(values.averageLatency),
            throughput: formatThroughputValue(values.throughput),
            successCount: formatNumber(successCount),
            failureCount: formatNumber(failureCount),
            commitCode: formatTextValue(values.commitCode),
            commitBlock: formatTextValue(values.commitBlock),
        };
    }

    function buildHighlightMetrics(values) {
        if (!values || typeof values !== 'object') {
            return [];
        }

        return [
            { label: 'Latensi terbaru', value: values.latestLatency },
            { label: 'Rata-rata latensi', value: values.averageLatency },
            { label: 'Throughput', value: values.throughput },
            { label: 'Commit berhasil', value: values.successCount },
            { label: 'Commit gagal', value: values.failureCount },
            {
                label: 'Kode commit terakhir',
                value: values.commitCode,
                fullWidth: true,
                size: 'base',
                valueClass: 'truncate font-mono text-primary/80',
            },
            {
                label: 'Blok commit terakhir',
                value: values.commitBlock,
                fullWidth: true,
                size: 'base',
            },
        ];
    }

    function computeOverallHighlight(overall, networks) {
        const values = {
            latestLatency: null,
            averageLatency: null,
            throughput: null,
            successCount: 0,
            failureCount: 0,
            commitCode: null,
            commitBlock: null,
        };

        if (overall && typeof overall === 'object') {
            values.successCount = Number.isFinite(overall.successCount) ? overall.successCount : 0;
            values.failureCount = Number.isFinite(overall.failureCount) ? overall.failureCount : 0;
            values.averageLatency = Number.isFinite(overall.averageLatencyMs)
                ? overall.averageLatencyMs
                : (Number.isFinite(overall.averageCommitTimeMs) ? overall.averageCommitTimeMs : null);
            values.throughput = Number.isFinite(overall.throughput) ? overall.throughput : null;
        }

        const latestInfo = selectLatestBlockInfo(networks);
        let subtitle = null;

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

            values.latestLatency = latestLatency;
            values.commitCode = block?.lastTransactionId || network?.lastTransactionId || null;
            values.commitBlock = resolveBlockLabel(block) || network?.lastBlockLabel || null;

            const timestamp = block?.lastUpdatedAt || block?.lastCompletedAt || network?.lastBlockUpdatedAt || null;
            const formattedTimestamp = formatDateTime(timestamp);
            if (formattedTimestamp) {
                subtitle = `Pembaruan terakhir ${formattedTimestamp}`;
            }
        } else {
            values.latestLatency = Number.isFinite(overall?.averageCommitTimeMs)
                ? overall.averageCommitTimeMs
                : (Number.isFinite(overall?.averageLatencyMs) ? overall.averageLatencyMs : null);

            const fallbackTimestamp = overall?.lastCompletedAt || overall?.lastUpdatedAt || null;
            const formattedTimestamp = formatDateTime(fallbackTimestamp);
            if (formattedTimestamp) {
                subtitle = `Pembaruan terakhir ${formattedTimestamp}`;
            }
        }

        const formatted = formatHighlightValues(values);
        const metrics = buildHighlightMetrics(formatted);

        return {
            title: 'Gabungan Jaringan',
            subtitle,
            metrics,
            tone: 'default',
        };
    }

    function computeNetworkHighlight(network, overall) {
        if (!network || typeof network !== 'object') {
            return null;
        }

        const latestBlock = selectLatestBlockForNetwork(network);
        const values = {
            latestLatency: null,
            averageLatency: Number.isFinite(network.averageLatencyMs)
                ? network.averageLatencyMs
                : (Number.isFinite(network.averageCommitTimeMs) ? network.averageCommitTimeMs : null),
            throughput: Number.isFinite(network.throughput) ? network.throughput : null,
            successCount: Number.isFinite(network.successCount) ? network.successCount : 0,
            failureCount: Number.isFinite(network.failureCount) ? network.failureCount : 0,
            commitCode: latestBlock?.lastTransactionId || network.lastTransactionId || null,
            commitBlock: resolveBlockLabel(latestBlock) || network.lastBlockLabel || null,
        };

        let latestLatency = Number.isFinite(latestBlock?.averageCommitTimeMs)
            ? latestBlock.averageCommitTimeMs
            : (Number.isFinite(latestBlock?.averageLatencyMs) ? latestBlock.averageLatencyMs : null);

        if (!Number.isFinite(latestLatency)) {
            if (Number.isFinite(network.averageCommitTimeMs)) {
                latestLatency = network.averageCommitTimeMs;
            } else if (Number.isFinite(network.averageLatencyMs)) {
                latestLatency = network.averageLatencyMs;
            } else if (overall && typeof overall === 'object') {
                if (Number.isFinite(overall.averageCommitTimeMs)) {
                    latestLatency = overall.averageCommitTimeMs;
                } else if (Number.isFinite(overall.averageLatencyMs)) {
                    latestLatency = overall.averageLatencyMs;
                } else {
                    latestLatency = null;
                }
            }
        }

        values.latestLatency = latestLatency;

        const formatted = formatHighlightValues(values);
        const metrics = buildHighlightMetrics(formatted);

        const subtitleParts = [];
        if (values.commitBlock && typeof values.commitBlock === 'string' && values.commitBlock.trim() !== '') {
            subtitleParts.push(`Blok ${values.commitBlock}`);
        }

        const timestamp = latestBlock?.lastUpdatedAt
            || latestBlock?.lastCompletedAt
            || network.lastBlockUpdatedAt
            || network.lastUpdatedAt
            || network.lastCompletedAt
            || null;
        const formattedTimestamp = formatDateTime(timestamp);
        if (formattedTimestamp) {
            subtitleParts.push(`Diperbarui ${formattedTimestamp}`);
        }

        const badge = getScopeBadge(network.scope);
        if (badge) {
            badge.classList.add('shrink-0');
        }

        return {
            title: network.label || network.id || 'Jaringan RAFT',
            subtitle: subtitleParts.join(' • ') || null,
            badge,
            metrics,
            tone: network.hasSimulationData === false ? 'inactive' : 'default',
        };
    }

    function renderHighlightCards(overall, networks) {
        if (!highlightGrid) {
            return;
        }

        const cards = [];
        const overallCard = computeOverallHighlight(overall, networks);
        if (overallCard) {
            cards.push(overallCard);
        }

        if (Array.isArray(networks)) {
            networks.forEach((network) => {
                const card = computeNetworkHighlight(network, overall);
                if (card) {
                    cards.push(card);
                }
            });
        }

        if (cards.length === 0) {
            showHighlightPlaceholder('Belum ada sorotan performa blok yang dapat ditampilkan.', 'empty');
            return;
        }

        highlightGrid.dataset.state = 'ready';
        highlightGrid.replaceChildren();

        cards.forEach((cardConfig) => {
            const card = createHighlightCard(cardConfig);
            if (card) {
                highlightGrid.append(card);
            }
        });
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

    function destroyMetricChart(key) {
        if (!key) {
            return;
        }

        const existing = metricChartInstances.get(key);
        if (existing) {
            existing.destroy();
            metricChartInstances.delete(key);
        }
    }

    function destroyMetricCharts() {
        metricChartInstances.forEach((chart) => {
            if (chart) {
                chart.destroy();
            }
        });
        metricChartInstances.clear();
    }

    function setMetricChartsLoading() {
        metricChartDefinitions.forEach((definition) => {
            if (!definition || !definition.container) {
                return;
            }

            setChartLoading(
                definition.container,
                definition.loadingMessage || 'Menyiapkan visualisasi metrik per jaringan...',
            );
        });
    }

    function setMetricChartsError() {
        metricChartDefinitions.forEach((definition) => {
            if (!definition || !definition.container) {
                return;
            }

            setChartMessage(
                definition.container,
                definition.errorMessage || 'Tidak dapat memuat grafik metrik per jaringan.',
                'error',
            );
        });
    }

    function renderMetricChart(definition, networks, overall) {
        if (!definition || typeof definition !== 'object') {
            return;
        }

        const {
            key,
            container,
            canvas,
            datasetLabel,
            valueExtractor,
            emptyMessage,
        } = definition;

        const chartKey = key || datasetLabel || `metric-${metricChartInstances.size + 1}`;

        if (!container || !canvas) {
            destroyMetricChart(chartKey);
            return;
        }

        destroyMetricChart(chartKey);

        if (!Array.isArray(networks) || networks.length === 0) {
            setChartMessage(
                container,
                emptyMessage || 'Belum ada data metrik yang siap divisualisasikan.',
                'empty',
            );
            return;
        }

        if (!isChartJsAvailable()) {
            setChartMessage(
                container,
                definition.errorMessage || 'Chart.js tidak tersedia untuk menampilkan grafik.',
                'error',
            );
            return;
        }

        const labels = networks.map((network, index) => network?.label || network?.id || `Jaringan ${index + 1}`);
        const extractor = typeof valueExtractor === 'function'
            ? valueExtractor
            : (() => null);

        const rawData = networks.map((network) => extractor(network, overall));
        const hasData = rawData.some((value) => Number.isFinite(value));

        if (!hasData) {
            setChartMessage(
                container,
                emptyMessage || 'Belum ada data metrik yang siap divisualisasikan.',
                'empty',
            );
            return;
        }

        const data = rawData.map((value) => (Number.isFinite(value) ? value : null));
        const context = canvas.getContext('2d');

        if (!context) {
            setChartMessage(container, definition.errorMessage || 'Kanvas grafik tidak tersedia.', 'error');
            return;
        }

        setChartReady(container);

        const backgroundColors = labels.map((_, index) => hexToRgba(COLOR_PALETTE[index % COLOR_PALETTE.length], 0.45));
        const borderColors = labels.map((_, index) => COLOR_PALETTE[index % COLOR_PALETTE.length]);

        const tickFormatter = typeof definition.tickFormatter === 'function'
            ? definition.tickFormatter
            : (value) => numberFormatter.format(value);

        const tooltipFormatter = typeof definition.tooltipFormatter === 'function'
            ? definition.tooltipFormatter
            : (value) => numberFormatter.format(value);

        const chart = new window.Chart(context, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: datasetLabel || 'Metrik',
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
                                const numericValue = typeof value === 'number' ? value : Number(value);
                                if (!Number.isFinite(numericValue)) {
                                    return '';
                                }
                                return tickFormatter(numericValue, definition);
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
                                const datasetLabelText = context.dataset.label || '';
                                const value = Number.isFinite(context.parsed.y) ? context.parsed.y : null;

                                if (value === null) {
                                    return datasetLabelText || '';
                                }

                                const network = networks[context.dataIndex] || null;
                                const labelText = labels[context.dataIndex] || '';
                                const formattedValue = tooltipFormatter(value, network, labelText, definition);

                                return datasetLabelText
                                    ? `${datasetLabelText}: ${formattedValue}`
                                    : formattedValue;
                            },
                        },
                    },
                },
            },
        });

        metricChartInstances.set(chartKey, chart);
    }

    function renderMetricCharts(networks, overall) {
        metricChartDefinitions.forEach((definition) => {
            renderMetricChart(definition, networks, overall);
        });
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
        destroyMetricCharts();
        showSummaryPlaceholder('Menyiapkan ringkasan blok jaringan...', 'info');
        setChartLoading(blockCountContainer, 'Menyiapkan visualisasi total blok per jaringan...');
        setChartLoading(blockTimelineContainer, 'Menyiapkan visualisasi distribusi blok terbaru...');
        setMetricChartsLoading();
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
            renderMetricCharts(networks, payload?.overall || null);
            renderHighlightCards(payload?.overall || null, networks);
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
            setMetricChartsError();
            showHighlightPlaceholder('Tidak dapat memuat sorotan performa blok.', 'error');
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
