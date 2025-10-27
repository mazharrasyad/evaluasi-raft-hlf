const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
const yearEl = document.getElementById('currentYear');
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

const hierarchyContainer = document.getElementById('hierarchyContainer');
const hierarchyChartCanvas = document.getElementById('hierarchyChart');
const hierarchyChartWrapper = document.getElementById('hierarchyChartWrapper');
const hierarchyChartContainer = document.getElementById('hierarchyChartContainer');
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
const simulationStatusIndicator = simulationStatusEl
    ? simulationStatusEl.querySelector('[data-status-indicator]')
    : null;
const simulationStatusMessage = simulationStatusEl
    ? simulationStatusEl.querySelector('[data-status-message]')
    : null;
const simulationSummaryContainer = document.getElementById('simulationSummary');
const clearSimulationButton = document.getElementById('clearSimulationButton');
const simulationModal = document.getElementById('simulationModal');
const simulationModalTitle = document.getElementById('simulationModalTitle');
const simulationModalContent = document.getElementById('simulationModalContent');
const simulationModalOverlay = document.getElementById('simulationModalOverlay');
const simulationModalClose = document.getElementById('simulationModalClose');
const simulationEvaluationContainer = document.getElementById('simulationEvaluation');
const simulationEvaluationList = document.getElementById('simulationEvaluationList');
const simulationSubmitButton = simulationForm
    ? simulationForm.querySelector('button[type="submit"]')
    : null;
const networkStartupButton = document.getElementById('networkStartupButton');
const networkStartupStatusEl = document.getElementById('networkStartupStatus');
const networkCheckButton = document.getElementById('networkCheckButton');
const networkCheckStatusEl = document.getElementById('networkCheckStatus');
const networkShutdownButton = document.getElementById('networkShutdownButton');
const networkShutdownStatusEl = document.getElementById('networkShutdownStatus');
const networkHealthResultsContainer = document.getElementById('networkHealthResults');
const networkBlockSummaryEl = document.getElementById('networkBlockSummary');
const networkHealthSummaryEl = document.getElementById('networkHealthSummary');
const networkHealthListEl = document.getElementById('networkHealthList');

const networkOperationOverlay = document.getElementById('networkOperationOverlay');
const networkOperationMessage = networkOperationOverlay
    ? networkOperationOverlay.querySelector('[data-overlay-message]')
    : null;
const networkOperationTimer = networkOperationOverlay
    ? networkOperationOverlay.querySelector('[data-overlay-timer]')
    : null;
const networkOperationHint = networkOperationOverlay
    ? networkOperationOverlay.querySelector('[data-overlay-hint]')
    : null;

let networkOperationTimerHandle = null;
let networkOperationOverlayStart = null;
let networkOperationOverlayHideTimeout = null;

const MIN_NETWORK_OPERATION_OVERLAY_DURATION = 600;

let animateObserver;
let wilayahDataset = null;
const WILAYAH_DATA_BASE_URL = '/wilayah-indonesia';
let simulationData = [];
let subdistrictRecordsIndex = new Map();
let hierarchyChartInstance = null;
let hierarchyViewStack = [];
let hierarchyTree = [];
let currentChartItems = [];
let activeHierarchyBarIndex = null;
let isModalOpen = false;
let lastFocusedElement = null;
let isIngestingSimulation = false;

const BLOCKCHAIN_TARGETS = [
    {
        id: 'channel-standard',
        label: 'RAFT Standard',
        channel: 'channel-standard',
    },
    {
        id: 'channel-variant',
        label: 'RAFT Variant',
        channel: 'channel-variant',
    },
];

const evaluationStats = new Map();
const evaluationElements = new Map();

const SESSION_STORAGE_KEY = 'simulasiPelaporan';
const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short'
});
const decimalFormatter = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const SWAL_PRIMARY_COLOR = '#38BDF8';
const SWAL_CANCEL_COLOR = '#64748B';
const DEFAULT_NETWORK_START_STATUS_MESSAGE = 'Belum ada perintah penyalaan jaringan yang dijalankan.';
const DEFAULT_NETWORK_STATUS_MESSAGE = 'Belum ada pemeriksaan yang dijalankan.';
const DEFAULT_NETWORK_SHUTDOWN_STATUS_MESSAGE = 'Belum ada perintah pemadaman jaringan yang dijalankan.';

const NETWORK_STATUS_META = {
    healthy: {
        label: 'Jaringan sehat',
        icon: '✅',
        description: 'Jaringan siap digunakan.',
        badgeClass: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
    },
    unhealthy: {
        label: 'Tidak merespons',
        icon: '❌',
        description: 'Jaringan tidak dapat diakses atau chaincode gagal merespons.',
        badgeClass: 'border-rose-400/40 bg-rose-500/10 text-rose-300',
    },
    not_found: {
        label: 'Direktori belum tersedia',
        icon: '⚠️',
        description: 'Direktori jaringan tidak ditemukan pada server.',
        badgeClass: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
    },
    incomplete: {
        label: 'Material belum lengkap',
        icon: '⚠️',
        description: 'Material kriptografi belum lengkap.',
        badgeClass: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
    },
    error: {
        label: 'Pemeriksaan gagal',
        icon: '❌',
        description: 'Pemeriksaan jaringan tidak dapat dijalankan.',
        badgeClass: 'border-rose-400/40 bg-rose-500/10 text-rose-300',
    },
    unknown: {
        label: 'Status tidak diketahui',
        icon: 'ℹ️',
        description: 'Status jaringan tidak dapat ditentukan.',
        badgeClass: 'border-slate-400/40 bg-slate-500/10 text-slate-300',
    },
};

const NETWORK_STATUS_INDICATOR = {
    idle: 'bg-secondary',
    loading: 'bg-accent',
    success: 'bg-emerald-400',
    error: 'bg-rose-400',
};

const SIMULATION_STATUS_VARIANTS = {
    info: {
        container: ['border-secondary/40', 'bg-secondary/10', 'text-secondary/90'],
        indicator: ['bg-secondary', 'shadow-[0_0_0_4px_rgba(99,102,241,0.25)]'],
    },
    success: {
        container: ['border-emerald-400/40', 'bg-emerald-500/10', 'text-emerald-200'],
        indicator: ['bg-emerald-400', 'shadow-[0_0_0_4px_rgba(16,185,129,0.25)]'],
    },
    error: {
        container: ['border-rose-400/40', 'bg-rose-500/10', 'text-rose-200'],
        indicator: ['bg-rose-400', 'shadow-[0_0_0_4px_rgba(244,63,94,0.25)]'],
    },
};

const SIMULATION_STATUS_VARIANT_CLASS_CACHE = Object.values(SIMULATION_STATUS_VARIANTS)
    .reduce((accumulator, variant) => {
        if (variant.container) {
            variant.container.forEach(className => accumulator.container.add(className));
        }
        if (variant.indicator) {
            variant.indicator.forEach(className => accumulator.indicator.add(className));
        }
        return accumulator;
    }, { container: new Set(), indicator: new Set() });

SIMULATION_STATUS_VARIANT_CLASS_CACHE.container = Array.from(SIMULATION_STATUS_VARIANT_CLASS_CACHE.container);
SIMULATION_STATUS_VARIANT_CLASS_CACHE.indicator = Array.from(SIMULATION_STATUS_VARIANT_CLASS_CACHE.indicator);

const EVALUATION_STATUS_VARIANTS = {
    idle: {
        label: 'Menunggu',
        classes: ['border-secondary/40', 'bg-secondary/10', 'text-secondary'],
    },
    processing: {
        label: 'Memproses',
        classes: ['border-accent/40', 'bg-accent/10', 'text-accent'],
    },
    success: {
        label: 'Berhasil',
        classes: ['border-emerald-400/40', 'bg-emerald-500/10', 'text-emerald-200'],
    },
    error: {
        label: 'Perlu perhatian',
        classes: ['border-rose-400/40', 'bg-rose-500/10', 'text-rose-200'],
    },
};

const EVALUATION_STATUS_CLASS_CACHE = Array.from(new Set(
    Object.values(EVALUATION_STATUS_VARIANTS)
        .flatMap(variant => (Array.isArray(variant.classes) ? variant.classes : [])),
));

const OVERALL_STATUS_META = {
    healthy: {
        icon: '✅',
        title: 'Semua jaringan siap digunakan.',
        description: 'Seluruh jaringan RAFT merespons transaksi evaluasi.',
        accentClass: 'text-emerald-300',
    },
    partial: {
        icon: '⚠️',
        title: 'Sebagian jaringan siap, beberapa membutuhkan perhatian.',
        description: 'Periksa catatan pada jaringan yang belum siap sebelum melanjutkan pengujian.',
        accentClass: 'text-amber-300',
    },
    unavailable: {
        icon: '❌',
        title: 'Tidak ada jaringan yang siap digunakan.',
        description: 'Pastikan seluruh layanan dan material kriptografi tersedia sebelum mencoba kembali.',
        accentClass: 'text-rose-300',
    },
};

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

const HIERARCHY_BAR_STYLE = {
    fallbackColor: 'rgba(99, 102, 241, 0.7)',
    startColor: [56, 189, 248],
    endColor: [79, 70, 229]
};

