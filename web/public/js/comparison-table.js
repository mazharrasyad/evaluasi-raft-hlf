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
    }

    function updateSummaryTimestamp(updatedAt) {
        if (!summaryTimestampEl) {
            return;
        }
        summaryTimestampEl.textContent = formatTimestamp(updatedAt);
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
