const DEFAULT_MESSAGES = {
    start: 'Belum ada perintah start yang dijalankan.',
    shutdown: 'Belum ada perintah shutdown yang dijalankan.',
    check: 'Belum ada pemeriksaan jaringan yang dijalankan.',
    restart: 'Belum ada perintah restart yang dijalankan.',
};

const ACTION_METADATA = {
    start: {
        badge: 'Start jaringan',
        title: 'Nyalakan semua jaringan',
        description: 'Menjalankan perintah start untuk seluruh jaringan Fabric 2 & Fabric 3.',
    },
    shutdown: {
        badge: 'Shutdown jaringan',
        title: 'Matikan semua jaringan',
        description: 'Menghentikan seluruh layanan dan kontainer RAFT yang sedang berjalan.',
    },
    check: {
        badge: 'Pemeriksaan jaringan',
        title: 'Periksa kesehatan jaringan',
        description: 'Mengambil status kesehatan terbaru dari semua jaringan RAFT.',
    },
    restart: {
        badge: 'Restart jaringan',
        title: 'Restart semua jaringan',
        description: 'Menjalankan shutdown lalu start ulang seluruh jaringan secara otomatis.',
    },
};

const STATUS_TRANSLATIONS = {
    success: 'berhasil',
    error: 'gagal',
    warning: 'peringatan',
    skipped: 'dilewati',
    running: 'sedang berjalan',
    partial: 'sebagian berhasil',
    healthy: 'sehat',
};

const previewElements = {
    start: document.querySelector('[data-status-preview="start"]'),
    shutdown: document.querySelector('[data-status-preview="shutdown"]'),
    check: document.querySelector('[data-status-preview="check"]'),
    restart: document.querySelector('[data-status-preview="restart"]'),
};

Object.entries(previewElements).forEach(([key, element]) => {
    if (!element) {
        return;
    }
    element.dataset.variant = 'idle';
    element.textContent = DEFAULT_MESSAGES[key] || DEFAULT_MESSAGES.start;
});

const buttons = {
    start: document.getElementById('startAllButton'),
    shutdown: document.getElementById('shutdownAllButton'),
    check: document.getElementById('checkAllButton'),
    restart: document.getElementById('restartAllButton'),
};

const modalRoot = document.getElementById('actionModal');
const modalBadge = document.getElementById('actionModalBadge');
const modalTitle = document.getElementById('actionModalTitle');
const modalDescription = document.getElementById('actionModalDescription');
const modalBody = document.getElementById('actionModalBody');
const modalCloseButtons = Array.from(document.querySelectorAll('[data-modal-close]'));
const modalBackdrop = modalRoot ? modalRoot.querySelector('[data-modal-backdrop]') : null;
const modalContent = modalRoot ? modalRoot.querySelector('[role="dialog"]') : null;

let modalSummarySection = null;
let modalExtraSections = [];
let previousBodyOverflow = '';

function isModalOpen() {
    return Boolean(modalRoot) && !modalRoot.classList.contains('hidden');
}

function resetModalContent() {
    modalSummarySection = null;
    modalExtraSections = [];
    if (modalBody) {
        modalBody.innerHTML = '';
    }
}

function renderModalSections() {
    if (!modalBody) {
        return;
    }

    const nodes = [];
    if (modalSummarySection) {
        nodes.push(modalSummarySection);
    }
    if (modalExtraSections.length) {
        nodes.push(...modalExtraSections);
    }

    if (nodes.length === 0) {
        modalBody.innerHTML = '';
        return;
    }

    modalBody.replaceChildren(...nodes);
}

function createModalSection({ sectionTitle, message, variant = 'idle', details = [], content = null }) {
    const section = document.createElement('section');
    section.className = 'space-y-4';

    if (sectionTitle) {
        const heading = document.createElement('h3');
        heading.className = 'text-sm font-semibold text-textdark';
        heading.textContent = sectionTitle;
        section.appendChild(heading);
    }

    if (message) {
        const alert = document.createElement('div');
        alert.className = 'modal-alert';
        alert.dataset.variant = variant;
        alert.textContent = message;
        section.appendChild(alert);
    }

    if (Array.isArray(details) && details.length) {
        const list = document.createElement('ul');
        list.className = 'list-disc space-y-2 pl-5 text-xs leading-relaxed text-textdark/80';
        details.forEach((line) => {
            if (!line) {
                return;
            }
            const item = document.createElement('li');
            item.textContent = line;
            list.appendChild(item);
        });

        if (list.childElementCount > 0) {
            section.appendChild(list);
        }
    }

    if (content instanceof Node) {
        section.appendChild(content);
    }

    return section;
}

