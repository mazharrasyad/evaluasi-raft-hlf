const yearEl = document.getElementById('currentYear');
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

const hierarchyContainer = document.getElementById('hierarchyContainer');
const hierarchyChartWrapper = document.getElementById('hierarchyChartWrapper');
const hierarchyEmptyState = document.getElementById('hierarchyEmptyState');
const hierarchyChartCanvas = document.getElementById('hierarchyChart');
const hierarchyBreadcrumb = document.getElementById('hierarchyBreadcrumb');
const hierarchyBackButton = document.getElementById('hierarchyBackButton');
const hierarchyTitleEl = document.getElementById('hierarchyTitle');
const hierarchyInstructionEl = document.getElementById('hierarchyInstruction');
const hierarchyChartFallback = document.getElementById('hierarchyChartFallback');
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
let isModalOpen = false;
let lastFocusedElement = null;
let hierarchyChartInstance = null;
let hierarchyStructure = null;
let hierarchyPath = [];
let currentChartItems = [];
let currentViewType = 'province';

const SESSION_STORAGE_KEY = 'simulasiPelaporan';
const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short'
});

const HIERARCHY_LEVEL_LABELS = {
    province: 'Provinsi',
    regency: 'Kabupaten/Kota',
    district: 'Kecamatan',
    subdistrict: 'Kelurahan'
};

const HIERARCHY_INSTRUCTIONS = {
    province: 'Klik batang provinsi untuk melihat kabupaten/kota.',
    regency: 'Klik batang kabupaten/kota untuk melihat kecamatan.',
    district: 'Klik batang kecamatan untuk melihat kelurahan.',
    subdistrict: 'Klik batang kelurahan untuk membuka detail laporannya.'
};

const HIERARCHY_COLOR_PALETTE = [
    '#38BDF8',
    '#6366F1',
    '#F59E0B',
    '#F97316',
    '#34D399',
    '#A855F7',
    '#F472B6',
    '#14B8A6',
    '#FACC15',
    '#60A5FA'
];

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

