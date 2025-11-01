const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    const summaryGrid = document.getElementById('networkSummaryGrid');
    const comparisonSummary = document.getElementById('comparisonSummary');
    const ordererComparison = document.getElementById('ordererComparison');
    const peerComparison = document.getElementById('peerComparison');
    const updatedAtEl = document.getElementById('comparisonUpdatedAt');

    const PLACEHOLDER_VARIANTS = {
        info: 'border-white/10 bg-surfaceMuted/70 text-textdark/70',
        error: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
        empty: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    };

    const NETWORK_META = {
        'raft-standard': {
            title: 'Fabric 2 — RAFT Standard',
            scopeLabel: 'Fabric 2',
            variantLabel: 'RAFT Standard',
            badgeClass: 'border-secondary/40 bg-secondary/15 text-secondary/90',
        },
        'raft-variant': {
            title: 'Fabric 2 — RAFT Variant',
            scopeLabel: 'Fabric 2',
            variantLabel: 'RAFT Variant',
            badgeClass: 'border-highlight/40 bg-highlight/15 text-highlight/90',
        },
        'fabric3-raft-standard': {
            title: 'Fabric 3 — RAFT Standard',
            scopeLabel: 'Fabric 3',
            variantLabel: 'RAFT Standard',
            badgeClass: 'border-accent/40 bg-accent/15 text-accent/90',
        },
        'fabric3-raft-variant': {
            title: 'Fabric 3 — RAFT Variant',
            scopeLabel: 'Fabric 3',
            variantLabel: 'RAFT Variant',
            badgeClass: 'border-primary/40 bg-primary/15 text-primary/90',
        },
    };

    const SCOPE_CONFIG = [
        {
            scopeLabel: 'Fabric 2',
            standardId: 'raft-standard',
            variantId: 'raft-variant',
            badgeClass: 'border-secondary/40 bg-secondary/15 text-secondary/90',
        },
        {
            scopeLabel: 'Fabric 3',
            standardId: 'fabric3-raft-standard',
            variantId: 'fabric3-raft-variant',
            badgeClass: 'border-accent/40 bg-accent/15 text-accent/90',
        },
    ];

    const SUMMARY_ROWS = [
        {
            label: 'Versi Fabric',
            getValue: (item) => item?.fabricVersion?.value ?? null,
            getDisplay: (item) => item?.fabricVersion?.label ?? '—',
        },
        {
            label: 'Versi Fabric CA',
            getValue: (item) => item?.fabricCAVersion?.value ?? null,
            getDisplay: (item) => item?.fabricCAVersion?.label ?? '—',
        },
        {
            label: 'Channel',
            getValue: (item) => item?.channelName ?? null,
            getDisplay: (item) => item?.channelName ?? '—',
        },
        {
            label: 'Basis Data',
            getValue: (item) => item?.database ?? null,
            getDisplay: (item) => item?.database ?? '—',
        },
        {
            label: 'Chaincode',
            getValue: (item) => {
                const name = item?.chaincode?.name ?? '';
                const version = item?.chaincode?.version ?? '';
                return name || version ? `${name}::${version}` : null;
            },
            getDisplay: (item) => {
                const name = item?.chaincode?.name;
                const version = item?.chaincode?.version;
                if (!name && !version) {
                    return '—';
                }
                if (name && version) {
                    return `${name} (${version})`;
                }
                return name || version || '—';
            },
        },
        {
            label: 'Bahasa Chaincode',
            getValue: (item) => item?.chaincode?.language ?? null,
            getDisplay: (item) => item?.chaincode?.language ?? '—',
        },
        {
            label: 'Lokasi Chaincode',
            getValue: (item) => item?.chaincode?.path ?? null,
            getDisplay: (item) => item?.chaincode?.path ?? '—',
        },
    ];

    function showPlaceholder(container, message, tone = 'info') {
        if (!container) {
            return;
        }

        const classes = PLACEHOLDER_VARIANTS[tone] || PLACEHOLDER_VARIANTS.info;

        container.dataset.state = 'placeholder';
        container.replaceChildren();

        const article = document.createElement('article');
        article.className = `rounded-3xl border p-6 text-sm shadow-inner shadow-black/20 ${classes}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-3';

        const indicator = document.createElement('span');
        indicator.className = 'inline-flex h-3 w-3 rounded-full';

        if (tone === 'error') {
            indicator.classList.add('bg-rose-400');
        } else if (tone === 'empty') {
            indicator.classList.add('bg-amber-400');
        } else {
            indicator.classList.add('bg-primary/70', 'animate-pulse');
        }

        const text = document.createElement('span');
        text.textContent = message;

        wrapper.append(indicator, text);
        article.append(wrapper);
        container.append(article);
    }

    function clearContainer(container) {
        if (!container) {
            return;
        }

        container.dataset.state = 'ready';
        container.replaceChildren();
    }

    function stringOrDash(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        return String(value);
    }

    function formatTimestampLabel(isoString) {
        if (!isoString || typeof isoString !== 'string') {
            return null;
        }

        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        try {
            const formatted = new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(date);
            return `Terakhir diperbarui: ${formatted}`;
        } catch (error) {
            console.error('Gagal memformat tanggal pembaruan perbandingan:', error);
            return null;
        }
    }

    function buildEndpointLines(address, port, mapping) {
        const lines = [];

        if (address) {
            lines.push(address);
        } else if (port) {
            lines.push(`Port kontainer: ${port}`);
        }

        if (mapping?.host) {
            lines.push(`Host: ${mapping.host}`);
        }

        if (mapping?.raw && mapping.raw !== mapping.host) {
            lines.push(`Raw: ${mapping.raw}`);
        }

        return lines;
    }

    function appendDetailBlock(container, label, values) {
        const block = document.createElement('div');
        block.className = 'rounded-2xl border border-white/10 bg-surfaceMuted/60 p-4';

        const title = document.createElement('p');
        title.className = 'text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-textdark/50';
        title.textContent = label;

        block.append(title);

        const valueLines = Array.isArray(values)
            ? values.filter(line => line !== null && line !== undefined && line !== '')
            : [values];

        if (!valueLines.length) {
            const fallback = document.createElement('p');
            fallback.className = 'text-sm text-textdark/60';
            fallback.textContent = '—';
            block.append(fallback);
        } else {
            valueLines.forEach((line) => {
                const paragraph = document.createElement('p');
                paragraph.className = 'text-sm text-textdark';
                paragraph.textContent = String(line);
                block.append(paragraph);
            });
        }

        container.append(block);
    }

    function renderNetworkOverview(container, networkMap) {
        if (!container) {
            return;
        }

        const orderedIds = ['raft-standard', 'raft-variant', 'fabric3-raft-standard', 'fabric3-raft-variant'];
        const visibleIds = orderedIds.filter(id => networkMap.has(id));

        if (!visibleIds.length) {
            showPlaceholder(container, 'Data jaringan tidak ditemukan.', 'empty');
            return;
        }

        clearContainer(container);

        visibleIds.forEach((id) => {
            const description = networkMap.get(id);
            const meta = NETWORK_META[id] || {};

            const card = document.createElement('article');
            card.className = 'flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-surface/85 p-6 text-sm text-textdark/80 shadow-2xl shadow-black/30 backdrop-blur-sm';

            const header = document.createElement('div');
            header.className = 'space-y-3';

            const scopeBadge = document.createElement('span');
            scopeBadge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${meta.badgeClass || 'border-white/10 bg-white/5 text-textdark/60'}`;
            scopeBadge.textContent = meta.scopeLabel || description?.label || 'Jaringan RAFT';

            const title = document.createElement('h3');
            title.className = 'text-lg font-semibold text-textdark';
            title.textContent = meta.title || description?.label || 'Paket RAFT';

            const variantLabel = document.createElement('p');
            variantLabel.className = 'text-xs text-textdark/60';
            variantLabel.textContent = description?.label
                ? `Profil ${description.label}`
                : (meta.variantLabel || 'Konfigurasi jaringan');

            header.append(scopeBadge, title, variantLabel);
            card.append(header);

            const infoList = document.createElement('ul');
            infoList.className = 'space-y-3';

            const peerCount = Array.isArray(description?.peers) ? description.peers.length : 0;
            const ordererName = description?.orderer?.serviceName || description?.orderer?.containerName;

            const overviewItems = [
                {
                    label: 'Versi Fabric',
                    value: description?.fabricVersion?.label || '—',
                },
                {
                    label: 'Versi Fabric CA',
                    value: description?.fabricCAVersion?.label || '—',
                },
                {
                    label: 'Channel',
                    value: description?.channelName || '—',
                },
                {
                    label: 'Basis Data',
                    value: description?.database || '—',
                },
                {
                    label: 'Orderer',
                    value: ordererName || 'Tidak diketahui',
                },
                {
                    label: 'Peer Aktif',
                    value: peerCount ? `${peerCount} node` : 'Tidak ada data peer',
                },
            ];

            overviewItems.forEach((item) => {
                const listItem = document.createElement('li');
                listItem.className = 'rounded-2xl border border-white/10 bg-surfaceMuted/60 px-4 py-3';

                const label = document.createElement('p');
                label.className = 'text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-textdark/50';
                label.textContent = item.label;

                const value = document.createElement('p');
                value.className = 'text-sm font-medium text-textdark';
                value.textContent = stringOrDash(item.value);

                listItem.append(label, value);
                infoList.append(listItem);
            });

            card.append(infoList);
            container.append(card);
        });
    }

    function renderComparisonTables(container, networkMap) {
        if (!container) {
            return;
        }

        const anyData = SCOPE_CONFIG.some(config => networkMap.has(config.standardId) || networkMap.has(config.variantId));
        if (!anyData) {
            showPlaceholder(container, 'Tidak ada data konfigurasi yang dapat dibandingkan.', 'empty');
            return;
        }

        clearContainer(container);

        SCOPE_CONFIG.forEach((config) => {
            const standard = networkMap.get(config.standardId);
            const variant = networkMap.get(config.variantId);

            const card = document.createElement('article');
            card.className = 'space-y-5 rounded-3xl border border-white/10 bg-surface/85 p-6 text-sm text-textdark/80 shadow-2xl shadow-black/30 backdrop-blur-sm';

            const header = document.createElement('div');
            header.className = 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between';

            const heading = document.createElement('div');
            heading.className = 'space-y-2';

            const scopeBadge = document.createElement('span');
            scopeBadge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${config.badgeClass}`;
            scopeBadge.textContent = config.scopeLabel;

            const title = document.createElement('h3');
            title.className = 'text-lg font-semibold text-textdark';
            title.textContent = `Perbandingan ${config.scopeLabel}`;

            const subtitle = document.createElement('p');
            subtitle.className = 'text-xs text-textdark/60';
            subtitle.textContent = 'Mengukur parameter inti antara paket RAFT Standard dan RAFT Variant.';

            heading.append(scopeBadge, title, subtitle);
            header.append(heading);
            card.append(header);

            const table = document.createElement('table');
            table.className = 'w-full border-separate border-spacing-y-2 text-sm text-textdark/80';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');

            const headers = ['Parameter', 'RAFT Standard', 'RAFT Variant', 'Catatan'];
            headers.forEach((label) => {
                const th = document.createElement('th');
                th.scope = 'col';
                th.className = 'rounded-2xl bg-surfaceMuted/70 px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-textdark/60';
                th.textContent = label;
                headerRow.append(th);
            });
            thead.append(headerRow);
            table.append(thead);

            const tbody = document.createElement('tbody');

            SUMMARY_ROWS.forEach((row) => {
                const standardValueRaw = row.getValue(standard);
                const variantValueRaw = row.getValue(variant);
                const standardDisplay = row.getDisplay(standard);
                const variantDisplay = row.getDisplay(variant);

                const normalizedStandard = typeof standardValueRaw === 'string'
                    ? standardValueRaw.trim().toLowerCase()
                    : (standardValueRaw ?? '').toString().trim().toLowerCase();
                const normalizedVariant = typeof variantValueRaw === 'string'
                    ? variantValueRaw.trim().toLowerCase()
                    : (variantValueRaw ?? '').toString().trim().toLowerCase();

                const hasStandard = standardValueRaw !== null && standardValueRaw !== undefined && standardValueRaw !== '';
                const hasVariant = variantValueRaw !== null && variantValueRaw !== undefined && variantValueRaw !== '';

                let noteLabel = 'Serupa';
                let noteClass = 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';

                if (!hasStandard && !hasVariant) {
                    noteLabel = 'Data kosong';
                    noteClass = 'border-white/10 bg-white/5 text-textdark/60';
                } else if (normalizedStandard !== normalizedVariant) {
                    noteLabel = 'Berbeda';
                    noteClass = 'border-amber-400/30 bg-amber-400/10 text-amber-200';
                }

                const rowEl = document.createElement('tr');

                const parameterCell = document.createElement('td');
                parameterCell.className = 'rounded-2xl bg-surfaceMuted/60 px-4 py-3 text-sm font-medium text-textdark';
                parameterCell.textContent = row.label;

                const standardCell = document.createElement('td');
                standardCell.className = 'rounded-2xl bg-surfaceMuted/40 px-4 py-3 text-sm text-textdark/80';
                standardCell.textContent = stringOrDash(standardDisplay);

                const variantCell = document.createElement('td');
                variantCell.className = 'rounded-2xl bg-surfaceMuted/40 px-4 py-3 text-sm text-textdark/80';
                variantCell.textContent = stringOrDash(variantDisplay);

                const noteCell = document.createElement('td');
                noteCell.className = 'rounded-2xl bg-surfaceMuted/40 px-4 py-3';

                const noteBadge = document.createElement('span');
                noteBadge.className = `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.3em] ${noteClass}`;
                noteBadge.textContent = noteLabel;

                noteCell.append(noteBadge);
                rowEl.append(parameterCell, standardCell, variantCell, noteCell);
                tbody.append(rowEl);
            });

            table.append(tbody);
            card.append(table);
            container.append(card);
        });
    }

    function renderOrdererDetails(container, networkMap) {
        if (!container) {
            return;
        }

        const orderedIds = ['raft-standard', 'raft-variant', 'fabric3-raft-standard', 'fabric3-raft-variant'];
        const visibleIds = orderedIds.filter(id => networkMap.has(id));

        if (!visibleIds.length) {
            showPlaceholder(container, 'Detail orderer tidak tersedia.', 'empty');
            return;
        }

        clearContainer(container);

        visibleIds.forEach((id) => {
            const description = networkMap.get(id);
            const meta = NETWORK_META[id] || {};
            const orderer = description?.orderer;

            const card = document.createElement('article');
            card.className = 'flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-surface/85 p-6 text-sm text-textdark/80 shadow-2xl shadow-black/30 backdrop-blur-sm';

            const header = document.createElement('div');
            header.className = 'space-y-2';

            const scopeBadge = document.createElement('span');
            scopeBadge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${meta.badgeClass || 'border-white/10 bg-white/5 text-textdark/60'}`;
            scopeBadge.textContent = meta.title || description?.label || 'Paket RAFT';

            const variantLabel = document.createElement('p');
            variantLabel.className = 'text-xs text-textdark/60';
            variantLabel.textContent = orderer?.serviceName
                ? `Orderer ${orderer.serviceName}`
                : 'Nama orderer tidak tersedia.';

            header.append(scopeBadge, variantLabel);
            card.append(header);

            const content = document.createElement('div');
            content.className = 'grid gap-4 md:grid-cols-2';

            if (!orderer) {
                appendDetailBlock(content, 'Informasi Orderer', ['Detail orderer tidak ditemukan dalam berkas konfigurasi.']);
            } else {
                appendDetailBlock(content, 'Service Name', [orderer.serviceName || '—']);
                appendDetailBlock(content, 'Container Name', [orderer.containerName || '—']);
                appendDetailBlock(content, 'Hostname', [orderer.hostname || '—']);
                appendDetailBlock(content, 'MSP', [orderer.mspId || '—']);
                appendDetailBlock(content, 'TLS', [orderer.tlsEnabled ? 'Aktif' : 'Nonaktif']);
                appendDetailBlock(content, 'Image', [orderer.image || '—']);
                appendDetailBlock(content, 'gRPC Endpoint', buildEndpointLines(orderer.listenAddress, orderer.listenPort, orderer.grpcMapping));
                appendDetailBlock(content, 'Admin Endpoint', buildEndpointLines(orderer.adminAddress, orderer.adminMapping?.container, orderer.adminMapping));
                appendDetailBlock(content, 'Operations Endpoint', buildEndpointLines(orderer.operationsAddress, orderer.operationsMapping?.container, orderer.operationsMapping));
                appendDetailBlock(content, 'Metrics Provider', [orderer.metricsProvider || '—']);
                appendDetailBlock(content, 'Port Terbuka', [Array.isArray(orderer.ports) ? `${orderer.ports.length} port` : 'Tidak ada data port']);
            }

            card.append(content);
            container.append(card);
        });
    }

    function renderPeerDetails(container, networkMap) {
        if (!container) {
            return;
        }

        const orderedIds = ['raft-standard', 'raft-variant', 'fabric3-raft-standard', 'fabric3-raft-variant'];
        const visibleIds = orderedIds.filter(id => networkMap.has(id));

        if (!visibleIds.length) {
            showPlaceholder(container, 'Data peer jaringan tidak ditemukan.', 'empty');
            return;
        }

        clearContainer(container);

        visibleIds.forEach((id) => {
            const description = networkMap.get(id);
            const meta = NETWORK_META[id] || {};
            const peers = Array.isArray(description?.peers) ? description.peers : [];

            const card = document.createElement('article');
            card.className = 'flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-surface/85 p-6 text-sm text-textdark/80 shadow-2xl shadow-black/30 backdrop-blur-sm';

            const header = document.createElement('div');
            header.className = 'space-y-2';

            const scopeBadge = document.createElement('span');
            scopeBadge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${meta.badgeClass || 'border-white/10 bg-white/5 text-textdark/60'}`;
            scopeBadge.textContent = meta.title || description?.label || 'Paket RAFT';

            const subtitle = document.createElement('p');
            subtitle.className = 'text-xs text-textdark/60';
            subtitle.textContent = peers.length
                ? `${peers.length} peer ditemukan dalam konfigurasi.`
                : 'Tidak ada peer yang terdeteksi untuk paket ini.';

            header.append(scopeBadge, subtitle);
            card.append(header);

            if (!peers.length) {
                const emptyState = document.createElement('div');
                emptyState.className = 'rounded-2xl border border-white/10 bg-surfaceMuted/60 p-4 text-sm text-textdark/60';
                emptyState.textContent = 'Berkas konfigurasi tidak memuat definisi peer untuk paket ini atau gagal dibaca.';
                card.append(emptyState);
                container.append(card);
                return;
            }

            const list = document.createElement('ul');
            list.className = 'space-y-4';

            peers.forEach((peer) => {
                const listItem = document.createElement('li');
                listItem.className = 'space-y-3 rounded-2xl border border-white/10 bg-surfaceMuted/60 p-4';

                const titleRow = document.createElement('div');
                titleRow.className = 'flex flex-wrap items-center justify-between gap-3';

                const name = document.createElement('p');
                name.className = 'text-sm font-semibold text-textdark';
                name.textContent = peer?.serviceName || peer?.containerName || 'Peer';

                const mspBadge = document.createElement('span');
                mspBadge.className = 'inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-textdark/50';
                mspBadge.textContent = peer?.mspId || 'MSP tidak tersedia';

                titleRow.append(name, mspBadge);
                listItem.append(titleRow);

                const detailsGrid = document.createElement('div');
                detailsGrid.className = 'grid gap-3 sm:grid-cols-2';

                appendDetailBlock(detailsGrid, 'Container', [peer?.containerName || '—']);
                appendDetailBlock(detailsGrid, 'TLS', [peer?.tlsEnabled ? 'Aktif' : 'Nonaktif']);
                appendDetailBlock(detailsGrid, 'Alamat Peer', buildEndpointLines(peer?.listenAddress, peer?.listenPort, peer?.listenMapping));
                appendDetailBlock(detailsGrid, 'Alamat Chaincode', buildEndpointLines(peer?.chaincodeAddress, peer?.chaincodePort, peer?.chaincodeMapping));
                appendDetailBlock(detailsGrid, 'Endpoint Operasi', buildEndpointLines(peer?.operationsAddress, peer?.operationsMapping?.container, peer?.operationsMapping));
                appendDetailBlock(detailsGrid, 'Gossip', [peer?.gossipBootstrap || peer?.gossipEndpoint || '—']);
                appendDetailBlock(detailsGrid, 'Image', [peer?.image || '—']);

                listItem.append(detailsGrid);
                list.append(listItem);
            });

            card.append(list);
            container.append(card);
        });
    }

    async function fetchComparisonData() {
        try {
            const response = await fetch('/api/fabric-descriptions', {
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Gagal memuat data perbandingan (status ${response.status})`);
            }

            const payload = await response.json();
            return payload;
        } catch (error) {
            console.error('Gagal mengambil data perbandingan jaringan:', error);
            throw error;
        }
    }

    async function initializeComparison() {
        try {
            const data = await fetchComparisonData();
            const descriptions = Array.isArray(data?.descriptions) ? data.descriptions : [];

            if (!descriptions.length) {
                showPlaceholder(summaryGrid, 'Deskripsi jaringan kosong.', 'empty');
                showPlaceholder(comparisonSummary, 'Deskripsi jaringan kosong.', 'empty');
                showPlaceholder(ordererComparison, 'Deskripsi jaringan kosong.', 'empty');
                showPlaceholder(peerComparison, 'Deskripsi jaringan kosong.', 'empty');
                return;
            }

            const networkMap = new Map();
            descriptions.forEach((description) => {
                if (description?.id) {
                    networkMap.set(description.id, description);
                }
            });

            renderNetworkOverview(summaryGrid, networkMap);
            renderComparisonTables(comparisonSummary, networkMap);
            renderOrdererDetails(ordererComparison, networkMap);
            renderPeerDetails(peerComparison, networkMap);

            if (updatedAtEl) {
                const label = formatTimestampLabel(data?.fetchedAt);
                updatedAtEl.textContent = label || '';
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal memuat data perbandingan jaringan.';
            showPlaceholder(summaryGrid, message, 'error');
            showPlaceholder(comparisonSummary, message, 'error');
            showPlaceholder(ordererComparison, message, 'error');
            showPlaceholder(peerComparison, message, 'error');

            if (updatedAtEl) {
                updatedAtEl.textContent = '';
            }
        }
    }

    initializeComparison();
});
