const yearEl = document.getElementById('currentYear');
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

const hierarchyContainer = document.getElementById('hierarchyContainer');
const hierarchyChartCanvas = document.getElementById('hierarchyChart');
const hierarchyChartWrapper = document.getElementById('hierarchyChartWrapper');
const hierarchyEmptyState = document.getElementById('hierarchyEmptyState');
const hierarchyEmptyStateMessage = hierarchyEmptyState
    ? hierarchyEmptyState.querySelector('[data-empty-message]')
    : null;
const hierarchyBreadcrumbEl = document.getElementById('hierarchyBreadcrumb');
const hierarchyBackButton = document.getElementById('hierarchyBackButton');
const totalReportsEl = document.getElementById('totalReports');
const simulationForm = document.getElementById('simulationForm');
const simulationCountInput = document.getElementById('simulationCount');
const simulationStatusEl = document.getElementById('simulationStatus');
const simulationSummaryContainer = document.getElementById('simulationSummary');
const clearSimulationButton = document.getElementById('clearSimulationButton');
const simulationModal = document.getElementById('simulationModal');
const simulationModalTitle = document.getElementById('simulationModalTitle');
const simulationModalContent = document.getElementById('simulationModalContent');
const simulationModalOverlay = document.getElementById('simulationModalOverlay');
const simulationModalClose = document.getElementById('simulationModalClose');

let animateObserver;
let wilayahDataset = null;
const WILAYAH_DATA_BASE_URL = '/wilayah-indonesia';
let simulationData = [];
let subdistrictRecordsIndex = new Map();
let hierarchyChartInstance = null;
let hierarchyViewStack = [];
let hierarchyTree = [];
let currentChartItems = [];
let isModalOpen = false;
let lastFocusedElement = null;

const SESSION_STORAGE_KEY = 'simulasiPelaporan';
const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short'
});

const SWAL_PRIMARY_COLOR = '#38BDF8';
const SWAL_CANCEL_COLOR = '#64748B';

if (typeof window !== 'undefined' && window.Chart) {
    window.Chart.defaults.font.family = 'Inter, sans-serif';
    window.Chart.defaults.color = '#E2E8F0';
    window.Chart.defaults.font.size = 13;
}

const HIERARCHY_LEVEL_META = {
    province: {
        label: 'Provinsi',
        childLevel: 'regency',
        emptyChildMessage: 'Provinsi ini belum memiliki data kabupaten/kota.'
    },
    regency: {
        label: 'Kabupaten/Kota',
        childLevel: 'district',
        emptyChildMessage: 'Kabupaten/kota ini belum memiliki data kecamatan.'
    },
    district: {
        label: 'Kecamatan',
        childLevel: 'subdistrict',
        emptyChildMessage: 'Kecamatan ini belum memiliki data kelurahan/desa.'
    },
    subdistrict: {
        label: 'Kelurahan/Desa',
        childLevel: null,
        emptyChildMessage: null
    }
};

function isSwalAvailable() {
    return typeof window !== 'undefined'
        && typeof window.Swal !== 'undefined'
        && typeof window.Swal.fire === 'function';
}

async function showInfoAlert(message, { title = 'Informasi', confirmText = 'Mengerti' } = {}) {
    if (isSwalAvailable()) {
        await window.Swal.fire({
            icon: 'info',
            title,
            text: message,
            confirmButtonText: confirmText,
            confirmButtonColor: SWAL_PRIMARY_COLOR
        });
        return;
    }

    window.alert([title, message].filter(Boolean).join('\n\n'));
}

async function showSuccessAlert(message, { title = 'Berhasil', confirmText = 'Baik' } = {}) {
    if (isSwalAvailable()) {
        await window.Swal.fire({
            icon: 'success',
            title,
            text: message,
            confirmButtonText: confirmText,
            confirmButtonColor: SWAL_PRIMARY_COLOR
        });
        return;
    }

    window.alert([title, message].filter(Boolean).join('\n\n'));
}

async function showErrorAlert(message, { title = 'Gagal', confirmText = 'Mengerti' } = {}) {
    if (isSwalAvailable()) {
        await window.Swal.fire({
            icon: 'error',
            title,
            text: message,
            confirmButtonText: confirmText,
            confirmButtonColor: SWAL_PRIMARY_COLOR
        });
        return;
    }

    window.alert([title, message].filter(Boolean).join('\n\n'));
}

async function confirmSimulationCreation(count) {
    const formattedCount = formatCount(count);
    const text = `Buat ${formattedCount} data simulasi baru pada sesi ini?`;
    const title = 'Buat data simulasi?';

    if (isSwalAvailable()) {
        const result = await window.Swal.fire({
            icon: 'question',
            title,
            text,
            showCancelButton: true,
            confirmButtonText: 'Ya, buat data',
            cancelButtonText: 'Batal',
            confirmButtonColor: SWAL_PRIMARY_COLOR,
            cancelButtonColor: SWAL_CANCEL_COLOR,
            focusCancel: true
        });
        return Boolean(result.isConfirmed);
    }

    return window.confirm(`${title}\n\n${text}`);
}

async function confirmSimulationDeletion() {
    const text = 'Hapus seluruh data simulasi pada session browser? Tindakan ini tidak dapat dibatalkan.';
    const title = 'Hapus data simulasi?';

    if (isSwalAvailable()) {
        const result = await window.Swal.fire({
            icon: 'warning',
            title,
            text,
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: SWAL_PRIMARY_COLOR,
            cancelButtonColor: SWAL_CANCEL_COLOR,
            focusCancel: true
        });
        return Boolean(result.isConfirmed);
    }

    return window.confirm(text);
}

