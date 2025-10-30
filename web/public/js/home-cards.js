const DEFAULT_MESSAGES = {
    start: 'Belum ada perintah start yang dijalankan.',
    shutdown: 'Belum ada perintah shutdown yang dijalankan.',
    check: 'Belum ada pemeriksaan jaringan yang dijalankan.',
    restart: 'Belum ada perintah restart yang dijalankan.',
};

const STATUS_BASE_CLASS = 'alert small mb-0';

const ALERT_VARIANTS = {
    idle: 'alert-secondary',
    loading: 'alert-info',
    success: 'alert-success',
    error: 'alert-danger',
    warning: 'alert-warning',
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
        <div class="fw-semibold text-uppercase small mb-1">Status</div>
        <p class="mb-0">${DEFAULT_MESSAGES[key] || DEFAULT_MESSAGES.start}</p>
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
    label.className = 'fw-semibold text-uppercase small mb-1';
    label.textContent = 'Status';
    fragment.appendChild(label);

    const messageEl = document.createElement('p');
    messageEl.className = 'mb-0';
    messageEl.textContent = message;
    fragment.appendChild(messageEl);

    if (Array.isArray(details) && details.length) {
        const list = document.createElement('ul');
        list.className = 'mb-0 mt-2 small ps-3';
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
        <span class="d-inline-flex align-items-center gap-2">
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
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

const BADGE_BASE_CLASS = 'badge rounded-pill';

function mapStatusToBadge(status) {
    switch (status) {
    case 'healthy':
        return { label: 'Sehat', className: `${BADGE_BASE_CLASS} text-bg-success` };
    case 'unhealthy':
    case 'error':
        return { label: 'Gangguan', className: `${BADGE_BASE_CLASS} text-bg-danger` };
    case 'partial':
    case 'warning':
        return { label: 'Sebagian', className: `${BADGE_BASE_CLASS} text-bg-warning text-dark` };
    case 'not_found':
        return { label: 'Tidak ditemukan', className: `${BADGE_BASE_CLASS} text-bg-secondary` };
    default:
        return { label: status || 'Tidak diketahui', className: `${BADGE_BASE_CLASS} text-bg-secondary` };
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
        timestamp.className = 'small text-muted mb-3';
        timestamp.textContent = `Terakhir diperiksa: ${formatDateTime(data.checkedAt) ?? 'tidak diketahui'}`;
        checkResultsContainer.appendChild(timestamp);
    }

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
        const empty = document.createElement('p');
        empty.className = 'small text-muted mb-0';
        empty.textContent = 'Pemeriksaan selesai tanpa data jaringan.';
        checkResultsContainer.appendChild(empty);
        return;
    }

    const list = document.createElement('div');
    list.className = 'row g-3';
    checkResultsContainer.appendChild(list);

    results.forEach(result => {
        const col = document.createElement('div');
        col.className = 'col-12';
        list.appendChild(col);

        const card = document.createElement('div');
        card.className = 'card border-0 shadow-sm';
        col.appendChild(card);

        const body = document.createElement('div');
        body.className = 'card-body';
        card.appendChild(body);

        const header = document.createElement('div');
        header.className = 'd-flex justify-content-between align-items-start gap-2 mb-2';
        body.appendChild(header);

        const title = document.createElement('h3');
        title.className = 'h6 mb-0';
        title.textContent = result?.label || result?.networkDir || 'Jaringan';
        header.appendChild(title);

        const badgeInfo = mapStatusToBadge(result?.status);
        const badge = document.createElement('span');
        badge.className = badgeInfo.className;
        badge.textContent = badgeInfo.label;
        header.appendChild(badge);

        if (result?.message) {
            const message = document.createElement('p');
            message.className = 'small text-body-secondary mb-2';
            message.textContent = result.message;
            body.appendChild(message);
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
            meta.className = 'small text-body-secondary mb-0 ps-3';
            metaLines.forEach(line => {
                const row = document.createElement('li');
                row.textContent = line;
                meta.appendChild(row);
            });
            body.appendChild(meta);
        }

        if (Array.isArray(result?.instructions) && result.instructions.length) {
            const instructions = document.createElement('ul');
            instructions.className = 'small text-body-secondary mb-0 mt-3 ps-3';
            result.instructions.forEach(instruction => {
                if (!instruction) {
                    return;
                }
                const li = document.createElement('li');
                li.textContent = instruction;
                instructions.appendChild(li);
            });
            if (instructions.childElementCount > 0) {
                body.appendChild(instructions);
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
