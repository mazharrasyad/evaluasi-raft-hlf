const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    const refreshButton = document.getElementById('refreshBlockComparisonButton');
    const updatedAtEl = document.getElementById('blockComparisonUpdatedAt');
    const blockTimelineContainer = document.querySelector('[data-block-timeline-chart]');
    const blockTimelineCanvas = document.getElementById('blockTimelineChart');

    if (!blockTimelineContainer || !blockTimelineCanvas) {
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
    const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    let isLoading = false;
    let blockTimelineChartInstance = null;

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

    function destroyBlockTimelineChart() {
        if (blockTimelineChartInstance) {
            blockTimelineChartInstance.destroy();
            blockTimelineChartInstance = null;
        }
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

        const BLOCK_LIMIT = 24;
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

                const total = Number.isFinite(block?.totalCount) ? block.totalCount : 0;
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
                                const label = datasetLabel
                                    ? `${datasetLabel}: ${numberFormatter.format(value)} transaksi`
                                    : `${numberFormatter.format(value)} transaksi`;

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
        setChartLoading(blockTimelineContainer, 'Menyiapkan grafik distribusi blok simulasi...');
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

            renderBlockTimelineChart(networks);
            setUpdatedAtLabel(payload?.updatedAt || payload?.fetchedAt || null);
        } catch (error) {
            console.error('Gagal memuat data perbandingan blok jaringan:', error);
            setChartMessage(blockTimelineContainer, 'Tidak dapat memuat grafik distribusi blok.', 'error');
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