function ensureAnimateObserver() {
    if (animateObserver) {
        return animateObserver;
    }

    animateObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const delay = target.dataset.animateDelay;
                if (delay) {
                    target.style.transitionDelay = `${parseInt(delay, 10) / 1000}s`;
                }
                target.classList.add('is-visible');
                obs.unobserve(target);
            }
        });
    }, { threshold: 0.2 });

    return animateObserver;
}

function observeAnimatedElement(element) {
    if (!element || !element.classList || !element.classList.contains('animate-on-scroll')) {
        return;
    }

    ensureAnimateObserver().observe(element);
}

document.querySelectorAll('.animate-on-scroll').forEach(observeAnimatedElement);

function formatCount(value) {
    return new Intl.NumberFormat('id-ID').format(value ?? 0);
}

function sanitizeCode(value) {
    return (value || '')
        .toString()
        .replace(/[^0-9]/g, '');
}

function createRandomId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `SIM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const descriptionWordBank = [
    'pelaporan', 'masyarakat', 'layanan', 'administrasi', 'digital', 'kolaborasi', 'pengawasan', 'pemerintah',
    'pelayanan', 'inovasi', 'partisipasi', 'komitmen', 'responsif', 'terpadu', 'evaluasi', 'integritas',
    'pencegahan', 'maladministrasi', 'kualitas', 'transparansi', 'akuntabilitas', 'koordinasi', 'laporan',
    'pengaduan', 'solusi', 'pemetaan', 'wilayah', 'penguatan', 'perbaikan', 'data', 'monitoring',
    'percepatan', 'penyelesaian', 'perencanaan', 'pemantauan', 'peninjauan', 'kolaboratif', 'konsisten',
    'komunikasi', 'dukungan', 'partisipatif', 'pengembangan', 'implementasi', 'praktik', 'terukur',
    'kesiapan', 'prioritas', 'koordinatif', 'otonom', 'pemangku', 'kepentingan', 'respon', 'optimal',
    'pengendalian', 'peningkatan', 'fokus', 'penyelarasan', 'pemanfaatan', 'strategi', 'aksesibilitas',
    'keandalan', 'perbaikan', 'pengarahan', 'pendampingan', 'keterlibatan', 'feedback', 'konfirmasi',
    'penguatan', 'pengetahuan', 'kontinuitas', 'kecepatan', 'ketepatan', 'kesesuaian', 'kelengkapan',
    'kolaborator', 'efektivitas', 'integrasi', 'penyelenggaraan', 'responsibilitas', 'koordinasi', 'validasi',
    'penjaminan', 'mutu', 'sosialisasi', 'kesadaran', 'akomodasi', 'pengkajian', 'pemutakhiran', 'akselerasi'
];

function getRandomItem(items) {
    if (!Array.isArray(items) || !items.length) {
        return null;
    }
    const index = Math.floor(Math.random() * items.length);
    return items[index];
}

function generateRandomDescription(minWords = 30, maxWords = 150) {
    if (minWords > maxWords) {
        [minWords, maxWords] = [maxWords, minWords];
    }
    const totalWords = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
    const words = [];
    for (let i = 0; i < totalWords; i += 1) {
        words.push(getRandomItem(descriptionWordBank) || 'pelaporan');
    }
    const sentences = [];
    const chunkSize = 16;
    for (let i = 0; i < words.length; i += chunkSize) {
        const segment = words.slice(i, i + chunkSize).join(' ');
        if (segment) {
            sentences.push(segment.charAt(0).toUpperCase() + segment.slice(1) + '.');
        }
    }
    return sentences.join(' ');
}

function parseWilayahCsvLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        return null;
    }

    const match = trimmed.match(/^"([^"\n]+)",\s*(.*)$/);
    if (!match) {
        return null;
    }

    const [, id, rawName] = match;
    if (!rawName) {
        return null;
    }

    let name = rawName.trim();
    if (name.startsWith('"') && name.endsWith('"')) {
        name = name.slice(1, -1);
    }
    name = name.replace(/""/g, '"').trim();

    if (!name) {
        return null;
    }

    return { id, name };
}

async function loadPackedWilayahDataset() {
    const response = await fetch(`${WILAYAH_DATA_BASE_URL}/dataset.min.json`, {
        cache: 'force-cache'
    });
    if (!response.ok) {
        throw new Error(`Gagal memuat dataset wilayah ringkas (${response.status})`);
    }

    const data = await response.json();

    const provinces = new Map();
    const regencies = new Map();
    const districts = new Map();
    const subdistricts = [];

    const safeSplit = (value, expectedSegments) => {
        const segments = (value || '').split('|');
        if (segments.length < expectedSegments) {
            return null;
        }
        if (segments.length === expectedSegments) {
            return segments;
        }
        const head = segments.slice(0, expectedSegments - 1);
        head.push(segments.slice(expectedSegments - 1).join('|'));
        return head;
    };

    (Array.isArray(data.p) ? data.p : []).forEach(entry => {
        const segments = safeSplit(entry, 2);
        if (!segments) {
            return;
        }
        const [id, name] = segments;
        if (!id || !name) {
            return;
        }
        provinces.set(id, {
            id,
            sanitizedId: sanitizeCode(id),
            name
        });
    });

    (Array.isArray(data.r) ? data.r : []).forEach(entry => {
        const segments = safeSplit(entry, 3);
        if (!segments) {
            return;
        }
        const [provinceId, id, name] = segments;
        if (!provinceId || !id || !name || !provinces.has(provinceId)) {
            return;
        }
        regencies.set(id, {
            id,
            sanitizedId: sanitizeCode(id),
            name,
            provinceId
        });
    });

    (Array.isArray(data.d) ? data.d : []).forEach(entry => {
        const segments = safeSplit(entry, 4);
        if (!segments) {
            return;
        }
        const [provinceId, regencyId, id, name] = segments;
        if (!provinceId || !regencyId || !id || !name) {
            return;
        }
        if (!provinces.has(provinceId) || !regencies.has(regencyId)) {
            return;
        }
        districts.set(id, {
            id,
            sanitizedId: sanitizeCode(id),
            name,
            provinceId,
            regencyId
        });
    });

    (Array.isArray(data.s) ? data.s : []).forEach(entry => {
        const segments = safeSplit(entry, 5);
        if (!segments) {
            return;
        }
        const [provinceId, regencyId, districtId, id, name] = segments;
        if (!provinceId || !regencyId || !districtId || !id || !name) {
            return;
        }
        if (!provinces.has(provinceId) || !regencies.has(regencyId) || !districts.has(districtId)) {
            return;
        }
        subdistricts.push({
            id,
            sanitizedId: sanitizeCode(id),
            name,
            provinceId,
            regencyId,
            districtId
        });
    });

    if (!subdistricts.length) {
        throw new Error('Dataset wilayah tidak berisi kelurahan/desa.');
    }

    return { provinces, regencies, districts, subdistricts };
}

async function loadCsvRecords(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Gagal memuat dataset wilayah (${response.status})`);
    }
    const text = await response.text();
    return text
        .split(/\r?\n/)
        .slice(1)
        .map(parseWilayahCsvLine)
        .filter(Boolean);
}