async function loadWilayahDataset() {
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
        ? 'Gunakan grafik batang hierarkis di bawah untuk memilih provinsi, kabupaten/kota, dan kecamatan. Klik batang kelurahan untuk membuka pop up yang memuat tabel detail laporannya.'
        : 'Setelah membuat data simulasi, gunakan grafik batang hierarkis untuk menelusuri provinsi hingga kelurahan. Klik batang kelurahan untuk membuka pop up berisi detail laporan.';

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

function getHierarchyColors(count) {
    const colors = [];
    for (let i = 0; i < count; i += 1) {
        colors.push(HIERARCHY_COLOR_PALETTE[i % HIERARCHY_COLOR_PALETTE.length]);
    }
    return colors;
}

function buildHierarchyTitle(type) {
    if (type === 'regency') {
        const provinceName = hierarchyPath[0]?.node?.name;
        return provinceName ? `Kabupaten/Kota di ${provinceName}` : 'Kabupaten/Kota';
    }
    if (type === 'district') {
        const regencyName = hierarchyPath[1]?.node?.name;
        return regencyName ? `Kecamatan di ${regencyName}` : 'Kecamatan';
    }
    if (type === 'subdistrict') {
        const districtName = hierarchyPath[2]?.node?.name;
        return districtName ? `Kelurahan di ${districtName}` : 'Kelurahan';
    }
    return 'Persebaran Laporan per Provinsi';
}

function createBreadcrumbChip(text, variant = 'default') {
    const span = document.createElement('span');
    span.textContent = text;
    if (variant === 'selection') {
        span.className = 'inline-flex items-center rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 font-medium text-secondary';
    } else if (variant === 'level') {
        span.className = 'inline-flex items-center rounded-full border border-white/10 bg-soft/20 px-3 py-1 font-medium text-textdark/70';
    } else {
        span.className = 'inline-flex items-center rounded-full border border-white/10 bg-soft/30 px-3 py-1 font-medium text-textdark';
    }
    return span;
}

function createBreadcrumbSeparator() {
    const separator = document.createElement('span');
    separator.className = 'text-textdark/40';
    separator.textContent = '›';
    return separator;
}

function renderHierarchyBreadcrumb(type) {
    if (!hierarchyBreadcrumb) {
        return;
    }

    hierarchyBreadcrumb.innerHTML = '';
    if (!hierarchyStructure) {
        return;
    }

    const fragments = [];
    fragments.push(createBreadcrumbChip('Provinsi', hierarchyPath.length ? 'default' : 'level'));

    hierarchyPath.forEach(entry => {
        fragments.push(createBreadcrumbSeparator());
        fragments.push(createBreadcrumbChip(entry.node.name, 'selection'));
    });

    if (hierarchyPath.length || type !== 'province') {
        fragments.push(createBreadcrumbSeparator());
        const levelLabel = HIERARCHY_LEVEL_LABELS[type] || 'Wilayah';
        fragments.push(createBreadcrumbChip(levelLabel, 'level'));
    }

    fragments.forEach(fragment => hierarchyBreadcrumb.appendChild(fragment));
}

function updateHierarchyInstruction(type, items) {
    if (!hierarchyInstructionEl) {
        return;
    }

    if (!Array.isArray(items) || !items.length) {
        hierarchyInstructionEl.textContent = 'Belum ada data pada tingkat ini.';
        return;
    }

    hierarchyInstructionEl.textContent = HIERARCHY_INSTRUCTIONS[type] || '';
}

function updateBackButtonState() {
    if (!hierarchyBackButton) {
        return;
    }

    hierarchyBackButton.disabled = hierarchyPath.length === 0;
}

function updateHierarchyTitle(type) {
    if (!hierarchyTitleEl) {
        return;
    }

    hierarchyTitleEl.textContent = buildHierarchyTitle(type);
}

function updateHierarchyEmptyState(isEmpty) {
    if (hierarchyEmptyState) {
        hierarchyEmptyState.classList.toggle('hidden', !isEmpty);
    }
    if (hierarchyChartWrapper) {
        hierarchyChartWrapper.classList.toggle('hidden', isEmpty);
    }
    if (isEmpty) {
        hierarchyPath = [];
        hierarchyStructure = null;
        currentChartItems = [];
        currentViewType = 'province';
        if (hierarchyBreadcrumb) {
            hierarchyBreadcrumb.innerHTML = '';
        }
        if (hierarchyTitleEl) {
            hierarchyTitleEl.textContent = buildHierarchyTitle('province');
        }
        if (hierarchyInstructionEl) {
            hierarchyInstructionEl.textContent = HIERARCHY_INSTRUCTIONS.province;
        }
        if (hierarchyBackButton) {
            hierarchyBackButton.disabled = true;
        }
        if (hierarchyChartFallback) {
            hierarchyChartFallback.classList.add('hidden');
        }
        if (hierarchyChartInstance) {
            hierarchyChartInstance.destroy();
            hierarchyChartInstance = null;
        }
    }
}

function getHierarchyView() {
    if (!hierarchyStructure || !Array.isArray(hierarchyStructure.provinces)) {
        return { type: 'province', items: [] };
    }

    if (!hierarchyPath.length) {
        return { type: 'province', items: hierarchyStructure.provinces };
    }

    const lastEntry = hierarchyPath[hierarchyPath.length - 1];
    if (!lastEntry) {
        return { type: 'province', items: hierarchyStructure.provinces };
    }

    if (lastEntry.type === 'province') {
        return { type: 'regency', items: lastEntry.node.regencies || [] };
    }
    if (lastEntry.type === 'regency') {
        return { type: 'district', items: lastEntry.node.districts || [] };
    }
    if (lastEntry.type === 'district') {
        return { type: 'subdistrict', items: lastEntry.node.subdistricts || [] };
    }

    return { type: 'province', items: hierarchyStructure.provinces };
}

function renderHierarchyChart(type, items) {
    if (!hierarchyChartCanvas) {
        return;
    }

    const ChartJS = typeof window !== 'undefined' ? window.Chart : null;
    if (!ChartJS) {
        return;
    }

    currentViewType = type;
    currentChartItems = Array.isArray(items) ? items : [];

    const labels = currentChartItems.map(item => item.name);
    const data = currentChartItems.map(item => item.totalReports);
    const colors = getHierarchyColors(currentChartItems.length);

    if (!hierarchyChartInstance) {
        const context = hierarchyChartCanvas.getContext('2d');
        hierarchyChartInstance = new ChartJS(context, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Jumlah Laporan',
                    data,
                    backgroundColor: colors,
                    borderColor: colors,
                    hoverBackgroundColor: colors,
                    borderWidth: 0,
                    borderRadius: 14,
                    maxBarThickness: 46
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 400
                },
                layout: {
                    padding: {
                        top: 12,
                        right: 16,
                        bottom: 8,
                        left: 8
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(148, 163, 184, 0.35)',
                        borderWidth: 1,
                        titleColor: '#E2E8F0',
                        bodyColor: '#E2E8F0',
                        callbacks: {
                            title(context) {
                                return context[0]?.label || '';
                            },
                            label(context) {
                                const value = context.parsed?.y ?? 0;
                                return `${formatCount(value)} laporan`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#94A3B8',
                            maxRotation: 40,
                            minRotation: 0
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.12)',
                            drawBorder: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#94A3B8',
                            callback(value) {
                                return formatCount(value);
                            }
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.12)',
                            drawBorder: false
                        }
                    }
                },
                onClick(event, elements) {
                    if (!elements || !elements.length) {
                        return;
                    }
                    const { index } = elements[0];
                    const item = currentChartItems[index];
                    handleHierarchySelection(item);
                }
            }
        });
    } else {
        hierarchyChartInstance.data.labels = labels;
        const dataset = hierarchyChartInstance.data.datasets[0];
        dataset.data = data;
        dataset.backgroundColor = colors;
        dataset.borderColor = colors;
        dataset.hoverBackgroundColor = colors;
        hierarchyChartInstance.update();
    }

    if (hierarchyChartFallback) {
        if (currentChartItems.length) {
            hierarchyChartFallback.classList.add('hidden');
        } else {
            hierarchyChartFallback.classList.remove('hidden');
        }
    }
}