function getParsedChartValue(parsedValue) {
    if (parsedValue == null) {
        return 0;
    }

    if (typeof parsedValue === 'number' && !Number.isNaN(parsedValue)) {
        return parsedValue;
    }

    if (typeof parsedValue === 'object') {
        if (typeof parsedValue.x === 'number' && !Number.isNaN(parsedValue.x)) {
            return parsedValue.x;
        }
        if (typeof parsedValue.y === 'number' && !Number.isNaN(parsedValue.y)) {
            return parsedValue.y;
        }
    }

    const numericValue = Number(parsedValue);
    return Number.isNaN(numericValue) ? 0 : numericValue;
}

function createHierarchyBarGradient(context, maxValue, { boost = 0 } = {}) {
    if (!context || typeof context.dataIndex !== 'number') {
        return HIERARCHY_BAR_STYLE.fallbackColor;
    }

    const chart = context.chart;
    if (!chart || !chart.ctx || !chart.chartArea) {
        return HIERARCHY_BAR_STYLE.fallbackColor;
    }

    const { chartArea } = chart;
    const value = getParsedChartValue(context.parsed);
    const ratio = maxValue > 0 ? Math.min(1, Math.max(0, value / maxValue)) : 0;
    const isActive = context.dataIndex === activeHierarchyBarIndex;
    const activeBoost = isActive ? 0.18 : 0;

    const startAlpha = Math.min(1, 0.28 + ratio * 0.3 + activeBoost + boost);
    const endAlpha = Math.min(1, 0.5 + ratio * 0.45 + activeBoost + boost);

    const gradient = chart.ctx.createLinearGradient(
        chartArea.left,
        chartArea.top,
        chartArea.right,
        chartArea.top
    );

    const [startR, startG, startB] = HIERARCHY_BAR_STYLE.startColor;
    const [endR, endG, endB] = HIERARCHY_BAR_STYLE.endColor;

    gradient.addColorStop(0, `rgba(${startR}, ${startG}, ${startB}, ${startAlpha})`);
    gradient.addColorStop(1, `rgba(${endR}, ${endG}, ${endB}, ${endAlpha})`);

    return gradient;
}

const HIERARCHY_CHART_HEIGHT = {
    min: 520,
    perItem: 48,
};

const NAME_COMPARISON_LOCALE = 'id-ID';

function compareByTotalReportsDesc(a, b) {
    const totalA = a?.totalReports ?? 0;
    const totalB = b?.totalReports ?? 0;
    if (totalA === totalB) {
        const nameA = a?.name || '';
        const nameB = b?.name || '';
        return nameA.localeCompare(nameB, NAME_COMPARISON_LOCALE, { sensitivity: 'base' });
    }
    return totalB - totalA;
}

function sortItemsByTotalReports(items) {
    if (!Array.isArray(items)) {
        return [];
    }
    return items.slice().sort(compareByTotalReportsDesc);
}

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

async function confirmNetworkShutdown() {
    const title = 'Matikan seluruh jaringan Fabric?';
    const text = 'Perintah ini akan menjalankan ./network.sh down pada jaringan RAFT Standard dan RAFT Variant. Pastikan tidak ada operasi penting yang sedang berjalan sebelum melanjutkan.';

    if (isSwalAvailable()) {
        const result = await window.Swal.fire({
            icon: 'warning',
            title,
            text,
            showCancelButton: true,
            confirmButtonText: 'Ya, matikan jaringan',
            cancelButtonText: 'Batal',
            confirmButtonColor: SWAL_PRIMARY_COLOR,
            cancelButtonColor: SWAL_CANCEL_COLOR,
            focusCancel: true,
        });

        return Boolean(result.isConfirmed);
    }

    return window.confirm(`${title}\n\n${text}`);
}