async function loadWilayahDatasetFromCsv() {
    const [provinceRecords, regencyRecords, districtRecords, subdistrictRecords] = await Promise.all([
        loadCsvRecords(`${WILAYAH_DATA_BASE_URL}/provinsi.csv`),
        loadCsvRecords(`${WILAYAH_DATA_BASE_URL}/kabupaten_kota.csv`),
        loadCsvRecords(`${WILAYAH_DATA_BASE_URL}/kecamatan.csv`),
        loadCsvRecords(`${WILAYAH_DATA_BASE_URL}/kelurahan_desa.csv`)
    ]);

    const provinces = new Map();
    const regencies = new Map();
    const districts = new Map();
    const subdistricts = [];

    provinceRecords.forEach(record => {
        provinces.set(record.id, {
            id: record.id,
            sanitizedId: sanitizeCode(record.id),
            name: record.name
        });
    });

    regencyRecords.forEach(record => {
        const segments = record.id.split('.');
        if (!segments.length) {
            return;
        }
        const provinceId = segments[0];
        if (!provinces.has(provinceId)) {
            return;
        }
        regencies.set(record.id, {
            id: record.id,
            sanitizedId: sanitizeCode(record.id),
            name: record.name,
            provinceId
        });
    });

    districtRecords.forEach(record => {
        const segments = record.id.split('.');
        if (segments.length < 3) {
            return;
        }
        const provinceId = segments[0];
        const regencyId = `${segments[0]}.${segments[1]}`;
        if (!provinces.has(provinceId) || !regencies.has(regencyId)) {
            return;
        }
        districts.set(record.id, {
            id: record.id,
            sanitizedId: sanitizeCode(record.id),
            name: record.name,
            provinceId,
            regencyId
        });
    });

    subdistrictRecords.forEach(record => {
        const segments = record.id.split('.');
        if (segments.length < 4) {
            return;
        }
        const provinceId = segments[0];
        const regencyId = `${segments[0]}.${segments[1]}`;
        const districtId = `${segments[0]}.${segments[1]}.${segments[2]}`;
        if (!provinces.has(provinceId) || !regencies.has(regencyId) || !districts.has(districtId)) {
            return;
        }
        subdistricts.push({
            id: record.id,
            sanitizedId: sanitizeCode(record.id),
            name: record.name,
            provinceId,
            regencyId,
            districtId
        });
    });

    if (!subdistricts.length) {
        throw new Error('Dataset wilayah tidak berisi kelurahan/desa.');
    }

    return { provinces, regencies, districts, subdistricts };
}

async function loadWilayahDataset() {
    try {
        return await loadPackedWilayahDataset();
    } catch (error) {
        console.warn('Gagal memuat dataset wilayah ringkas, mencoba fallback CSV:', error);
        return loadWilayahDatasetFromCsv();
    }
}

function loadSimulationDataFromSession() {
    try {
        const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Gagal memuat data simulasi dari session storage:', error);
        return [];
    }
}

function saveSimulationDataToSession(data) {
    try {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.warn('Gagal menyimpan data simulasi ke session storage:', error);
    }
}

function createEmptyMessage(text) {
    const message = document.createElement('p');
    message.className = 'text-sm text-secondary';
    message.textContent = text;
    return message;
}