function updateHierarchyChartView() {
    const { type, items } = getHierarchyView();
    updateBackButtonState();
    renderHierarchyBreadcrumb(type);
    updateHierarchyTitle(type);
    updateHierarchyInstruction(type, items);
    renderHierarchyChart(type, items);
}

function handleHierarchySelection(item) {
    if (!item) {
        return;
    }

    if (currentViewType === 'province') {
        hierarchyPath.push({ type: 'province', node: item });
        updateHierarchyChartView();
        return;
    }
    if (currentViewType === 'regency') {
        hierarchyPath.push({ type: 'regency', node: item });
        updateHierarchyChartView();
        return;
    }
    if (currentViewType === 'district') {
        hierarchyPath.push({ type: 'district', node: item });
        updateHierarchyChartView();
        return;
    }

    if (currentViewType === 'subdistrict') {
        const records = getRecordsForSubdistrict(item);
        openSubdistrictModal(item, records);
    }
}

if (hierarchyBackButton) {
    hierarchyBackButton.addEventListener('click', () => {
        if (!hierarchyPath.length) {
            return;
        }
        hierarchyPath.pop();
        updateHierarchyChartView();
    });
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

    const { totalReports, provinces } = buildHierarchyFromRecords(records);

    if (totalReportsEl) {
        totalReportsEl.textContent = formatCount(totalReports);
    }

    if (!records.length) {
        updateHierarchyEmptyState(true);
        subdistrictRecordsIndex = new Map();
        return;
    }

    updateHierarchyEmptyState(false);

    subdistrictRecordsIndex = new Map();
    records.forEach(record => {
        const key = sanitizeCode(record.subdistrictId || record.kelurahan_desa);
        if (!key) {
            return;
        }
        const existing = subdistrictRecordsIndex.get(key) || [];
        existing.push(record);
        subdistrictRecordsIndex.set(key, existing);
    });

    hierarchyStructure = {
        totalReports,
        provinces
    };
    hierarchyPath = [];
    updateHierarchyChartView();
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

function handleSimulationSubmit(event) {
    event.preventDefault();

    if (!simulationCountInput) {
        return;
    }

    if (!wilayahDataset || !wilayahDataset.subdistricts.length) {
        updateSimulationStatus('Dataset wilayah belum siap. Tidak dapat membuat data simulasi.', 'error');
        return;
    }

    const requested = Number(simulationCountInput.value);
    const count = Number.isFinite(requested) ? Math.min(Math.max(Math.floor(requested), 1), 1000) : 1;
    simulationCountInput.value = String(count);

    const generated = generateSimulationRecords(count);
    if (!generated.length) {
        updateSimulationStatus('Tidak ada data simulasi yang berhasil dibuat. Coba lagi.', 'error');
        return;
    }

    simulationData = [...simulationData, ...generated];
    saveSimulationDataToSession(simulationData);
    renderSimulationData();
    updateSimulationStatus(`Berhasil membuat ${formatCount(generated.length)} data simulasi.`, 'success');
}

if (simulationForm) {
    simulationForm.addEventListener('submit', handleSimulationSubmit);
}

if (clearSimulationButton) {
    clearSimulationButton.addEventListener('click', () => {
        if (!simulationData.length) {
            updateSimulationStatus('Tidak ada data simulasi yang perlu dihapus.', 'info');
            return;
        }

        const confirmed = window.confirm('Hapus seluruh data simulasi pada session browser? Tindakan ini tidak dapat dibatalkan.');
        if (!confirmed) {
            return;
        }

        simulationData = [];
        saveSimulationDataToSession(simulationData);
        renderSimulationData();
        updateSimulationStatus('Seluruh data simulasi berhasil dihapus.', 'success');
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
