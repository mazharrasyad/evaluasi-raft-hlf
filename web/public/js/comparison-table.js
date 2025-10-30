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

    const overallTotalEl = document.querySelector('[data-overall-total]');
    const overallSuccessEl = document.querySelector('[data-overall-success]');
    const overallFailureEl = document.querySelector('[data-overall-failure]');
    const overallLatencyEl = document.querySelector('[data-overall-latency]');
    const overallSuccessRateEl = document.querySelector('[data-overall-success-rate]');
    const overallBlockCountEl = document.querySelector('[data-overall-block-count]');

    const refreshButton = document.getElementById('refreshSummaryButton');

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

    function getScopeBadge(scope) {
        if (!scope) {
            return '';
        }

        const scopeLabel = scopeLabels[scope] || scope;
        return `<span class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-surface/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-secondary/80">${scopeLabel}</span>`;
    }

    function getChannelBadge(channel) {
        if (!channel) {
            return '';
        }

        return `<span class="text-xs text-textdark/60">Channel: ${channel}</span>`;
    }

    function getDataAvailabilityBadge(hasSimulationData) {
        if (hasSimulationData !== false) {
            return '';
        }

        return `<span class="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200">Belum ada data</span>`;
    }

    function renderBlockHighlights(blocks) {
        if (!Array.isArray(blocks) || blocks.length === 0) {
            return '';
        }

        const sortedBlocks = [...blocks]
            .filter(Boolean)
            .sort((a, b) => {
                const timeA = a?.lastUpdatedAt ? Date.parse(a.lastUpdatedAt) : Number.NaN;
                const timeB = b?.lastUpdatedAt ? Date.parse(b.lastUpdatedAt) : Number.NaN;

                const hasTimeA = Number.isFinite(timeA);
                const hasTimeB = Number.isFinite(timeB);

                if (hasTimeA || hasTimeB) {
                    if (!hasTimeA) {
                        return 1;
                    }
                    if (!hasTimeB) {
                        return -1;
                    }
                    return timeB - timeA;
                }

                const numberA = Number.isFinite(a?.blockNumber) ? a.blockNumber : Number.NEGATIVE_INFINITY;
                const numberB = Number.isFinite(b?.blockNumber) ? b.blockNumber : Number.NEGATIVE_INFINITY;

                if (numberA !== numberB) {
                    return numberB - numberA;
                }

                return String(a?.blockLabel || '').localeCompare(String(b?.blockLabel || ''));
            })
            .slice(0, 3);

        if (sortedBlocks.length === 0) {
            return '';
        }

        const items = sortedBlocks.map(block => {
            const blockLabel = block?.blockLabel || (Number.isFinite(block?.blockNumber)
                ? `#${block.blockNumber}`
                : 'Blok');
            const success = formatCount(block?.successCount);
            const failure = formatCount(block?.failureCount);
            const latency = formatLatency(block?.averageLatencyMs);
            const updated = block?.lastUpdatedAt ? formatTimestamp(block.lastUpdatedAt) : '—';

            return `<li class="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-soft/50 px-3 py-2">
                <span class="text-xs font-semibold text-textdark">${blockLabel}</span>
                <span class="text-[11px] text-textdark/60">Terakhir: ${updated}</span>
                <span class="text-[11px] text-textdark/60">Sukses: <span class="font-semibold text-emerald-300">${success}</span> &bull; Gagal: <span class="font-semibold text-rose-300">${failure}</span></span>
                <span class="text-[11px] text-textdark/60">Latensi rata-rata: <span class="font-semibold text-amber-200">${latency}</span></span>
            </li>`;
        }).join('');

        return `<div class="mt-3 space-y-2 text-[11px] text-textdark/60">
            <p class="font-semibold uppercase tracking-[0.28em] text-secondary/70">Sorotan blok terbaru</p>
            <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${items}</ul>
        </div>`;
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
            const blockHighlights = renderBlockHighlights(network.blocks);

            const volumeMetrics = [
                {
                    label: 'Blok tercatat',
                    value: formatCount(blockCount),
                    valueClass: 'text-textdark',
                    numeric: true,
                },
                {
                    label: 'Total catatan',
                    value: formatCount(network.totalCount),
                    valueClass: 'text-textdark',
                    numeric: true,
                },
                {
                    label: 'Berhasil',
                    value: formatCount(network.successCount),
                    valueClass: 'text-emerald-300',
                    numeric: true,
                },
                {
                    label: 'Gagal',
                    value: formatCount(network.failureCount),
                    valueClass: 'text-rose-300',
                    numeric: true,
                },
                {
                    label: 'Rasio sukses',
                    value: formatSuccessRate(network.successRate),
                    valueClass: 'text-primary',
                    numeric: false,
                },
            ];

            const performanceMetrics = [
                {
                    label: 'Latensi rata-rata',
                    value: formatLatency(network.averageLatencyMs),
                    valueClass: 'text-amber-200',
                    numeric: true,
                },
                {
                    label: 'Waktu commit rata-rata',
                    value: formatLatency(network.averageCommitTimeMs),
                    valueClass: 'text-secondary',
                    numeric: true,
                },
                {
                    label: 'Throughput',
                    value: formatThroughput(network.throughput),
                    valueClass: 'text-primary',
                    numeric: false,
                },
                {
                    label: 'Payload rata-rata',
                    value: formatByteSize(network.averagePayloadSizeBytes),
                    valueClass: 'text-textdark',
                    numeric: false,
                },
                {
                    label: 'Hasil rata-rata',
                    value: formatByteSize(network.averageResultSizeBytes),
                    valueClass: 'text-textdark',
                    numeric: false,
                },
                {
                    label: 'Jendela pengamatan',
                    value: formatObservationWindow(network),
                    valueClass: 'text-textdark/70',
                    numeric: false,
                },
            ];

            const renderMetricList = (metrics) => metrics.map((metric) => {
                const valueClass = metric.valueClass || 'text-textdark';
                const numericClass = metric.numeric ? 'tabular-nums' : '';
                return `
                    <div class="flex items-center justify-between gap-3">
                        <span class="text-[11px] font-semibold uppercase tracking-[0.28em] text-textdark/60">${metric.label}</span>
                        <span class="text-sm font-semibold ${valueClass} ${numericClass}">${metric.value}</span>
                    </div>
                `;
            }).join('');

            const volumeHtml = renderMetricList(volumeMetrics);
            const performanceHtml = renderMetricList(performanceMetrics);

            row.innerHTML = `
                <td class="px-4 py-4 align-top">
                    <div class="flex flex-col gap-1">
                        <span class="text-sm font-semibold text-textdark">${network.label || 'Jaringan'}</span>
                        <div class="flex flex-wrap items-center gap-2 text-xs text-textdark/60">
                            ${getScopeBadge(network.scope)}
                            ${getChannelBadge(network.channel)}
                            ${getDataAvailabilityBadge(network.hasSimulationData)}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-4 align-top">
                    <div class="flex flex-col gap-2 rounded-2xl border border-white/5 bg-soft/40 p-4 text-xs text-textdark/70">
                        ${volumeHtml}
                    </div>
                </td>
                <td class="px-4 py-4 align-top">
                    <div class="flex flex-col gap-2 rounded-2xl border border-white/5 bg-soft/40 p-4 text-xs text-textdark/70">
                        ${performanceHtml}
                    </div>
                </td>
                <td class="px-4 py-4 align-top text-xs text-textdark/60">
                    <div class="flex flex-col gap-1">
                        <span>Blok terakhir: <span class="font-semibold text-textdark">${blockLabel}</span></span>
                        <span>Ringkasan: ${summaryUpdatedLabel}</span>
                        ${blockUpdatedLabel ? `<span>Pembaruan blok: ${blockUpdatedLabel}</span>` : ''}
                    </div>
                    ${blockHighlights}
                </td>
            `;

            tableBody.appendChild(row);
        });

        table.classList.remove('hidden');
        setState('ready');
    }

    function renderOverall(overall = {}, updatedAt = null) {
        if (overallTotalEl) {
            overallTotalEl.textContent = formatCount(overall.totalCount);
        }
        if (overallSuccessEl) {
            overallSuccessEl.textContent = formatCount(overall.successCount);
        }
        if (overallFailureEl) {
            overallFailureEl.textContent = formatCount(overall.failureCount);
        }
        if (overallLatencyEl) {
            overallLatencyEl.textContent = formatLatency(overall.averageLatencyMs);
        }
        if (overallSuccessRateEl) {
            overallSuccessRateEl.textContent = formatSuccessRate(overall.successRate);
        }
        if (summaryTimestampEl) {
            summaryTimestampEl.textContent = formatTimestamp(updatedAt);
        }
        if (overallBlockCountEl) {
            overallBlockCountEl.textContent = formatCount(overall.blockCount);
        }
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
            renderOverall(data?.overall, data?.updatedAt);
            renderTable(Array.isArray(data?.networks) ? data.networks : []);
        } catch (error) {
            console.error('Gagal memuat ringkasan simulasi:', error);
            const message = error instanceof Error ? error.message : 'Gagal memuat ringkasan jaringan.';
            clearTable();
            if (table) {
                table.classList.add('hidden');
            }
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
