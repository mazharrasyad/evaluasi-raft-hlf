// Submit Simulasi JavaScript
const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    const form = document.getElementById('simulationForm');
    const submitButton = document.getElementById('submitButton');
    const submitButtonText = document.getElementById('submitButtonText');
    const resetButton = document.getElementById('resetButton');
    const progressSection = document.getElementById('progressSection');
    const resultsSection = document.getElementById('resultsSection');
    const progressStatus = document.getElementById('progressStatus');
    const progressDetail = document.getElementById('progressDetail');
    const progressBar = document.getElementById('progressBar');
    const resultsContainer = document.getElementById('resultsContainer');
    const networkError = document.getElementById('networkError');

    // Data reference for simulation generation
    const SUBSTANCE_DATA = [
        { name: 'Agraria (Pertanahan dan Tata Ruang)', weight: 17.2 },
        { name: 'Kepegawaian', weight: 12.5 },
        { name: 'Pendidikan', weight: 9.6 },
        { name: 'Perhubungan dan Infrastruktur', weight: 6.7 },
        { name: 'Hak Sipil dan Politik', weight: 6.3 },
        { name: 'Administrasi Kependudukan', weight: 6.0 },
        { name: 'Kepolisian', weight: 5.7 },
        { name: 'Lainnya', weight: 36.0 }
    ];

    const REPORTER_GROUPS = [
        { name: 'Perorangan', weight: 77.3 },
        { name: 'Badan Hukum/Organisasi', weight: 7.6 },
        { name: 'Anggota Keluarga', weight: 3.8 },
        { name: 'Kelompok Masyarakat', weight: 1.2 },
        { name: 'Bukan Korban Langsung maupun Kuasa', weight: 1.0 },
        { name: 'Kantor Hukum (Advokat)', weight: 0.4 },
        { name: 'Tidak Diketahui', weight: 8.7 }
    ];

    const REPORTED_GROUPS = [
        { name: 'Pemerintah Daerah', weight: 47.5 },
        { name: 'Badan Pertanahan Nasional', weight: 12.3 },
        { name: 'BUMN/BUMD', weight: 6.7 },
        { name: 'Lembaga Pendidikan Negeri', weight: 6.0 },
        { name: 'Kepolisian', weight: 5.8 },
        { name: 'Instansi Pemerintah / Kementerian', weight: 5.8 },
        { name: 'Lainnya', weight: 15.9 }
    ];

    const RECEIVING_OFFICES = [
        { name: 'Pusat', weight: 10.2 },
        { name: 'Sumatera Barat', weight: 5.0 },
        { name: 'Sumatera Selatan', weight: 4.5 },
        { name: 'Jakarta Raya', weight: 3.7 },
        { name: 'Sulawesi Selatan', weight: 3.7 },
        { name: 'Kalimantan Barat', weight: 3.6 },
        { name: 'Jawa Tengah', weight: 3.6 },
        { name: 'Kantor Regional Lainnya', weight: 65.7 }
    ];

    // Weighted random selection function
    function weightedRandomSelect(items) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;

        for (const item of items) {
            random -= item.weight;
            if (random <= 0) {
                return item.name;
            }
        }

        return items[items.length - 1].name;
    }

    // Generate unique report ID
    function generateReportId(index) {
        const year = new Date().getFullYear();
        const paddedIndex = String(index).padStart(5, '0');
        return `RPT-${year}-${paddedIndex}`;
    }

    // Generate timestamp based on load category
    function generateTimestamp(loadCategory, index, totalCount) {
        const now = new Date();
        const baseTime = now.getTime();

        switch (loadCategory) {
            case 'light':
                // Distributed evenly throughout the day
                const daySpread = 24 * 60 * 60 * 1000; // 24 hours in ms
                return new Date(baseTime - Math.random() * daySpread).toISOString();

            case 'medium':
                // Concentrated during work hours (8 AM - 4 PM)
                const workHoursSpread = 8 * 60 * 60 * 1000; // 8 hours in ms
                const workDayStart = new Date(now);
                workDayStart.setHours(8, 0, 0, 0);
                return new Date(workDayStart.getTime() + Math.random() * workHoursSpread).toISOString();

            case 'high':
                // Burst traffic within 2-4 hours
                const burstSpread = (2 + Math.random() * 2) * 60 * 60 * 1000; // 2-4 hours
                const burstStart = new Date(now);
                burstStart.setHours(10, 0, 0, 0);
                return new Date(burstStart.getTime() + Math.random() * burstSpread).toISOString();

            default:
                return now.toISOString();
        }
    }

    // Generate simulation record
    function generateSimulationRecord(index, totalCount, loadCategory) {
        return {
            id: generateReportId(index + 1),
            reportId: generateReportId(index + 1),
            timestamp: generateTimestamp(loadCategory, index, totalCount),
            substance: weightedRandomSelect(SUBSTANCE_DATA),
            reporterGroup: weightedRandomSelect(REPORTER_GROUPS),
            reportedGroup: weightedRandomSelect(REPORTED_GROUPS),
            receivingOffice: weightedRandomSelect(RECEIVING_OFFICES),
            description: `Laporan maladministrasi ${index + 1} dari ${totalCount} untuk simulasi ${loadCategory}`,
            status: 'pending'
        };
    }

    // Generate multiple simulation records
    function generateSimulationRecords(count, loadCategory) {
        const records = [];
        for (let i = 0; i < count; i++) {
            records.push(generateSimulationRecord(i, count, loadCategory));
        }
        return records;
    }

    // Submit record to blockchain
    async function submitRecordToBlockchain(record, targetIds) {
        const payload = {
            record,
            targetIds
        };

        const response = await fetch('/api/simulations/records', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let message = `Server returned status ${response.status}`;
            try {
                const errorBody = await response.json();
                if (errorBody?.error) {
                    message = errorBody.error;
                }
            } catch (error) {
                // Ignore JSON parse errors
            }
            throw new Error(message);
        }

        return response.json();
    }

    // Update progress UI
    function updateProgress(current, total, status, detail) {
        const percentage = Math.round((current / total) * 100);
        progressBar.style.width = `${percentage}%`;
        progressStatus.textContent = status;
        progressDetail.textContent = detail;
    }

    // Show results
    function showResults(results) {
        resultsContainer.innerHTML = '';

        const summary = {
            total: results.length,
            success: 0,
            failed: 0,
            networkResults: {}
        };

        // Calculate summary
        results.forEach(result => {
            if (result.success) {
                summary.success++;
            } else {
                summary.failed++;
            }

            if (result.results) {
                result.results.forEach(netResult => {
                    const netId = netResult.targetId || 'unknown';
                    if (!summary.networkResults[netId]) {
                        summary.networkResults[netId] = {
                            label: netResult.label || netId,
                            success: 0,
                            failed: 0
                        };
                    }

                    if (netResult.status === 'success') {
                        summary.networkResults[netId].success++;
                    } else {
                        summary.networkResults[netId].failed++;
                    }
                });
            }
        });

        // Create summary card
        const summaryCard = document.createElement('div');
        summaryCard.className = 'rounded-2xl border border-white/10 bg-surfaceMuted/60 p-6 space-y-4';

        const summaryTitle = document.createElement('h3');
        summaryTitle.className = 'text-lg font-semibold text-textdark';
        summaryTitle.textContent = 'Ringkasan Hasil';
        summaryCard.appendChild(summaryTitle);

        const summaryGrid = document.createElement('div');
        summaryGrid.className = 'grid gap-4 md:grid-cols-3';

        // Total
        const totalBox = document.createElement('div');
        totalBox.className = 'rounded-xl border border-white/10 bg-white/5 p-4';
        totalBox.innerHTML = `
            <div class="text-xs font-semibold uppercase tracking-wider text-muted">Total Transaksi</div>
            <div class="text-2xl font-semibold text-textdark">${summary.total}</div>
        `;
        summaryGrid.appendChild(totalBox);

        // Success
        const successBox = document.createElement('div');
        successBox.className = 'rounded-xl border border-green-500/20 bg-green-500/10 p-4';
        successBox.innerHTML = `
            <div class="text-xs font-semibold uppercase tracking-wider text-green-400">Berhasil</div>
            <div class="text-2xl font-semibold text-green-400">${summary.success}</div>
        `;
        summaryGrid.appendChild(successBox);

        // Failed
        const failedBox = document.createElement('div');
        failedBox.className = 'rounded-xl border border-red-500/20 bg-red-500/10 p-4';
        failedBox.innerHTML = `
            <div class="text-xs font-semibold uppercase tracking-wider text-red-400">Gagal</div>
            <div class="text-2xl font-semibold text-red-400">${summary.failed}</div>
        `;
        summaryGrid.appendChild(failedBox);

        summaryCard.appendChild(summaryGrid);

        // Network results
        if (Object.keys(summary.networkResults).length > 0) {
            const networkTitle = document.createElement('h4');
            networkTitle.className = 'text-sm font-semibold text-textdark mt-4';
            networkTitle.textContent = 'Hasil per Jaringan';
            summaryCard.appendChild(networkTitle);

            const networkGrid = document.createElement('div');
            networkGrid.className = 'grid gap-3 md:grid-cols-2';

            Object.entries(summary.networkResults).forEach(([netId, netData]) => {
                const networkBox = document.createElement('div');
                networkBox.className = 'rounded-xl border border-white/10 bg-white/5 p-4';

                const successRate = netData.success + netData.failed > 0
                    ? Math.round((netData.success / (netData.success + netData.failed)) * 100)
                    : 0;

                networkBox.innerHTML = `
                    <div class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">${netData.label}</div>
                    <div class="flex items-center gap-4">
                        <div class="flex-1">
                            <div class="text-sm text-textdark/70">
                                <span class="text-green-400">${netData.success}</span> berhasil •
                                <span class="text-red-400">${netData.failed}</span> gagal
                            </div>
                        </div>
                        <div class="text-xl font-semibold ${successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}">
                            ${successRate}%
                        </div>
                    </div>
                `;
                networkGrid.appendChild(networkBox);
            });

            summaryCard.appendChild(networkGrid);
        }

        resultsContainer.appendChild(summaryCard);

        // Show detailed results
        const detailsTitle = document.createElement('h3');
        detailsTitle.className = 'text-lg font-semibold text-textdark mt-8 mb-4';
        detailsTitle.textContent = 'Detail Hasil Transaksi';
        resultsContainer.appendChild(detailsTitle);

        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'space-y-3';

        results.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = `result-item rounded-xl border p-4 ${
                result.success
                    ? 'border-green-500/20 bg-green-500/10'
                    : 'border-red-500/20 bg-red-500/10'
            }`;

            const header = document.createElement('div');
            header.className = 'flex items-start justify-between mb-2';

            const titleDiv = document.createElement('div');
            titleDiv.innerHTML = `
                <div class="text-sm font-semibold ${result.success ? 'text-green-400' : 'text-red-400'}">
                    Transaksi #${index + 1}
                </div>
                <div class="text-xs text-textdark/60">
                    ${result.record?.reportId || 'N/A'}
                </div>
            `;

            const statusBadge = document.createElement('span');
            statusBadge.className = `rounded-full px-3 py-1 text-xs font-semibold ${
                result.success
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
            }`;
            statusBadge.textContent = result.success ? 'BERHASIL' : 'GAGAL';

            header.appendChild(titleDiv);
            header.appendChild(statusBadge);
            resultItem.appendChild(header);

            // Show network results if available
            if (result.results && result.results.length > 0) {
                const networkResults = document.createElement('div');
                networkResults.className = 'mt-3 space-y-2';

                result.results.forEach(netResult => {
                    const netItem = document.createElement('div');
                    netItem.className = 'text-xs rounded-lg bg-white/5 p-2';
                    netItem.innerHTML = `
                        <div class="flex items-center justify-between">
                            <span class="text-textdark/70">${netResult.label || netResult.targetId}</span>
                            <span class="${netResult.status === 'success' ? 'text-green-400' : 'text-red-400'}">
                                ${netResult.status === 'success' ? '✓ Berhasil' : '✗ Gagal'}
                            </span>
                        </div>
                        ${netResult.message ? `<div class="text-textdark/50 mt-1">${netResult.message}</div>` : ''}
                    `;
                    networkResults.appendChild(netItem);
                });

                resultItem.appendChild(networkResults);
            }

            detailsContainer.appendChild(resultItem);
        });

        resultsContainer.appendChild(detailsContainer);
    }

    // Handle form submission
    async function handleSubmit(event) {
        event.preventDefault();

        // Validate network selection
        const selectedNetworks = Array.from(
            document.querySelectorAll('input[name="targetNetworks"]:checked')
        ).map(checkbox => checkbox.value);

        if (selectedNetworks.length === 0) {
            networkError.classList.remove('hidden');
            return;
        }

        networkError.classList.add('hidden');

        // Get form values
        const formData = new FormData(form);
        const loadCategory = formData.get('loadCategory');
        const transactionCount = parseInt(formData.get('transactionCount'), 10);

        // Disable form
        submitButton.disabled = true;
        submitButtonText.textContent = 'Memproses...';

        // Show progress section
        progressSection.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        // Generate simulation records
        updateProgress(0, transactionCount, 'Membuat data simulasi...', `Menghasilkan ${transactionCount} record simulasi`);

        const records = generateSimulationRecords(transactionCount, loadCategory);

        // Submit records
        const results = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];

            updateProgress(
                i + 1,
                records.length,
                `Mengirim transaksi ${i + 1} dari ${records.length}...`,
                `Mengirim ke ${selectedNetworks.length} jaringan`
            );

            try {
                const response = await submitRecordToBlockchain(record, selectedNetworks);
                results.push({
                    success: response.success || false,
                    record: record,
                    results: response.results || [],
                    response: response
                });

                // Add small delay to avoid overwhelming the server
                if (i < records.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`Error submitting record ${i + 1}:`, error);
                results.push({
                    success: false,
                    record: record,
                    error: error.message,
                    results: []
                });
            }
        }

        // Update progress to complete
        updateProgress(records.length, records.length, 'Selesai!', `${records.length} transaksi telah diproses`);

        // Show results
        setTimeout(() => {
            progressSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
            showResults(results);

            // Re-enable form
            submitButton.disabled = false;
            submitButtonText.textContent = 'Submit Simulasi ke Jaringan';
        }, 1000);
    }

    // Handle reset
    function handleReset() {
        form.reset();
        progressSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
        networkError.classList.add('hidden');
    }

    // Event listeners
    form.addEventListener('submit', handleSubmit);
    resetButton.addEventListener('click', handleReset);

    // Update transaction count placeholder based on load category
    const loadCategoryInputs = document.querySelectorAll('input[name="loadCategory"]');
    const transactionCountInput = document.getElementById('transactionCount');

    loadCategoryInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const category = e.target.value;
            switch (category) {
                case 'light':
                    transactionCountInput.placeholder = 'Contoh: 100-500';
                    transactionCountInput.min = '100';
                    transactionCountInput.max = '500';
                    break;
                case 'medium':
                    transactionCountInput.placeholder = 'Contoh: 1000-3000';
                    transactionCountInput.min = '1000';
                    transactionCountInput.max = '3000';
                    break;
                case 'high':
                    transactionCountInput.placeholder = 'Contoh: 5000-10000';
                    transactionCountInput.min = '5000';
                    transactionCountInput.max = '10000';
                    break;
            }
        });
    });
});
