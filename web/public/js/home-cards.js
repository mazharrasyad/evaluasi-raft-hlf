const DEFAULT_MESSAGES = {
    start: 'Belum ada perintah start yang dijalankan.',
    shutdown: 'Belum ada perintah shutdown yang dijalankan.',
    check: 'Belum ada pemeriksaan jaringan yang dijalankan.',
    restart: 'Belum ada perintah restart yang dijalankan.',
};

const STATUS_BASE_CLASS = 'rounded-2xl border px-5 py-4 text-sm leading-relaxed shadow-inner shadow-black/10';
const STATUS_LABEL_CLASS = 'text-[0.65rem] font-semibold uppercase tracking-[0.35em] opacity-80';
const STATUS_MESSAGE_CLASS = 'mt-2 text-sm leading-relaxed';
const STATUS_LIST_CLASS = 'mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed opacity-90';

const ALERT_VARIANTS = {
    idle: 'border-white/10 bg-surfaceMuted/60 text-textdark/70',
    loading: 'border-secondary/50 bg-secondary/20 text-secondary',
    success: 'border-emerald-400/50 bg-emerald-400/20 text-emerald-200',
    error: 'border-rose-400/60 bg-rose-400/20 text-rose-200',
    warning: 'border-amber-400/50 bg-amber-400/20 text-amber-200',
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

const statusElements = {
    start: document.getElementById('startStatus'),
    shutdown: document.getElementById('shutdownStatus'),
    check: document.getElementById('checkStatus'),
    restart: document.getElementById('restartStatus'),
};

const buttons = {
    start: document.getElementById('startAllButton'),
    shutdown: document.getElementById('shutdownAllButton'),
    check: document.getElementById('checkAllButton'),
    restart: document.getElementById('restartAllButton'),
};

const checkResultsContainer = document.getElementById('checkResults');

Object.entries(statusElements).forEach(([key, element]) => {
    if (!element) {
        return;
    }
    element.className = `${STATUS_BASE_CLASS} ${ALERT_VARIANTS.idle}`;
    element.innerHTML = `
        <div class="${STATUS_LABEL_CLASS}">Status</div>
        <p class="${STATUS_MESSAGE_CLASS}">${DEFAULT_MESSAGES[key] || DEFAULT_MESSAGES.start}</p>
    `;
});

function setStatus(type, variant, message, details = []) {
    const element = statusElements[type];
    if (!element) {
        return;
    }

    const variantClass = ALERT_VARIANTS[variant] || ALERT_VARIANTS.idle;
    element.className = `${STATUS_BASE_CLASS} ${variantClass}`;

    const fragment = document.createDocumentFragment();

    const label = document.createElement('div');
    label.className = STATUS_LABEL_CLASS;
    label.textContent = 'Status';
    fragment.appendChild(label);

    const messageEl = document.createElement('p');
    messageEl.className = STATUS_MESSAGE_CLASS;
    messageEl.textContent = message;
    fragment.appendChild(messageEl);

    if (Array.isArray(details) && details.length) {
        const list = document.createElement('ul');
        list.className = STATUS_LIST_CLASS;
        details.forEach(line => {
            if (!line) {
                return;
            }
            const item = document.createElement('li');
            item.textContent = line;
            list.appendChild(item);
        });
        if (list.childElementCount > 0) {
            fragment.appendChild(list);
        }
    }

    element.replaceChildren(fragment);
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

    return results.map(result => {
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

async function startAllNetworks() {
    const restore = setButtonLoading(buttons.start, 'Menyalakan...');
    setStatus('start', 'loading', 'Menyalakan seluruh jaringan RAFT...');

    try {
        const data = await requestJson('/api/start-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const lines = buildResultLines(data?.results);
        if (data?.overallStatus === 'success') {
            setStatus('start', 'success', 'Seluruh jaringan berhasil dinyalakan.', lines);
        } else if (data?.overallStatus === 'partial') {
            setStatus('start', 'warning', 'Beberapa jaringan berhasil dinyalakan.', lines);
        } else {
            const message = data?.error || 'Perintah start gagal dijalankan.';
            setStatus('start', 'error', message, lines);
        }
    } catch (error) {
        const lines = buildResultLines(error?.data?.results);
        setStatus('start', 'error', error?.message || 'Gagal menjalankan perintah start.', lines);
    } finally {
        restore();
    }
}

async function shutdownAllNetworks() {
    const restore = setButtonLoading(buttons.shutdown, 'Mematikan...');
    setStatus('shutdown', 'loading', 'Mematikan seluruh jaringan RAFT...');

    try {
        const data = await requestJson('/api/shutdown-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const lines = buildResultLines(data?.results);
        if (data?.overallStatus === 'success') {
            setStatus('shutdown', 'success', 'Seluruh jaringan berhasil dimatikan.', lines);
        } else if (data?.overallStatus === 'partial') {
            setStatus('shutdown', 'warning', 'Sebagian jaringan berhasil dimatikan.', lines);
        } else {
            const message = data?.error || 'Perintah shutdown gagal dijalankan.';
            setStatus('shutdown', 'error', message, lines);
        }
    } catch (error) {
        const lines = buildResultLines(error?.data?.results);
        setStatus('shutdown', 'error', error?.message || 'Gagal menjalankan perintah shutdown.', lines);
    } finally {
        restore();
    }
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

function renderCheckResults(data) {
    if (!checkResultsContainer) {
        return;
    }

    checkResultsContainer.innerHTML = '';

    if (!data) {
        return;
    }

    if (data.checkedAt) {
        const timestamp = document.createElement('p');
        timestamp.className = 'text-xs text-textdark/60';
        timestamp.textContent = `Terakhir diperiksa: ${formatDateTime(data.checkedAt) ?? 'tidak diketahui'}`;
        checkResultsContainer.appendChild(timestamp);
    }

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
        const empty = document.createElement('p');
        empty.className = 'text-xs text-textdark/60';
        empty.textContent = 'Pemeriksaan selesai tanpa data jaringan.';
        checkResultsContainer.appendChild(empty);
        return;
    }

    const list = document.createElement('div');
    list.className = 'grid gap-4';
    checkResultsContainer.appendChild(list);

    results.forEach(result => {
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
            metaLines.forEach(line => {
                const row = document.createElement('li');
                row.textContent = line;
                meta.appendChild(row);
            });
            content.appendChild(meta);
        }

        if (Array.isArray(result?.instructions) && result.instructions.length) {
            const instructions = document.createElement('ul');
            instructions.className = 'list-disc space-y-1 pl-5 text-xs text-textdark/60';
            result.instructions.forEach(instruction => {
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
}

async function checkAllNetworks() {
    const restore = setButtonLoading(buttons.check, 'Memeriksa...');
    setStatus('check', 'loading', 'Sedang memeriksa seluruh jaringan...');
    renderCheckResults(null);

    try {
        const data = await requestJson('/api/check-network', { method: 'GET' });

        const lines = buildResultLines(data?.results);
        if (data?.overallStatus === 'healthy') {
            setStatus('check', 'success', 'Seluruh jaringan merespons dengan baik.', lines);
        } else if (data?.overallStatus === 'partial') {
            setStatus('check', 'warning', 'Sebagian jaringan merespons dengan baik.', lines);
        } else if (data?.overallStatus) {
            setStatus('check', 'error', 'Jaringan tidak merespons dengan baik.', lines);
        } else {
            setStatus('check', 'success', 'Pemeriksaan jaringan selesai.', lines);
        }

        renderCheckResults(data);
    } catch (error) {
        setStatus('check', 'error', error?.message || 'Gagal memeriksa jaringan.');
        renderCheckResults(null);
    } finally {
        restore();
    }
}

async function restartAllNetworks() {
    const restore = setButtonLoading(buttons.restart, 'Memulai ulang...');
    setStatus('restart', 'loading', 'Melakukan restart seluruh jaringan RAFT...');

    try {
        setStatus('shutdown', 'loading', 'Mematikan jaringan sebagai bagian dari restart...');
        const shutdownData = await requestJson('/api/shutdown-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const shutdownLines = buildResultLines(shutdownData?.results);
        if (shutdownData?.overallStatus === 'success') {
            setStatus('shutdown', 'success', 'Semua jaringan berhasil dimatikan.', shutdownLines);
        } else if (shutdownData?.overallStatus === 'partial') {
            setStatus('shutdown', 'warning', 'Sebagian jaringan berhasil dimatikan.', shutdownLines);
            throw new Error('Restart dibatalkan karena tidak semua jaringan berhasil dimatikan.');
        } else {
            const message = shutdownData?.error || 'Gagal mematikan jaringan.';
            setStatus('shutdown', 'error', message, shutdownLines);
            throw new Error(message);
        }

        setStatus('start', 'loading', 'Menyalakan jaringan kembali...');
        const startupData = await requestJson('/api/start-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const startupLines = buildResultLines(startupData?.results);
        if (startupData?.overallStatus === 'success') {
            setStatus('start', 'success', 'Semua jaringan berhasil dinyalakan kembali.', startupLines);
            setStatus('restart', 'success', 'Restart jaringan selesai dengan sukses.');
        } else if (startupData?.overallStatus === 'partial') {
            setStatus('start', 'warning', 'Sebagian jaringan berhasil dinyalakan.', startupLines);
            setStatus('restart', 'warning', 'Restart selesai namun sebagian jaringan bermasalah.', startupLines);
        } else {
            const message = startupData?.error || 'Gagal menyalakan jaringan setelah shutdown.';
            setStatus('start', 'error', message, startupLines);
            setStatus('restart', 'error', 'Restart gagal saat menyalakan ulang jaringan.', startupLines);
        }
    } catch (error) {
        setStatus('restart', 'error', error?.message || 'Restart jaringan gagal.');
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
