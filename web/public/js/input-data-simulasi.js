// Input Data Simulasi - Handler for manual data input and submission to multiple networks

const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    // DOM Elements
    const form = document.getElementById('simulationInputForm');
    const submitButton = document.getElementById('submitButton');
    const resetButton = document.getElementById('resetButton');
    const generateButton = document.getElementById('generateButton');
    const selectAllBtn = document.getElementById('selectAllNetworks');
    const deselectAllBtn = document.getElementById('deselectAllNetworks');
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('resultsContainer');
    const clearResultsBtn = document.getElementById('clearResultsButton');

    // Form fields
    const reportIdInput = document.getElementById('reportId');
    const timestampInput = document.getElementById('timestamp');
    const substanceInput = document.getElementById('substance');
    const reporterGroupInput = document.getElementById('reporterGroup');
    const reportedGroupInput = document.getElementById('reportedGroup');
    const receivingOfficeInput = document.getElementById('receivingOffice');
    const descriptionInput = document.getElementById('description');
    const statusInput = document.getElementById('status');

    // Network checkboxes
    const networkCheckboxes = document.querySelectorAll('input[name="network"]');

    // Initialize timestamp with current date/time
    function initializeTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        timestampInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Generate random report ID
    function generateReportId() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 99999) + 1;
        const paddedRandom = String(random).padStart(5, '0');
        return `RPT-${year}-${paddedRandom}`;
    }

    // Data for auto-generation
    const substances = [
        'Agraria (Pertanahan dan Tata Ruang)',
        'Kepegawaian',
        'Pendidikan',
        'Perhubungan dan Infrastruktur',
        'Hak Sipil dan Politik',
        'Administrasi Kependudukan',
        'Kepolisian',
        'Kesehatan',
        'Pelayanan Umum'
    ];

    const reporterGroups = [
        'Perorangan',
        'Badan Hukum/Organisasi',
        'Anggota Keluarga',
        'Kelompok Masyarakat',
        'Kantor Hukum (Advokat)'
    ];

    const reportedGroups = [
        'Pemerintah Daerah',
        'Badan Pertanahan Nasional',
        'BUMN/BUMD',
        'Lembaga Pendidikan Negeri',
        'Kepolisian',
        'Instansi Pemerintah / Kementerian',
        'Lembaga Peradilan'
    ];

    const offices = [
        'Pusat', 'Jakarta Raya', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur',
        'Sumatera Utara', 'Sumatera Barat', 'Sumatera Selatan',
        'Kalimantan Barat', 'Kalimantan Selatan', 'Kalimantan Timur',
        'Sulawesi Selatan', 'Sulawesi Utara', 'Bali', 'Yogyakarta'
    ];

    const sampleDescriptions = [
        'Penundaan proses administrasi yang tidak wajar',
        'Diskriminasi dalam pelayanan publik',
        'Pungutan liar dalam pengurusan dokumen',
        'Ketidakjelasan prosedur pelayanan',
        'Penolakan pelayanan tanpa alasan yang jelas',
        'Keterlambatan pemberian izin melebihi waktu yang ditentukan',
        'Pelanggaran SOP dalam pelayanan masyarakat',
        'Penyalahgunaan wewenang dalam pelayanan publik'
    ];

    // Get random item from array
    function getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // Auto-generate form data
    function generateFormData() {
        reportIdInput.value = generateReportId();
        initializeTimestamp();
        substanceInput.value = getRandomItem(substances);
        reporterGroupInput.value = getRandomItem(reporterGroups);
        reportedGroupInput.value = getRandomItem(reportedGroups);
        receivingOfficeInput.value = getRandomItem(offices);
        descriptionInput.value = getRandomItem(sampleDescriptions);
        statusInput.value = 'pending';

        // Show feedback
        Swal.fire({
            icon: 'success',
            title: 'Data Berhasil Digenerate',
            text: 'Form telah diisi dengan data otomatis. Silakan review dan kirim.',
            background: '#0F172A',
            color: '#E2E8F0',
            confirmButtonColor: '#38BDF8',
            timer: 2000,
            showConfirmButton: false
        });
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

    // Validate form
    function validateForm() {
        const selectedNetworks = getSelectedNetworks();

        if (selectedNetworks.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Pilih Network',
                text: 'Silakan pilih minimal satu network untuk menerima data.',
                background: '#0F172A',
                color: '#E2E8F0',
                confirmButtonColor: '#38BDF8'
            });
            return false;
        }

        // Validate report ID format
        const reportIdPattern = /^RPT-\d{4}-\d{5}$/;
        if (!reportIdPattern.test(reportIdInput.value)) {
            Swal.fire({
                icon: 'warning',
                title: 'Format ID Tidak Valid',
                text: 'Format ID Laporan harus: RPT-YYYY-XXXXX',
                background: '#0F172A',
                color: '#E2E8F0',
                confirmButtonColor: '#38BDF8'
            });
            return false;
        }

        return true;
    }

    // Build record object from form
    function buildRecordFromForm() {
        return {
            reportId: reportIdInput.value.trim(),
            timestamp: new Date(timestampInput.value).toISOString(),
            substance: substanceInput.value,
            reporterGroup: reporterGroupInput.value,
            reportedGroup: reportedGroupInput.value,
            receivingOffice: receivingOfficeInput.value,
            description: descriptionInput.value.trim(),
            status: statusInput.value
        };
    }

    // Submit record to blockchain networks
    async function submitToNetworks(record, targetIds) {
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
            let errorMessage = `Server mengembalikan status ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // Ignore JSON parse error
            }
            throw new Error(errorMessage);
        }

        return response.json();
    }

    // Display results
    function displayResults(results, record) {
        resultsSection.classList.remove('hidden');

        const resultHTML = results.map(result => {
            const statusClass = result.success ? 'status-success' : 'status-error';
            const statusIcon = result.success
                ? '<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                : '<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';

            const badgeClass = result.networkId.includes('fabric3') ? 'badge-fabric3' : 'badge-fabric2';

            let detailsHTML = '';
            if (result.success && result.result) {
                const transactionId = result.result.transactionId || 'N/A';
                const blockNumber = result.result.blockNumber || 'N/A';
                const timestamp = result.result.timestamp
                    ? new Date(result.result.timestamp).toLocaleString('id-ID')
                    : 'N/A';

                detailsHTML = `
                    <div class="mt-3 space-y-1 text-xs">
                        <div class="flex justify-between">
                            <span class="text-textdark/60">Transaction ID:</span>
                            <span class="font-mono text-textdark/80">${transactionId.substring(0, 16)}...</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-textdark/60">Block Number:</span>
                            <span class="font-mono text-textdark/80">${blockNumber}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-textdark/60">Timestamp:</span>
                            <span class="text-textdark/80">${timestamp}</span>
                        </div>
                    </div>
                `;
            } else if (!result.success && result.error) {
                detailsHTML = `
                    <div class="mt-3 text-xs text-red-300">
                        Error: ${result.error}
                    </div>
                `;
            }

            return `
                <div class="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div class="flex items-start gap-4">
                        <div class="${statusClass} mt-1">${statusIcon}</div>
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <h3 class="text-base font-semibold text-textdark">${result.label || result.networkId}</h3>
                                <span class="${badgeClass} rounded-full border px-2 py-0.5 text-xs font-semibold">
                                    ${result.networkId.includes('fabric3') ? 'Fabric 3' : 'Fabric 2'}
                                </span>
                            </div>
                            <p class="text-sm ${statusClass}">
                                ${result.success ? 'Berhasil dikirim ke blockchain' : 'Gagal mengirim ke blockchain'}
                            </p>
                            ${detailsHTML}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const timestamp = new Date().toLocaleString('id-ID');
        const recordInfoHTML = `
            <div class="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
                <h3 class="mb-3 text-lg font-semibold text-primary">Data yang Dikirim</h3>
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span class="text-textdark/60">ID Laporan:</span>
                        <span class="ml-2 font-mono text-textdark">${record.reportId}</span>
                    </div>
                    <div>
                        <span class="text-textdark/60">Substansi:</span>
                        <span class="ml-2 text-textdark">${record.substance}</span>
                    </div>
                    <div>
                        <span class="text-textdark/60">Pelapor:</span>
                        <span class="ml-2 text-textdark">${record.reporterGroup}</span>
                    </div>
                    <div>
                        <span class="text-textdark/60">Terlapor:</span>
                        <span class="ml-2 text-textdark">${record.reportedGroup}</span>
                    </div>
                    <div>
                        <span class="text-textdark/60">Kantor:</span>
                        <span class="ml-2 text-textdark">${record.receivingOffice}</span>
                    </div>
                    <div>
                        <span class="text-textdark/60">Status:</span>
                        <span class="ml-2 text-textdark">${record.status}</span>
                    </div>
                </div>
                <div class="mt-3 text-xs text-textdark/50">Dikirim pada: ${timestamp}</div>
            </div>
        `;

        resultsContainer.innerHTML = recordInfoHTML + resultHTML;

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Handle form submission
    async function handleSubmit(event) {
        event.preventDefault();

        if (!validateForm()) {
            return;
        }

        const selectedNetworks = getSelectedNetworks();
        const record = buildRecordFromForm();

        // Show loading
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Mengirim...
        `;

        try {
            const response = await submitToNetworks(record, selectedNetworks);

            if (response.success) {
                // Display results
                displayResults(response.results || [], record);

                // Show success message
                const successCount = response.successCount || 0;
                const totalCount = response.totalCount || selectedNetworks.length;

                Swal.fire({
                    icon: successCount === totalCount ? 'success' : 'warning',
                    title: successCount === totalCount ? 'Berhasil Dikirim' : 'Sebagian Berhasil',
                    text: `${successCount} dari ${totalCount} network berhasil menerima data.`,
                    background: '#0F172A',
                    color: '#E2E8F0',
                    confirmButtonColor: '#38BDF8'
                });

                // Reset form if all successful
                if (successCount === totalCount) {
                    form.reset();
                    initializeTimestamp();
                }
            } else {
                throw new Error(response.error || 'Gagal mengirim data ke network');
            }
        } catch (error) {
            console.error('Error submitting to networks:', error);

            Swal.fire({
                icon: 'error',
                title: 'Gagal Mengirim',
                text: error.message || 'Terjadi kesalahan saat mengirim data ke network.',
                background: '#0F172A',
                color: '#E2E8F0',
                confirmButtonColor: '#38BDF8'
            });
        } finally {
            // Restore button
            submitButton.disabled = false;
            submitButton.innerHTML = `
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
                Kirim ke Network Terpilih
            `;
        }
    }

    // Event Listeners
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            form.reset();
            initializeTimestamp();
        });
    }

    if (generateButton) {
        generateButton.addEventListener('click', generateFormData);
    }

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            networkCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            networkCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        });
    }

    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', () => {
            resultsContainer.innerHTML = '';
            resultsSection.classList.add('hidden');
        });
    }

    // Initialize
    initializeTimestamp();
});
