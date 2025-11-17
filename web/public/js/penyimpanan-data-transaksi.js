const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    // DOM Elements
    const blockSummaryContainerEl = document.getElementById('blockSummaryContainer');
    const tableContainerEl = document.getElementById('tableContainer');
    const refreshDataBtn = document.getElementById('refreshData');

    // Network-specific containers
    const networkContainers = {
        'channel-standard': document.getElementById('blocksTableContainer-channel-standard'),
        'channel-variant': document.getElementById('blocksTableContainer-channel-variant'),
        'channel-fabric3-standard': document.getElementById('blocksTableContainer-channel-fabric3-standard'),
        'channel-fabric3-variant': document.getElementById('blocksTableContainer-channel-fabric3-variant')
    };

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
        value.textContent = numberFormatter.format(data.blockHeight || 0);

        const description = document.createElement('span');
        description.className = 'text-xs text-textdark/50';
        description.textContent = 'Total Blok';

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
                blockHeightValue.textContent = numberFormatter.format(record.blockHeight || 0);
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

    // Pagination state for each network
    const paginationState = {};

    // Pagination configuration
    const ITEMS_PER_PAGE = 10;

    // Create pagination controls
    function createPaginationControls(networkId, totalItems, currentPage, onPageChange) {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (totalPages <= 1) {
            return null; // No pagination needed for single page
        }

        const paginationWrapper = document.createElement('div');
        paginationWrapper.className = 'flex items-center justify-between border-t border-white/10 bg-surfaceMuted/30 px-6 py-4';

        // Info text
        const infoText = document.createElement('div');
        infoText.className = 'text-sm text-textdark/60';
        const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
        const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
        infoText.textContent = `Menampilkan ${startItem}-${endItem} dari ${totalItems} blok`;

        // Pagination buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'flex items-center gap-2';

        // Previous button
        const prevButton = document.createElement('button');
        prevButton.type = 'button';
        prevButton.className = 'flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition';
        prevButton.disabled = currentPage === 1;

        if (currentPage === 1) {
            prevButton.className += ' border-white/10 bg-surfaceMuted/30 text-textdark/30 cursor-not-allowed';
        } else {
            prevButton.className += ' border-primary/40 bg-primary/10 text-primary hover:bg-primary/20';
        }

        prevButton.innerHTML = `
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            <span>Previous</span>
        `;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                onPageChange(currentPage - 1);
            }
        });

        // Page numbers
        const pageNumbers = document.createElement('div');
        pageNumbers.className = 'flex items-center gap-1';

        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // First page
        if (startPage > 1) {
            const firstPageBtn = createPageButton(1, currentPage === 1, () => onPageChange(1));
            pageNumbers.appendChild(firstPageBtn);

            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'px-2 text-textdark/40';
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }
        }

        // Page buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = createPageButton(i, i === currentPage, () => onPageChange(i));
            pageNumbers.appendChild(pageBtn);
        }

        // Last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'px-2 text-textdark/40';
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }

            const lastPageBtn = createPageButton(totalPages, currentPage === totalPages, () => onPageChange(totalPages));
            pageNumbers.appendChild(lastPageBtn);
        }

        // Next button
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition';
        nextButton.disabled = currentPage === totalPages;

        if (currentPage === totalPages) {
            nextButton.className += ' border-white/10 bg-surfaceMuted/30 text-textdark/30 cursor-not-allowed';
        } else {
            nextButton.className += ' border-primary/40 bg-primary/10 text-primary hover:bg-primary/20';
        }

        nextButton.innerHTML = `
            <span>Next</span>
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
        `;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                onPageChange(currentPage + 1);
            }
        });

        buttonGroup.append(prevButton, pageNumbers, nextButton);
        paginationWrapper.append(infoText, buttonGroup);

        return paginationWrapper;
    }

    // Create individual page button
    function createPageButton(pageNum, isActive, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'h-9 w-9 rounded-lg border text-sm font-semibold transition';

        if (isActive) {
            button.className += ' border-primary/40 bg-primary/20 text-primary';
        } else {
            button.className += ' border-white/10 bg-surfaceMuted/30 text-textdark/70 hover:border-primary/30 hover:bg-primary/10 hover:text-primary';
        }

        button.textContent = pageNum;
        button.addEventListener('click', onClick);

        return button;
    }

    // Create single network blocks table
    function createSingleNetworkBlocksTable(network) {
        const networkId = network.targetId;

        // Initialize pagination state for this network
        if (!paginationState[networkId]) {
            paginationState[networkId] = { currentPage: 1 };
        }

        const currentPage = paginationState[networkId].currentPage;

        // Check if blocks exist
        if (!network.blocks || network.blocks.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'flex flex-col items-center gap-3 bg-surfaceMuted/50 p-8 text-center';
            emptyState.innerHTML = `
                <svg class="h-10 w-10 text-textdark/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <p class="text-sm text-textdark/60">Tidak ada blok yang tersedia</p>
            `;
            return emptyState;
        }

        // Calculate pagination
        const totalBlocks = network.blocks.length;
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedBlocks = network.blocks.slice(startIndex, endIndex);

        const wrapper = document.createElement('div');

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'w-full text-sm';

        // Table header
        const thead = document.createElement('thead');
        thead.className = 'border-b border-white/10 bg-surfaceMuted/50';
        const headerRow = document.createElement('tr');

        const headers = [
            { label: 'Block #', width: '10%' },
            { label: 'Data Hash', width: '30%' },
            { label: 'Previous Hash', width: '30%' },
            { label: 'Transaksi', width: '15%' },
            { label: 'Timestamp', width: '15%' }
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

        // Table body
        const tbody = document.createElement('tbody');
        tbody.className = 'divide-y divide-white/10 bg-surfaceMuted/20';

        paginatedBlocks.forEach((block, blockIndex) => {
            const row = document.createElement('tr');
            row.className = 'table-row transition hover:bg-primary/5';

            // Block Number
            const blockNumCell = document.createElement('td');
            blockNumCell.className = 'px-6 py-4';
            const blockNum = document.createElement('span');
            blockNum.className = 'inline-flex items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-sm font-bold text-primary';
            blockNum.textContent = block.blockNumber !== null && block.blockNumber !== undefined ? block.blockNumber : '-';
            blockNumCell.appendChild(blockNum);

            // Data Hash
            const dataHashCell = document.createElement('td');
            dataHashCell.className = 'px-6 py-4';
            const dataHashValue = document.createElement('code');
            dataHashValue.className = 'block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-textdark/70';
            dataHashValue.textContent = block.dataHash || '-';
            dataHashValue.title = block.dataHash || '';
            dataHashCell.appendChild(dataHashValue);

            // Previous Hash
            const prevHashCell = document.createElement('td');
            prevHashCell.className = 'px-6 py-4';
            const prevHashValue = document.createElement('code');
            prevHashValue.className = 'block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-textdark/70';
            prevHashValue.textContent = block.previousHash || '-';
            prevHashValue.title = block.previousHash || '';
            prevHashCell.appendChild(prevHashValue);

            // Transaction Count
            const txCountCell = document.createElement('td');
            txCountCell.className = 'px-6 py-4 text-center';
            const txCount = document.createElement('span');
            txCount.className = 'inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent';
            txCount.innerHTML = `
                <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span>${numberFormatter.format(block.transactionCount || 0)}</span>
            `;
            txCountCell.appendChild(txCount);

            // Timestamp
            const timestampCell = document.createElement('td');
            timestampCell.className = 'px-6 py-4 text-xs text-textdark/60';
            timestampCell.textContent = block.timestamp
                ? dateTimeFormatter.format(new Date(block.timestamp))
                : '-';

            row.append(blockNumCell, dataHashCell, prevHashCell, txCountCell, timestampCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        wrapper.appendChild(tableWrapper);

        // Add pagination controls
        const paginationControls = createPaginationControls(
            networkId,
            totalBlocks,
            currentPage,
            (newPage) => {
                paginationState[networkId].currentPage = newPage;
                loadBlocksData();
            }
        );

        if (paginationControls) {
            wrapper.appendChild(paginationControls);
        }

        return wrapper;
    }

    // Fetch and render blocks data
    async function loadBlocksData() {
        try {
            // Show loading state for all containers
            Object.values(networkContainers).forEach(container => {
                if (container) {
                    container.innerHTML = `
                        <div class="flex items-center justify-center bg-surfaceMuted/50 p-12">
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
            });

            // Fetch data from API
            const response = await fetch('/api/blocks');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Render blocks for each network
            if (data.results && Array.isArray(data.results)) {
                data.results.forEach(network => {
                    const networkId = network.targetId;
                    const container = networkContainers[networkId];

                    if (container) {
                        container.innerHTML = '';
                        const networkTable = createSingleNetworkBlocksTable(network);
                        container.appendChild(networkTable);
                    }
                });
            }

        } catch (error) {
            console.error('Error loading blocks data:', error);

            // Show error state for all containers
            Object.values(networkContainers).forEach(container => {
                if (container) {
                    container.innerHTML = `
                        <div class="flex items-center justify-center bg-surfaceMuted/50 p-12">
                            <div class="text-center">
                                <svg class="mx-auto mb-3 h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <p class="mb-2 font-semibold text-red-400">Gagal Memuat Data Blok</p>
                                <p class="text-sm text-textdark/60">${error.message || 'Terjadi kesalahan saat memuat data blok'}</p>
                            </div>
                        </div>
                    `;
                }
            });
        }
    }

    // Event listeners
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', async () => {
            refreshDataBtn.disabled = true;
            refreshDataBtn.querySelector('svg').classList.add('animate-spin');

            await loadBlockData();

            refreshDataBtn.disabled = false;
            refreshDataBtn.querySelector('svg').classList.remove('animate-spin');
        });
    }

    // Refresh buttons for individual network blocks
    const refreshBlocksBtns = document.querySelectorAll('.refresh-blocks-btn');
    refreshBlocksBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.querySelector('svg').classList.add('animate-spin');

            await loadBlocksData();

            btn.disabled = false;
            btn.querySelector('svg').classList.remove('animate-spin');
        });
    });

    // Initialize - load data on page load
    loadBlockData();
    loadBlocksData();
});