function renderSimulationSummary(records) {
    if (!simulationSummaryContainer) {
        return;
    }

    simulationSummaryContainer.innerHTML = '';

    const totalCard = document.createElement('article');
    totalCard.className = 'flex flex-col gap-3 rounded-2xl border border-white/10 bg-surfaceMuted/70 p-6 shadow-lg shadow-black/10 animate-on-scroll';
    totalCard.dataset.animateDelay = '60';

    const totalLabel = document.createElement('span');
    totalLabel.className = 'text-xs font-semibold uppercase tracking-[0.3em] text-secondary';
    totalLabel.textContent = 'Total data simulasi';

    const totalValue = document.createElement('span');
    totalValue.className = 'text-4xl font-semibold text-primary';
    totalValue.textContent = formatCount(records.length);

    const metaInfo = document.createElement('p');
    metaInfo.className = 'text-sm text-textdark/70';

    if (records.length) {
        const latestRecord = records[records.length - 1];
        let formattedDate = null;
        if (latestRecord && latestRecord.createdAt) {
            const createdAtDate = new Date(latestRecord.createdAt);
            if (!Number.isNaN(createdAtDate.getTime())) {
                formattedDate = dateTimeFormatter.format(createdAtDate);
            }
        }

        const uniqueProvinces = new Set(records.map(record => record.provinsi).filter(Boolean));
        const provinceText = uniqueProvinces.size ? `${formatCount(uniqueProvinces.size)} provinsi terlibat` : 'menjangkau beberapa provinsi';
        metaInfo.textContent = formattedDate
            ? `Memuat ${provinceText}. Pembaruan terakhir ${formattedDate}.`
            : `Memuat ${provinceText}.`; 
    } else {
        metaInfo.textContent = 'Belum ada data simulasi tersimpan pada sesi ini.';
    }

    totalCard.appendChild(totalLabel);
    totalCard.appendChild(totalValue);
    totalCard.appendChild(metaInfo);
    observeAnimatedElement(totalCard);

    const guidanceCard = document.createElement('article');
    guidanceCard.className = 'flex flex-col gap-3 rounded-2xl border border-secondary/30 bg-surfaceMuted/50 p-6 shadow-lg shadow-black/10 animate-on-scroll';
    guidanceCard.dataset.animateDelay = '120';

    const guidanceTitle = document.createElement('span');
    guidanceTitle.className = 'text-xs font-semibold uppercase tracking-[0.3em] text-secondary';
    guidanceTitle.textContent = 'Cara melihat data';

    const guidanceDescription = document.createElement('p');
    guidanceDescription.className = 'text-sm leading-relaxed text-textdark/80';
    guidanceDescription.textContent = records.length
        ? 'Gunakan grafik batang hierarkis di bawah untuk memilih provinsi, kabupaten/kota, dan kecamatan. Klik batang kelurahan/desa untuk membuka pop up yang memuat tabel detail laporannya.'
        : 'Setelah membuat data simulasi, grafik batang hierarkis akan menampilkan provinsi dan jumlah laporan. Klik setiap batang untuk menelusuri hingga kelurahan/desa.';

    const guidanceHint = document.createElement('p');
    guidanceHint.className = 'text-xs text-textdark/60';
    guidanceHint.textContent = 'Seluruh data hanya tersimpan di session browser dan dapat dihapus kapan saja melalui tombol "Hapus Data".';

    guidanceCard.appendChild(guidanceTitle);
    guidanceCard.appendChild(guidanceDescription);
    guidanceCard.appendChild(guidanceHint);
    observeAnimatedElement(guidanceCard);

    simulationSummaryContainer.appendChild(totalCard);
    simulationSummaryContainer.appendChild(guidanceCard);
}

function isChartJsAvailable() {
    return typeof window !== 'undefined'
        && typeof window.Chart !== 'undefined';
}

function destroyHierarchyChart() {
    if (hierarchyChartInstance) {
        hierarchyChartInstance.destroy();
        hierarchyChartInstance = null;
    }
    currentChartItems = [];
}

function showHierarchyEmptyState(message) {
    if (hierarchyEmptyState) {
        hierarchyEmptyState.classList.remove('hidden');
        if (hierarchyEmptyStateMessage) {
            hierarchyEmptyStateMessage.textContent = message;
        }
        return;
    }

    if (!hierarchyContainer) {
        return;
    }

    hierarchyContainer.innerHTML = '';
    hierarchyContainer.appendChild(createEmptyMessage(message));
}

function hideHierarchyEmptyState() {
    if (hierarchyEmptyState) {
        hierarchyEmptyState.classList.add('hidden');
    }
}

function showHierarchyChartWrapper() {
    if (hierarchyChartWrapper) {
        hierarchyChartWrapper.classList.remove('hidden');
    }
}

function hideHierarchyChartWrapper() {
    if (hierarchyChartWrapper) {
        hierarchyChartWrapper.classList.add('hidden');
    }
}

