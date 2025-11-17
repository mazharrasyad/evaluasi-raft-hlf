// Input Data Simulasi - Auto-generate simulation data based on 2024 statistics and submit to multiple networks

const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    // DOM Elements
    const loadCards = document.querySelectorAll('.load-card');
    const loadRadios = document.querySelectorAll('input[name="loadType"]');
    const transactionCountInput = document.getElementById('transactionCount');
    const networkCheckboxes = document.querySelectorAll('input[name="network"]');
    const selectAllBtn = document.getElementById('selectAllNetworks');
    const deselectAllBtn = document.getElementById('deselectAllNetworks');
    const executeButton = document.getElementById('executeButton');
    const statusSection = document.getElementById('statusSection');
    const statusContent = document.getElementById('statusContent');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultsSection = document.getElementById('resultsSection');
    const resultsContent = document.getElementById('resultsContent');
    const networkHealthContent = document.getElementById('networkHealthContent');
    const networkWarning = document.getElementById('networkWarning');
    const refreshNetworkStatusBtn = document.getElementById('refreshNetworkStatus');

    // Load type configuration
    const LOAD_CONFIGS = {
        light: { min: 100, max: 500, tps: '10-20' },
        medium: { min: 1000, max: 3000, tps: '50-100' },
        heavy: { min: 5000, max: 10000, tps: '200-500' }
    };

    // Data distributions based on 2024 statistics
    const DISTRIBUTIONS = {
        substances: [
            { value: 'Agraria (Pertanahan dan Tata Ruang)', weight: 17.2 },
            { value: 'Kepegawaian', weight: 12.5 },
            { value: 'Pendidikan', weight: 9.6 },
            { value: 'Perhubungan dan Infrastruktur', weight: 6.7 },
            { value: 'Hak Sipil dan Politik', weight: 6.3 },
            { value: 'Administrasi Kependudukan', weight: 6.0 },
            { value: 'Kepolisian', weight: 5.7 },
            { value: 'Kesehatan', weight: 4.8 },
            { value: 'Pelayanan Umum', weight: 4.2 },
            { value: 'Lainnya', weight: 27.0 }
        ],
        reporterGroups: [
            { value: 'Perorangan', weight: 77.3 },
            { value: 'Badan Hukum/Organisasi', weight: 7.6 },
            { value: 'Anggota Keluarga', weight: 3.8 },
            { value: 'Kelompok Masyarakat', weight: 1.2 },
            { value: 'Bukan Korban Langsung maupun Kuasa', weight: 1.0 },
            { value: 'Kantor Hukum (Advokat)', weight: 0.4 },
            { value: 'Tidak Diketahui', weight: 8.7 }
        ],
        reportedGroups: [
            { value: 'Pemerintah Daerah', weight: 47.5 },
            { value: 'Badan Pertanahan Nasional', weight: 12.3 },
            { value: 'BUMN/BUMD', weight: 6.7 },
            { value: 'Lembaga Pendidikan Negeri', weight: 6.0 },
            { value: 'Kepolisian', weight: 5.8 },
            { value: 'Instansi Pemerintah / Kementerian', weight: 5.8 },
            { value: 'Lainnya', weight: 15.9 }
        ],
        offices: [
            { value: 'Pusat', weight: 10.2 },
            { value: 'Sumatera Barat', weight: 5.0 },
            { value: 'Sumatera Selatan', weight: 4.5 },
            { value: 'Jakarta Raya', weight: 3.7 },
            { value: 'Sulawesi Selatan', weight: 3.7 },
            { value: 'Kalimantan Barat', weight: 3.6 },
            { value: 'Jawa Tengah', weight: 3.6 },
            { value: 'Jawa Barat', weight: 3.5 },
            { value: 'Jawa Timur', weight: 3.4 },
            { value: 'Sumatera Utara', weight: 3.2 },
            { value: 'Lainnya', weight: 55.6 }
        ]
    };

    const SAMPLE_DESCRIPTIONS = [
        'Penundaan proses administrasi yang tidak wajar dalam pelayanan publik',
        'Diskriminasi dalam pemberian layanan kepada masyarakat',
        'Pungutan liar yang dilakukan oleh aparat dalam pengurusan dokumen',
        'Ketidakjelasan prosedur pelayanan yang merugikan masyarakat',
        'Penolakan pelayanan tanpa alasan yang jelas dan tidak sesuai SOP',
        'Keterlambatan pemberian izin melebihi waktu yang ditentukan',
        'Pelanggaran standar operasional prosedur dalam pelayanan masyarakat',
        'Penyalahgunaan wewenang dalam pelaksanaan tugas pelayanan publik',
        'Ketidakpastian waktu penyelesaian layanan administrasi',
        'Pembiaran atas pelanggaran yang dilakukan oleh bawahan'
    ];

    let isExecuting = false;
    let currentLoadType = null;
    let networkHealthStatus = {};

    // Network ID to label mapping
    const NETWORK_LABELS = {
        'channel-standard': 'Fabric 2 RAFT Standard',
        'channel-variant': 'Fabric 2 RAFT Variant',
        'channel-fabric3-standard': 'Fabric 3 RAFT Standard',
        'channel-fabric3-variant': 'Fabric 3 RAFT Variant'
    };

    // Fetch network health status
    async function fetchNetworkHealth() {
        try {
            const response = await fetch('/api/check-network');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching network health:', error);
            return null;
        }
    }

    // Display network health status
    function displayNetworkHealth(healthData) {
        if (!healthData || !healthData.results) {
            networkHealthContent.innerHTML = `
                <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4">
                    <div class="flex items-center gap-3">
                        <svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        <p class="text-sm text-red-400">Gagal memeriksa status network</p>
                    </div>
                </div>
            `;
            return;
        }

        networkHealthStatus = {};
        let healthHTML = '';

        healthData.results.forEach(network => {
            const isHealthy = network.status === 'healthy';
            networkHealthStatus[network.targetId] = isHealthy;

            const statusColor = isHealthy
                ? 'border-green-400/30 bg-green-400/10'
                : 'border-red-400/30 bg-red-400/10';

            const statusIcon = isHealthy
                ? '<svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                : '<svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';

            const statusText = isHealthy
                ? '<span class="text-sm font-semibold text-green-400">Online</span>'
                : '<span class="text-sm font-semibold text-red-400">Offline</span>';

            healthHTML += `
                <div class="flex items-center justify-between rounded-lg border ${statusColor} p-4">
                    <div class="flex items-center gap-3">
                        ${statusIcon}
                        <div>
                            <div class="font-semibold text-textdark">${network.label}</div>
                            <div class="text-xs text-textdark/60">${network.targetId}</div>
                        </div>
                    </div>
                    ${statusText}
                </div>
            `;
        });

        networkHealthContent.innerHTML = healthHTML;
        updateNetworkWarning();
    }

    // Update network warning based on selected networks
    function updateNetworkWarning() {
        const selectedNetworks = getSelectedNetworks();
        const unhealthySelected = selectedNetworks.filter(id => !networkHealthStatus[id]);

        if (unhealthySelected.length > 0) {
            networkWarning.classList.remove('hidden');
        } else {
            networkWarning.classList.add('hidden');
        }
    }

    // Check network health
    async function checkNetworkHealth() {
        if (refreshNetworkStatusBtn) {
            refreshNetworkStatusBtn.disabled = true;
        }

        networkHealthContent.innerHTML = `
            <div class="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-8">
                <div class="text-center">
                    <svg class="mx-auto mb-3 h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-sm text-textdark/70">Memeriksa status network...</p>
                </div>
            </div>
        `;

        const healthData = await fetchNetworkHealth();
        displayNetworkHealth(healthData);

        if (refreshNetworkStatusBtn) {
            refreshNetworkStatusBtn.disabled = false;
        }
    }

    // Weighted random selection
    function weightedRandom(items) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;

        for (const item of items) {
            random -= item.weight;
            if (random <= 0) {
                return item.value;
            }
        }

        return items[items.length - 1].value;
    }

    // Generate random timestamp
    function generateTimestamp(loadType) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();

        let hour, minute, second;

        if (loadType === 'light') {
            // Distributed throughout the day (00:00 - 23:59)
            hour = Math.floor(Math.random() * 24);
            minute = Math.floor(Math.random() * 60);
        } else if (loadType === 'medium') {
            // Concentrated during work hours (08:00 - 16:00)
            hour = 8 + Math.floor(Math.random() * 9);
            minute = Math.floor(Math.random() * 60);
        } else {
            // Burst in peak hours (10:00 - 14:00)
            hour = 10 + Math.floor(Math.random() * 5);
            minute = Math.floor(Math.random() * 60);
        }

        second = Math.floor(Math.random() * 60);

        return new Date(year, month, day, hour, minute, second).toISOString();
    }

    // Generate report ID
    function generateReportId(index, total) {
        const paddedIndex = String(index).padStart(5, '0');
        return `RPT-2024-${paddedIndex}`;
    }

    // Generate single record
    function generateRecord(index, total, loadType) {
        return {
            reportId: generateReportId(index, total),
            timestamp: generateTimestamp(loadType),
            substance: weightedRandom(DISTRIBUTIONS.substances),
            reporterGroup: weightedRandom(DISTRIBUTIONS.reporterGroups),
            reportedGroup: weightedRandom(DISTRIBUTIONS.reportedGroups),
            receivingOffice: weightedRandom(DISTRIBUTIONS.offices),
            description: SAMPLE_DESCRIPTIONS[Math.floor(Math.random() * SAMPLE_DESCRIPTIONS.length)],
            status: 'pending'
        };
    }

    // Generate multiple records
    function generateRecords(count, loadType) {
        const records = [];
        for (let i = 1; i <= count; i++) {
            records.push(generateRecord(i, count, loadType));
        }
        return records;
    }

    // Get selected networks
    function getSelectedNetworks() {
        const selected = [];
        networkCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.push(checkbox.value);
            }
        });
        return selected;
    }

    // Submit record to blockchain
    async function submitRecord(record, targetIds) {
        const response = await fetch('/api/simulations/records', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                record: record,
                targetIds: targetIds
            })
        });

        if (!response.ok) {
            let errorMessage = `Server error: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // Ignore
            }
            throw new Error(errorMessage);
        }

        return response.json();
    }

    // Update progress
    function updateProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    }

    // Show status message
    function showStatus(message, type = 'info') {
        const iconMap = {
            info: '<svg class="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            success: '<svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
            error: '<svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
            warning: '<svg class="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>'
        };

        const colorMap = {
            info: 'border-primary/20 bg-primary/5',
            success: 'border-green-400/20 bg-green-400/5',
            error: 'border-red-400/20 bg-red-400/5',
            warning: 'border-yellow-400/20 bg-yellow-400/5'
        };

        const statusHTML = `
            <div class="flex items-start gap-3 rounded-lg border ${colorMap[type]} p-4">
                ${iconMap[type]}
                <p class="flex-1 text-sm text-textdark/90">${message}</p>
            </div>
        `;

        statusContent.insertAdjacentHTML('beforeend', statusHTML);
        statusSection.classList.remove('hidden');
        statusSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Show results
    function showResults(summary) {
        const totalRecords = summary.totalRecords || 0;
        const totalNetworks = summary.networks?.length || 0;
        const lastSubmittedData = summary.lastSubmittedData;

        let resultsHTML = `
            <div class="rounded-xl border border-primary/20 bg-primary/5 p-6">
                <h3 class="mb-4 text-lg font-semibold text-primary">Ringkasan Simulasi</h3>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div class="text-textdark/60">Total Transaksi</div>
                        <div class="text-2xl font-bold text-textdark">${totalRecords}</div>
                    </div>
                    <div>
                        <div class="text-textdark/60">Target Network</div>
                        <div class="text-2xl font-bold text-textdark">${totalNetworks}</div>
                    </div>
                </div>
            </div>
        `;

        // Show last submitted data sample
        if (lastSubmittedData) {
            resultsHTML += `
                <div class="rounded-xl border border-accent/20 bg-accent/5 p-6">
                    <h4 class="mb-4 text-base font-semibold text-accent">Contoh Data Simulasi Terakhir</h4>
                    <div class="space-y-3 text-sm">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <span class="font-semibold text-textdark/70">Report ID:</span>
                                <div class="mt-1 font-mono text-primary">${lastSubmittedData.reportId || '-'}</div>
                            </div>
                            <div>
                                <span class="font-semibold text-textdark/70">Timestamp:</span>
                                <div class="mt-1 text-textdark">${lastSubmittedData.timestamp || '-'}</div>
                            </div>
                        </div>
                        <div>
                            <span class="font-semibold text-textdark/70">Substansi:</span>
                            <div class="mt-1 text-textdark">${lastSubmittedData.substance || '-'}</div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <span class="font-semibold text-textdark/70">Pelapor:</span>
                                <div class="mt-1 text-textdark">${lastSubmittedData.reporterGroup || '-'}</div>
                            </div>
                            <div>
                                <span class="font-semibold text-textdark/70">Terlapor:</span>
                                <div class="mt-1 text-textdark">${lastSubmittedData.reportedGroup || '-'}</div>
                            </div>
                        </div>
                        <div>
                            <span class="font-semibold text-textdark/70">Kantor Penerima:</span>
                            <div class="mt-1 text-textdark">${lastSubmittedData.receivingOffice || '-'}</div>
                        </div>
                        <div>
                            <span class="font-semibold text-textdark/70">Deskripsi:</span>
                            <div class="mt-1 text-textdark">${lastSubmittedData.description || '-'}</div>
                        </div>
                        <div>
                            <span class="font-semibold text-textdark/70">Status:</span>
                            <div class="mt-1">
                                <span class="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                                    ${lastSubmittedData.status || 'pending'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (summary.networks && summary.networks.length > 0) {
            resultsHTML += '<div class="space-y-4">';

            summary.networks.forEach(network => {
                const successRate = network.total > 0
                    ? Math.round((network.success / network.total) * 100)
                    : 0;

                const statusColor = successRate === 100
                    ? 'border-green-400/30 bg-green-400/5'
                    : successRate > 0
                        ? 'border-yellow-400/30 bg-yellow-400/5'
                        : 'border-red-400/30 bg-red-400/5';

                resultsHTML += `
                    <div class="rounded-xl border ${statusColor} p-5">
                        <div class="mb-3 flex items-center justify-between">
                            <h4 class="font-semibold text-textdark">${network.label}</h4>
                            <span class="rounded-full px-3 py-1 text-xs font-semibold ${
                                successRate === 100 ? 'bg-green-400/20 text-green-400' :
                                successRate > 0 ? 'bg-yellow-400/20 text-yellow-400' :
                                'bg-red-400/20 text-red-400'
                            }">${successRate}%</span>
                        </div>
                        <div class="grid grid-cols-3 gap-3 text-sm">
                            <div>
                                <div class="text-xs text-textdark/60">Total</div>
                                <div class="text-lg font-semibold text-textdark">${network.total}</div>
                            </div>
                            <div>
                                <div class="text-xs text-textdark/60">Berhasil</div>
                                <div class="text-lg font-semibold text-green-400">${network.success}</div>
                            </div>
                            <div>
                                <div class="text-xs text-textdark/60">Gagal</div>
                                <div class="text-lg font-semibold text-red-400">${network.failed}</div>
                            </div>
                        </div>
                    </div>
                `;
            });

            resultsHTML += '</div>';
        }

        resultsContent.innerHTML = resultsHTML;
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Save block submission data to localStorage
    function saveBlockSubmissionData(response) {
        try {
            // Get existing submissions from localStorage
            const existingData = localStorage.getItem('blockSubmissions');
            let submissions = existingData ? JSON.parse(existingData) : [];

            // Add new submission
            submissions.push(response);

            // Keep only last 1000 submissions to avoid localStorage overflow
            if (submissions.length > 1000) {
                submissions = submissions.slice(-1000);
            }

            // Save back to localStorage
            localStorage.setItem('blockSubmissions', JSON.stringify(submissions));
        } catch (error) {
            console.error('Error saving block submission data:', error);
        }
    }

    // Execute simulation
    async function executeSimulation() {
        if (isExecuting) {
            return;
        }

        const selectedNetworks = getSelectedNetworks();
        if (selectedNetworks.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Pilih Network',
                text: 'Silakan pilih minimal satu network untuk menerima data simulasi.',
                background: '#0F172A',
                color: '#E2E8F0',
                confirmButtonColor: '#38BDF8'
            });
            return;
        }

        // Check network health
        const unhealthyNetworks = selectedNetworks.filter(id => !networkHealthStatus[id]);
        if (unhealthyNetworks.length > 0) {
            const unhealthyLabels = unhealthyNetworks.map(id => NETWORK_LABELS[id] || id).join(', ');

            const result = await Swal.fire({
                icon: 'warning',
                title: 'Network Belum Siap',
                html: `
                    <p class="mb-3 text-textdark/80">Network berikut belum berjalan atau tidak dapat diakses:</p>
                    <p class="mb-4 text-sm font-semibold text-yellow-400">${unhealthyLabels}</p>
                    <p class="text-sm text-textdark/60">Silakan jalankan network terlebih dahulu atau hapus dari pilihan.</p>
                `,
                showCancelButton: true,
                confirmButtonText: 'Jalankan Network',
                cancelButtonText: 'Batal',
                background: '#0F172A',
                color: '#E2E8F0',
                confirmButtonColor: '#38BDF8',
                cancelButtonColor: '#64748B'
            });

            if (result.isConfirmed) {
                window.location.href = '/penelitian/pelaksanaan-simulasi/menjalankan-network';
            }
            return;
        }

        const count = parseInt(transactionCountInput.value);
        if (isNaN(count) || count < 1 || count > 10000) {
            Swal.fire({
                icon: 'warning',
                title: 'Jumlah Tidak Valid',
                text: 'Masukkan jumlah transaksi antara 1 - 10.000',
                background: '#0F172A',
                color: '#E2E8F0',
                confirmButtonColor: '#38BDF8'
            });
            return;
        }

        // Confirm execution
        const result = await Swal.fire({
            icon: 'question',
            title: 'Konfirmasi Eksekusi',
            html: `
                <p class="text-textdark/80">Akan membangkitkan <strong>${count}</strong> transaksi dan mengirimkan ke <strong>${selectedNetworks.length}</strong> network.</p>
                <p class="mt-2 text-sm text-textdark/60">Total: ${count * selectedNetworks.length} operasi blockchain</p>
            `,
            showCancelButton: true,
            confirmButtonText: 'Lanjutkan',
            cancelButtonText: 'Batal',
            background: '#0F172A',
            color: '#E2E8F0',
            confirmButtonColor: '#38BDF8',
            cancelButtonColor: '#64748B'
        });

        if (!result.isConfirmed) {
            return;
        }

        isExecuting = true;
        executeButton.disabled = true;

        // Clear previous results
        statusContent.innerHTML = '';
        resultsContent.innerHTML = '';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        statusSection.classList.remove('hidden');
        progressContainer.classList.remove('hidden');

        showStatus(`Membangkitkan ${count} data simulasi...`, 'info');

        try {
            // Generate records
            const records = generateRecords(count, currentLoadType);
            showStatus(`Berhasil membangkitkan ${records.length} data simulasi`, 'success');

            // Submit records
            showStatus(`Memulai pengiriman ke ${selectedNetworks.length} network...`, 'info');

            const networkSummary = selectedNetworks.map(id => ({
                id: id,
                label: id,
                total: 0,
                success: 0,
                failed: 0
            }));

            let lastSubmittedData = null;
            let batchCompletedAt = null;

            for (let i = 0; i < records.length; i++) {
                const record = records[i];

                try {
                    const response = await submitRecord(record, selectedNetworks);

                    // Collect last submitted data
                    if (response.simulationData) {
                        lastSubmittedData = response.simulationData;
                    }

                    // Collect results
                    if (response.results) {
                        response.results.forEach(result => {
                            const network = networkSummary.find(n => n.id === result.networkId);
                            if (network) {
                                network.total++;
                                if (result.success) {
                                    network.success++;
                                } else {
                                    network.failed++;
                                }
                                network.label = result.label || network.id;
                            }
                        });
                    }

                    // Update batch completion time
                    if (response.completedAt) {
                        batchCompletedAt = response.completedAt;
                    }

                    // Save block submission data to localStorage
                    if (response.success && response.results) {
                        saveBlockSubmissionData(response);
                    }
                } catch (error) {
                    console.error(`Error submitting record ${record.reportId}:`, error);
                    networkSummary.forEach(network => {
                        network.total++;
                        network.failed++;
                    });
                }

                updateProgress(i + 1, records.length);
            }

            showStatus(`Selesai mengirim ${records.length} transaksi`, 'success');

            // Show results with last submitted data
            showResults({
                totalRecords: records.length,
                networks: networkSummary,
                lastSubmittedData: lastSubmittedData
            });

            Swal.fire({
                icon: 'success',
                title: 'Simulasi Selesai',
                text: `Berhasil mengirim ${records.length} transaksi ke ${selectedNetworks.length} network`,
                background: '#0F172A',
                color: '#E2E8F0',
                confirmButtonColor: '#38BDF8'
            });

        } catch (error) {
            console.error('Execution error:', error);
            showStatus(`Error: ${error.message}`, 'error');

            Swal.fire({
                icon: 'error',
                title: 'Eksekusi Gagal',
                text: error.message || 'Terjadi kesalahan saat eksekusi simulasi',
                background: '#0F172A',
                color: '#E2E8F0',
                confirmButtonColor: '#38BDF8'
            });
        } finally {
            isExecuting = false;
            executeButton.disabled = false;
        }
    }

    // Event: Load type selection
    loadCards.forEach(card => {
        card.addEventListener('click', () => {
            const loadType = card.dataset.loadType;
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                handleLoadTypeChange(loadType);
            }
        });
    });

    loadRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                handleLoadTypeChange(e.target.value);
            }
        });
    });

    function handleLoadTypeChange(loadType) {
        currentLoadType = loadType;

        // Update visual selection
        loadCards.forEach(card => {
            if (card.dataset.loadType === loadType) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Update transaction count
        const config = LOAD_CONFIGS[loadType];
        if (config) {
            const suggested = Math.floor((config.min + config.max) / 2);
            transactionCountInput.value = suggested;
            transactionCountInput.min = config.min;
            transactionCountInput.max = config.max;
        }
    }

    // Event: Network selection
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            networkCheckboxes.forEach(cb => cb.checked = true);
            updateNetworkWarning();
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            networkCheckboxes.forEach(cb => cb.checked = false);
            updateNetworkWarning();
        });
    }

    // Event: Network checkbox changes
    networkCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateNetworkWarning);
    });

    // Event: Refresh network status
    if (refreshNetworkStatusBtn) {
        refreshNetworkStatusBtn.addEventListener('click', checkNetworkHealth);
    }

    // Event: Execute button
    if (executeButton) {
        executeButton.addEventListener('click', executeSimulation);
    }

    // Initialize: Select light load by default
    const lightRadio = document.getElementById('loadLight');
    if (lightRadio) {
        lightRadio.checked = true;
        handleLoadTypeChange('light');
    }

    // Initialize: Check network health on page load
    checkNetworkHealth();
});