function setModalSummary(state) {
    if (!modalBody) {
        return;
    }

    modalSummarySection = createModalSection(state);
    renderModalSections();
}

function appendModalSection(state) {
    if (!modalBody) {
        return;
    }

    const section = createModalSection(state);
    modalExtraSections.push(section);
    renderModalSections();
}

function configureModalHeader(action) {
    const config = ACTION_METADATA[action] || {};
    if (modalBadge) {
        modalBadge.textContent = config.badge || 'Aksi jaringan';
    }
    if (modalTitle) {
        modalTitle.textContent = config.title || 'Status aksi jaringan';
    }
    if (modalDescription) {
        modalDescription.textContent = config.description
            || 'Ikuti perkembangan aksi jaringan melalui ringkasan berikut.';
    }
}

function openActionModal(action) {
    if (!modalRoot) {
        return;
    }

    configureModalHeader(action);
    resetModalContent();

    modalRoot.classList.remove('hidden');
    modalRoot.setAttribute('aria-hidden', 'false');

    if (document.body) {
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }

    if (modalContent && typeof modalContent.focus === 'function') {
        modalContent.focus({ preventScroll: true });
    }
}

function closeActionModal() {
    if (!modalRoot || !isModalOpen()) {
        return;
    }

    modalRoot.classList.add('hidden');
    modalRoot.setAttribute('aria-hidden', 'true');

    if (document.body) {
        document.body.style.overflow = previousBodyOverflow || '';
        previousBodyOverflow = '';
    }
}

modalCloseButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
        event.preventDefault();
        closeActionModal();
    });
});

if (modalBackdrop) {
    modalBackdrop.addEventListener('click', () => {
        closeActionModal();
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isModalOpen()) {
        closeActionModal();
    }
});

function setPreview(type, variant, message) {
    const element = previewElements[type];
    if (!element) {
        return;
    }

    element.dataset.variant = variant || 'idle';
    const fallback = DEFAULT_MESSAGES[type] || DEFAULT_MESSAGES.start;
    element.textContent = message || fallback;
}

function setButtonLoading(button, loadingLabel) {
    if (!button) {
        return () => {};
    }

    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `
        <span class="inline-flex items-center gap-2">
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"></span>
            <span>${loadingLabel}</span>
        </span>
    `;

    return () => {
        button.disabled = false;
        button.innerHTML = original;
    };
}

function translateStatus(status) {
    if (!status) {
        return 'tidak diketahui';
    }
    return STATUS_TRANSLATIONS[status] || status;
}

function buildResultLines(results) {
    if (!Array.isArray(results) || results.length === 0) {
        return [];
    }

    return results.map((result) => {
        const label = result?.label || result?.targetId || 'Jaringan';
        const statusLabel = translateStatus(result?.status);
        if (result?.message) {
            return `${label}: ${statusLabel} — ${result.message}`;
        }
        return `${label}: ${statusLabel}`;
    });
}

async function requestJson(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    const config = { ...options, headers };

    const response = await fetch(url, config);
    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            console.error('Gagal mengurai respons JSON:', error);
        }
    }

    if (!response.ok) {
        const message = data?.error || `Permintaan gagal dengan status ${response.status}`;
        const error = new Error(message);
        error.data = data;
        throw error;
    }

    return data;
}