function getHierarchyLevelInfo(entry) {
    if (!entry) {
        return {
            level: 'province',
            label: HIERARCHY_LEVEL_META.province.label,
            childLevel: HIERARCHY_LEVEL_META.province.childLevel,
            emptyChildMessage: HIERARCHY_LEVEL_META.province.emptyChildMessage,
            datasetTitle: 'Jumlah laporan per provinsi',
            items: []
        };
    }

    const meta = HIERARCHY_LEVEL_META[entry.level] || HIERARCHY_LEVEL_META.province;

    if (entry.level === 'province') {
        return {
            level: entry.level,
            label: meta.label,
            childLevel: meta.childLevel,
            emptyChildMessage: meta.emptyChildMessage,
            datasetTitle: 'Jumlah laporan per provinsi',
            items: hierarchyTree.slice()
        };
    }

    if (entry.level === 'regency') {
        const province = entry.item;
        return {
            level: entry.level,
            label: province?.name || meta.label,
            childLevel: meta.childLevel,
            emptyChildMessage: meta.emptyChildMessage,
            datasetTitle: province
                ? `Jumlah laporan kab/kota di ${province.name}`
                : 'Jumlah laporan kabupaten/kota',
            items: Array.isArray(province?.regencies) ? province.regencies.slice() : []
        };
    }

    if (entry.level === 'district') {
        const regency = entry.item;
        return {
            level: entry.level,
            label: regency?.name || meta.label,
            childLevel: meta.childLevel,
            emptyChildMessage: meta.emptyChildMessage,
            datasetTitle: regency
                ? `Jumlah laporan kecamatan di ${regency.name}`
                : 'Jumlah laporan kecamatan',
            items: Array.isArray(regency?.districts) ? regency.districts.slice() : []
        };
    }

    if (entry.level === 'subdistrict') {
        const district = entry.item;
        return {
            level: entry.level,
            label: district?.name || meta.label,
            childLevel: meta.childLevel,
            emptyChildMessage: meta.emptyChildMessage,
            datasetTitle: district
                ? `Jumlah laporan kelurahan/desa di ${district.name}`
                : 'Jumlah laporan kelurahan/desa',
            items: Array.isArray(district?.subdistricts) ? district.subdistricts.slice() : []
        };
    }

    return {
        level: entry.level,
        label: meta.label,
        childLevel: meta.childLevel,
        emptyChildMessage: meta.emptyChildMessage,
        datasetTitle: 'Jumlah laporan',
        items: []
    };
}

function getNextHierarchyEntry(level, item) {
    const meta = HIERARCHY_LEVEL_META[level];
    if (!meta || !meta.childLevel) {
        return null;
    }

    if (level === 'province') {
        return Array.isArray(item.regencies) && item.regencies.length
            ? { level: 'regency', item }
            : null;
    }

    if (level === 'regency') {
        return Array.isArray(item.districts) && item.districts.length
            ? { level: 'district', item }
            : null;
    }

    if (level === 'district') {
        return Array.isArray(item.subdistricts) && item.subdistricts.length
            ? { level: 'subdistrict', item }
            : null;
    }

    return null;
}

function getBreadcrumbLabel(entry) {
    if (!entry) {
        return '';
    }
    if (entry.level === 'province') {
        return HIERARCHY_LEVEL_META.province.label;
    }
    return entry.item?.name || HIERARCHY_LEVEL_META[entry.level]?.label || 'Wilayah';
}

function navigateToHierarchyIndex(index) {
    if (!Array.isArray(hierarchyViewStack) || !hierarchyViewStack.length) {
        return;
    }

    const targetIndex = Math.max(0, Math.min(index, hierarchyViewStack.length - 1));
    hierarchyViewStack = hierarchyViewStack.slice(0, targetIndex + 1);
    renderCurrentHierarchyLevel();
}

function updateHierarchyBreadcrumb() {
    if (!hierarchyBreadcrumbEl) {
        return;
    }

    hierarchyBreadcrumbEl.innerHTML = '';

    if (!hierarchyViewStack.length) {
        return;
    }

    const list = document.createElement('ol');
    list.className = 'flex flex-wrap items-center gap-2';

    hierarchyViewStack.forEach((entry, index) => {
        if (index > 0) {
            const separator = document.createElement('span');
            separator.className = 'text-xs text-textdark/50';
            separator.textContent = '›';
            list.appendChild(separator);
        }

        const label = getBreadcrumbLabel(entry);
        const isLast = index === hierarchyViewStack.length - 1;

        if (isLast) {
            const current = document.createElement('span');
            current.className = 'text-sm font-semibold text-textdark';
            current.textContent = label;
            list.appendChild(current);
        } else {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';
            button.textContent = label;
            button.addEventListener('click', () => navigateToHierarchyIndex(index));
            list.appendChild(button);
        }
    });

    hierarchyBreadcrumbEl.appendChild(list);
}

function updateHierarchyNavigationControls() {
    if (!hierarchyBackButton) {
        return;
    }

    if (hierarchyViewStack.length <= 1) {
        hierarchyBackButton.classList.add('hidden');
        hierarchyBackButton.disabled = true;
    } else {
        hierarchyBackButton.classList.remove('hidden');
        hierarchyBackButton.disabled = false;
    }
}

