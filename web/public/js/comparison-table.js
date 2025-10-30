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

            const scopeLabel = scopeLabels[network.scope] || null;
            const scopeBadge = scopeLabel
                ? `<span class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-surface/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-secondary/80">${scopeLabel}</span>`
                : '';
            const channelLine = network.channel
                ? `<span class="text-xs text-textdark/60">Channel: ${network.channel}</span>`
                : '';

            row.innerHTML = `
                <td class="px-4 py-4 align-middle">
                    <div class="flex flex-col gap-1">
                        <span class="text-sm font-semibold text-textdark">${network.label || 'Jaringan'}</span>
                        <div class="flex flex-wrap items-center gap-2 text-xs text-textdark/60">
                            ${scopeBadge}
                            ${channelLine}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-4 text-right text-sm font-semibold text-textdark tabular-nums">${formatCount(network.totalCount)}</td>
                <td class="px-4 py-4 text-right text-sm font-semibold text-emerald-300 tabular-nums">${formatCount(network.successCount)}</td>
                <td class="px-4 py-4 text-right text-sm font-semibold text-rose-300 tabular-nums">${formatCount(network.failureCount)}</td>
                <td class="px-4 py-4 text-right text-sm font-medium text-amber-200 tabular-nums">${formatLatency(network.averageLatencyMs)}</td>
                <td class="px-4 py-4 text-right text-sm font-medium text-primary tabular-nums">${formatSuccessRate(network.successRate)}</td>
                <td class="px-4 py-4 text-left text-xs text-textdark/60">${formatTimestamp(network.lastUpdatedAt)}</td>
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
