const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    // DOM Elements
    const blockSummaryContainerEl = document.getElementById('blockSummaryContainer');
    const tableContainerEl = document.getElementById('tableContainer');
    const refreshDataBtn = document.getElementById('refreshData');

    // Formatters
    const numberFormatter = new Intl.NumberFormat('id-ID');
    const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    // Network color mapping
    const networkColors = {
        'channel-standard': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
        'channel-variant': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
        'channel-fabric3-standard': { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
        'channel-fabric3-variant': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    };

    // Create summary card
    function createBlockSummaryCard(data, index = 0) {
        const card = document.createElement('article');
        card.className = 'fade-in flex flex-col gap-3 rounded-2xl border border-white/10 bg-surfaceMuted/70 p-6 shadow-lg shadow-black/10 transition hover:shadow-xl hover:shadow-black/20';
        card.style.animationDelay = `${index * 0.1}s`;

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between gap-2';

        const label = document.createElement('span');
        label.className = 'text-xs font-semibold uppercase tracking-[0.3em] text-textdark/60';
        label.textContent = data.label || 'Unknown Network';

        const statusBadge = document.createElement('span');
        statusBadge.className = `inline-flex h-2 w-2 rounded-full ${data.status === 'healthy' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`;
        statusBadge.setAttribute('title', data.status === 'healthy' ? 'Network Aktif' : 'Network Tidak Aktif');

        header.append(label, statusBadge);

        const value = document.createElement('p');
        value.className = 'text-4xl font-bold text-primary';
        // Exclude 7 setup blocks from the count
        const adjustedBlockHeight = Math.max(0, (data.blockHeight || 0) - 7);
        value.textContent = numberFormatter.format(adjustedBlockHeight);

        const description = document.createElement('span');
        description.className = 'text-xs text-textdark/50';
        description.textContent = 'Blok Simulasi';

        // Additional info
        const info = document.createElement('div');
        info.className = 'mt-2 flex flex-col gap-1 text-xs text-textdark/60';

        if (data.peer) {
            const peerInfo = document.createElement('div');
            peerInfo.className = 'flex items-center gap-1';
            peerInfo.innerHTML = `
                <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                </svg>
                <span>${data.peer}</span>
            `;
            info.appendChild(peerInfo);
        }

        card.append(header, value, description, info);
        return card;
    }

    // Create data table
    function createDataTable(records) {
        const wrapper = document.createElement('div');
        wrapper.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'w-full text-sm';

        // Create header
        const thead = document.createElement('thead');
        thead.className = 'border-b border-white/10 bg-surfaceMuted/50';
        const headerRow = document.createElement('tr');

        const headers = [
            { label: 'Network', width: '25%' },
            { label: 'Block Height', width: '15%' },
            { label: 'Status', width: '15%' },
            { label: 'Peer', width: '20%' },
            { label: 'Last Check', width: '25%' }
        ];

        headers.forEach(header => {
            const th = document.createElement('th');
            th.className = 'px-6 py-4 text-left font-semibold text-textdark';
            th.style.width = header.width;
            th.textContent = header.label;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        tbody.className = 'divide-y divide-white/10';

        if (records.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 5;
            emptyCell.className = 'px-6 py-12 text-center text-textdark/60';
            emptyCell.innerHTML = `
                <div class="flex flex-col items-center gap-3">
                    <svg class="h-12 w-12 text-textdark/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <p>Tidak ada data transaksi blok yang tersedia</p>
                </div>
            `;
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        } else {
            records.forEach((record, index) => {
                const row = document.createElement('tr');
                row.className = 'table-row';
                row.style.animationDelay = `${index * 0.05}s`;

                // Network cell
                const networkCell = document.createElement('td');
                networkCell.className = 'px-6 py-4';
                const networkBadge = document.createElement('div');
                networkBadge.className = 'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5';
                const colors = networkColors[record.channel] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' };
                networkBadge.className += ` ${colors.bg} ${colors.text} ${colors.border}`;
                networkBadge.innerHTML = `
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                    </svg>
                    <span class="text-xs font-semibold">${record.label || 'Unknown'}</span>
                `;
                networkCell.appendChild(networkBadge);

                // Block Height cell
                const blockHeightCell = document.createElement('td');
                blockHeightCell.className = 'px-6 py-4';
                const blockHeightValue = document.createElement('span');
                blockHeightValue.className = 'font-mono text-base font-semibold text-primary';
                // Exclude 7 setup blocks from the count
                const adjustedBlockHeight = Math.max(0, (record.blockHeight || 0) - 7);
                blockHeightValue.textContent = numberFormatter.format(adjustedBlockHeight);
                blockHeightCell.appendChild(blockHeightValue);

                // Status cell
                const statusCell = document.createElement('td');
                statusCell.className = 'px-6 py-4';
                const statusBadge = document.createElement('span');
                if (record.status === 'healthy') {
                    statusBadge.className = 'inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400';
                    statusBadge.innerHTML = `
                        <span class="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        Aktif
                    `;
                } else {
                    statusBadge.className = 'inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400';
                    statusBadge.innerHTML = `
                        <span class="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                        Tidak Aktif
                    `;
                }
                statusCell.appendChild(statusBadge);

                // Peer cell
                const peerCell = document.createElement('td');
                peerCell.className = 'px-6 py-4 font-mono text-xs text-textdark/70';
                peerCell.textContent = record.peer || '-';

                // Last Check cell
                const lastCheckCell = document.createElement('td');
                lastCheckCell.className = 'px-6 py-4 text-xs text-textdark/60';
                lastCheckCell.textContent = record.timestamp
                    ? dateTimeFormatter.format(new Date(record.timestamp))
                    : '-';

                row.append(networkCell, blockHeightCell, statusCell, peerCell, lastCheckCell);
                tbody.appendChild(row);
            });
        }

        table.appendChild(tbody);
        wrapper.appendChild(table);
        return wrapper;
    }

    // Fetch and render data
    async function loadBlockData() {
        try {
            // Show loading state
            if (blockSummaryContainerEl) {
                blockSummaryContainerEl.innerHTML = `
                    <div class="col-span-full flex items-center justify-center rounded-2xl border border-white/10 bg-surfaceMuted/70 p-12 shadow-lg">
                        <div class="text-center">
                            <svg class="mx-auto mb-3 h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p class="text-sm text-textdark/70">Memuat data blok...</p>
                        </div>
                    </div>
                `;
            }

            if (tableContainerEl) {
                tableContainerEl.innerHTML = `
                    <div class="flex items-center justify-center bg-surfaceMuted/50 p-12">
                        <div class="text-center">
                            <svg class="mx-auto mb-3 h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p class="text-sm text-textdark/70">Memuat data transaksi...</p>
                        </div>
                    </div>
                `;
            }

            // Fetch data from API
            const response = await fetch('/api/check-network');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Render summary cards
            if (blockSummaryContainerEl && data.results && Array.isArray(data.results)) {
                blockSummaryContainerEl.innerHTML = '';

                if (data.results.length === 0) {
                    const emptyState = document.createElement('div');
                    emptyState.className = 'col-span-full flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-surfaceMuted/70 p-12 text-center';
                    emptyState.innerHTML = `
                        <svg class="h-12 w-12 text-textdark/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                        </svg>
                        <p class="text-textdark/60">Tidak ada data network yang tersedia</p>
                    `;
                    blockSummaryContainerEl.appendChild(emptyState);
                } else {
                    data.results.forEach((result, index) => {
                        const card = createBlockSummaryCard(result, index);
                        blockSummaryContainerEl.appendChild(card);
                    });
                }
            }

            // Render data table
            if (tableContainerEl && data.results && Array.isArray(data.results)) {
                tableContainerEl.innerHTML = '';
                const table = createDataTable(data.results);
                tableContainerEl.appendChild(table);
            }

        } catch (error) {
            console.error('Error loading block data:', error);

            // Show error state
            if (blockSummaryContainerEl) {
                blockSummaryContainerEl.innerHTML = `
                    <div class="col-span-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
                        <div class="flex items-start gap-3">
                            <svg class="h-5 w-5 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <div class="flex-1">
                                <h3 class="mb-1 font-semibold text-red-400">Gagal Memuat Data</h3>
                                <p class="text-sm text-textdark/70">${error.message || 'Terjadi kesalahan saat memuat data blok'}</p>
                            </div>
                        </div>
                    </div>
                `;
            }

            if (tableContainerEl) {
                tableContainerEl.innerHTML = `
                    <div class="flex items-center justify-center bg-surfaceMuted/50 p-12">
                        <div class="text-center text-textdark/60">
                            <svg class="mx-auto mb-3 h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <p>Gagal memuat data transaksi</p>
                        </div>
                    </div>
                `;
            }
        }
    }

    // Initialize - load data on page load
    loadBlockData();

    // ============================================
    // Block Submissions Section
    // ============================================

    const blockSubmissionsContainerEl = document.getElementById('blockSubmissionsContainer');
    const refreshBlockDataBtn = document.getElementById('refreshBlockData');
    const blockDetailModal = document.getElementById('blockDetailModal');
    const blockDetailContent = document.getElementById('blockDetailContent');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // Network color mapping for block submissions (matching targetId from backend)
    const submissionNetworkColors = {
        'channel-standard': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
        'channel-variant': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
        'channel-fabric3-standard': { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
        'channel-fabric3-variant': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    };

    // Network label mapping
    const submissionNetworkLabels = {
        'channel-standard': 'Fabric 2 RAFT Standard',
        'channel-variant': 'Fabric 2 RAFT Variant',
        'channel-fabric3-standard': 'Fabric 3 RAFT Standard',
        'channel-fabric3-variant': 'Fabric 3 RAFT Variant',
    };

    // Fetch block submissions from API
    async function fetchBlockSubmissions() {
        try {
            const response = await fetch('/api/catatan');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('📊 API Response /api/catatan:', data);
            console.log('📋 Results:', data.results);
            return data.results || [];
        } catch (error) {
            console.error('❌ Error fetching block submissions:', error);
            return [];
        }
    }

    // Create network table for block submissions
    function createNetworkBlockTable(networkData) {
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-4';

        // Network header
        const header = document.createElement('div');
        header.className = 'flex items-center gap-3 rounded-lg border border-white/10 bg-surfaceMuted/50 p-4';

        const colors = submissionNetworkColors[networkData.targetId] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' };
        const networkLabel = networkData.label || submissionNetworkLabels[networkData.targetId] || networkData.targetId;

        header.innerHTML = `
            <div class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${colors.bg} ${colors.text} ${colors.border}">
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                </svg>
                <span class="text-sm font-semibold">${networkLabel}</span>
            </div>
            <span class="ml-auto text-sm text-textdark/60">${networkData.records.length} data</span>
        `;

        // Table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto rounded-xl border border-white/10';

        const table = document.createElement('table');
        table.className = 'w-full text-sm';

        // Table header
        const thead = document.createElement('thead');
        thead.className = 'border-b border-white/10 bg-surfaceMuted/50';
        const headerRow = document.createElement('tr');

        const headers = [
            { label: 'Report ID', width: '15%' },
            { label: 'Timestamp', width: '20%' },
            { label: 'Substansi', width: '20%' },
            { label: 'Pelapor', width: '15%' },
            { label: 'Status', width: '10%' },
            { label: 'Kantor Penerima', width: '15%' },
            { label: 'Aksi', width: '5%' }
        ];

        headers.forEach(header => {
            const th = document.createElement('th');
            th.className = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-textdark/70';
            th.style.width = header.width;
            th.textContent = header.label;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table body
        const tbody = document.createElement('tbody');
        tbody.className = 'divide-y divide-white/10 bg-surfaceMuted/30';

        if (networkData.records.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 7;
            emptyCell.className = 'px-4 py-8 text-center text-textdark/60';
            emptyCell.textContent = 'Tidak ada data blok';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        } else {
            // Sort by timestamp descending (newest first)
            const sortedRecords = [...networkData.records].sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );

            sortedRecords.forEach((record, index) => {
                const row = document.createElement('tr');
                row.className = 'table-row transition hover:bg-primary/5';
                row.style.animationDelay = `${index * 0.03}s`;

                // Report ID cell
                const reportIdCell = document.createElement('td');
                reportIdCell.className = 'px-4 py-3';
                reportIdCell.innerHTML = `<span class="font-mono text-xs text-primary">${record.reportId || '-'}</span>`;

                // Timestamp cell
                const timestampCell = document.createElement('td');
                timestampCell.className = 'px-4 py-3 text-xs text-textdark/70';
                timestampCell.textContent = record.timestamp
                    ? dateTimeFormatter.format(new Date(record.timestamp))
                    : '-';

                // Substance cell
                const substanceCell = document.createElement('td');
                substanceCell.className = 'px-4 py-3 text-xs text-textdark/70';
                substanceCell.textContent = record.substance || '-';

                // Reporter Group cell
                const reporterCell = document.createElement('td');
                reporterCell.className = 'px-4 py-3 text-xs text-textdark/70';
                reporterCell.textContent = record.reporterGroup || '-';

                // Status cell
                const statusCell = document.createElement('td');
                statusCell.className = 'px-4 py-3';
                const statusBadge = document.createElement('span');
                const statusValue = record.status || 'pending';
                if (statusValue === 'completed' || statusValue === 'resolved') {
                    statusBadge.className = 'inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400';
                    statusBadge.innerHTML = `
                        <span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                        ${statusValue}
                    `;
                } else if (statusValue === 'processing' || statusValue === 'in_progress') {
                    statusBadge.className = 'inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400';
                    statusBadge.innerHTML = `
                        <span class="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                        ${statusValue}
                    `;
                } else {
                    statusBadge.className = 'inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-400';
                    statusBadge.innerHTML = `
                        <span class="h-1.5 w-1.5 rounded-full bg-yellow-400"></span>
                        ${statusValue}
                    `;
                }
                statusCell.appendChild(statusBadge);

                // Receiving Office cell
                const officeCell = document.createElement('td');
                officeCell.className = 'px-4 py-3 text-xs text-textdark/70';
                officeCell.textContent = record.receivingOffice || '-';

                // Action cell
                const actionCell = document.createElement('td');
                actionCell.className = 'px-4 py-3';
                const detailBtn = document.createElement('button');
                detailBtn.type = 'button';
                detailBtn.className = 'rounded-lg p-2 text-primary transition hover:bg-primary/10';
                detailBtn.innerHTML = `
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                `;
                detailBtn.addEventListener('click', () => showBlockDetail(record, networkLabel));
                actionCell.appendChild(detailBtn);

                row.append(reportIdCell, timestampCell, substanceCell, reporterCell, statusCell, officeCell, actionCell);
                tbody.appendChild(row);
            });
        }

        table.appendChild(tbody);
        tableContainer.appendChild(table);
        wrapper.append(header, tableContainer);

        return wrapper;
    }

    // Show block detail in modal
    function showBlockDetail(data, networkLabel) {
        if (!data) return;

        let detailHTML = `
            <div class="space-y-6">
                <!-- Network Info -->
                <div class="rounded-xl border border-primary/20 bg-primary/5 p-5">
                    <h4 class="mb-4 text-base font-semibold text-primary">Informasi Jaringan</h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-textdark/60">Network</div>
                            <div class="mt-1 font-semibold text-textdark">${networkLabel || '-'}</div>
                        </div>
                        <div>
                            <div class="text-textdark/60">Report ID</div>
                            <div class="mt-1 font-mono text-primary">${data.reportId || '-'}</div>
                        </div>
                    </div>
                </div>

                <!-- Record Data -->
                <div class="rounded-xl border border-accent/20 bg-accent/5 p-5">
                    <h4 class="mb-4 text-base font-semibold text-accent">Data Laporan</h4>
                    <div class="space-y-3 text-sm">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <span class="font-semibold text-textdark/70">Report ID:</span>
                                <div class="mt-1 font-mono text-primary">${data.reportId || '-'}</div>
                            </div>
                            <div>
                                <span class="font-semibold text-textdark/70">Timestamp:</span>
                                <div class="mt-1 text-textdark">${data.timestamp ? new Date(data.timestamp).toLocaleString('id-ID') : '-'}</div>
                            </div>
                        </div>
                        <div>
                            <span class="font-semibold text-textdark/70">Substansi:</span>
                            <div class="mt-1 text-textdark">${data.substance || '-'}</div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <span class="font-semibold text-textdark/70">Pelapor:</span>
                                <div class="mt-1 text-textdark">${data.reporterGroup || '-'}</div>
                            </div>
                            <div>
                                <span class="font-semibold text-textdark/70">Terlapor:</span>
                                <div class="mt-1 text-textdark">${data.reportedGroup || '-'}</div>
                            </div>
                        </div>
                        <div>
                            <span class="font-semibold text-textdark/70">Kantor Penerima:</span>
                            <div class="mt-1 text-textdark">${data.receivingOffice || '-'}</div>
                        </div>
                        <div>
                            <span class="font-semibold text-textdark/70">Deskripsi:</span>
                            <div class="mt-1 text-textdark">${data.description || '-'}</div>
                        </div>
                        <div>
                            <span class="font-semibold text-textdark/70">Status:</span>
                            <div class="mt-1">
                                <span class="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                                    ${data.status || 'pending'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Raw JSON -->
                <div class="rounded-xl border border-white/10 bg-surfaceMuted/30 p-5">
                    <h4 class="mb-3 text-base font-semibold text-textdark">Data Lengkap (JSON)</h4>
                    <pre class="overflow-x-auto rounded-lg bg-soft p-4 text-xs text-textdark/80"><code>${JSON.stringify(data, null, 2)}</code></pre>
                </div>
            </div>
        `;

        blockDetailContent.innerHTML = detailHTML;
        blockDetailModal.classList.remove('hidden');
        blockDetailModal.classList.add('flex');
    }

    // Close modal
    function closeModal() {
        blockDetailModal.classList.add('hidden');
        blockDetailModal.classList.remove('flex');
    }

    // Render block submissions
    async function renderBlockSubmissions() {
        // Show loading state
        blockSubmissionsContainerEl.innerHTML = `
            <div class="flex items-center justify-center rounded-xl border border-white/10 bg-surfaceMuted/50 p-12">
                <div class="text-center">
                    <svg class="mx-auto mb-3 h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-sm text-textdark/70">Memuat data blok dari blockchain...</p>
                </div>
            </div>
        `;

        const results = await fetchBlockSubmissions();
        console.log('🔍 Total networks fetched:', results.length);

        if (!results || results.length === 0) {
            blockSubmissionsContainerEl.innerHTML = `
                <div class="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-surfaceMuted/30 p-12 text-center">
                    <svg class="h-16 w-16 text-textdark/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <div>
                        <p class="mb-2 text-lg font-semibold text-textdark">Belum Ada Data Blok</p>
                        <p class="text-sm text-textdark/60">Server tidak merespons atau belum berjalan. Pastikan server gateway sedang aktif.</p>
                        <p class="mt-2 text-xs text-textdark/40">Jalankan: npm start di folder web/</p>
                    </div>
                    <a href="/penelitian/pelaksanaan-simulasi/input-data-simulasi"
                       class="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        Input Data Simulasi
                    </a>
                </div>
            `;
            return;
        }

        // Debug: Log all networks status
        console.log('📋 All networks status:');
        results.forEach((network, index) => {
            console.log(`  ${index + 1}. [${network.status}] ${network.label || network.targetId}`);
            console.log(`     - Has records: ${network.records ? 'Yes' : 'No'}`);
            console.log(`     - Record count: ${network.records ? network.records.length : 0}`);
            if (network.message) {
                console.log(`     - Message: ${network.message}`);
            }
        });

        // Filter networks with records (regardless of status for debugging)
        const networksWithRecords = results.filter(network =>
            network.records && Array.isArray(network.records) && network.records.length > 0
        );

        console.log('📦 Networks with records (any status):', networksWithRecords.length);

        // Filter only healthy networks with records
        const healthyNetworks = results.filter(network =>
            network.status === 'healthy' && network.records && network.records.length > 0
        );

        console.log('✅ Healthy networks with data:', healthyNetworks.length);
        healthyNetworks.forEach((network, index) => {
            console.log(`  ${index + 1}. ${network.label || network.targetId} - ${network.records.length} records`);
        });

        if (healthyNetworks.length === 0) {
            // Check if there are networks with records but unhealthy status
            if (networksWithRecords.length > 0) {
                console.warn('⚠️  Found networks with records but not healthy. Showing anyway for debugging.');
                // Use networks with records even if not healthy
                renderNetworkTables(networksWithRecords);
                return;
            }

            // Truly no data available
            blockSubmissionsContainerEl.innerHTML = `
                <div class="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-surfaceMuted/30 p-12 text-center">
                    <svg class="h-12 w-12 text-textdark/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <div>
                        <p class="mb-2 text-textdark">Tidak ada data yang tersedia di blockchain</p>
                        <p class="text-xs text-textdark/50">Network mungkin belum berjalan atau belum ada data yang diinput</p>
                    </div>
                </div>
            `;
            return;
        }

        // Render tables for healthy networks
        renderNetworkTables(healthyNetworks);
    }

    // Helper function to render network tables
    function renderNetworkTables(networks) {
        // Clear container
        blockSubmissionsContainerEl.innerHTML = '';

        // Create container for all networks
        const networksContainer = document.createElement('div');
        networksContainer.className = 'space-y-6';

        // Render table for each network
        networks.forEach((networkData, index) => {
            const networkTable = createNetworkBlockTable(networkData);
            networkTable.classList.add('fade-in');
            networkTable.style.animationDelay = `${index * 0.1}s`;
            networksContainer.appendChild(networkTable);
        });

        blockSubmissionsContainerEl.appendChild(networksContainer);
    }

    // Event listeners
    if (refreshBlockDataBtn) {
        refreshBlockDataBtn.addEventListener('click', renderBlockSubmissions);
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    if (blockDetailModal) {
        blockDetailModal.addEventListener('click', (e) => {
            if (e.target === blockDetailModal) {
                closeModal();
            }
        });
    }

    // Initialize block submissions on page load
    renderBlockSubmissions();
});