function renderCurrentHierarchyLevel() {
    if (!hierarchyViewStack.length) {
        destroyHierarchyChart();
        hideHierarchyChartWrapper();
        showHierarchyEmptyState('Belum ada data simulasi yang dapat ditampilkan.');
        return;
    }

    const entry = hierarchyViewStack[hierarchyViewStack.length - 1];
    const levelInfo = getHierarchyLevelInfo(entry);

    updateHierarchyBreadcrumb();
    updateHierarchyNavigationControls();

    if (!isChartJsAvailable() || !hierarchyChartCanvas) {
        destroyHierarchyChart();
        hideHierarchyChartWrapper();
        showHierarchyEmptyState('Chart.js tidak tersedia untuk menampilkan grafik.');
        return;
    }

    currentChartItems = Array.isArray(levelInfo.items) ? levelInfo.items.slice() : [];

    if (!currentChartItems.length) {
        destroyHierarchyChart();
        hideHierarchyChartWrapper();
        showHierarchyEmptyState('Belum ada data pada tingkat ini.');
        return;
    }

    hideHierarchyEmptyState();
    showHierarchyChartWrapper();

    const labels = currentChartItems.map(item => item.name);
    const data = currentChartItems.map(item => item.totalReports);

    destroyHierarchyChart();

    const chartContext = hierarchyChartCanvas.getContext('2d');
    hierarchyChartInstance = new window.Chart(chartContext, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: levelInfo.datasetTitle,
                    data,
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    hoverBackgroundColor: 'rgba(99, 102, 241, 0.95)',
                    borderRadius: 16,
                    borderSkipped: false,
                    maxBarThickness: 48,
                    minBarLength: 4
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 16,
                    right: 24,
                    bottom: 16,
                    left: 12
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(148, 163, 184, 0.15)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94A3B8',
                        callback: value => formatCount(value),
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#E2E8F0',
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#0F172A',
                    borderColor: 'rgba(148, 163, 184, 0.15)',
                    borderWidth: 1,
                    titleColor: '#E2E8F0',
                    bodyColor: '#E2E8F0',
                    callbacks: {
                        label(context) {
                            const value = context?.parsed?.x ?? context?.parsed ?? 0;
                            return `${formatCount(value)} laporan`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: levelInfo.datasetTitle,
                    color: '#94A3B8',
                    font: {
                        size: 14,
                        weight: '600'
                    },
                    padding: {
                        bottom: 16
                    }
                }
            },
            onHover(event, elements) {
                if (event?.native) {
                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                }
            },
            onClick(event, elements) {
                handleHierarchyChartInteraction(levelInfo.level, elements);
            }
        }
    });
}

function handleHierarchyChartInteraction(level, elements) {
    if (!Array.isArray(elements) || !elements.length) {
        return;
    }

    const { index } = elements[0];
    if (typeof index !== 'number') {
        return;
    }

    const targetItem = currentChartItems[index];
    if (!targetItem) {
        return;
    }

    if (level === 'subdistrict') {
        const records = getRecordsForSubdistrict(targetItem);
        openSubdistrictModal(targetItem, records);
        return;
    }

    const nextEntry = getNextHierarchyEntry(level, targetItem);
    if (!nextEntry) {
        const meta = HIERARCHY_LEVEL_META[level];
        if (meta && meta.emptyChildMessage) {
            showInfoAlert(meta.emptyChildMessage, { title: 'Data belum tersedia' });
        }
        return;
    }

    hierarchyViewStack.push(nextEntry);
    renderCurrentHierarchyLevel();
}

function getRecordsForSubdistrict(subdistrict) {
    if (!subdistrict) {
        return [];
    }
    const key = sanitizeCode(subdistrict.id || subdistrict.sanitizedId || subdistrict.name);
    if (!key) {
        return [];
    }
    const records = subdistrictRecordsIndex.get(key) || [];
    return records.slice();
}

function buildHierarchyFromRecords(records) {
    const provincesMap = new Map();

    records.forEach(record => {
        const provinceId = record.provinceId || sanitizeCode(record.provinsi);
        if (!provinceId) {
            return;
        }
        const provinceName = record.provinsi || 'Provinsi Tidak Diketahui';

        let province = provincesMap.get(provinceId);
        if (!province) {
            province = {
                id: record.provinceId || provinceId,
                sanitizedId: sanitizeCode(record.provinceId || provinceId),
                name: provinceName,
                totalReports: 0,
                regenciesMap: new Map()
            };
            provincesMap.set(provinceId, province);
        }
        province.totalReports += 1;

        const regencyId = record.regencyId || sanitizeCode(record.kab_kota);
        if (!regencyId) {
            return;
        }
        const regencyName = record.kab_kota || 'Kabupaten/Kota Tidak Diketahui';

        let regency = province.regenciesMap.get(regencyId);
        if (!regency) {
            regency = {
                id: record.regencyId || regencyId,
                sanitizedId: sanitizeCode(record.regencyId || regencyId),
                name: regencyName,
                totalReports: 0,
                districtsMap: new Map()
            };
            province.regenciesMap.set(regencyId, regency);
        }
        regency.totalReports += 1;

        const districtId = record.districtId || sanitizeCode(record.kecamatan);
        if (!districtId) {
            return;
        }
        const districtName = record.kecamatan || 'Kecamatan Tidak Diketahui';

        let district = regency.districtsMap.get(districtId);
        if (!district) {
            district = {
                id: record.districtId || districtId,
                sanitizedId: sanitizeCode(record.districtId || districtId),
                name: districtName,
                totalReports: 0,
                subdistrictsMap: new Map()
            };
            regency.districtsMap.set(districtId, district);
        }
        district.totalReports += 1;

        const subdistrictId = record.subdistrictId || sanitizeCode(record.kelurahan_desa);
        if (!subdistrictId) {
            return;
        }
        const subdistrictName = record.kelurahan_desa || 'Kelurahan/Desa Tidak Diketahui';

        let subdistrict = district.subdistrictsMap.get(subdistrictId);
        if (!subdistrict) {
            subdistrict = {
                id: record.subdistrictId || subdistrictId,
                sanitizedId: sanitizeCode(record.subdistrictId || subdistrictId),
                name: subdistrictName,
                totalReports: 0
            };
            district.subdistrictsMap.set(subdistrictId, subdistrict);
        }
        subdistrict.totalReports += 1;
    });

    const provinces = Array.from(provincesMap.values()).map(province => {
        const regencies = Array.from(province.regenciesMap.values()).map(regency => {
            const districts = Array.from(regency.districtsMap.values()).map(district => {
                const subdistricts = Array.from(district.subdistrictsMap.values())
                    .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
                    .map(subdistrict => ({
                        id: subdistrict.id,
                        sanitizedId: subdistrict.sanitizedId,
                        name: subdistrict.name,
                        totalReports: subdistrict.totalReports
                    }));
                return {
                    id: district.id,
                    sanitizedId: district.sanitizedId,
                    name: district.name,
                    totalReports: district.totalReports,
                    subdistricts
                };
            }).sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
            return {
                id: regency.id,
                sanitizedId: regency.sanitizedId,
                name: regency.name,
                totalReports: regency.totalReports,
                districts
            };
        }).sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
        return {
            id: province.id,
            sanitizedId: province.sanitizedId,
            name: province.name,
            totalReports: province.totalReports,
            regencies
        };
    }).sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));

    return {
        totalReports: records.length,
        provinces
    };
}

