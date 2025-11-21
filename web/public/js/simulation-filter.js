/**
 * Simulation Filter Helper
 * Common functions for filtering simulations by category across analysis pages
 */

/**
 * Load simulations with optional category filter
 * @param {string} category - Optional category filter (light, medium, heavy)
 * @param {string} selectId - ID of the select element
 * @param {string} noDataMsgId - ID of the no data message element
 * @returns {Promise<void>}
 */
async function loadSimulationsWithFilter(category = '', selectId = 'simulationSelect', noDataMsgId = 'noDataMessage') {
    try {
        const url = category
            ? `/api/metrics/simulations?category=${category}`
            : '/api/metrics/simulations';
        const response = await fetch(url);
        const data = await response.json();

        const select = document.getElementById(selectId);
        const noDataMsg = document.getElementById(noDataMsgId);

        if (data.success && data.simulations && data.simulations.length > 0) {
            select.innerHTML = '<option value="">-- Pilih simulasi --</option>';

            // Sort by date (newest first)
            const sortedSims = data.simulations.sort((a, b) =>
                new Date(b.startTime) - new Date(a.startTime)
            );

            sortedSims.forEach(sim => {
                const option = document.createElement('option');
                option.value = sim.simulationId;
                const date = new Date(sim.startTime).toLocaleString('id-ID');
                const loadCat = sim.config?.loadCategory || 'unknown';
                const categoryMap = {
                    'light': 'Ringan',
                    'medium': 'Sedang',
                    'heavy': 'Tinggi'
                };
                const categoryName = categoryMap[loadCat] || loadCat;
                option.textContent = `${categoryName} - ${date} (${sim.simulationId.substring(0, 8)})`;
                select.appendChild(option);
            });
            noDataMsg.style.display = 'none';
        } else {
            select.innerHTML = '<option value="">-- Tidak ada simulasi --</option>';
            noDataMsg.style.display = 'block';
            const noDataP = noDataMsg.querySelector('p');
            if (noDataP && category) {
                const categoryMap = {
                    'light': 'Ringan',
                    'medium': 'Sedang',
                    'heavy': 'Tinggi'
                };
                const categoryName = categoryMap[category] || category;
                noDataP.textContent = `Belum ada data simulasi untuk kategori ${categoryName}. Silakan jalankan simulasi terlebih dahulu.`;
            }
        }
    } catch (error) {
        console.error('Error loading simulations:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Gagal memuat daftar simulasi',
                background: '#0F172A',
                color: '#E2E8F0'
            });
        }
    }
}

/**
 * Initialize category filter
 * @param {Function} loadSimulationsCallback - Callback function to load simulations
 */
function initializeCategoryFilter(loadSimulationsCallback) {
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            const category = e.target.value;
            loadSimulationsCallback(category);
        });
    }
}

/**
 * Get category filter HTML
 * @returns {string} HTML for category filter
 */
function getCategoryFilterHTML() {
    return `
        <div class="flex-1">
            <label for="categoryFilter" class="mb-2 block text-sm font-medium text-textdark/90">Filter Kategori Beban</label>
            <select id="categoryFilter" class="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-textdark focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50">
                <option value="">Semua Kategori</option>
                <option value="light">Ringan (Light)</option>
                <option value="medium">Sedang (Medium)</option>
                <option value="heavy">Tinggi (Heavy)</option>
            </select>
        </div>
    `;
}
