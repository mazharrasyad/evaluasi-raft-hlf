const componentLoaderReady = window.componentLoaderReady instanceof Promise
    ? window.componentLoaderReady
    : Promise.resolve();

componentLoaderReady.then(() => {
    const overallMetricsContainer = document.getElementById('overallMetricHighlights');
    const networkMetricsContainer = document.getElementById('networkMetricGrid');
    const metricInsightsContainer = document.getElementById('metricInsights');
    const updatedAtEl = document.getElementById('comparisonUpdatedAt');

    const PLACEHOLDER_VARIANTS = {
        info: 'border-white/10 bg-surfaceMuted/70 text-textdark/70',
        error: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
        empty: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    };

    const NETWORK_META = {
        'fabric2-raft-standard': {
            title: 'Fabric 2 — RAFT Standard',
            scopeLabel: 'Fabric 2',
            variantLabel: 'RAFT Standard',
            badgeClass: 'border-secondary/40 bg-secondary/15 text-secondary/90',
        },
        'fabric2-raft-variant': {
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

    const NETWORK_ORDER = [
        'fabric2-raft-standard',
        'fabric2-raft-variant',
        'fabric3-raft-standard',
        'fabric3-raft-variant',
    ];

    const METRIC_DEFINITIONS = [
        {
            key: 'throughput',
            label: 'Throughput',
            badgeClass: 'border-primary/40 bg-primary/15 text-primary/90',
        },
        {
            key: 'latency',
            label: 'Latency',
            badgeClass: 'border-secondary/40 bg-secondary/15 text-secondary/90',
        },
        {
            key: 'resourceUsage',
            label: 'Resource Usage',
            badgeClass: 'border-accent/40 bg-accent/15 text-accent/90',
        },
        {
            key: 'faultTolerance',
            label: 'Fault Tolerance',
            badgeClass: 'border-highlight/40 bg-highlight/15 text-highlight/90',
        },
    ];

    const INSIGHT_TONE_CLASSES = {
        positive: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50',
        caution: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
        warning: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
        neutral: 'border-white/10 bg-surfaceMuted/60 text-textdark/80',
    };

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
            return `Data simulasi diperbarui: ${formatted}`;
        } catch (error) {
            console.error('Gagal memformat cap waktu perbandingan:', error);
            return null;
        }
    }

    function formatNumber(value, options = {}) {
        if (!Number.isFinite(value)) {
            return null;
        }

        const formatter = new Intl.NumberFormat('id-ID', options);
        return formatter.format(value);
    }

    function formatInteger(value) {
        if (!Number.isFinite(value)) {
            return '0';
        }
        return formatNumber(value, { maximumFractionDigits: 0 });
    }

    function formatThroughput(value) {
        if (!Number.isFinite(value) || value <= 0) {
            return 'Belum ada data';
        }

        const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
        const formatted = formatNumber(value, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
        return `${formatted} tx/detik`;
    }

    function formatLatency(value) {
        if (!Number.isFinite(value) || value <= 0) {
            return 'Belum ada data';
        }

        if (value >= 1000) {
            const seconds = value / 1000;
            const decimals = seconds >= 10 ? 1 : 2;
            const formattedSeconds = formatNumber(seconds, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            });
            return `${formattedSeconds} dtk`;
        }

        const decimals = value < 10 ? 2 : value < 100 ? 1 : 0;
        const formatted = formatNumber(value, {
            maximumFractionDigits: decimals,
        });
        return `${formatted} ms`;
    }

    function formatPercentage(value, { fraction = false, decimals = 1, fallback = null } = {}) {
        if (!Number.isFinite(value)) {
            return fallback;
        }

        const raw = fraction ? value * 100 : value;
        const formatted = formatNumber(raw, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });

        return `${formatted}%`;
    }

    function formatDuration(ms) {
        if (!Number.isFinite(ms) || ms <= 0) {
            return null;
        }

        const seconds = Math.round(ms / 1000);

        if (seconds < 60) {
            return `${seconds}s`;
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes < 60) {
            return remainingSeconds
                ? `${minutes}m ${remainingSeconds}s`
                : `${minutes}m`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        return remainingMinutes
            ? `${hours}j ${remainingMinutes}m`
            : `${hours}j`;
    }

    function clampMetric(value, min, max, fallback = null) {
        if (!Number.isFinite(value)) {
            return Number.isFinite(fallback) ? fallback : null;
        }

        let clamped = value;

        if (typeof min === 'number' && clamped < min) {
            clamped = min;
        }

        if (typeof max === 'number' && clamped > max) {
            clamped = max;
        }

        return clamped;
    }

    function computeResourceUsagePercentage({ stats, throughputSnapshot, latencyMs, fallback = null }) {
        const normalizedThroughput = Number.isFinite(throughputSnapshot)
            ? Math.min(Math.max(throughputSnapshot / 10, 0), 1)
            : 0;
        const normalizedLatency = Number.isFinite(latencyMs)
            ? Math.min(Math.max(latencyMs / 750, 0), 1)
            : 0.25;

        let usage = 35 + (normalizedThroughput * 45) + (normalizedLatency * 20);

        if (stats?.lastStatus === 'error') {
            usage += 8;
        } else if (stats?.lastStatus === 'success') {
            usage -= 3;
        }

        return clampMetric(usage, 25, 100, fallback);
    }

    function computeFaultToleranceScore({ stats, latencyMs, fallback = null }) {
        const totalAttempts = Math.max(
            Number(stats?.totalCount) || 0,
            (Number(stats?.successCount) || 0) + (Number(stats?.failureCount) || 0),
        );
        const failureRate = totalAttempts > 0
            ? Math.min(Math.max((Number(stats?.failureCount) || 0) / totalAttempts, 0), 1)
            : 0;
        const latencyImpact = Number.isFinite(latencyMs)
            ? Math.min(Math.max(latencyMs / 1000, 0), 1)
            : 0;
        const statusPenalty = stats?.lastStatus === 'error'
            ? 0.12
            : stats?.lastStatus === 'processing'
                ? 0.05
                : 0;

        let score = 100
            - (failureRate * 60)
            - (latencyImpact * 20)
            - (statusPenalty * 100);

        if (stats?.failureCount === 0 && stats?.successCount > 0) {
            score += 5;
        } else if (stats?.lastStatus === 'success') {
            score += 2;
        }

        return clampMetric(score, 40, 100, fallback);
    }

    function describeThroughput(value, context = {}) {
        const totalCount = Number.isFinite(context.totalCount) ? context.totalCount : 0;

        if (!Number.isFinite(value) || value <= 0) {
            if (totalCount === 0) {
                return 'Belum ada transaksi berhasil yang dapat dihitung.';
            }
            return 'Throughput masih rendah, perbanyak sampel simulasi untuk gambaran yang lebih representatif.';
        }

        if (totalCount < 10) {
            return 'Dataset transaksi masih terbatas; jalankan simulasi lebih panjang untuk memvalidasi performa.';
        }

        if (value >= 20) {
            return 'Laju transaksi tinggi; RAFT memproses laporan secara agresif.';
        }
        if (value >= 10) {
            return 'Throughput stabil pada kisaran menengah ke atas.';
        }
        if (value >= 5) {
            return 'Cukup untuk pengujian; tingkatkan beban untuk menguji batas jaringan.';
        }
        return 'Throughput rendah, lakukan simulasi tambahan dan pantau konfigurasi chaincode.';
    }

    function describeLatency(value) {
        if (!Number.isFinite(value) || value <= 0) {
            return 'Latensi akan muncul setelah transaksi berhasil tercatat.';
        }

        if (value <= 250) {
            return 'Respons cepat dengan konfirmasi sub-250 ms.';
        }
        if (value <= 600) {
            return 'Latensi masih dalam ambang wajar untuk beban menengah.';
        }
        if (value <= 1000) {
            return 'Latensi mulai meningkat; evaluasi beban orderer dan peer.';
        }
        return 'Latensi tinggi; periksa jaringan, konfigurasi RAFT, dan kapasitas container.';
    }

    function describeResourceUsage(value) {
        if (!Number.isFinite(value)) {
            return 'Proyeksi beban sumber daya belum tersedia.';
        }

        if (value >= 90) {
            return 'Penggunaan sumber daya sangat tinggi; lakukan optimasi atau tambah kapasitas.';
        }
        if (value >= 80) {
            return 'Mendekati batas kapasitas; monitor CPU, memori, dan IO selama simulasi.';
        }
        if (value >= 60) {
            return 'Beban moderat; ideal untuk menguji skenario failover.';
        }
        if (value >= 40) {
            return 'Beban ringan hingga sedang; masih ada ruang peningkatan workload.';
        }
        return 'Beban sangat ringan; tingkatkan volume transaksi untuk hasil yang lebih representatif.';
    }

    function describeFaultTolerance(value, context = {}) {
        if (!Number.isFinite(value)) {
            return 'Ketahanan baru dapat dinilai setelah menjalankan skenario kegagalan.';
        }

        let message;
        if (value >= 90) {
            message = 'RAFT menunjukkan ketahanan sangat baik terhadap kegagalan.';
        } else if (value >= 75) {
            message = 'Ketahanan berada di kisaran aman; lanjutkan uji pemulihan berkala.';
        } else {
            message = 'Ketahanan perlu perhatian; siapkan skenario failover tambahan.';
        }

        if (Number.isFinite(context.failureCount) && context.failureCount > 0) {
            message += ` • ${formatInteger(context.failureCount)} kegagalan tercatat.`;
        } else if (Number.isFinite(context.successRate)) {
            const rateLabel = formatPercentage(context.successRate, { fraction: true, decimals: 1 });
            if (rateLabel) {
                message += ` • Tingkat keberhasilan ${rateLabel}.`;
            }
        }

        return message;
    }

    function createEmptyMetrics() {
        return {
            throughput: {
                value: null,
                display: 'Belum ada data',
                insight: 'Jalankan simulasi untuk melihat laju transaksi jaringan.',
            },
            latency: {
                value: null,
                display: 'Belum ada data',
                insight: 'Latensi akan tersedia setelah transaksi berhasil dikonfirmasi.',
            },
            resourceUsage: {
                value: null,
                display: 'Belum ada data',
                insight: 'Proyeksi penggunaan sumber daya muncul setelah simulasi aktif.',
            },
            faultTolerance: {
                value: null,
                display: 'Belum ada data',
                insight: 'Jalankan skenario failover untuk mengukur ketahanan RAFT.',
            },
        };
    }

    function buildMetricSnapshot(stats) {
        if (!stats || typeof stats !== 'object') {
            return {
                metrics: createEmptyMetrics(),
                hasData: false,
                totalCount: 0,
                successCount: 0,
                failureCount: 0,
                successRate: null,
                observationDurationMs: null,
                summaryBadges: [],
            };
        }

        const totalCount = Number.isFinite(stats.totalCount) ? stats.totalCount : 0;
        const successCount = Number.isFinite(stats.successCount) ? stats.successCount : 0;
        const failureCount = Number.isFinite(stats.failureCount) ? stats.failureCount : 0;
        const successRate = Number.isFinite(stats.successRate)
            ? stats.successRate
            : (totalCount > 0 ? successCount / totalCount : null);
        const observationDurationMs = Number.isFinite(stats.observationDurationMs)
            ? stats.observationDurationMs
            : null;
        const throughput = Number.isFinite(stats.throughput) ? stats.throughput : null;
        const latencyMs = Number.isFinite(stats.averageLatencyMs) ? stats.averageLatencyMs : null;

        const resourceUsage = computeResourceUsagePercentage({
            stats,
            throughputSnapshot: throughput,
            latencyMs,
            fallback: null,
        });

        const faultTolerance = computeFaultToleranceScore({
            stats,
            latencyMs,
            fallback: null,
        });

        const metrics = {
            throughput: {
                value: Number.isFinite(throughput) && throughput > 0 ? throughput : null,
                display: formatThroughput(throughput),
                insight: describeThroughput(throughput, { totalCount, observationDurationMs }),
            },
            latency: {
                value: Number.isFinite(latencyMs) && latencyMs > 0 ? latencyMs : null,
                display: formatLatency(latencyMs),
                insight: describeLatency(latencyMs),
            },
            resourceUsage: {
                value: Number.isFinite(resourceUsage) ? resourceUsage : null,
                display: formatPercentage(resourceUsage, { decimals: 0, fallback: 'Belum ada data' }),
                insight: describeResourceUsage(resourceUsage),
            },
            faultTolerance: {
                value: Number.isFinite(faultTolerance) ? faultTolerance : null,
                display: formatPercentage(faultTolerance, { decimals: 0, fallback: 'Belum ada data' }),
                insight: describeFaultTolerance(faultTolerance, { failureCount, successRate }),
            },
        };

        const summaryBadges = [];

        if (totalCount > 0) {
            summaryBadges.push(`${formatInteger(totalCount)} transaksi`);
        }

        const successPercentLabel = formatPercentage(successRate, { fraction: true, decimals: 1 });
        if (successPercentLabel) {
            summaryBadges.push(`${successPercentLabel} berhasil`);
        }

        if (failureCount > 0) {
            summaryBadges.push(`${formatInteger(failureCount)} gagal`);
        }

        const durationLabel = formatDuration(observationDurationMs);
        if (durationLabel) {
            summaryBadges.push(`Durasi ${durationLabel}`);
        }

        const hasData = successCount > 0 || failureCount > 0
            || Number.isFinite(throughput) || Number.isFinite(latencyMs);

        return {
            metrics,
            hasData,
            totalCount,
            successCount,
            failureCount,
            successRate,
            observationDurationMs,
            summaryBadges,
        };
    }

    function normalizeScopeLabel(scope) {
        if (!scope || typeof scope !== 'string') {
            return 'Jaringan';
        }

        const normalized = scope.toLowerCase();

        if (normalized.includes('fabric') && normalized.includes('2')) {
            return 'Fabric 2';
        }
        if (normalized.includes('fabric') && normalized.includes('3')) {
            return 'Fabric 3';
        }

        return scope.replace(/(^|\s)\w/g, (match) => match.toUpperCase());
    }

    function resolveNetworkMeta(key, stats, snapshot) {
        const baseMeta = NETWORK_META[key] || {};

        const scopeLabel = baseMeta.scopeLabel || normalizeScopeLabel(stats?.scope);
        const variantLabel = baseMeta.variantLabel || stats?.label || stats?.channel || 'Paket RAFT';
        const title = baseMeta.title || stats?.label || variantLabel || 'Jaringan RAFT';

        let statusLabel;
        let statusClass;

        if (!snapshot?.hasData) {
            statusLabel = 'Data belum tersedia';
            statusClass = 'border-white/15 bg-white/5 text-textdark/50';
        } else if ((snapshot.failureCount || 0) > 0 || stats?.lastStatus === 'error') {
            statusLabel = snapshot.failureCount
                ? `${formatInteger(snapshot.failureCount)} kegagalan`
                : 'Perlu pemeriksaan';
            statusClass = 'border-amber-400/40 bg-amber-400/10 text-amber-100';
        } else {
            statusLabel = 'Simulasi stabil';
            statusClass = 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
        }

        return {
            key,
            title,
            scopeLabel,
            variantLabel,
            badgeClass: baseMeta.badgeClass || 'border-white/10 bg-white/5 text-textdark/60',
            statusLabel,
            statusClass,
        };
    }

    function renderOverallMetrics(container, snapshot) {
        if (!container) {
            return;
        }

        const hasAnyData = Object.values(snapshot.metrics).some(metric => metric.value !== null);

        if (!hasAnyData) {
            showPlaceholder(container, 'Belum ada hasil simulasi agregat yang dapat ditampilkan.', 'empty');
            return;
        }

        clearContainer(container);

        METRIC_DEFINITIONS.forEach((definition) => {
            const metricInfo = snapshot.metrics[definition.key];
            const card = document.createElement('article');
            card.className = 'flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-surface/85 p-6 text-sm text-textdark/80 shadow-2xl shadow-black/30 backdrop-blur-sm';

            const badge = document.createElement('span');
            badge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.3em] ${definition.badgeClass}`;
            badge.textContent = definition.label;

            const value = document.createElement('p');
            value.className = 'text-2xl font-semibold text-textdark';
            value.textContent = metricInfo.display;
            if (metricInfo.value === null) {
                value.classList.add('text-textdark/50');
            }

            const insight = document.createElement('p');
            insight.className = 'text-xs text-textdark/60';
            insight.textContent = metricInfo.insight;

            card.append(badge, value, insight);
            container.append(card);
        });

        if (snapshot.summaryBadges.length) {
            const summary = document.createElement('div');
            summary.className = 'md:col-span-2 xl:col-span-4 rounded-3xl border border-white/10 bg-surfaceMuted/50 px-4 py-3 text-[0.7rem] uppercase tracking-[0.3em] text-textdark/60';
            summary.textContent = `Ringkasan: ${snapshot.summaryBadges.join(' • ')}`;
            container.append(summary);
        }
    }

    function renderNetworkMetrics(container, networkSnapshots) {
        if (!container) {
            return;
        }

        if (!Array.isArray(networkSnapshots) || networkSnapshots.length === 0) {
            showPlaceholder(container, 'Tidak ada profil jaringan yang dapat ditampilkan.', 'empty');
            return;
        }

        clearContainer(container);

        networkSnapshots.forEach(({ meta, snapshot }) => {
            const card = document.createElement('article');
            card.className = 'space-y-5 rounded-3xl border border-white/10 bg-surface/85 p-6 text-sm text-textdark/80 shadow-2xl shadow-black/30 backdrop-blur-sm';

            const header = document.createElement('div');
            header.className = 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between';

            const heading = document.createElement('div');
            heading.className = 'space-y-2';

            const scopeBadge = document.createElement('span');
            scopeBadge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.3em] ${meta.badgeClass}`;
            scopeBadge.textContent = meta.scopeLabel;

            const title = document.createElement('h3');
            title.className = 'text-lg font-semibold text-textdark';
            title.textContent = meta.title;

            const subtitle = document.createElement('p');
            subtitle.className = 'text-xs text-textdark/60';
            subtitle.textContent = meta.variantLabel;

            heading.append(scopeBadge, title, subtitle);

            const statusBadge = document.createElement('span');
            statusBadge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.3em] ${meta.statusClass}`;
            statusBadge.textContent = meta.statusLabel;

            header.append(heading, statusBadge);
            card.append(header);

            const metricsGrid = document.createElement('div');
            metricsGrid.className = 'grid gap-4 sm:grid-cols-2';

            METRIC_DEFINITIONS.forEach((definition) => {
                const metricInfo = snapshot.metrics[definition.key] ?? {
                    value: null,
                    display: 'Belum ada data',
                    insight: 'Menunggu data simulasi.',
                };

                const block = document.createElement('div');
                block.className = 'flex flex-col gap-2 rounded-2xl border border-white/10 bg-surfaceMuted/60 p-4';

                const badge = document.createElement('span');
                badge.className = `inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.3em] ${definition.badgeClass}`;
                badge.textContent = definition.label;

                const value = document.createElement('p');
                value.className = 'text-xl font-semibold text-textdark';
                value.textContent = metricInfo.display;
                if (metricInfo.value === null) {
                    value.classList.add('text-textdark/50');
                }

                const insight = document.createElement('p');
                insight.className = 'text-xs text-textdark/60';
                insight.textContent = metricInfo.insight;

                block.append(badge, value, insight);
                metricsGrid.append(block);
            });

            card.append(metricsGrid);

            if (snapshot.summaryBadges.length) {
                const footer = document.createElement('div');
                footer.className = 'flex flex-wrap gap-3 text-[0.62rem] uppercase tracking-[0.28em] text-textdark/50';
                snapshot.summaryBadges.forEach((badgeText) => {
                    const badge = document.createElement('span');
                    badge.className = 'inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1';
                    badge.textContent = badgeText;
                    footer.append(badge);
                });
                card.append(footer);
            }

            if (!snapshot.hasData) {
                const emptyState = document.createElement('div');
                emptyState.className = 'rounded-2xl border border-dashed border-white/15 bg-surfaceMuted/40 p-4 text-xs text-textdark/60';
                emptyState.textContent = 'Belum ada hasil simulasi yang tercatat untuk paket ini. Jalankan skenario pengujian untuk melihat perbandingan metrik.';
                card.append(emptyState);
            }

            container.append(card);
        });
    }

    function buildMetricInsights(networkSnapshots, overallSnapshot) {
        const insights = [];
        const activeSnapshots = networkSnapshots.filter(item => item.snapshot?.hasData);

        if (overallSnapshot && (overallSnapshot.hasData || Object.values(overallSnapshot.metrics).some(metric => metric.value !== null))) {
            if (Number.isFinite(overallSnapshot.successRate) && overallSnapshot.totalCount > 0) {
                const successRateLabel = formatPercentage(overallSnapshot.successRate, { fraction: true, decimals: 1 });
                insights.push({
                    tone: overallSnapshot.successRate >= 0.9 ? 'positive' : 'neutral',
                    title: 'Tingkat keberhasilan kumulatif',
                    detail: `Seluruh simulasi mencatat ${successRateLabel} keberhasilan dari ${formatInteger(overallSnapshot.totalCount)} transaksi.`,
                    action: overallSnapshot.failureCount > 0
                        ? 'Periksa log transaksi yang gagal untuk menilai dampak terhadap fault tolerance.'
                        : undefined,
                });
            }
        }

        const throughputLeaders = activeSnapshots.filter(item => Number.isFinite(item.snapshot.metrics.throughput.value) && item.snapshot.metrics.throughput.value > 0);
        if (throughputLeaders.length) {
            const leader = throughputLeaders.reduce((prev, current) => (
                current.snapshot.metrics.throughput.value > prev.snapshot.metrics.throughput.value ? current : prev
            ));
            insights.push({
                tone: 'positive',
                title: `${leader.meta.title} memimpin throughput`,
                detail: `Rata-rata ${leader.snapshot.metrics.throughput.display} dengan ${formatInteger(leader.snapshot.successCount)} transaksi berhasil.`,
                action: 'Pertahankan beban simulasi untuk memvalidasi konsistensi performa.',
            });
        }

        const latencyCandidates = activeSnapshots.filter(item => Number.isFinite(item.snapshot.metrics.latency.value) && item.snapshot.metrics.latency.value > 0);
        if (latencyCandidates.length) {
            const fastest = latencyCandidates.reduce((prev, current) => (
                current.snapshot.metrics.latency.value < prev.snapshot.metrics.latency.value ? current : prev
            ));
            insights.push({
                tone: 'positive',
                title: `${fastest.meta.title} paling responsif`,
                detail: `Rata-rata latensi ${fastest.snapshot.metrics.latency.display}, menunjukkan jalur komit RAFT yang efisien.`,
            });
        }

        const resourceWarnings = activeSnapshots
            .filter(item => Number.isFinite(item.snapshot.metrics.resourceUsage.value))
            .sort((a, b) => b.snapshot.metrics.resourceUsage.value - a.snapshot.metrics.resourceUsage.value);
        if (resourceWarnings.length) {
            const highest = resourceWarnings[0];
            if (highest.snapshot.metrics.resourceUsage.value >= 80) {
                insights.push({
                    tone: 'warning',
                    title: `${highest.meta.title} mendekati batas sumber daya`,
                    detail: `Perkiraan pemanfaatan ${highest.snapshot.metrics.resourceUsage.display}. Monitor CPU, memori, dan IO orderer selama failover.`,
                    action: 'Pertimbangkan penyesuaian resource limit atau penjadwalan ulang simulasi.',
                });
            } else if (highest.snapshot.metrics.resourceUsage.value >= 60) {
                insights.push({
                    tone: 'caution',
                    title: `${highest.meta.title} menunjukkan beban moderat`,
                    detail: `Resource usage sekitar ${highest.snapshot.metrics.resourceUsage.display}.`,
                    action: 'Gunakan profil beban berat untuk melihat batas ketahanan RAFT.',
                });
            }
        }

        const toleranceConcerns = activeSnapshots.filter(item => Number.isFinite(item.snapshot.metrics.faultTolerance.value) && item.snapshot.metrics.faultTolerance.value < 75);
        if (toleranceConcerns.length) {
            toleranceConcerns.forEach((item) => {
                insights.push({
                    tone: 'warning',
                    title: `${item.meta.title} perlu uji failover`,
                    detail: `Skor fault tolerance ${item.snapshot.metrics.faultTolerance.display}. ${item.snapshot.metrics.faultTolerance.insight}`,
                    action: 'Simulasikan penghentian orderer pemimpin untuk memastikan proses pemulihan berjalan baik.',
                });
            });
        } else if (activeSnapshots.length) {
            const strongest = activeSnapshots.reduce((prev, current) => (
                (current.snapshot.metrics.faultTolerance.value || 0) > (prev.snapshot.metrics.faultTolerance.value || 0) ? current : prev
            ));
            if (Number.isFinite(strongest.snapshot.metrics.faultTolerance.value)) {
                insights.push({
                    tone: 'positive',
                    title: `${strongest.meta.title} paling tangguh`,
                    detail: `Skor ketahanan ${strongest.snapshot.metrics.faultTolerance.display}.`,
                });
            }
        }

        const missingData = networkSnapshots.filter(item => !item.snapshot.hasData);
        if (missingData.length) {
            insights.push({
                tone: 'neutral',
                title: 'Lengkapi sampel simulasi',
                detail: `Belum ada data untuk ${missingData.map(item => item.meta.title).join(', ')}. Jalankan simulasi agar metrik empat pilar tampil lengkap.`,
            });
        }

        return insights;
    }

    function renderMetricInsights(container, insights) {
        if (!container) {
            return;
        }

        if (!Array.isArray(insights) || insights.length === 0) {
            showPlaceholder(container, 'Insight akan muncul setelah simulasi dijalankan.', 'empty');
            return;
        }

        clearContainer(container);

        insights.forEach((insight) => {
            const toneClass = INSIGHT_TONE_CLASSES[insight.tone] || INSIGHT_TONE_CLASSES.neutral;

            const article = document.createElement('article');
            article.className = `space-y-2 rounded-3xl border p-6 text-sm shadow-inner shadow-black/25 ${toneClass}`;

            const title = document.createElement('h3');
            title.className = 'text-sm font-semibold uppercase tracking-[0.3em]';
            title.textContent = insight.title;

            const detail = document.createElement('p');
            detail.className = 'text-sm';
            detail.textContent = insight.detail;

            article.append(title, detail);

            if (insight.action) {
                const action = document.createElement('p');
                action.className = 'text-xs uppercase tracking-[0.28em] opacity-80';
                action.textContent = insight.action;
                article.append(action);
            }

            container.append(article);
        });
    }

    async function fetchSimulationSummary() {
        const response = await fetch('/api/simulations/summary', {
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Gagal memuat ringkasan simulasi (status ${response.status})`);
        }

        return response.json();
    }

    async function initializeComparison() {
        try {
            const data = await fetchSimulationSummary();

            const overallSnapshot = buildMetricSnapshot(data?.overall || null);
            renderOverallMetrics(overallMetricsContainer, overallSnapshot);

            const descriptions = Array.isArray(data?.networks) ? data.networks : [];
            const recordsMap = new Map();
            const usedEntries = new Set();

            descriptions.forEach((entry) => {
                if (!entry || typeof entry !== 'object') {
                    return;
                }

                const slug = entry.slug;
                const id = entry.id;

                if (slug) {
                    recordsMap.set(slug, entry);
                }
                if (id) {
                    recordsMap.set(id, entry);
                }
            });

            const orderedEntries = NETWORK_ORDER.map((key) => {
                const stats = recordsMap.get(key) || null;
                if (stats) {
                    usedEntries.add(stats);
                }
                return { key, stats };
            });

            descriptions.forEach((entry) => {
                if (!usedEntries.has(entry)) {
                    const fallbackKey = entry.slug || entry.id || `network-${orderedEntries.length}`;
                    orderedEntries.push({ key: fallbackKey, stats: entry });
                    usedEntries.add(entry);
                }
            });

            const networkSnapshots = orderedEntries.map(({ key, stats }) => {
                const snapshot = buildMetricSnapshot(stats);
                const meta = resolveNetworkMeta(key, stats, snapshot);
                return { key, stats, snapshot, meta };
            });

            renderNetworkMetrics(networkMetricsContainer, networkSnapshots);

            const insights = buildMetricInsights(networkSnapshots, overallSnapshot);
            renderMetricInsights(metricInsightsContainer, insights);

            if (updatedAtEl) {
                const timestampLabel = formatTimestampLabel(data?.updatedAt || data?.fetchedAt);
                updatedAtEl.textContent = timestampLabel || '';
            }
        } catch (error) {
            console.error('Gagal memuat ringkasan perbandingan jaringan:', error);
            const message = error instanceof Error ? error.message : 'Gagal memuat ringkasan perbandingan jaringan.';

            showPlaceholder(overallMetricsContainer, message, 'error');
            showPlaceholder(networkMetricsContainer, message, 'error');
            showPlaceholder(metricInsightsContainer, message, 'error');

            if (updatedAtEl) {
                updatedAtEl.textContent = '';
            }
        }
    }

    initializeComparison();
});
