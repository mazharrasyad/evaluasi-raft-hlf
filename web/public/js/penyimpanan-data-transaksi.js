const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    // DOM Elements
    const tableContainerEl = document.getElementById('tableContainer');

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

            // Render data table
            if (tableContainerEl && data.results && Array.isArray(data.results)) {
                tableContainerEl.innerHTML = '';
                const table = createDataTable(data.results);
                tableContainerEl.appendChild(table);
            }

        } catch (error) {
            console.error('Error loading block data:', error);

            // Show error state
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

    // Get all blocks for a network to calculate transaction offsets
    async function getNetworkBlocks(networkId) {
        try {
            const response = await fetch('/api/blocks');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const networkData = data.results?.find(r => r.targetId === networkId);
            return networkData?.blocks || [];
        } catch (error) {
            console.error('Error fetching network blocks:', error);
            return [];
        }
    }

    // Show block detail modal with transaction data
    async function showBlockDetail(block, networkId) {
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto';
        backdrop.style.animation = 'fadeIn 0.2s ease-out';

        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'relative w-full max-w-5xl my-8 rounded-2xl border border-white/10 bg-surface p-8 shadow-2xl';
        modal.style.animation = 'fadeIn 0.3s ease-out';

        // Modal header
        const header = document.createElement('div');
        header.className = 'mb-6 flex items-start justify-between';

        const title = document.createElement('h3');
        title.className = 'text-2xl font-semibold text-textdark';
        title.textContent = `Detail Blok #${block.blockNumber}`;

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'rounded-lg p-2 text-textdark/60 transition hover:bg-white/10 hover:text-textdark';
        closeButton.innerHTML = `
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        `;
        closeButton.addEventListener('click', () => {
            document.body.removeChild(backdrop);
        });

        header.append(title, closeButton);

        // Modal body
        const body = document.createElement('div');
        body.className = 'space-y-6';

        // Block basic information
        const basicInfoSection = document.createElement('div');
        basicInfoSection.innerHTML = `
            <h4 class="mb-3 text-sm font-semibold uppercase tracking-wider text-textdark/70">Informasi Blok</h4>
        `;

        const basicInfoGrid = document.createElement('div');
        basicInfoGrid.className = 'grid grid-cols-2 gap-3';

        const basicInfo = [
            { label: 'Block Number', value: block.blockNumber },
            { label: 'Transaction Count', value: numberFormatter.format(block.transactionCount || 0) },
            { label: 'Timestamp', value: block.timestamp ? dateTimeFormatter.format(new Date(block.timestamp)) : '-' }
        ];

        basicInfo.forEach(item => {
            const infoItem = document.createElement('div');
            infoItem.className = 'rounded-lg border border-white/10 bg-surfaceMuted/50 p-3';
            infoItem.innerHTML = `
                <div class="mb-1 text-xs font-semibold uppercase tracking-wider text-textdark/60">${item.label}</div>
                <div class="text-base font-medium text-textdark">${item.value}</div>
            `;
            basicInfoGrid.appendChild(infoItem);
        });

        basicInfoSection.appendChild(basicInfoGrid);
        body.appendChild(basicInfoSection);

        // Transaction data section
        const transactionSection = document.createElement('div');
        const headerWithInfo = document.createElement('div');
        headerWithInfo.className = 'mb-3 flex items-center justify-between gap-3';
        headerWithInfo.innerHTML = `
            <h4 class="text-sm font-semibold uppercase tracking-wider text-textdark/70">Data Transaksi dalam Blok Ini</h4>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                ${numberFormatter.format(block.transactionCount || 0)} Transaksi
            </span>
        `;
        transactionSection.appendChild(headerWithInfo);

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'flex items-center justify-center rounded-lg border border-white/10 bg-surfaceMuted/50 p-8';
        loadingDiv.innerHTML = `
            <div class="text-center">
                <svg class="mx-auto mb-3 h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm text-textdark/70">Memuat data transaksi...</p>
            </div>
        `;
        transactionSection.appendChild(loadingDiv);
        body.appendChild(transactionSection);

        modal.append(header, body);
        backdrop.appendChild(modal);

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape' && document.body.contains(backdrop)) {
                document.body.removeChild(backdrop);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        document.body.appendChild(backdrop);

        // Fetch transaction data
        try {
            const response = await fetch('/api/catatan');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const networkData = data.results?.find(r => r.targetId === networkId);

            if (networkData && networkData.records && networkData.records.length > 0) {
                // Get all blocks for this network to calculate the correct offset
                const allBlocks = await getNetworkBlocks(networkId);

                // Filter out the first 7 setup blocks
                const simulationBlocks = allBlocks.filter(b => b.blockNumber >= 7);

                // Sort by block number to ensure correct order
                simulationBlocks.sort((a, b) => a.blockNumber - b.blockNumber);

                // Sort records by timestamp to get them in chronological order
                const sortedRecords = [...networkData.records].sort((a, b) => {
                    const timeA = new Date(a.timestamp || 0).getTime();
                    const timeB = new Date(b.timestamp || 0).getTime();
                    return timeA - timeB;
                });

                // Calculate the starting index by summing transactions from all previous blocks
                let startIndex = 0;
                for (const prevBlock of simulationBlocks) {
                    if (prevBlock.blockNumber < block.blockNumber) {
                        startIndex += prevBlock.transactionCount || 0;
                    } else {
                        break;
                    }
                }

                // Get only the records that belong to this specific block
                const blockRecords = sortedRecords.slice(startIndex, startIndex + (block.transactionCount || 0));

                if (blockRecords.length === 0) {
                    loadingDiv.innerHTML = `
                        <div class="text-center">
                            <svg class="mx-auto mb-3 h-12 w-12 text-textdark/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <p class="text-sm text-textdark/60">Tidak ada data transaksi dalam blok ini</p>
                        </div>
                    `;
                } else {
                    // Replace loading with transaction data
                    loadingDiv.remove();

                    const recordsContainer = document.createElement('div');
                    recordsContainer.className = 'space-y-3 max-h-96 overflow-y-auto';

                    blockRecords.forEach((record, index) => {
                    const recordCard = document.createElement('div');
                    recordCard.className = 'rounded-lg border border-white/10 bg-surfaceMuted/30 p-4';

                    const statusColors = {
                        'pending': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
                        'in_progress': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
                        'resolved': 'bg-green-500/10 text-green-400 border-green-500/30'
                    };

                    const statusColor = statusColors[record.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';

                    const cardHTML = `
                        <div class="mb-3 flex items-start justify-between gap-3">
                            <div class="flex-1">
                                <div class="mb-1 font-mono text-sm font-semibold text-primary">${record.reportId || record.id}</div>
                                <div class="text-xs text-textdark/60">${record.timestamp ? dateTimeFormatter.format(new Date(record.timestamp)) : '-'}</div>
                            </div>
                            <span class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusColor}">
                                ${record.status || 'unknown'}
                            </span>
                        </div>
                        <div class="mb-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span class="text-textdark/60">Waktu Dibuat:</span>
                                <span class="ml-1 text-textdark">${record.createdAt ? dateTimeFormatter.format(new Date(record.createdAt)) : '-'}</span>
                            </div>
                            <div>
                                <span class="text-textdark/60">Substansi:</span>
                                <span class="ml-1 text-textdark">${record.substance || '-'}</span>
                            </div>
                            <div>
                                <span class="text-textdark/60">Kantor Penerima:</span>
                                <span class="ml-1 text-textdark">${record.receivingOffice || '-'}</span>
                            </div>
                            <div>
                                <span class="text-textdark/60">Pelapor:</span>
                                <span class="ml-1 text-textdark">${record.reporterGroup || '-'}</span>
                            </div>
                            <div class="col-span-2">
                                <span class="text-textdark/60">Terlapor:</span>
                                <span class="ml-1 text-textdark">${record.reportedGroup || '-'}</span>
                            </div>
                        </div>
                        <div class="text-sm text-textdark/80">
                            <span class="font-semibold text-textdark/60">Deskripsi:</span>
                            <p class="mt-1">${record.description || '-'}</p>
                        </div>
                    `;

                    recordCard.innerHTML = cardHTML;
                    recordsContainer.appendChild(recordCard);
                    });

                    transactionSection.appendChild(recordsContainer);
                }
            } else {
                loadingDiv.innerHTML = `
                    <div class="text-center">
                        <svg class="mx-auto mb-3 h-12 w-12 text-textdark/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <p class="text-sm text-textdark/60">Tidak ada data transaksi simulasi di network ini</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading transaction data:', error);
            loadingDiv.innerHTML = `
                <div class="text-center">
                    <svg class="mx-auto mb-3 h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="mb-2 font-semibold text-red-400">Gagal Memuat Data Transaksi</p>
                    <p class="text-sm text-textdark/60">${error.message || 'Terjadi kesalahan'}</p>
                </div>
            `;
        }
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

        // Filter out first 7 initialization blocks
        const filteredBlocks = network.blocks.slice(7);

        // Calculate pagination
        const totalBlocks = filteredBlocks.length;
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedBlocks = filteredBlocks.slice(startIndex, endIndex);

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
            { label: 'Block #', width: '15%' },
            { label: 'Transaksi', width: '20%' },
            { label: 'Timestamp', width: '25%' },
            { label: 'Detail', width: '15%' }
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

            // Transaction Count
            const txCountCell = document.createElement('td');
            txCountCell.className = 'px-6 py-4';
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

            // Detail Button
            const detailCell = document.createElement('td');
            detailCell.className = 'px-6 py-4';
            const detailButton = document.createElement('button');
            detailButton.type = 'button';
            detailButton.className = 'inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20';
            detailButton.innerHTML = `
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                <span>Lihat Detail</span>
            `;
            detailButton.addEventListener('click', () => {
                showBlockDetail(block, networkId);
            });
            detailCell.appendChild(detailButton);

            row.append(blockNumCell, txCountCell, timestampCell, detailCell);
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