async function confirmNetworkStartup() {
    const title = 'Hidupkan seluruh jaringan Fabric?';
    const text = 'Perintah ini akan menjalankan ./network.sh up -ca, ./network.sh createChannel, dan deploy chaincode pelaporan untuk jaringan RAFT Standard serta RAFT Variant. Pastikan server siap sebelum melanjutkan.';

    if (isSwalAvailable()) {
        const result = await window.Swal.fire({
            icon: 'question',
            title,
            text,
            showCancelButton: true,
            confirmButtonText: 'Ya, hidupkan jaringan',
            cancelButtonText: 'Batal',
            confirmButtonColor: SWAL_PRIMARY_COLOR,
            cancelButtonColor: SWAL_CANCEL_COLOR,
            focusCancel: true,
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

function getNetworkStatusMeta(status) {
    if (status && NETWORK_STATUS_META[status]) {
        return NETWORK_STATUS_META[status];
    }
    return NETWORK_STATUS_META.unknown;
}

function updateNetworkStartupStatus(state = 'idle', message = DEFAULT_NETWORK_START_STATUS_MESSAGE) {
    if (!networkStartupStatusEl) {
        return;
    }

    const indicator = networkStartupStatusEl.querySelector('[data-indicator]');
    const messageEl = networkStartupStatusEl.querySelector('[data-message]');

    if (indicator) {
        indicator.className = `h-2 w-2 rounded-full ${NETWORK_STATUS_INDICATOR[state] || NETWORK_STATUS_INDICATOR.idle}`;
    }

    if (messageEl && typeof message === 'string') {
        messageEl.textContent = message;
    }

    if (state !== 'idle') {
        setNetworkOperationOverlayMessage(message);
    }
}

function updateNetworkCheckStatus(state = 'idle', message = DEFAULT_NETWORK_STATUS_MESSAGE) {
    if (!networkCheckStatusEl) {
        return;
    }

    const indicator = networkCheckStatusEl.querySelector('[data-indicator]');
    const messageEl = networkCheckStatusEl.querySelector('[data-message]');

    if (indicator) {
        indicator.className = `h-2 w-2 rounded-full ${NETWORK_STATUS_INDICATOR[state] || NETWORK_STATUS_INDICATOR.idle}`;
    }

    if (messageEl && typeof message === 'string') {
        messageEl.textContent = message;
    }
}

function updateNetworkShutdownStatus(state = 'idle', message = DEFAULT_NETWORK_SHUTDOWN_STATUS_MESSAGE) {
    if (!networkShutdownStatusEl) {
        return;
    }

    const indicator = networkShutdownStatusEl.querySelector('[data-indicator]');
    const messageEl = networkShutdownStatusEl.querySelector('[data-message]');

    if (indicator) {
        indicator.className = `h-2 w-2 rounded-full ${NETWORK_STATUS_INDICATOR[state] || NETWORK_STATUS_INDICATOR.idle}`;
    }

    if (messageEl && typeof message === 'string') {
        messageEl.textContent = message;
    }

    if (state !== 'idle') {
        setNetworkOperationOverlayMessage(message);
    }
}

function isNetworkOperationOverlayActive() {
    return Boolean(networkOperationOverlay && !networkOperationOverlay.classList.contains('hidden'));
}

function setNetworkOperationOverlayMessage(message) {
    if (!networkOperationMessage || !isNetworkOperationOverlayActive() || typeof message !== 'string') {
        return;
    }

    networkOperationMessage.textContent = message;
}

function formatElapsedTime(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        milliseconds = 0;
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const tenths = Math.floor((milliseconds % 1000) / 100);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return [
            String(hours).padStart(2, '0'),
            String(remainingMinutes).padStart(2, '0'),
            String(seconds).padStart(2, '0'),
        ].join(':');
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function updateNetworkOperationOverlayTimer() {
    if (!isNetworkOperationOverlayActive() || networkOperationOverlayStart === null) {
        return;
    }

    const elapsed = Math.max(0, performance.now() - networkOperationOverlayStart);

    if (networkOperationTimer) {
        networkOperationTimer.textContent = formatElapsedTime(elapsed);
    }
}

function showNetworkOperationOverlay(mode = 'startup', message) {
    if (!networkOperationOverlay) {
        return;
    }

    if (networkOperationOverlayHideTimeout) {
        window.clearTimeout(networkOperationOverlayHideTimeout);
        networkOperationOverlayHideTimeout = null;
    }

    if (networkOperationTimerHandle) {
        window.clearInterval(networkOperationTimerHandle);
        networkOperationTimerHandle = null;
    }

    networkOperationOverlayStart = performance.now();

    if (networkOperationTimer) {
        networkOperationTimer.textContent = '00:00.0';
    }

    const defaultHint = mode === 'shutdown'
        ? 'Menunggu seluruh node berhenti. Jangan tutup halaman hingga proses selesai.'
        : 'Menyalakan jaringan dapat memerlukan beberapa menit. Jangan tutup halaman.';

    if (typeof message === 'string') {
        if (networkOperationMessage) {
            networkOperationMessage.textContent = message;
        }
    } else if (networkOperationMessage) {
        networkOperationMessage.textContent = 'Menjalankan perintah jaringan...';
    }

    if (networkOperationHint) {
        networkOperationHint.textContent = defaultHint;
    }

    networkOperationOverlay.classList.remove('hidden');
    networkOperationOverlay.classList.add('flex');
    networkOperationOverlay.classList.remove('opacity-0', 'pointer-events-none');
    networkOperationOverlay.classList.add('pointer-events-auto', 'opacity-100');
    networkOperationOverlay.setAttribute('aria-hidden', 'false');

    networkOperationTimerHandle = window.setInterval(updateNetworkOperationOverlayTimer, 100);
    updateNetworkOperationOverlayTimer();
}

function hideNetworkOperationOverlay() {
    if (!networkOperationOverlay) {
        return;
    }

    if (networkOperationOverlayHideTimeout) {
        window.clearTimeout(networkOperationOverlayHideTimeout);
        networkOperationOverlayHideTimeout = null;
    }

    const overlayActive = isNetworkOperationOverlayActive();

    if (!overlayActive) {
        if (networkOperationTimerHandle) {
            window.clearInterval(networkOperationTimerHandle);
            networkOperationTimerHandle = null;
        }

        networkOperationOverlayStart = null;

        networkOperationOverlay.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        networkOperationOverlay.classList.remove('flex', 'opacity-100', 'pointer-events-auto');
        networkOperationOverlay.setAttribute('aria-hidden', 'true');

        return;
    }

    const completeHide = () => {
        if (!networkOperationOverlay) {
            return;
        }

        networkOperationOverlay.classList.add('hidden');
        networkOperationOverlay.classList.remove('flex');
        networkOperationOverlay.setAttribute('aria-hidden', 'true');
    };

    const beginFade = () => {
        if (!networkOperationOverlay) {
            return;
        }

        networkOperationOverlay.classList.add('opacity-0', 'pointer-events-none');
        networkOperationOverlay.classList.remove('opacity-100', 'pointer-events-auto');

        networkOperationOverlayHideTimeout = window.setTimeout(() => {
            completeHide();
            networkOperationOverlayHideTimeout = null;
        }, 200);
    };

    if (networkOperationTimerHandle) {
        window.clearInterval(networkOperationTimerHandle);
        networkOperationTimerHandle = null;
    }

    const elapsed = networkOperationOverlayStart === null
        ? 0
        : Math.max(0, performance.now() - networkOperationOverlayStart);
    networkOperationOverlayStart = null;

    const effectiveElapsed = Number.isFinite(elapsed) ? elapsed : 0;
    const remainingDelay = Math.max(0, MIN_NETWORK_OPERATION_OVERLAY_DURATION - effectiveElapsed);

    if (remainingDelay > 0) {
        networkOperationOverlayHideTimeout = window.setTimeout(() => {
            beginFade();
            networkOperationOverlayHideTimeout = null;
        }, remainingDelay);
    } else {
        beginFade();
    }
}

function formatNetworkStartupSummary(results) {
    if (!Array.isArray(results) || !results.length) {
        return ['Tidak ada jaringan yang ditemukan untuk dijalankan.'];
    }

    return results.map(result => {
        const label = result?.label || 'Jaringan';
        let statusLabel = 'gagal dijalankan';

        if (result?.status === 'success') {
            statusLabel = 'berhasil dijalankan';
        } else if (result?.status === 'partial') {
            statusLabel = 'berhasil sebagian';
        } else if (result?.status === 'not_found') {
            statusLabel = 'tidak ditemukan';
        } else if (result?.status === 'dependency_missing') {
            statusLabel = 'tidak dapat dijalankan karena dependensi hilang';
        }

        const detailParts = [];

        if (Array.isArray(result?.steps)) {
            result.steps.forEach(step => {
                const stepLabel = step?.label || step?.displayCommand || 'Langkah';
                let stepStatusLabel = 'gagal';

                if (step?.status === 'success') {
                    stepStatusLabel = 'berhasil';
                } else if (step?.status === 'skipped') {
                    stepStatusLabel = 'dilewati';
                }

                detailParts.push(`${stepLabel} — ${stepStatusLabel}.`);

                if (step?.message) {
                    detailParts.push(step.message);
                }

                if (step?.resolution) {
                    detailParts.push(step.resolution);
                }
            });
        }

        if (result?.message) {
            detailParts.push(result.message);
        }

        if (result?.resolution) {
            detailParts.push(result.resolution);
        }

        const detailText = detailParts.length ? ` ${detailParts.join(' ')}` : '';

        return `${label} — ${statusLabel}.${detailText}`.trim();
    });
}

function formatNetworkShutdownSummary(results) {
    if (!Array.isArray(results) || !results.length) {
        return ['Tidak ada jaringan yang ditemukan untuk dimatikan.'];
    }

    return results.map(result => {
        const label = result?.label || 'Jaringan';
        let statusLabel = 'gagal dimatikan';

        if (result?.status === 'success') {
            statusLabel = 'berhasil dimatikan';
        } else if (result?.status === 'not_found') {
            statusLabel = 'tidak ditemukan';
        } else if (result?.status === 'dependency_missing') {
            statusLabel = 'tidak dapat dijalankan karena dependensi hilang';
        }

        const additionalDetails = [];

        if (result?.message) {
            additionalDetails.push(result.message);
        }

        if (result?.resolution) {
            additionalDetails.push(result.resolution);
        }

        const detailText = additionalDetails.length ? ` ${additionalDetails.join(' ')}` : '';

        return `${label} — ${statusLabel}.${detailText}`.trim();
    });
}

function formatDateTimeFromIso(isoString) {
    if (!isoString) {
        return '';
    }

    try {
        const parsed = new Date(isoString);
        if (Number.isNaN(parsed.getTime())) {
            return '';
        }
        return dateTimeFormatter.format(parsed);
    } catch (error) {
        console.warn('Gagal memformat waktu pemeriksaan jaringan:', error);
        return '';
    }
}

function createInstructionList(instructions) {
    if (!instructions || typeof instructions !== 'object') {
        return null;
    }

    const items = [];
    if (instructions.up) {
        items.push({ label: 'Mulai jaringan', command: instructions.up });
    }
    if (instructions.deploy) {
        items.push({ label: 'Deploy chaincode', command: instructions.deploy });
    }

    if (!items.length) {
        return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-2 rounded-lg border border-white/10 bg-surfaceMuted/60 px-3 py-3';

    const heading = document.createElement('p');
    heading.className = 'text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary';
    heading.textContent = 'Langkah pemulihan';
    wrapper.append(heading);

    const list = document.createElement('ul');
    list.className = 'space-y-2 text-xs text-textdark/70';

    items.forEach(item => {
        const listItem = document.createElement('li');
        listItem.className = 'flex flex-col gap-1';

        const label = document.createElement('span');
        label.className = 'text-textdark/60';
        label.textContent = item.label;

        const code = document.createElement('code');
        code.className = 'break-words rounded bg-surface px-2 py-1 text-[11px] text-textdark';
        code.textContent = item.command;

        listItem.append(label, code);
        list.append(listItem);
    });

    wrapper.append(list);
    return wrapper;
}

function createNetworkBlockSummaryCard(result, index = 0) {
    const card = document.createElement('article');
    card.className = 'animate-on-scroll flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface p-5 shadow-lg shadow-black/10';
    card.dataset.animateDelay = String(80 * (index + 1));

    const channelLabel = document.createElement('span');
    channelLabel.className = 'text-xs font-semibold uppercase tracking-[0.3em] text-secondary';
    channelLabel.textContent = result?.channel || 'Channel';

    const networkName = document.createElement('h3');
    networkName.className = 'text-base font-semibold text-textdark';
    networkName.textContent = result?.label || 'Jaringan';

    const blockInfo = resolveBlockHeightInfo(result);

    const valueEl = document.createElement('p');
    valueEl.className = `text-3xl font-semibold ${blockInfo?.hasData ? 'text-primary' : 'text-textdark/60'}`;
    valueEl.textContent = blockInfo?.primary || 'Tidak tersedia';

    const statusMeta = NETWORK_STATUS_META[result?.status] || NETWORK_STATUS_META.unknown;
    const statusBadge = document.createElement('span');
    statusBadge.className = `inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-[11px] font-semibold ${statusMeta.badgeClass}`;
    statusBadge.textContent = `${statusMeta.icon} ${statusMeta.label}`;

    const descriptionEl = document.createElement('p');
    descriptionEl.className = 'text-xs text-textdark/70';
    descriptionEl.textContent = blockInfo?.secondary || statusMeta.description || '';

    card.append(channelLabel, networkName, valueEl, statusBadge, descriptionEl);
    observeAnimatedElement(card);
    return card;
}

function createNetworkResultCard(result) {
    const card = document.createElement('article');
    card.className = 'flex flex-col gap-3 rounded-xl border border-white/10 bg-surface p-4 shadow-lg shadow-black/10';

    const meta = getNetworkStatusMeta(result?.status);

    const header = document.createElement('header');
    header.className = 'flex flex-col gap-2';

    const title = document.createElement('h3');
    title.className = 'text-base font-semibold text-primary';
    title.textContent = result?.label || 'Jaringan tanpa nama';

    const badge = document.createElement('span');
    badge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${meta.badgeClass}`;
    badge.textContent = `${meta.icon} ${meta.label}`;

    header.append(title, badge);
    card.append(header);

    if (meta.description) {
        const description = document.createElement('p');
        description.className = 'text-xs text-textdark/70';
        description.textContent = meta.description;
        card.append(description);
    }

    const details = document.createElement('dl');
    details.className = 'grid gap-3 text-xs text-textdark/60 sm:grid-cols-2';

    const blockInfo = resolveBlockHeightInfo(result);

    const detailEntries = [
        { term: 'Direktori jaringan', value: result?.networkDir },
        { term: 'Channel', value: result?.channel },
        { term: 'Chaincode', value: result?.chaincode },
        { term: 'Peer', value: result?.peer },
    ];

    if (blockInfo?.primary) {
        detailEntries.push({ term: 'Jumlah blok', value: blockInfo.primary });
    }

    detailEntries.forEach(entry => {
        if (!entry.value) {
            return;
        }
        const termEl = document.createElement('dt');
        termEl.className = 'font-semibold text-textdark/70';
        termEl.textContent = entry.term;

        const valueEl = document.createElement('dd');
        valueEl.className = 'text-textdark/60';
        valueEl.textContent = entry.value;

        details.append(termEl, valueEl);
    });

    card.append(details);

    if (result?.message && result.status !== 'healthy') {
        const note = document.createElement('p');
        note.className = 'rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90';
        note.textContent = result.message;
        card.append(note);
    }

    const instructions = createInstructionList(result?.instructions);
    if (instructions) {
        card.append(instructions);
    }

    return card;
}

function renderNetworkHealthResults(results, summary = {}) {
    if (!networkHealthResultsContainer) {
        return;
    }

    if (networkBlockSummaryEl) {
        networkBlockSummaryEl.innerHTML = '';
        if (Array.isArray(results) && results.length) {
            results.forEach((result, index) => {
                networkBlockSummaryEl.append(createNetworkBlockSummaryCard(result, index));
            });
        }
    }

    if (networkHealthSummaryEl) {
        networkHealthSummaryEl.innerHTML = '';
        const summaryMeta = OVERALL_STATUS_META[summary.overallStatus] || {
            icon: 'ℹ️',
            title: 'Pemeriksaan jaringan selesai.',
            description: 'Periksa detail setiap jaringan pada daftar di bawah ini.',
            accentClass: 'text-slate-200',
        };

        const title = document.createElement('p');
        title.className = `text-sm font-semibold ${summaryMeta.accentClass}`;
        title.textContent = `${summaryMeta.icon} ${summaryMeta.title}`;

        const description = document.createElement('p');
        description.className = 'text-xs text-textdark/70';
        description.textContent = summaryMeta.description;

        networkHealthSummaryEl.append(title, description);

        const formattedDate = formatDateTimeFromIso(summary.checkedAt);
        if (formattedDate) {
            const timestamp = document.createElement('p');
            timestamp.className = 'text-[11px] text-textdark/60';
            timestamp.textContent = `Terakhir diperiksa: ${formattedDate}`;
            networkHealthSummaryEl.append(timestamp);
        }
    }

    if (networkHealthListEl) {
        networkHealthListEl.innerHTML = '';
        if (Array.isArray(results) && results.length) {
            results.forEach(result => {
                networkHealthListEl.append(createNetworkResultCard(result));
            });
        } else {
            const emptyState = document.createElement('p');
            emptyState.className = 'rounded-lg border border-white/10 bg-surface px-4 py-3 text-xs text-textdark/70';
            emptyState.textContent = 'Pemeriksaan tidak mengembalikan data jaringan.';
            networkHealthListEl.append(emptyState);
        }
    }

    networkHealthResultsContainer.classList.remove('hidden');
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

function normalizeBlockHeight(value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return { numeric: value, text: formatCount(value) };
    }

    if (typeof value === 'bigint') {
        const isSafe = value <= BigInt(Number.MAX_SAFE_INTEGER);
        return {
            numeric: isSafe ? Number(value) : null,
            text: isSafe ? formatCount(Number(value)) : value.toString()
        };
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isNaN(parsed)) {
            return { numeric: parsed, text: formatCount(parsed) };
        }
        return { numeric: null, text: trimmed };
    }

    return { numeric: null, text: String(value) };
}

function formatBlockHeightLabel(value, { withUnit = true } = {}) {
    const normalized = normalizeBlockHeight(value);
    if (!normalized) {
        return null;
    }

    if (!withUnit) {
        return normalized.text;
    }

    return normalized.numeric !== null
        ? `${normalized.text} blok`
        : normalized.text;
}

function resolveBlockHeightInfo(result) {
    const formatted = formatBlockHeightLabel(result?.blockHeight);
    if (formatted) {
        return {
            primary: formatted,
            secondary: 'Jumlah blok pada channel saat pemeriksaan ini.',
            hasData: true,
        };
    }

    switch (result?.status) {
        case 'healthy':
            return {
                primary: 'Tidak tersedia',
                secondary: 'Jumlah blok tidak berhasil diambil dari jaringan.',
                hasData: false,
            };
        case 'unhealthy':
            return {
                primary: 'Tidak tersedia',
                secondary: 'Jaringan tidak merespons. Periksa konfigurasi sebelum mencoba lagi.',
                hasData: false,
            };
        case 'not_found':
            return {
                primary: 'Tidak ditemukan',
                secondary: 'Direktori jaringan tidak tersedia pada server.',
                hasData: false,
            };
        case 'incomplete':
            return {
                primary: 'Material belum lengkap',
                secondary: result?.message || 'Material kriptografi belum lengkap.',
                hasData: false,
            };
        default:
            return {
                primary: 'Menunggu pemeriksaan',
                secondary: 'Jalankan pemeriksaan jaringan untuk melihat jumlah blok.',
                hasData: false,
            };
    }
}

function sanitizeCode(value) {
    return (value || '')
        .toString()
        .replace(/[^0-9]/g, '');
}

function normalizeName(value) {
    return (value || '')
        .toString()
        .trim()
        .toLowerCase();
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
    setHierarchyChartContainerHeight(0);
}

function setHierarchyChartContainerHeight(itemCount) {
    if (!hierarchyChartContainer) {
        return;
    }

    const { min, perItem } = HIERARCHY_CHART_HEIGHT;
    const computedHeight = Math.max(min, Number(itemCount || 0) * perItem);
    hierarchyChartContainer.style.height = `${computedHeight}px`;
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

    currentChartItems = sortItemsByTotalReports(levelInfo.items);
    activeHierarchyBarIndex = null;

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

    setHierarchyChartContainerHeight(currentChartItems.length);

    destroyHierarchyChart();

    const chartContext = hierarchyChartCanvas.getContext('2d');
    const maxReportValue = data.length ? Math.max(...data) : 0;

    hierarchyChartInstance = new window.Chart(chartContext, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: levelInfo.datasetTitle,
                    data,
                    barPercentage: 0.74,
                    categoryPercentage: 0.82,
                    backgroundColor(context) {
                        return createHierarchyBarGradient(context, maxReportValue);
                    },
                    hoverBackgroundColor(context) {
                        return createHierarchyBarGradient(context, maxReportValue, { boost: 0.08 });
                    },
                    borderWidth: 1,
                    borderColor: 'rgba(148, 163, 184, 0.25)',
                    borderSkipped: false,
                    borderRadius: 12,
                    maxBarThickness: 56,
                    minBarLength: 6
                }
            ]
        },
        options: {
            animation: {
                duration: 450,
                easing: 'easeOutCubic'
            },
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 24,
                    right: 72,
                    bottom: 24,
                    left: 12
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    border: {
                        display: false
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.15)',
                        drawBorder: false,
                        drawTicks: false
                    },
                    ticks: {
                        color: '#94A3B8',
                        callback: value => formatCount(value),
                        maxRotation: 0,
                        padding: 16,
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    border: {
                        display: false
                    },
                    grid: {
                        display: false,
                        drawBorder: false,
                        drawTicks: false
                    },
                    ticks: {
                        color: '#E2E8F0',
                        padding: 16,
                        autoSkip: false,
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
                    displayColors: false,
                    backgroundColor: '#0F172A',
                    borderColor: 'rgba(148, 163, 184, 0.15)',
                    borderWidth: 1,
                    titleColor: '#E2E8F0',
                    bodyColor: '#E2E8F0',
                    callbacks: {
                        label(context) {
                            const value = context?.parsed?.x ?? context?.parsed ?? 0;
                            return `${formatCount(value)} laporan`;
                        },
                        title(tooltipItems) {
                            if (!Array.isArray(tooltipItems) || !tooltipItems.length) {
                                return '';
                            }
                            return tooltipItems[0].label || '';
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
                },
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

    animateHierarchyBarSelection(index);

    const records = getRecordsForHierarchyLevel(level, targetItem);
    const nextEntry = getNextHierarchyEntry(level, targetItem);
    const meta = HIERARCHY_LEVEL_META[level] || {};
    const childLevel = nextEntry ? nextEntry.level : meta.childLevel;

    const navigateToNextLevel = nextEntry
        ? () => {
            hierarchyViewStack.push(nextEntry);
            renderCurrentHierarchyLevel();
        }
        : null;

    openHierarchyReportsModal({
        level,
        item: targetItem,
        records,
        onNavigate: navigateToNextLevel,
        childLevel,
        childUnavailableMessage: !nextEntry && meta.emptyChildMessage ? meta.emptyChildMessage : ''
    });
}

function animateHierarchyBarSelection(index) {
    if (!hierarchyChartInstance || typeof index !== 'number') {
        return;
    }

    if (activeHierarchyBarIndex === index) {
        hierarchyChartInstance.update();
        return;
    }

    activeHierarchyBarIndex = index;
    hierarchyChartInstance.update();
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

function getRecordIdentifiers(record, level) {
    if (!record) {
        return { id: '', name: '' };
    }

    if (level === 'province') {
        return {
            id: sanitizeCode(record.provinceId || record.provinsi),
            name: normalizeName(record.provinsi)
        };
    }

    if (level === 'regency') {
        return {
            id: sanitizeCode(record.regencyId || record.kab_kota),
            name: normalizeName(record.kab_kota)
        };
    }

    if (level === 'district') {
        return {
            id: sanitizeCode(record.districtId || record.kecamatan),
            name: normalizeName(record.kecamatan)
        };
    }

    if (level === 'subdistrict') {
        return {
            id: sanitizeCode(record.subdistrictId || record.kelurahan_desa),
            name: normalizeName(record.kelurahan_desa)
        };
    }

    return { id: '', name: '' };
}

function getRecordsForHierarchyLevel(level, item) {
    if (!level || !item) {
        return [];
    }

    if (level === 'subdistrict') {
        return getRecordsForSubdistrict(item);
    }

    const targetId = sanitizeCode(item.id || item.sanitizedId || item.name);
    const targetName = normalizeName(item.name);

    if (!Array.isArray(simulationData) || !simulationData.length) {
        return [];
    }

    return simulationData.filter(record => {
        const { id, name } = getRecordIdentifiers(record, level);
        if (targetId && id) {
            return id === targetId;
        }
        if (targetName && name) {
            return name === targetName;
        }
        return false;
    });
}

function getChildItemsForLevel(level, item) {
    if (!item) {
        return [];
    }

    if (level === 'province') {
        return sortItemsByTotalReports(item.regencies);
    }

    if (level === 'regency') {
        return sortItemsByTotalReports(item.districts);
    }

    if (level === 'district') {
        return sortItemsByTotalReports(item.subdistricts);
    }

    return [];
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

    const provinces = sortItemsByTotalReports(Array.from(provincesMap.values()).map(province => {
        const regencies = sortItemsByTotalReports(Array.from(province.regenciesMap.values()).map(regency => {
            const districts = sortItemsByTotalReports(Array.from(regency.districtsMap.values()).map(district => {
                const subdistricts = sortItemsByTotalReports(Array.from(district.subdistrictsMap.values()).map(subdistrict => ({
                    id: subdistrict.id,
                    sanitizedId: subdistrict.sanitizedId,
                    name: subdistrict.name,
                    totalReports: subdistrict.totalReports
                })));

                return {
                    id: district.id,
                    sanitizedId: district.sanitizedId,
                    name: district.name,
                    totalReports: district.totalReports,
                    subdistricts
                };
            }));

            return {
                id: regency.id,
                sanitizedId: regency.sanitizedId,
                name: regency.name,
                totalReports: regency.totalReports,
                districts
            };
        }));

        return {
            id: province.id,
            sanitizedId: province.sanitizedId,
            name: province.name,
            totalReports: province.totalReports,
            regencies
        };
    }));

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

function setButtonState(button, disabled) {
    if (!button) {
        return;
    }
    button.disabled = !!disabled;
    button.classList.toggle('cursor-not-allowed', !!disabled);
    button.classList.toggle('opacity-60', !!disabled);
}

function disableSimulationControlsForProcessing() {
    const previousState = {
        inputDisabled: simulationCountInput ? simulationCountInput.disabled : false,
        submitDisabled: simulationSubmitButton ? simulationSubmitButton.disabled : false,
        clearDisabled: clearSimulationButton ? clearSimulationButton.disabled : false,
    };

    if (simulationCountInput) {
        simulationCountInput.disabled = true;
    }
    setButtonState(simulationSubmitButton, true);
    setButtonState(clearSimulationButton, true);

    return previousState;
}

function restoreSimulationControls(previousState) {
    if (!previousState) {
        return;
    }

    if (simulationCountInput) {
        simulationCountInput.disabled = !!previousState.inputDisabled;
    }
    setButtonState(simulationSubmitButton, !!previousState.submitDisabled);
    setButtonState(clearSimulationButton, !!previousState.clearDisabled);
}

function createDefaultEvaluationStats() {
    return {
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        lastLatencyMs: null,
        firstSubmittedAt: null,
        lastUpdatedAt: null,
        lastCommitStatus: null,
        lastMessage: 'Belum ada transaksi yang dikirim.',
        lastStatus: 'idle',
        lastTransactionId: null,
    };
}

function ensureEvaluationSectionInitialized() {
    if (!simulationEvaluationContainer || !simulationEvaluationList) {
        return;
    }

    if (simulationEvaluationList.dataset.initialized === 'true') {
        return;
    }

    simulationEvaluationList.dataset.initialized = 'true';

    BLOCKCHAIN_TARGETS.forEach((target, index) => {
        if (!evaluationStats.has(target.id)) {
            evaluationStats.set(target.id, createDefaultEvaluationStats());
        }

        const card = document.createElement('article');
        card.className = 'flex flex-col gap-4 rounded-2xl border border-white/10 bg-surfaceMuted/70 p-6 shadow-lg shadow-black/10 animate-on-scroll';
        card.dataset.targetId = target.id;
        card.dataset.animateDelay = String(90 + (index * 30));

        const header = document.createElement('header');
        header.className = 'flex items-start justify-between gap-3 border-b border-white/5 pb-4';

        const info = document.createElement('div');
        info.className = 'space-y-1';

        const labelEl = document.createElement('p');
        labelEl.className = 'text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/80';
        labelEl.textContent = 'Jaringan blockchain';

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-lg font-semibold text-textdark';
        titleEl.textContent = target.label;

        const channelEl = document.createElement('p');
        channelEl.className = 'text-xs text-textdark/60';
        channelEl.textContent = `Channel: ${target.channel}`;

        info.appendChild(labelEl);
        info.appendChild(titleEl);
        info.appendChild(channelEl);

        const statusBadge = document.createElement('span');
        statusBadge.className = 'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] transition';
        statusBadge.dataset.evalStatusBadge = 'true';

        header.appendChild(info);
        header.appendChild(statusBadge);

        const metrics = document.createElement('dl');
        metrics.className = 'grid gap-3 md:grid-cols-2';

        function createMetric(label, attribute, accentClass = 'text-primary') {
            const wrapper = document.createElement('div');
            wrapper.className = 'rounded-xl border border-white/5 bg-surface/70 px-4 py-3 shadow-inner shadow-black/5';

            const dt = document.createElement('dt');
            dt.className = 'text-xs font-semibold uppercase tracking-[0.25em] text-secondary/70';
            dt.textContent = label;

            const dd = document.createElement('dd');
            dd.className = `text-lg font-semibold ${accentClass}`;
            dd.textContent = '—';
            dd.setAttribute(attribute, '');

            wrapper.appendChild(dt);
            wrapper.appendChild(dd);

            return { wrapper, valueEl: dd };
        }

        const latencyMetric = createMetric('Latensi terbaru', 'data-eval-latency-latest');
        const avgLatencyMetric = createMetric('Rata-rata latensi', 'data-eval-latency-average');
        const throughputMetric = createMetric('Throughput', 'data-eval-throughput');
        const successMetric = createMetric('Commit berhasil', 'data-eval-success-count', 'text-emerald-300');
        const failureMetric = createMetric('Commit gagal', 'data-eval-failure-count', 'text-rose-300');
        const commitCodeMetric = createMetric('Kode commit terakhir', 'data-eval-commit-code', 'text-highlight');
        const commitBlockMetric = createMetric('Blok commit terakhir', 'data-eval-commit-block', 'text-secondary');

        [
            latencyMetric,
            avgLatencyMetric,
            throughputMetric,
            successMetric,
            failureMetric,
            commitCodeMetric,
            commitBlockMetric,
        ].forEach(metricEntry => {
            metrics.appendChild(metricEntry.wrapper);
        });

        const footer = document.createElement('footer');
        footer.className = 'rounded-xl border border-white/5 bg-surface/60 px-4 py-3 text-xs text-textdark/70';

        const messageEl = document.createElement('p');
        messageEl.setAttribute('data-eval-message', '');
        messageEl.textContent = 'Belum ada transaksi yang dikirim.';

        const timestampEl = document.createElement('p');
        timestampEl.className = 'mt-1 text-[11px] uppercase tracking-[0.25em] text-textdark/50';
        timestampEl.setAttribute('data-eval-timestamp', '');
        timestampEl.textContent = 'Belum ada pembaruan.';

        footer.appendChild(messageEl);
        footer.appendChild(timestampEl);

        card.appendChild(header);
        card.appendChild(metrics);
        card.appendChild(footer);

        simulationEvaluationList.appendChild(card);
        observeAnimatedElement(card);

        evaluationElements.set(target.id, {
            card,
            statusBadge,
            message: messageEl,
            timestamp: timestampEl,
            latestLatency: latencyMetric.valueEl,
            averageLatency: avgLatencyMetric.valueEl,
            throughput: throughputMetric.valueEl,
            successCount: successMetric.valueEl,
            failureCount: failureMetric.valueEl,
            commitCode: commitCodeMetric.valueEl,
            commitBlock: commitBlockMetric.valueEl,
        });

        renderEvaluationStats(target.id);
    });
}

function resetEvaluationStats() {
    BLOCKCHAIN_TARGETS.forEach(target => {
        evaluationStats.set(target.id, createDefaultEvaluationStats());
        renderEvaluationStats(target.id);
    });
}

function formatLatencyValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${decimalFormatter.format(value)} ms`;
    }
    return '—';
}

function formatThroughputValue(stats) {
    if (!stats || !stats.firstSubmittedAt || !stats.lastUpdatedAt || stats.successCount === 0) {
        return '0,00 tx/detik';
    }

    const durationMs = Math.max(stats.lastUpdatedAt - stats.firstSubmittedAt, 0);
    if (durationMs <= 0) {
        return `${decimalFormatter.format(stats.successCount)} tx/detik`;
    }

    const throughput = stats.successCount / (durationMs / 1000);
    if (!Number.isFinite(throughput)) {
        return '0,00 tx/detik';
    }

    return `${decimalFormatter.format(throughput)} tx/detik`;
}

function renderEvaluationStats(targetId) {
    const stats = evaluationStats.get(targetId);
    const elements = evaluationElements.get(targetId);

    if (!stats || !elements) {
        return;
    }

    const variantKey = EVALUATION_STATUS_VARIANTS[stats.lastStatus] ? stats.lastStatus : 'idle';
    const variant = EVALUATION_STATUS_VARIANTS[variantKey];

    if (variant) {
        elements.statusBadge.textContent = variant.label;
        elements.statusBadge.classList.remove(...EVALUATION_STATUS_CLASS_CACHE);
        elements.statusBadge.classList.add(...variant.classes);
    }

    elements.latestLatency.textContent = formatLatencyValue(stats.lastLatencyMs);

    const averageLatency = stats.successCount > 0
        ? stats.totalLatencyMs / stats.successCount
        : null;
    elements.averageLatency.textContent = formatLatencyValue(averageLatency);

    elements.throughput.textContent = formatThroughputValue(stats);
    elements.successCount.textContent = formatCount(stats.successCount);
    elements.failureCount.textContent = formatCount(stats.failureCount);

    if (stats.lastCommitStatus) {
        const { code, codeName, blockNumber } = stats.lastCommitStatus;
        elements.commitCode.textContent = codeName || (code !== undefined ? String(code) : '—');
        const normalizedBlock = normalizeBlockHeight(blockNumber);
        elements.commitBlock.textContent = normalizedBlock ? `#${normalizedBlock.text}` : '—';
    } else {
        elements.commitCode.textContent = '—';
        elements.commitBlock.textContent = '—';
    }

    elements.message.textContent = stats.lastMessage || 'Belum ada transaksi yang dikirim.';

    if (stats.lastUpdatedAt) {
        const timestampDate = new Date(stats.lastUpdatedAt);
        elements.timestamp.textContent = Number.isNaN(timestampDate.getTime())
            ? 'Pembaruan terakhir tidak diketahui.'
            : `Pembaruan terakhir ${dateTimeFormatter.format(timestampDate)}`;
    } else {
        elements.timestamp.textContent = 'Belum ada pembaruan.';
    }
}

function notifyEvaluationProgressStart(record, index, total) {
    const now = Date.now();
    const label = record?.kelurahan_desa || record?.id || `Catatan ${index}`;

    BLOCKCHAIN_TARGETS.forEach(target => {
        const stats = evaluationStats.get(target.id) || createDefaultEvaluationStats();
        if (!stats.firstSubmittedAt) {
            stats.firstSubmittedAt = now;
        }
        stats.lastUpdatedAt = now;
        stats.lastStatus = 'processing';
        stats.lastMessage = `Mengirim ${label} (${index}/${total}).`;
        evaluationStats.set(target.id, stats);
        renderEvaluationStats(target.id);
    });
}

function updateEvaluationResult(result, { record } = {}) {
    if (!result || !result.targetId) {
        return;
    }

    const stats = evaluationStats.get(result.targetId) || createDefaultEvaluationStats();
    const now = Date.now();

    if (!stats.firstSubmittedAt) {
        stats.firstSubmittedAt = now;
    }

    stats.lastUpdatedAt = now;
    stats.totalCount += 1;

    if (typeof result.latencyMs === 'number' && Number.isFinite(result.latencyMs)) {
        stats.lastLatencyMs = result.latencyMs;
        if (result.status === 'success') {
            stats.totalLatencyMs += result.latencyMs;
        }
    } else {
        stats.lastLatencyMs = null;
    }

    if (result.commitStatus) {
        stats.lastCommitStatus = result.commitStatus;
    } else if (result.status === 'error' || result.status === 'commit_failed') {
        stats.lastCommitStatus = null;
    }

    if (result.status === 'success') {
        stats.successCount += 1;
        stats.lastStatus = 'success';
    } else if (result.status === 'commit_failed' || result.status === 'error' || result.status === 'not_found' || result.status === 'incomplete') {
        stats.failureCount += 1;
        stats.lastStatus = 'error';
    } else {
        stats.lastStatus = 'processing';
    }

    const recordLabel = record?.kelurahan_desa || record?.id || 'catatan';

    if (result.status === 'success') {
        const blockInfo = normalizeBlockHeight(result.commitStatus?.blockNumber);
        const blockLabel = blockInfo ? `blok ${blockInfo.text}` : 'blok tidak diketahui';
        stats.lastMessage = `Catatan ${recordLabel} berhasil dikomit (${blockLabel}).`;
    } else if (result.status === 'commit_failed') {
        const codeLabel = result.commitStatus?.codeName || result.commitStatus?.code || 'tidak diketahui';
        stats.lastMessage = `Commit catatan ${recordLabel} gagal (${codeLabel}).`;
    } else if (result.status === 'not_found' || result.status === 'incomplete') {
        stats.lastMessage = result.message || `Jaringan ${result.label} belum siap menerima transaksi.`;
    } else if (result.status === 'error') {
        stats.lastMessage = result.message || `Terjadi kesalahan saat mengirim catatan ${recordLabel}.`;
    } else {
        stats.lastMessage = result.message || `Memproses catatan ${recordLabel}.`;
    }

    stats.lastTransactionId = result.transactionId || result.commitStatus?.transactionId || null;

    evaluationStats.set(result.targetId, stats);
    renderEvaluationStats(result.targetId);
}

async function submitRecordToBlockchain(record) {
    const response = await fetch('/api/simulations/records', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ record }),
    });

    if (!response.ok) {
        let message = `Server mengembalikan status ${response.status}.`;
        try {
            const errorBody = await response.json();
            if (errorBody?.error) {
                message = errorBody.error;
            }
        } catch (error) {
            // ignore JSON parse errors
        }
        throw new Error(message);
    }

    return response.json();
}

async function ingestSimulationRecords(records) {
    if (!Array.isArray(records) || !records.length) {
        return { summary: {}, errors: [] };
    }

    const summary = {};
    const errors = [];

    BLOCKCHAIN_TARGETS.forEach(target => {
        summary[target.id] = { success: 0, failure: 0 };
    });

    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        notifyEvaluationProgressStart(record, index + 1, records.length);

        try {
            const response = await submitRecordToBlockchain(record);
            const results = Array.isArray(response?.results) ? response.results : [];

            if (!results.length) {
                BLOCKCHAIN_TARGETS.forEach(target => {
                    summary[target.id].failure += 1;
                    updateEvaluationResult({
                        targetId: target.id,
                        label: target.label,
                        status: 'error',
                        message: 'Tidak ada hasil dari server.',
                    }, { record });
                });
                errors.push(`Tidak ada hasil untuk catatan ${record.id}.`);
                updateSimulationStatus(`Pengiriman catatan ${record.id} tidak memberikan respons yang valid.`, 'error');
                continue;
            }

            results.forEach(result => {
                if (!summary[result.targetId]) {
                    summary[result.targetId] = { success: 0, failure: 0 };
                }
                if (result.status === 'success') {
                    summary[result.targetId].success += 1;
                } else {
                    summary[result.targetId].failure += 1;
                }
                updateEvaluationResult(result, { record });
            });

            const successfulTargets = results.filter(result => result.status === 'success');
            if (successfulTargets.length === results.length) {
                updateSimulationStatus(`Catatan ${record.id} berhasil dikomit pada seluruh jaringan (${index + 1}/${records.length}).`, 'success');
            } else if (successfulTargets.length > 0) {
                const labels = successfulTargets.map(result => result.label).join(', ');
                updateSimulationStatus(`Catatan ${record.id} hanya berhasil di ${labels} (${index + 1}/${records.length}).`, 'error');
            } else {
                updateSimulationStatus(`Catatan ${record.id} gagal dikomit pada seluruh jaringan (${index + 1}/${records.length}).`, 'error');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);

            BLOCKCHAIN_TARGETS.forEach(target => {
                summary[target.id].failure += 1;
                updateEvaluationResult({
                    targetId: target.id,
                    label: target.label,
                    status: 'error',
                    message: 'Tidak dapat terhubung ke gateway atau jaringan blockchain.',
                }, { record });
            });

            updateSimulationStatus(`Gagal mengirim catatan ${record.id}. (${index + 1}/${records.length})`, 'error');
        }
    }

    return { summary, errors };
}

function createModalTable(records) {
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-secondary/15 text-sm text-left';
    table.setAttribute('role', 'grid');

    const thead = document.createElement('thead');
    thead.className = 'sticky top-0 z-10 bg-surfaceMuted/80 backdrop-blur-sm';
    const headerRow = document.createElement('tr');

    const headers = [
        { label: 'ID', className: 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Kecamatan', className: 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Kabupaten/Kota', className: 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Provinsi', className: 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Waktu', className: 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-secondary' },
        { label: 'Deskripsi', className: 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-secondary' }
    ];

    headers.forEach(({ label, className }) => {
        const th = document.createElement('th');
        th.className = className;
        th.scope = 'col';
        th.textContent = label;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-secondary/12 bg-surface/80';

    const orderedRecords = records.slice().sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
    });

    orderedRecords.forEach(record => {
        const row = document.createElement('tr');
        row.className = 'odd:bg-surface even:bg-surfaceMuted/40 transition-colors hover:bg-secondary/15';

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

const CHILD_SUMMARY_LIMIT = 10;

function createChildSummaryList(items, childLevel) {
    if (!Array.isArray(items) || !items.length || !childLevel) {
        return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'mb-4 space-y-3';

    const childLabel = HIERARCHY_LEVEL_META[childLevel]?.label || 'Wilayah';

    const heading = document.createElement('p');
    heading.className = 'text-xs font-semibold uppercase tracking-[0.3em] text-secondary';
    heading.textContent = `Sebaran laporan per ${childLabel.toLowerCase()}`;
    wrapper.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'space-y-2';

    const sortedItems = sortItemsByTotalReports(items);
    const limitedItems = sortedItems.slice(0, CHILD_SUMMARY_LIMIT);
    limitedItems.forEach(child => {
        const itemRow = document.createElement('li');
        itemRow.className = 'flex items-center justify-between rounded-xl border border-white/10 bg-surface/80 px-4 py-3 text-sm text-textdark/80 shadow-inner shadow-black/5';

        const nameEl = document.createElement('span');
        nameEl.className = 'font-medium text-textdark';
        nameEl.textContent = child?.name || 'Wilayah';

        const countEl = document.createElement('span');
        countEl.className = 'text-xs font-semibold uppercase tracking-[0.2em] text-secondary';
        countEl.textContent = `${formatCount(child?.totalReports ?? 0)} laporan`;

        itemRow.appendChild(nameEl);
        itemRow.appendChild(countEl);
        list.appendChild(itemRow);
    });

    wrapper.appendChild(list);

    if (sortedItems.length > CHILD_SUMMARY_LIMIT) {
        const remaining = document.createElement('p');
        remaining.className = 'text-xs text-textdark/60';
        remaining.textContent = `+${formatCount(sortedItems.length - CHILD_SUMMARY_LIMIT)} ${childLabel.toLowerCase()} lainnya.`;
        wrapper.appendChild(remaining);
    }

    return wrapper;
}

function createLocationDescription(level, itemName, reference, recordsCount) {
    if (!itemName) {
        itemName = 'Wilayah';
    }

    if (level === 'province') {
        return `Provinsi ${itemName} mencatat ${formatCount(recordsCount)} laporan.`;
    }

    if (level === 'regency') {
        const provinceName = reference?.provinsi || 'provinsi tidak diketahui';
        return `Kabupaten/Kota ${itemName} berada di Provinsi ${provinceName} dan mencatat ${formatCount(recordsCount)} laporan.`;
    }

    if (level === 'district') {
        const regencyName = reference?.kab_kota || 'kabupaten/kota tidak diketahui';
        const provinceName = reference?.provinsi || 'provinsi tidak diketahui';
        return `Kecamatan ${itemName} berada di ${regencyName}, Provinsi ${provinceName}, dengan ${formatCount(recordsCount)} laporan.`;
    }

    if (level === 'subdistrict') {
        const districtName = reference?.kecamatan || 'kecamatan tidak diketahui';
        const regencyName = reference?.kab_kota || 'kabupaten/kota tidak diketahui';
        const provinceName = reference?.provinsi || 'provinsi tidak diketahui';
        return `Kelurahan ${itemName} berada di Kecamatan ${districtName}, ${regencyName}, ${provinceName} dan mencatat ${formatCount(recordsCount)} laporan.`;
    }

    return '';
}

function createDistributionDescription(level, item, records) {
    if (!Array.isArray(records) || !records.length) {
        return '';
    }

    if (level === 'province') {
        const uniqueRegencies = new Set(records.map(record => normalizeName(record?.kab_kota)).filter(Boolean));
        if (uniqueRegencies.size) {
            return `Laporan tersebar di ${formatCount(uniqueRegencies.size)} kabupaten/kota.`;
        }
    }

    if (level === 'regency') {
        const uniqueDistricts = new Set(records.map(record => normalizeName(record?.kecamatan)).filter(Boolean));
        if (uniqueDistricts.size) {
            return `Laporan tercatat pada ${formatCount(uniqueDistricts.size)} kecamatan.`;
        }
    }

    if (level === 'district') {
        const uniqueSubdistricts = new Set(records.map(record => normalizeName(record?.kelurahan_desa)).filter(Boolean));
        if (uniqueSubdistricts.size) {
            return `Laporan berasal dari ${formatCount(uniqueSubdistricts.size)} kelurahan/desa.`;
        }
    }

    return '';
}

function openHierarchyReportsModal({ level, item, records, onNavigate, childLevel, childUnavailableMessage }) {
    if (!simulationModal || !simulationModalContent || !simulationModalTitle) {
        return;
    }

    const itemName = item?.name || 'Wilayah';
    const safeRecords = Array.isArray(records) ? records.slice() : [];
    const totalReports = safeRecords.length || item?.totalReports || 0;
    const totalText = `${formatCount(totalReports)} laporan`;

    simulationModalTitle.textContent = `${itemName} • ${totalText}`;
    simulationModalContent.innerHTML = '';

    if (!safeRecords.length) {
        simulationModalContent.appendChild(createEmptyMessage('Belum ada data detail untuk wilayah ini.'));
    } else {
        const reference = safeRecords[0];
        const description = document.createElement('div');
        description.className = 'mb-4 space-y-2 text-sm text-textdark/70';

        const locationText = createLocationDescription(level, itemName, reference, totalReports);
        if (locationText) {
            const locationParagraph = document.createElement('p');
            locationParagraph.textContent = locationText;
            description.appendChild(locationParagraph);
        }

        const distributionText = createDistributionDescription(level, item, safeRecords);
        if (distributionText) {
            const distributionParagraph = document.createElement('p');
            distributionParagraph.textContent = distributionText;
            description.appendChild(distributionParagraph);
        }

        if (description.childNodes.length) {
            simulationModalContent.appendChild(description);
        }

        if (level !== 'subdistrict') {
            const childItems = getChildItemsForLevel(level, item);
            const summaryList = createChildSummaryList(childItems, childLevel);
            if (summaryList) {
                simulationModalContent.appendChild(summaryList);
            } else if (childUnavailableMessage) {
                const message = document.createElement('p');
                message.className = 'mb-4 rounded-xl border border-dashed border-secondary/30 bg-surface/60 px-4 py-3 text-sm text-secondary';
                message.textContent = childUnavailableMessage;
                simulationModalContent.appendChild(message);
            }
        }

        if (typeof onNavigate === 'function' && childLevel) {
            const actions = document.createElement('div');
            actions.className = 'mb-4 flex justify-end';

            const nextLabel = HIERARCHY_LEVEL_META[childLevel]?.label || 'Wilayah';
            const navigateButton = document.createElement('button');
            navigateButton.type = 'button';
            navigateButton.className = 'inline-flex items-center gap-2 rounded-lg bg-primary/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#041226] shadow-lg shadow-primary/20 transition duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:text-textdark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';
            navigateButton.textContent = `Telusuri ${nextLabel}`;
            navigateButton.addEventListener('click', () => {
                closeSimulationModal();
                onNavigate();
            });

            actions.appendChild(navigateButton);
            simulationModalContent.appendChild(actions);
        }

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'max-h-[55vh] overflow-auto rounded-2xl border border-white/10 bg-surface shadow-inner shadow-black/10';
        tableWrapper.appendChild(createModalTable(safeRecords));
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
    if (!simulationStatusEl || !simulationStatusMessage) {
        return;
    }

    const nextVariant = SIMULATION_STATUS_VARIANTS[variant]
        ? variant
        : 'info';
    const variantConfig = SIMULATION_STATUS_VARIANTS[nextVariant];

    simulationStatusEl.dataset.variant = nextVariant;

    if (variantConfig && Array.isArray(variantConfig.container)) {
        simulationStatusEl.classList.remove(...SIMULATION_STATUS_VARIANT_CLASS_CACHE.container);
        simulationStatusEl.classList.add(...variantConfig.container);
    }

    if (simulationStatusIndicator && variantConfig && Array.isArray(variantConfig.indicator)) {
        simulationStatusIndicator.classList.remove(...SIMULATION_STATUS_VARIANT_CLASS_CACHE.indicator);
        simulationStatusIndicator.classList.add(...variantConfig.indicator);
    }

    simulationStatusMessage.textContent = message;
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

    if (isIngestingSimulation) {
        updateSimulationStatus('Pengiriman data simulasi sebelumnya masih berlangsung. Harap tunggu.', 'info');
        return;
    }

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
    ensureEvaluationSectionInitialized();

    const preparationMessage = `Berhasil membuat ${formatCount(generated.length)} data simulasi. Memulai pengiriman ke jaringan blockchain...`;
    updateSimulationStatus(preparationMessage, 'info');

    const previousControlState = disableSimulationControlsForProcessing();
    isIngestingSimulation = true;

    try {
        const { summary, errors } = await ingestSimulationRecords(generated);

        const hasFailure = BLOCKCHAIN_TARGETS.some(target => {
            const stats = summary[target.id] ?? { success: 0, failure: 0 };
            return (stats.failure ?? 0) > 0;
        });

        if (!hasFailure && errors.length === 0) {
            const successMessage = `Berhasil mengirim ${formatCount(generated.length)} catatan ke seluruh jaringan blockchain.`;
            updateSimulationStatus(successMessage, 'success');
            await showSuccessAlert(successMessage);
        } else {
            const summaryLines = BLOCKCHAIN_TARGETS.map(target => {
                const stats = summary[target.id] ?? { success: 0, failure: 0 };
                const successText = formatCount(stats.success ?? 0);
                const failureText = formatCount(stats.failure ?? 0);
                return `${target.label}: ${successText} berhasil • ${failureText} gagal`;
            });

            if (errors.length) {
                summaryLines.push('Catatan tambahan:');
                errors.forEach(error => {
                    summaryLines.push(`• ${error}`);
                });
            }

            const errorDetails = summaryLines.join('\n');
            updateSimulationStatus('Pengiriman data simulasi selesai dengan beberapa kegagalan.', 'error');
            await showErrorAlert(errorDetails, { title: 'Sebagian transaksi gagal' });
        }
    } catch (error) {
        console.error('Gagal mengirim data simulasi ke blockchain:', error);
        updateSimulationStatus('Terjadi kesalahan saat mengirim data simulasi ke jaringan blockchain.', 'error');
        await showErrorAlert('Terjadi kesalahan saat mengirim data simulasi. Periksa log server untuk detailnya.');
    } finally {
        isIngestingSimulation = false;
        restoreSimulationControls(previousControlState);
    }
}

async function handleNetworkStartupButtonClick() {
    if (!networkStartupButton) {
        return;
    }

    const confirmed = await confirmNetworkStartup();
    if (!confirmed) {
        updateNetworkStartupStatus('idle', 'Perintah penyalaan jaringan dibatalkan.');
        return;
    }

    const originalContent = networkStartupButton.innerHTML;
    networkStartupButton.disabled = true;
    networkStartupButton.classList.add('cursor-not-allowed', 'opacity-60');
    networkStartupButton.innerHTML = '<span class="text-base animate-spin">⚡</span><span>Menyalakan...</span>';

    const startupLoadingMessage = 'Menjalankan perintah penyalaan jaringan...';
    showNetworkOperationOverlay('startup', startupLoadingMessage);
    updateNetworkStartupStatus('loading', startupLoadingMessage);

    try {
        const response = await fetch('/api/start-network', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Server mengembalikan status ${response.status}`);
        }

        const data = await response.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        const successCount = results.filter(result => result?.status === 'success').length;
        const summaryLines = formatNetworkStartupSummary(results);
        const summaryText = summaryLines.join('\n');

        if (!results.length) {
            updateNetworkStartupStatus('error', 'Tidak ada jaringan yang ditemukan untuk dijalankan.');
            await showErrorAlert(summaryText, { title: 'Perintah penyalaan gagal' });
            return;
        }

        if (successCount === results.length) {
            updateNetworkStartupStatus('success', 'Seluruh jaringan berhasil dijalankan.');
            await showSuccessAlert(summaryText, { title: 'Jaringan siap digunakan' });
            return;
        }

        if (successCount > 0) {
            updateNetworkStartupStatus('error', 'Sebagian jaringan gagal dijalankan. Periksa detail pemberitahuan.');
            await showErrorAlert(summaryText, { title: 'Sebagian perintah gagal' });
            return;
        }

        updateNetworkStartupStatus('error', 'Perintah penyalaan jaringan gagal dijalankan.');
        await showErrorAlert(summaryText || 'Perintah penyalaan jaringan gagal dijalankan.');
    } catch (error) {
        console.error('Gagal menyalakan jaringan Fabric:', error);
        updateNetworkStartupStatus('error', 'Perintah penyalaan jaringan gagal. Periksa log server.');
        await showErrorAlert('Gagal menjalankan perintah penyalaan jaringan. Periksa log server untuk detailnya.');
    } finally {
        hideNetworkOperationOverlay();
        networkStartupButton.disabled = false;
        networkStartupButton.classList.remove('cursor-not-allowed', 'opacity-60');
        networkStartupButton.innerHTML = originalContent;
    }
}

async function handleNetworkCheckButtonClick() {
    if (!networkCheckButton) {
        return;
    }

    const originalContent = networkCheckButton.innerHTML;
    networkCheckButton.disabled = true;
    networkCheckButton.classList.add('cursor-not-allowed', 'opacity-60');
    networkCheckButton.innerHTML = '<span class="text-base animate-spin">⟳</span><span>Memeriksa...</span>';

    updateNetworkCheckStatus('loading', 'Pemeriksaan jaringan sedang berjalan...');

    try {
        const response = await fetch('/api/check-network', {
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Server mengembalikan status ${response.status}`);
        }

        const data = await response.json();
        renderNetworkHealthResults(data?.results, {
            checkedAt: data?.checkedAt,
            overallStatus: data?.overallStatus,
        });

        if (data?.error) {
            const errorMessage = typeof data.error === 'string'
                ? data.error
                : 'Pemeriksaan jaringan gagal dijalankan. Periksa log server.';
            updateNetworkCheckStatus('error', errorMessage);
            await showErrorAlert(
                `Gagal menjalankan pemeriksaan jaringan. ${errorMessage}`,
                { title: 'Pemeriksaan jaringan gagal' }
            );
            return;
        }

        const summaryMeta = OVERALL_STATUS_META[data?.overallStatus];
        const successMessage = summaryMeta
            ? summaryMeta.title
            : 'Pemeriksaan jaringan selesai.';
        updateNetworkCheckStatus('success', successMessage);
    } catch (error) {
        console.error('Gagal menjalankan pemeriksaan jaringan:', error);
        updateNetworkCheckStatus('error', 'Pemeriksaan jaringan gagal. Periksa log server.');
        await showErrorAlert('Gagal menjalankan pemeriksaan jaringan. Pastikan jaringan Fabric aktif lalu coba lagi.');
    } finally {
        networkCheckButton.disabled = false;
        networkCheckButton.classList.remove('cursor-not-allowed', 'opacity-60');
        networkCheckButton.innerHTML = originalContent;
    }
}

if (networkStartupButton) {
    updateNetworkStartupStatus('idle', DEFAULT_NETWORK_START_STATUS_MESSAGE);
    networkStartupButton.addEventListener('click', handleNetworkStartupButtonClick);
} else {
    updateNetworkStartupStatus('idle', DEFAULT_NETWORK_START_STATUS_MESSAGE);
}

if (networkCheckButton) {
    updateNetworkCheckStatus('idle', DEFAULT_NETWORK_STATUS_MESSAGE);
    networkCheckButton.addEventListener('click', handleNetworkCheckButtonClick);
} else {
    updateNetworkCheckStatus('idle', DEFAULT_NETWORK_STATUS_MESSAGE);
}

async function handleNetworkShutdownButtonClick() {
    if (!networkShutdownButton) {
        return;
    }

    const confirmed = await confirmNetworkShutdown();
    if (!confirmed) {
        updateNetworkShutdownStatus('idle', 'Perintah pemadaman jaringan dibatalkan.');
        return;
    }

    const originalContent = networkShutdownButton.innerHTML;
    networkShutdownButton.disabled = true;
    networkShutdownButton.classList.add('cursor-not-allowed', 'opacity-60');
    networkShutdownButton.innerHTML = '<span class="text-base animate-pulse">⏻</span><span>Mematikan...</span>';

    const shutdownLoadingMessage = 'Menjalankan perintah pemadaman jaringan...';
    showNetworkOperationOverlay('shutdown', shutdownLoadingMessage);
    updateNetworkShutdownStatus('loading', shutdownLoadingMessage);

    try {
        const response = await fetch('/api/shutdown-network', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Server mengembalikan status ${response.status}`);
        }

        const data = await response.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        const successCount = results.filter(result => result?.status === 'success').length;
        const summaryLines = formatNetworkShutdownSummary(results);
        const summaryText = summaryLines.join('\n');

        if (!results.length) {
            updateNetworkShutdownStatus('error', 'Tidak ada jaringan yang ditemukan untuk dimatikan.');
            await showErrorAlert(summaryText, { title: 'Perintah pemadaman gagal' });
            return;
        }

        if (successCount === results.length) {
            updateNetworkShutdownStatus('success', 'Seluruh jaringan berhasil dimatikan.');
            await showSuccessAlert(summaryText, { title: 'Jaringan berhasil dimatikan' });
            return;
        }

        if (successCount > 0) {
            updateNetworkShutdownStatus('error', 'Sebagian jaringan gagal dimatikan. Periksa detail pemberitahuan.');
            await showErrorAlert(summaryText, { title: 'Sebagian perintah gagal' });
            return;
        }

        updateNetworkShutdownStatus('error', 'Perintah pemadaman jaringan gagal dijalankan.');
        await showErrorAlert(summaryText || 'Perintah pemadaman jaringan gagal dijalankan.');
    } catch (error) {
        console.error('Gagal mematikan jaringan Fabric:', error);
        updateNetworkShutdownStatus('error', 'Perintah pemadaman jaringan gagal. Periksa log server.');
        await showErrorAlert('Gagal menjalankan perintah pemadaman jaringan. Periksa log server untuk detailnya.');
    } finally {
        hideNetworkOperationOverlay();
        networkShutdownButton.disabled = false;
        networkShutdownButton.classList.remove('cursor-not-allowed', 'opacity-60');
        networkShutdownButton.innerHTML = originalContent;
    }
}

if (networkShutdownButton) {
    updateNetworkShutdownStatus('idle', DEFAULT_NETWORK_SHUTDOWN_STATUS_MESSAGE);
    networkShutdownButton.addEventListener('click', handleNetworkShutdownButtonClick);
} else {
    updateNetworkShutdownStatus('idle', DEFAULT_NETWORK_SHUTDOWN_STATUS_MESSAGE);
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
        if (isIngestingSimulation) {
            updateSimulationStatus('Tunggu hingga proses pengiriman data selesai sebelum menghapus simulasi.', 'info');
            return;
        }

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
        resetEvaluationStats();
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
    ensureEvaluationSectionInitialized();
    resetEvaluationStats();

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

});
