const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    const refreshButton = document.getElementById('refreshBlockComparisonButton');
    const updatedAtEl = document.getElementById('blockComparisonUpdatedAt');
    const networkStatusGrid = document.getElementById('blockNetworkStatusGrid');
    const networkStatusCheckedAtEl = document.getElementById('blockNetworkStatusCheckedAt');

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

    const numberFormatter = new Intl.NumberFormat('en-US');
    const decimalFormatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
    const percentageFormatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    });
    const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    const NETWORK_STATUS_VARIANTS = {
        healthy: {
            label: 'Operational',
            badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50',
            indicatorClass: 'bg-emerald-400',
            description: 'Fabric endpoints responded successfully.',
        },
        partial: {
            label: 'Degraded',
            badgeClass: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
            indicatorClass: 'bg-amber-400',
            description: 'Some health checks reported issues.',
        },
        unhealthy: {
            label: 'Down (mati)',
            badgeClass: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
            indicatorClass: 'bg-rose-400',
            description: 'The network is unreachable.',
        },
        unavailable: {
            label: 'Down (mati)',
            badgeClass: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
            indicatorClass: 'bg-rose-400',
            description: 'Health checks could not be completed.',
        },
        unknown: {
            label: 'Unknown',
            badgeClass: 'border-white/10 bg-surface/70 text-textdark/70',
            indicatorClass: 'bg-muted/60',
            description: 'Health status cannot be determined.',
        },
    };

    function normalizeResultStatus(status) {
        if (status === 'healthy') {
            return 'healthy';
        }
        if (status === 'unhealthy') {
            return 'unhealthy';
        }
        if (status === 'partial') {
            return 'partial';
        }
        if (status === 'unavailable') {
            return 'unavailable';
        }
        return 'unknown';
    }

    function normalizeOverallStatus(status) {
        if (status === 'healthy') {
            return 'healthy';
        }
        if (status === 'partial') {
            return 'partial';
        }
        if (status === 'unavailable') {
            return 'unavailable';
        }
        return 'unknown';
    }

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
            loadingMessage: 'Preparing block throughput chart...',
            emptyMessage: 'No block throughput data is available yet.',
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
                    return 'No data';
                }
                return `${decimalFormatter.format(value)} transactions/sec`;
            },
            tooltipExtras({ block }) {
                if (!block || typeof block !== 'object') {
                    return [];
                }

                const extras = [];
                if (Number.isFinite(block.successCount)) {
                    extras.push(`Successful: ${numberFormatter.format(block.successCount)}`);
                }
                if (Number.isFinite(block.failureCount) && block.failureCount > 0) {
                    extras.push(`Failed: ${numberFormatter.format(block.failureCount)}`);
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
            loadingMessage: 'Preparing block latency chart...',
            emptyMessage: 'No block latency data is available yet.',
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
                    return 'No data';
                }
                return `${decimalFormatter.format(value)} ms`;
            },
            tooltipExtras({ block }) {
                if (!block || typeof block !== 'object') {
                    return [];
                }

                const extras = [];
                if (Number.isFinite(block.successCount)) {
                    extras.push(`Successful: ${numberFormatter.format(block.successCount)}`);
                }
                if (Number.isFinite(block.failureCount) && block.failureCount > 0) {
                    extras.push(`Failed: ${numberFormatter.format(block.failureCount)}`);
                }
                if (Number.isFinite(block.throughput)) {
                    extras.push(`Throughput: ${decimalFormatter.format(block.throughput)} tps`);
                }
                return extras;
            },
        },
        {
            id: 'resourceUsage',
            loadingMessage: 'Preparing block resource utilisation chart...',
            emptyMessage: 'No block resource utilisation estimates are available yet.',
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
                return label || 'No data';
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
            loadingMessage: 'Preparing block fault-tolerance chart...',
            emptyMessage: 'No block fault-tolerance scores are available yet.',
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
                return label || 'No data';
            },
            tooltipExtras({ block }) {
                if (!block || typeof block !== 'object') {
                    return [];
                }

                const extras = [];
                if (Number.isFinite(block.successCount)) {
                    extras.push(`Successful: ${numberFormatter.format(block.successCount)}`);
                }
                if (Number.isFinite(block.failureCount) && block.failureCount > 0) {
                    extras.push(`Failed: ${numberFormatter.format(block.failureCount)}`);
                }
                const successRate = formatSuccessRate(block);
                if (successRate) {
                    extras.push(`Success rate: ${successRate}`);
                }
                if (block.lastStatus) {
                    extras.push(`Last status: ${String(block.lastStatus).toUpperCase()}`);
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
            console.error('Failed to format timestamp for block comparison:', error);
            return null;
        }
    }

    function setUpdatedAtLabel(value) {
        if (!updatedAtEl) {
            return;
        }

        const formatted = formatDateTime(value);
        updatedAtEl.textContent = formatted ? `Last updated: ${formatted}` : '';
    }

    function setNetworkStatusCheckedAt(value) {
        if (!networkStatusCheckedAtEl) {
            return;
        }

        const formatted = formatDateTime(value);
        networkStatusCheckedAtEl.textContent = formatted ? `Last checked: ${formatted}` : '';
    }

    function setNetworkStatusLoading() {
        if (!networkStatusGrid) {
            return;
        }

        networkStatusGrid.dataset.state = 'loading';
        networkStatusGrid.replaceChildren();

        const article = document.createElement('article');
        article.className = 'rounded-3xl border border-white/10 bg-surfaceMuted/70 p-6 text-sm text-textdark/70 shadow-inner shadow-black/20';

        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-3 text-textdark/80';

        const indicator = document.createElement('span');
        indicator.className = 'h-3 w-3 animate-ping rounded-full bg-secondary/70';

        const text = document.createElement('span');
        text.textContent = 'Checking network availability...';

        wrapper.append(indicator, text);
        article.append(wrapper);
        networkStatusGrid.append(article);
    }

    function setNetworkStatusMessage(message, tone = 'info') {
        if (!networkStatusGrid) {
            return;
        }

        networkStatusGrid.dataset.state = tone;
        networkStatusGrid.replaceChildren();

        const toneClasses = tone === 'error'
            ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
            : tone === 'empty'
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                : 'border-white/10 bg-surfaceMuted/70 text-textdark/70';

        const indicatorClass = tone === 'error'
            ? 'bg-rose-400'
            : tone === 'empty'
                ? 'bg-amber-400'
                : 'bg-primary/70 animate-pulse';

        const article = document.createElement('article');
        article.className = `rounded-3xl border p-6 text-sm shadow-inner shadow-black/20 ${toneClasses}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-3';

        const indicator = document.createElement('span');
        indicator.className = `h-3 w-3 rounded-full ${indicatorClass}`;

        const text = document.createElement('span');
        text.textContent = message;

        wrapper.append(indicator, text);
        article.append(wrapper);
        networkStatusGrid.append(article);
    }

    function createStatusBadge(variantKey) {
        const variant = NETWORK_STATUS_VARIANTS[variantKey] || NETWORK_STATUS_VARIANTS.unknown;
        const badge = document.createElement('span');
        badge.className = `inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] ${variant.badgeClass}`;

        const indicator = document.createElement('span');
        indicator.className = `h-2.5 w-2.5 rounded-full ${variant.indicatorClass}`;

        badge.append(indicator, document.createTextNode(variant.label));
        return badge;
    }

    function createNetworkStatusCard(options) {
        const {
            title,
            subtitle = null,
            variantKey = 'unknown',
            message = null,
            metadata = [],
        } = options || {};

        const variant = NETWORK_STATUS_VARIANTS[variantKey] || NETWORK_STATUS_VARIANTS.unknown;

        const article = document.createElement('article');
        article.className = 'flex flex-col gap-3 rounded-3xl border border-white/10 bg-surfaceMuted/70 p-6 text-sm text-textdark/70 shadow-inner shadow-black/20';

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-4';

        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'space-y-1';

        const titleEl = document.createElement('p');
        titleEl.className = 'text-base font-semibold text-textdark';
        titleEl.textContent = title || 'Network';
        titleWrapper.append(titleEl);

        if (subtitle) {
            const subtitleEl = document.createElement('p');
            subtitleEl.className = 'text-xs text-textdark/60';
            subtitleEl.textContent = subtitle;
            titleWrapper.append(subtitleEl);
        }

        header.append(titleWrapper, createStatusBadge(variantKey));
        article.append(header);

        const resolvedMessage = typeof message === 'string' && message.trim() !== ''
            ? message.trim()
            : variant.description;

        if (resolvedMessage) {
            const messageEl = document.createElement('p');
            messageEl.className = 'text-xs text-textdark/70';
            messageEl.textContent = resolvedMessage;
            article.append(messageEl);
        }

        if (Array.isArray(metadata) && metadata.length > 0) {
            const list = document.createElement('dl');
            list.className = 'mt-2 space-y-1 text-xs text-textdark/60';

            metadata.forEach((entry) => {
                if (!entry || typeof entry.label !== 'string' || typeof entry.value !== 'string' || entry.value.trim() === '') {
                    return;
                }

                const row = document.createElement('div');
                row.className = 'flex justify-between gap-2';

                const term = document.createElement('dt');
                term.className = 'font-semibold text-textdark/70';
                term.textContent = entry.label;

                const description = document.createElement('dd');
                description.className = 'text-textdark/60';
                description.textContent = entry.value;

                row.append(term, description);
                list.append(row);
            });

            if (list.children.length > 0) {
                article.append(list);
            }
        }

        return article;
    }

    function renderNetworkStatuses(payload) {
        if (!networkStatusGrid) {
            return;
        }

        const hasPayload = payload && typeof payload === 'object';

        const results = Array.isArray(payload?.results)
            ? payload.results.filter((item) => item && typeof item === 'object')
            : [];

        if (!hasPayload || results.length === 0) {
            setNetworkStatusMessage('No network health results are available yet.', 'empty');
            return;
        }

        networkStatusGrid.dataset.state = 'ready';
        networkStatusGrid.replaceChildren();

        const overallVariant = normalizeOverallStatus(payload?.overallStatus);
        const overallCard = createNetworkStatusCard({
            title: 'Overall Status',
            variantKey: overallVariant,
            message: NETWORK_STATUS_VARIANTS[overallVariant]?.description,
            metadata: [
                {
                    label: 'Checks executed',
                    value: numberFormatter.format(results.length),
                },
            ],
        });

        networkStatusGrid.append(overallCard);

        if (results.length === 0) {
            return;
        }

        results.forEach((result) => {
            const variant = normalizeResultStatus(result.status);

            const blockHeightValue = typeof result.blockHeight === 'number' && Number.isFinite(result.blockHeight)
                ? numberFormatter.format(result.blockHeight)
                : (typeof result.blockHeight === 'string' && result.blockHeight.trim() !== ''
                    ? result.blockHeight.trim()
                    : null);

            const metadata = [];

            if (result.channel && typeof result.channel === 'string') {
                metadata.push({
                    label: 'Channel',
                    value: result.channel,
                });
            }

            if (result.chaincode && typeof result.chaincode === 'string') {
                metadata.push({
                    label: 'Chaincode',
                    value: result.chaincode,
                });
            }

            if (blockHeightValue) {
                metadata.push({
                    label: 'Block height',
                    value: blockHeightValue,
                });
            }

            if (result.peer && typeof result.peer === 'string') {
                metadata.push({
                    label: 'Peer',
                    value: result.peer,
                });
            }

            const networkLabel = typeof result.label === 'string' && result.label.trim() !== ''
                ? result.label.trim()
                : (typeof result.networkDir === 'string' && result.networkDir.trim() !== ''
                    ? result.networkDir.trim()
                    : 'Network');

            const subtitleParts = [];
            if (result.networkDir && typeof result.networkDir === 'string') {
                subtitleParts.push(result.networkDir);
            }
            if (result.instructions && typeof result.instructions === 'string') {
                subtitleParts.push(result.instructions);
            }

            const message = variant === 'healthy'
                ? 'Fabric gateway responded successfully.'
                : (typeof result.message === 'string' && result.message.trim() !== ''
                    ? result.message.trim()
                    : NETWORK_STATUS_VARIANTS[variant]?.description);

            networkStatusGrid.append(createNetworkStatusCard({
                title: networkLabel,
                subtitle: subtitleParts.length > 0 ? subtitleParts.join(' • ') : null,
                variantKey: variant,
                message,
                metadata,
            }));
        });
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

        // Filter out first 7 blocks (genesis and setup blocks)
        const simulationBlocks = blocks.filter(block => {
            const blockNum = resolveBlockNumber(block);
            return blockNum === null || blockNum >= 7;
        });

        if (!limit || simulationBlocks.length <= limit) {
            return simulationBlocks.slice();
        }

        return simulationBlocks.slice(-limit);
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
            : (value !== null ? numberFormatter.format(value) : 'No data');

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
                return `Last updated: ${formatted}`;
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
                label: network.label || network.id || `Network ${index + 1}`,
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
            setChartMessage(elements.container, 'Chart canvas is not available.', 'error');
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
                    setChartMessage(elements.container, 'Chart.js is not available to render charts.', 'error');
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

    async function fetchBlockSummary() {
        const response = await fetch('/api/simulations/summary', {
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch block metrics (status ${response.status})`);
        }

        return response.json();
    }

    async function fetchNetworkAvailability() {
        const response = await fetch('/api/check-network', {
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to check network availability (status ${response.status})`);
        }

        return response.json();
    }

    async function loadBlockComparisonData(options = {}) {
        const { refreshNetworkStatus = true } = options || {};

        if (isLoading) {
            return;
        }

        isLoading = true;
        setAllChartsLoading();
        setUpdatedAtLabel(null);
        if (refreshNetworkStatus && networkStatusGrid) {
            setNetworkStatusCheckedAt(null);
            setNetworkStatusLoading();
        }

        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.classList.add('opacity-60', 'cursor-wait');
        }

        try {
            const summaryPromise = fetchBlockSummary();
            const networkPromise = refreshNetworkStatus && networkStatusGrid
                ? fetchNetworkAvailability()
                : Promise.resolve(null);

            const [summaryResult, networkResult] = await Promise.allSettled([summaryPromise, networkPromise]);

            if (summaryResult.status === 'fulfilled') {
                const payload = summaryResult.value;
                const networks = Array.isArray(payload?.networks) ? payload.networks : [];

                renderBlockMetricCharts(networks);
                setUpdatedAtLabel(payload?.updatedAt || payload?.fetchedAt || null);
            } else {
                console.error('Failed to load block comparison metrics:', summaryResult.reason);
                setAllChartsMessage('Unable to load block comparison charts.', 'error');
                setUpdatedAtLabel(null);
            }

            if (refreshNetworkStatus && networkStatusGrid) {
                if (networkResult.status === 'fulfilled' && networkResult.value) {
                    renderNetworkStatuses(networkResult.value);
                    setNetworkStatusCheckedAt(networkResult.value.checkedAt || null);
                } else if (networkResult.status === 'rejected') {
                    console.error('Failed to retrieve network availability for block comparison:', networkResult.reason);
                    setNetworkStatusMessage('Unable to verify network availability.', 'error');
                    setNetworkStatusCheckedAt(null);
                } else if (networkResult.status === 'fulfilled' && networkResult.value === null) {
                    // No network refresh requested; keep existing UI.
                }
            }
        } catch (error) {
            console.error('Unexpected error while loading block comparison data:', error);
            setAllChartsMessage('Unable to load block comparison charts.', 'error');
            if (refreshNetworkStatus && networkStatusGrid) {
                setNetworkStatusMessage('Unable to verify network availability.', 'error');
                setNetworkStatusCheckedAt(null);
            }
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
            loadBlockComparisonData({ refreshNetworkStatus: true });
        });
    }

    loadBlockComparisonData({ refreshNetworkStatus: true });
});