function renderHierarchy(records) {
    if (!hierarchyContainer) {
        return;
    }

    const safeRecords = Array.isArray(records) ? records : [];

    if (totalReportsEl) {
        totalReportsEl.textContent = formatCount(safeRecords.length);
    }

    subdistrictRecordsIndex = new Map();
    safeRecords.forEach(record => {
        const key = sanitizeCode(record.subdistrictId || record.kelurahan_desa);
        if (!key) {
            return;
        }
        const existing = subdistrictRecordsIndex.get(key) || [];
        existing.push(record);
        subdistrictRecordsIndex.set(key, existing);
    });

    if (!safeRecords.length) {
        hierarchyTree = [];
        hierarchyViewStack = [];
        destroyHierarchyChart();
        hideHierarchyChartWrapper();
        showHierarchyEmptyState('Belum ada data simulasi yang dapat ditampilkan.');
        return;
    }

    const { provinces } = buildHierarchyFromRecords(safeRecords);

    if (!Array.isArray(provinces) || !provinces.length) {
        hierarchyTree = [];
        hierarchyViewStack = [];
        destroyHierarchyChart();
        hideHierarchyChartWrapper();
        showHierarchyEmptyState('Data simulasi belum memiliki struktur wilayah yang dapat divisualisasikan.');
        return;
    }

    hierarchyTree = provinces;
    hierarchyViewStack = [{ level: 'province', item: null }];

    renderCurrentHierarchyLevel();
}

function renderSimulationData() {
    renderSimulationSummary(simulationData);
    renderHierarchy(simulationData);
}