function formatDateTime(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

const BADGE_BASE_CLASS = 'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]';

function mapStatusToBadge(status) {
    switch (status) {
    case 'healthy':
        return { label: 'Sehat', className: `${BADGE_BASE_CLASS} border-emerald-400/50 bg-emerald-400/20 text-emerald-200` };
    case 'unhealthy':
    case 'error':
        return { label: 'Gangguan', className: `${BADGE_BASE_CLASS} border-rose-400/50 bg-rose-400/20 text-rose-200` };
    case 'partial':
    case 'warning':
        return { label: 'Sebagian', className: `${BADGE_BASE_CLASS} border-amber-400/50 bg-amber-400/20 text-amber-200` };
    case 'not_found':
        return { label: 'Tidak ditemukan', className: `${BADGE_BASE_CLASS} border-white/15 bg-white/10 text-textdark/70` };
    default:
        return { label: status || 'Tidak diketahui', className: `${BADGE_BASE_CLASS} border-white/15 bg-white/10 text-textdark/70` };
    }
}

function createCheckResultsContent(data) {
    if (!data) {
        return null;
    }

    const fragment = document.createDocumentFragment();

    if (data.checkedAt) {
        const timestamp = document.createElement('p');
        timestamp.className = 'text-xs text-textdark/60';
        timestamp.textContent = `Terakhir diperiksa: ${formatDateTime(data.checkedAt) ?? 'tidak diketahui'}`;
        fragment.appendChild(timestamp);
    }

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
        const empty = document.createElement('p');
        empty.className = 'text-xs text-textdark/60';
        empty.textContent = 'Pemeriksaan selesai tanpa data jaringan.';
        fragment.appendChild(empty);
        return fragment;
    }

    const list = document.createElement('div');
    list.className = 'grid gap-4';
    fragment.appendChild(list);

    results.forEach((result) => {
        const card = document.createElement('article');
        card.className = 'rounded-2xl border border-white/10 bg-surfaceMuted/80 p-6 text-sm text-textdark/80 shadow-inner shadow-black/10';
        list.appendChild(card);

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-4';
        card.appendChild(header);

        const title = document.createElement('h3');
        title.className = 'text-base font-semibold text-textdark';
        title.textContent = result?.label || result?.networkDir || 'Jaringan';
        header.appendChild(title);

        const badgeInfo = mapStatusToBadge(result?.status);
        const badge = document.createElement('span');
        badge.className = badgeInfo.className;
        badge.textContent = badgeInfo.label;
        header.appendChild(badge);

        const content = document.createElement('div');
        content.className = 'mt-4 space-y-3';
        card.appendChild(content);

        if (result?.message) {
            const message = document.createElement('p');
            message.className = 'text-sm text-textdark/70';
            message.textContent = result.message;
            content.appendChild(message);
        }

        const metaLines = [];
        if (result?.networkDir) {
            metaLines.push(`Direktori: ${result.networkDir}`);
        }
        if (result?.channel) {
            metaLines.push(`Channel: ${result.channel}`);
        }
        if (result?.chaincode) {
            metaLines.push(`Chaincode: ${result.chaincode}`);
        }
        if (typeof result?.blockCount === 'number') {
            metaLines.push(`Jumlah blok: ${result.blockCount}`);
        } else if (typeof result?.blockNumber === 'number') {
            metaLines.push(`Jumlah blok: ${result.blockNumber}`);
        }

        if (metaLines.length) {
            const meta = document.createElement('ul');
            meta.className = 'list-disc space-y-1 pl-5 text-xs text-textdark/60';
            metaLines.forEach((line) => {
                const row = document.createElement('li');
                row.textContent = line;
                meta.appendChild(row);
            });
            content.appendChild(meta);
        }

        if (Array.isArray(result?.instructions) && result.instructions.length) {
            const instructions = document.createElement('ul');
            instructions.className = 'list-disc space-y-1 pl-5 text-xs text-textdark/60';
            result.instructions.forEach((instruction) => {
                if (!instruction) {
                    return;
                }
                const li = document.createElement('li');
                li.textContent = instruction;
                instructions.appendChild(li);
            });
            if (instructions.childElementCount > 0) {
                content.appendChild(instructions);
            }
        }
    });

    return fragment;
}

function variantFromOverallStatus(status) {
    if (status === 'success') {
        return 'success';
    }
    if (status === 'partial') {
        return 'warning';
    }
    return 'error';
}

function variantFromCheckStatus(status) {
    if (status === 'healthy') {
        return 'success';
    }
    if (status === 'partial') {
        return 'warning';
    }
    return 'error';
}