function createModalTable(records) {
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-secondary/20 text-sm';

    const thead = document.createElement('thead');
    thead.className = 'bg-soft/60';
    const headerRow = document.createElement('tr');

    const headers = [
        { label: 'ID', className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Kecamatan', className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Kabupaten/Kota', className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Provinsi', className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Waktu', className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Deskripsi', className: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-secondary' }
    ];

    headers.forEach(({ label, className }) => {
        const th = document.createElement('th');
        th.className = className;
        th.textContent = label;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-secondary/10 bg-white';

    const orderedRecords = records.slice().sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
    });

    orderedRecords.forEach(record => {
        const row = document.createElement('tr');
        row.className = 'transition-colors hover:bg-secondary/5';

        const cells = [
            { text: record.id, className: 'whitespace-nowrap px-4 py-3 font-mono text-xs text-textdark/80' },
            { text: record.kecamatan, className: 'whitespace-nowrap px-4 py-3 text-sm text-textdark/90' },
            { text: record.kab_kota, className: 'whitespace-nowrap px-4 py-3 text-sm text-textdark/90' },
            { text: record.provinsi, className: 'whitespace-nowrap px-4 py-3 text-sm text-textdark/90' },
            {
                text: (() => {
                    if (!record.createdAt) {
                        return '-';
                    }
                    const createdAtDate = new Date(record.createdAt);
                    return Number.isNaN(createdAtDate.getTime()) ? '-' : dateTimeFormatter.format(createdAtDate);
                })(),
                className: 'whitespace-nowrap px-4 py-3 text-xs text-textdark/70'
            },
            { text: record.deskripsi, className: 'px-4 py-3 text-sm leading-relaxed text-textdark/80' }
        ];

        cells.forEach(({ text, className }) => {
            const td = document.createElement('td');
            td.className = className;
            td.textContent = text;
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    return table;
}

function closeSimulationModal() {
    if (!simulationModal) {
        return;
    }

    simulationModal.classList.add('hidden');
    simulationModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
    isModalOpen = false;

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }
    lastFocusedElement = null;
}

function openSubdistrictModal(subdistrict, records) {
    if (!simulationModal || !simulationModalContent || !simulationModalTitle) {
        return;
    }

    const subdistrictName = subdistrict && subdistrict.name ? subdistrict.name : 'Kelurahan';
    const totalText = `${formatCount(records.length)} laporan`;

    simulationModalTitle.textContent = `${subdistrictName} • ${totalText}`;
    simulationModalContent.innerHTML = '';

    if (!records.length) {
        simulationModalContent.appendChild(createEmptyMessage('Belum ada data detail untuk kelurahan ini.'));
    } else {
        const reference = records[0];
        const meta = document.createElement('p');
        meta.className = 'mb-4 text-sm text-textdark/70';
        meta.textContent = `Kelurahan ${subdistrictName} berada di Kecamatan ${reference.kecamatan}, ${reference.kab_kota}, ${reference.provinsi}.`;

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'overflow-x-auto rounded-2xl border border-white/10 bg-surface shadow-inner shadow-black/10';
        tableWrapper.appendChild(createModalTable(records));

        simulationModalContent.appendChild(meta);
        simulationModalContent.appendChild(tableWrapper);
    }

    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    simulationModal.classList.remove('hidden');
    simulationModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    isModalOpen = true;

    window.requestAnimationFrame(() => {
        if (simulationModalClose) {
            simulationModalClose.focus();
        }
    });
}

function handleModalKeyDown(event) {
    if (event.key === 'Escape' && isModalOpen) {
        closeSimulationModal();
    }
}

function updateSimulationStatus(message, variant = 'info') {
    if (!simulationStatusEl) {
        return;
    }

    const baseClass = 'text-sm';
    let variantClass = 'text-secondary';
    if (variant === 'success') {
        variantClass = 'text-emerald-600';
    } else if (variant === 'error') {
        variantClass = 'text-highlight';
    }

    simulationStatusEl.className = `${baseClass} ${variantClass}`;
    simulationStatusEl.textContent = message;
}

function generateSimulationRecords(count) {
    if (!wilayahDataset || !wilayahDataset.subdistricts.length) {
        return [];
    }

    const records = [];
    for (let i = 0; i < count; i += 1) {
        const subdistrict = getRandomItem(wilayahDataset.subdistricts);
        if (!subdistrict) {
            break;
        }
        const district = wilayahDataset.districts.get(subdistrict.districtId);
        const regency = wilayahDataset.regencies.get(subdistrict.regencyId);
        const province = wilayahDataset.provinces.get(subdistrict.provinceId);

        if (!district || !regency || !province) {
            continue;
        }

        records.push({
            id: createRandomId(),
            kelurahan_desa: subdistrict.name,
            kecamatan: district.name,
            kab_kota: regency.name,
            provinsi: province.name,
            deskripsi: generateRandomDescription(30, 150),
            provinceId: province.id,
            regencyId: regency.id,
            districtId: district.id,
            subdistrictId: subdistrict.id,
            createdAt: new Date().toISOString()
        });
    }

    return records;
}

async function handleSimulationSubmit(event) {
    event.preventDefault();

    if (!simulationCountInput) {
        return;
    }

    if (!wilayahDataset || !wilayahDataset.subdistricts.length) {
        updateSimulationStatus('Dataset wilayah belum siap. Tidak dapat membuat data simulasi.', 'error');
        await showErrorAlert('Dataset wilayah belum siap. Tidak dapat membuat data simulasi.');
        return;
    }

    const requested = Number(simulationCountInput.value);
    const count = Number.isFinite(requested) ? Math.min(Math.max(Math.floor(requested), 1), 1000) : 1;
    simulationCountInput.value = String(count);

    const confirmed = await confirmSimulationCreation(count);
    if (!confirmed) {
        updateSimulationStatus('Pembuatan data simulasi dibatalkan.', 'info');
        return;
    }

    const generated = generateSimulationRecords(count);
    if (!generated.length) {
        updateSimulationStatus('Tidak ada data simulasi yang berhasil dibuat. Coba lagi.', 'error');
        await showErrorAlert('Tidak ada data simulasi yang berhasil dibuat. Coba lagi.');
        return;
    }

    simulationData = [...simulationData, ...generated];
    saveSimulationDataToSession(simulationData);
    renderSimulationData();
    const successMessage = `Berhasil membuat ${formatCount(generated.length)} data simulasi.`;
    updateSimulationStatus(successMessage, 'success');
    await showSuccessAlert(successMessage);
}

if (hierarchyBackButton) {
    hierarchyBackButton.addEventListener('click', () => {
        if (hierarchyViewStack.length > 1) {
            navigateToHierarchyIndex(hierarchyViewStack.length - 2);
        }
    });
}

if (simulationForm) {
    simulationForm.addEventListener('submit', handleSimulationSubmit);
}

if (clearSimulationButton) {
    clearSimulationButton.addEventListener('click', async () => {
        if (!simulationData.length) {
            const message = 'Tidak ada data simulasi yang perlu dihapus.';
            updateSimulationStatus(message, 'info');
            await showInfoAlert(message);
            return;
        }

        const confirmed = await confirmSimulationDeletion();
        if (!confirmed) {
            return;
        }

        simulationData = [];
        saveSimulationDataToSession(simulationData);
        renderSimulationData();
        const successMessage = 'Seluruh data simulasi berhasil dihapus.';
        updateSimulationStatus(successMessage, 'success');
        await showSuccessAlert(successMessage);
    });
}

if (simulationModalClose) {
    simulationModalClose.addEventListener('click', closeSimulationModal);
}

if (simulationModalOverlay) {
    simulationModalOverlay.addEventListener('click', closeSimulationModal);
}

document.addEventListener('keydown', handleModalKeyDown);

async function initialize() {
    simulationData = loadSimulationDataFromSession();
    renderSimulationData();

    if (simulationCountInput) {
        simulationCountInput.disabled = true;
    }

    updateSimulationStatus('Dataset wilayah sedang dimuat, harap tunggu.', 'info');

    try {
        wilayahDataset = await loadWilayahDataset();
        updateSimulationStatus('Dataset wilayah siap digunakan untuk simulasi.', 'success');
        if (simulationCountInput) {
            simulationCountInput.disabled = false;
            simulationCountInput.focus();
        }
    } catch (error) {
        console.error('Gagal memuat dataset wilayah:', error);
        updateSimulationStatus('Gagal memuat dataset wilayah. Formulir dinonaktifkan.', 'error');
    }
}

initialize();