async function startAllNetworks() {
    const restore = setButtonLoading(buttons.start, 'Menyalakan...');
    setPreview('start', 'loading', 'Perintah start sedang dijalankan...');
    openActionModal('start');
    setModalSummary({
        variant: 'loading',
        message: 'Menyalakan seluruh jaringan RAFT...',
    });

    try {
        const data = await requestJson('/api/start-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const lines = buildResultLines(data?.results);
        if (data?.overallStatus === 'success') {
            setPreview('start', 'success', 'Semua jaringan aktif.');
            setModalSummary({
                variant: 'success',
                message: 'Seluruh jaringan berhasil dinyalakan.',
                details: lines,
            });
        } else if (data?.overallStatus === 'partial') {
            setPreview('start', 'warning', 'Sebagian jaringan aktif.');
            setModalSummary({
                variant: 'warning',
                message: 'Beberapa jaringan berhasil dinyalakan.',
                details: lines,
            });
        } else {
            const message = data?.error || 'Perintah start gagal dijalankan.';
            setPreview('start', 'error', message);
            setModalSummary({
                variant: 'error',
                message,
                details: lines,
            });
        }
    } catch (error) {
        const lines = buildResultLines(error?.data?.results);
        const message = error?.message || 'Gagal menjalankan perintah start.';
        setPreview('start', 'error', message);
        setModalSummary({
            variant: 'error',
            message,
            details: lines,
        });
    } finally {
        restore();
    }
}

async function shutdownAllNetworks() {
    const restore = setButtonLoading(buttons.shutdown, 'Mematikan...');
    setPreview('shutdown', 'loading', 'Perintah shutdown sedang dijalankan...');
    openActionModal('shutdown');
    setModalSummary({
        variant: 'loading',
        message: 'Mematikan seluruh jaringan RAFT...',
    });

    try {
        const data = await requestJson('/api/shutdown-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const lines = buildResultLines(data?.results);
        if (data?.overallStatus === 'success') {
            setPreview('shutdown', 'success', 'Semua jaringan berhasil dimatikan.');
            setModalSummary({
                variant: 'success',
                message: 'Seluruh jaringan berhasil dimatikan.',
                details: lines,
            });
        } else if (data?.overallStatus === 'partial') {
            setPreview('shutdown', 'warning', 'Sebagian jaringan berhasil dimatikan.');
            setModalSummary({
                variant: 'warning',
                message: 'Sebagian jaringan berhasil dimatikan.',
                details: lines,
            });
        } else {
            const message = data?.error || 'Perintah shutdown gagal dijalankan.';
            setPreview('shutdown', 'error', message);
            setModalSummary({
                variant: 'error',
                message,
                details: lines,
            });
        }
    } catch (error) {
        const lines = buildResultLines(error?.data?.results);
        const message = error?.message || 'Gagal menjalankan perintah shutdown.';
        setPreview('shutdown', 'error', message);
        setModalSummary({
            variant: 'error',
            message,
            details: lines,
        });
    } finally {
        restore();
    }
}

async function checkAllNetworks() {
    const restore = setButtonLoading(buttons.check, 'Memeriksa...');
    setPreview('check', 'loading', 'Sedang memeriksa jaringan...');
    openActionModal('check');
    setModalSummary({
        variant: 'loading',
        message: 'Sedang memeriksa seluruh jaringan RAFT...',
    });

    try {
        const data = await requestJson('/api/check-network', { method: 'GET' });

        const lines = buildResultLines(data?.results);
        const overallStatus = data?.overallStatus || 'success';

        if (overallStatus === 'healthy' || overallStatus === 'success') {
            setPreview('check', 'success', 'Semua jaringan merespons baik.');
            setModalSummary({
                variant: 'success',
                message: 'Seluruh jaringan merespons dengan baik.',
                details: lines,
            });
        } else if (overallStatus === 'partial') {
            setPreview('check', 'warning', 'Sebagian jaringan merespons baik.');
            setModalSummary({
                variant: 'warning',
                message: 'Sebagian jaringan merespons dengan baik.',
                details: lines,
            });
        } else {
            const message = data?.error || 'Jaringan tidak merespons dengan baik.';
            setPreview('check', 'error', message);
            setModalSummary({
                variant: variantFromCheckStatus(overallStatus),
                message,
                details: lines,
            });
        }

        const detailContent = createCheckResultsContent(data);
        if (detailContent) {
            appendModalSection({
                sectionTitle: 'Detail pemeriksaan jaringan',
                content: detailContent,
            });
        }
    } catch (error) {
        const message = error?.message || 'Gagal memeriksa jaringan.';
        setPreview('check', 'error', message);
        setModalSummary({
            variant: 'error',
            message,
        });
    } finally {
        restore();
    }
}

async function restartAllNetworks() {
    const restore = setButtonLoading(buttons.restart, 'Memulai ulang...');
    setPreview('restart', 'loading', 'Perintah restart sedang dijalankan...');
    openActionModal('restart');
    setModalSummary({
        variant: 'loading',
        message: 'Melakukan restart seluruh jaringan RAFT...',
    });

    try {
        setPreview('shutdown', 'loading', 'Mematikan jaringan sebelum restart...');
        const shutdownData = await requestJson('/api/shutdown-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const shutdownLines = buildResultLines(shutdownData?.results);
        const shutdownVariant = variantFromOverallStatus(shutdownData?.overallStatus);
        const shutdownMessage = shutdownData?.overallStatus === 'success'
            ? 'Seluruh jaringan berhasil dimatikan.'
            : shutdownData?.overallStatus === 'partial'
                ? 'Sebagian jaringan berhasil dimatikan.'
                : shutdownData?.error || 'Gagal mematikan jaringan.';

        setPreview('shutdown', shutdownVariant, shutdownMessage);
        appendModalSection({
            sectionTitle: 'Langkah 1 · Matikan jaringan',
            variant: shutdownVariant,
            message: shutdownMessage,
            details: shutdownLines,
        });

        if (shutdownData?.overallStatus !== 'success') {
            const finalVariant = shutdownVariant === 'warning' ? 'warning' : 'error';
            const finalMessage = shutdownVariant === 'warning'
                ? 'Restart dihentikan karena hanya sebagian jaringan berhasil dimatikan.'
                : 'Restart gagal pada tahap mematikan jaringan.';

            setPreview('restart', finalVariant, finalMessage);
            setModalSummary({
                variant: finalVariant,
                message: finalMessage,
                details: shutdownLines,
            });
            return;
        }

        setPreview('start', 'loading', 'Menyalakan jaringan kembali...');
        const startupData = await requestJson('/api/start-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const startupLines = buildResultLines(startupData?.results);
        const startupVariant = variantFromOverallStatus(startupData?.overallStatus);
        const startupMessage = startupData?.overallStatus === 'success'
            ? 'Seluruh jaringan berhasil dinyalakan kembali.'
            : startupData?.overallStatus === 'partial'
                ? 'Sebagian jaringan berhasil dinyalakan kembali.'
                : startupData?.error || 'Gagal menyalakan jaringan kembali.';

        setPreview('start', startupVariant, startupMessage);
        appendModalSection({
            sectionTitle: 'Langkah 2 · Nyalakan jaringan',
            variant: startupVariant,
            message: startupMessage,
            details: startupLines,
        });

        const summaryDetails = [
            `Shutdown: ${translateStatus(shutdownData?.overallStatus || 'error')}`,
            `Start: ${translateStatus(startupData?.overallStatus || 'error')}`,
        ];

        if (startupData?.overallStatus === 'success') {
            setPreview('restart', 'success', 'Restart jaringan selesai.');
            setModalSummary({
                variant: 'success',
                message: 'Restart jaringan selesai dengan sukses.',
                details: summaryDetails,
            });
        } else if (startupData?.overallStatus === 'partial') {
            setPreview('restart', 'warning', 'Restart selesai namun sebagian jaringan bermasalah.');
            setModalSummary({
                variant: 'warning',
                message: 'Restart selesai namun sebagian jaringan bermasalah.',
                details: summaryDetails,
            });
        } else {
            const message = startupData?.error || 'Restart gagal saat menyalakan ulang jaringan.';
            setPreview('restart', 'error', message);
            setModalSummary({
                variant: 'error',
                message,
                details: summaryDetails,
            });
        }
    } catch (error) {
        const message = error?.message || 'Restart jaringan gagal.';
        setPreview('restart', 'error', message);
        setModalSummary({
            variant: 'error',
            message,
        });
    } finally {
        restore();
    }
}

if (buttons.start) {
    buttons.start.addEventListener('click', startAllNetworks);
}

if (buttons.shutdown) {
    buttons.shutdown.addEventListener('click', shutdownAllNetworks);
}

if (buttons.check) {
    buttons.check.addEventListener('click', checkAllNetworks);
}

if (buttons.restart) {
    buttons.restart.addEventListener('click', restartAllNetworks);
}
