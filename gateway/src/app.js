import express from 'express';
import { connect, signers, hash } from '@hyperledger/fabric-gateway';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import grpc from '@grpc/grpc-js';
import path from 'path';
import { TextDecoder } from 'util';
import { fileURLToPath } from 'url';
import { checkNetworkHealth } from './network-check.js';

// ✅ Konversi __dirname untuk ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Konfigurasi Hyperledger Fabric
const mspId = 'Org1MSP';
const channelName = 'mychannel';
const chaincodeName = 'pelaporan-standard';
const networkCandidates = [
    path.resolve(__dirname, '../../raft-standard/network'),
    path.resolve(__dirname, '../../raft-variant/network')
];
const networkPath = networkCandidates.find(candidate => existsSync(candidate)) || networkCandidates[0];
const cryptoPath = path.resolve(networkPath, 'organizations/peerOrganizations/org1.example.com');
const keyDirPath = path.resolve(cryptoPath, 'users/User1@org1.example.com/msp/keystore');
const certDirPath = path.resolve(cryptoPath, 'users/User1@org1.example.com/msp/signcerts');
const tlsCertPath = path.resolve(cryptoPath, 'peers/peer0.org1.example.com/tls/ca.crt');
const peerEndpoint = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';
const sampleDataPath = path.resolve(__dirname, '../sample.json');
const wilayahDataDir = path.resolve(__dirname, '../../wilayah-indonesia');

// ✅ Inisialisasi Express
const app = express();

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..')));

const decoder = new TextDecoder();

const remoteLogoUrl = 'http://31.97.107.123:5173/logo-gasnyoba.svg';
const LOGO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedLogoSvg;
let cachedLogoFetchedAt = 0;

const BLOCK_INTERVAL_MS = 2000;
const PERFORMANCE_BASELINE = {
    latencyMs: 182,
    throughputTps: 128,
    blockSizeKb: 412,
    commitTimeSec: 2.4
};

const defaultPerformanceSnapshot = () => ({
    averageLatencyMs: PERFORMANCE_BASELINE.latencyMs,
    peakThroughputTPS: PERFORMANCE_BASELINE.throughputTps,
    blockSizeKB: PERFORMANCE_BASELINE.blockSizeKb,
    commitTimeSec: PERFORMANCE_BASELINE.commitTimeSec
});

const PERFORMANCE_METRICS = {
    averageLatencyMs: { precision: 0 },
    peakThroughputTPS: { precision: 0 },
    blockSizeKB: { precision: 1 },
    commitTimeSec: { precision: 2 }
};

const PERFORMANCE_METRIC_KEYS = Object.keys(PERFORMANCE_METRICS);

function clampNumber(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return min;
    }
    return Math.min(Math.max(numeric, min), max);
}

function toNonNegativeNumber(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return fallback;
    }
    return numeric;
}

function safeDivide(numerator, denominator) {
    if (!denominator) {
        return 0;
    }
    return numerator / denominator;
}

function determineMaladministrasiRisk(serviceQualityIndex, backlogRate, escalationRate) {
    if (serviceQualityIndex >= 80 && backlogRate <= 10 && escalationRate <= 10) {
        return {
            level: 'rendah',
            description: 'Risiko maladministrasi terkendali dengan baik dan proses berjalan stabil.'
        };
    }

    if (serviceQualityIndex >= 60 && backlogRate <= 25) {
        return {
            level: 'sedang',
            description: 'Terdapat area yang perlu diperketat, namun situasi masih relatif dapat dikendalikan.'
        };
    }

    return {
        level: 'tinggi',
        description: 'Risiko maladministrasi tinggi dan membutuhkan intervensi segera untuk menekan eskalasi.'
    };
}

function buildMaladministrasiRecommendations(metrics) {
    const recommendations = [];

    if (metrics.backlogRate > 25) {
        recommendations.push('Prioritaskan penyelesaian backlog dengan alokasi tim khusus atau sesi layanan tambahan.');
    }

    if (metrics.resolutionRate < 70) {
        recommendations.push('Tingkatkan kapasitas penanganan melalui pelatihan ulang petugas dan otomatisasi alur kerja.');
    }

    if (metrics.escalationRate > 15) {
        recommendations.push('Perkuat kanal mediasi awal agar laporan dapat selesai tanpa eskalasi lanjutan.');
    }

    if (metrics.resolutionSpeedScore < 60) {
        recommendations.push('Tinjau kembali SLA dan sederhanakan SOP agar waktu penyelesaian mendekati target tujuh hari.');
    }

    if (metrics.satisfactionScore < 70) {
        recommendations.push('Lakukan survei kepuasan lanjutan untuk memahami keluhan utama pelapor.');
    }

    if (!recommendations.length) {
        recommendations.push('Pertahankan praktik pelayanan saat ini dan lakukan pemantauan berkala terhadap tren laporan.');
    }

    return recommendations;
}

function buildMaladministrasiSummary(simulationName, analysisPeriodDays, metrics, risk) {
    const headline = metrics.serviceQualityIndex >= 80
        ? 'Pelayanan maladministrasi berada pada kategori prima.'
        : metrics.serviceQualityIndex >= 60
            ? 'Pelayanan berjalan cukup baik namun memerlukan penguatan pada beberapa aspek.'
            : 'Pelayanan berada pada zona waspada dan membutuhkan perbaikan segera.';

    const description = [
        `Selama ${analysisPeriodDays} hari, simulasi "${simulationName}" menerima ${metrics.totalReports.toLocaleString('id-ID')} laporan dengan ${metrics.maladministrationCases.toLocaleString('id-ID')} kasus maladministrasi teridentifikasi (${metrics.detectionRate.toFixed(1)}%).`,
        `${metrics.resolvedCases.toLocaleString('id-ID')} kasus berhasil diselesaikan (${metrics.resolutionRate.toFixed(1)}%) sementara ${metrics.backlogCases.toLocaleString('id-ID')} kasus masih tertunda.`,
        `Rata-rata penyelesaian ${metrics.averageResolutionDays.toFixed(1)} hari dengan ${metrics.escalationRate.toFixed(1)}% kasus membutuhkan eskalasi.`,
        `Skor kualitas layanan keseluruhan berada di ${metrics.serviceQualityIndex.toFixed(1)} dari 100.`
    ].join(' ');

    return {
        headline,
        description,
        riskLevel: risk.level,
        riskDescription: risk.description
    };
}

function normalizeName(value) {
    return (value || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function sanitizeCode(value) {
    return (value || '')
        .toString()
        .replace(/[^0-9]/g, '');
}

function parseCsvRecords(raw) {
    return raw
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('//'))
        .slice(1)
        .map(line => {
            try {
                const [id, name] = JSON.parse(`[${line}]`);
                return { id, name };
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

function getFieldValue(candidate, keys) {
    for (const key of keys) {
        const value = candidate?.[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}

function incrementCount(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
}

let wilayahDatasetCache = null;

async function loadWilayahDataset() {
    if (wilayahDatasetCache) {
        return wilayahDatasetCache;
    }

    const [provinsiRaw, kabupatenRaw, kecamatanRaw, kelurahanRaw] = await Promise.all([
        fs.readFile(path.resolve(wilayahDataDir, 'provinsi.csv'), 'utf8'),
        fs.readFile(path.resolve(wilayahDataDir, 'kabupaten_kota.csv'), 'utf8'),
        fs.readFile(path.resolve(wilayahDataDir, 'kecamatan.csv'), 'utf8'),
        fs.readFile(path.resolve(wilayahDataDir, 'kelurahan_desa.csv'), 'utf8')
    ]);

    const provinsiRecords = parseCsvRecords(provinsiRaw);
    const kabupatenRecords = parseCsvRecords(kabupatenRaw);
    const kecamatanRecords = parseCsvRecords(kecamatanRaw);
    const kelurahanRecords = parseCsvRecords(kelurahanRaw);

    const dataset = {
        provinces: [],
        provincesById: new Map(),
        provincesBySanitizedId: new Map(),
        provincesByName: new Map()
    };

    for (const record of provinsiRecords) {
        const normalizedName = normalizeName(record.name);
        const province = {
            id: record.id,
            sanitizedId: sanitizeCode(record.id),
            name: record.name,
            normalizedName,
            regencies: [],
            regencyIndexBySanitizedId: new Map(),
            regencyIndexByName: new Map()
        };
        dataset.provinces.push(province);
        dataset.provincesById.set(province.id, province);
        dataset.provincesBySanitizedId.set(province.sanitizedId, province);
        dataset.provincesByName.set(province.normalizedName, province);
    }

    for (const record of kabupatenRecords) {
        const segments = record.id.split('.');
        if (!segments.length) {
            continue;
        }
        const provinceId = segments[0];
        const province = dataset.provincesById.get(provinceId);
        if (!province) {
            continue;
        }

        const regency = {
            id: record.id,
            sanitizedId: sanitizeCode(record.id),
            name: record.name,
            normalizedName: normalizeName(record.name),
            provinceId,
            districts: [],
            districtIndexBySanitizedId: new Map(),
            districtIndexByName: new Map()
        };

        province.regencies.push(regency);
        province.regencyIndexBySanitizedId.set(regency.sanitizedId, regency);
        province.regencyIndexByName.set(regency.normalizedName, regency);
    }

    for (const record of kecamatanRecords) {
        const segments = record.id.split('.');
        if (segments.length < 3) {
            continue;
        }

        const provinceId = segments[0];
        const regencyKey = sanitizeCode(`${segments[0]}.${segments[1]}`);
        const province = dataset.provincesById.get(provinceId);
        if (!province) {
            continue;
        }

        const regency = province.regencyIndexBySanitizedId.get(regencyKey);
        if (!regency) {
            continue;
        }

        const district = {
            id: record.id,
            sanitizedId: sanitizeCode(record.id),
            name: record.name,
            normalizedName: normalizeName(record.name),
            provinceId,
            regencyId: `${segments[0]}.${segments[1]}`,
            subdistricts: [],
            subdistrictIndexBySanitizedId: new Map(),
            subdistrictIndexByName: new Map()
        };

        regency.districts.push(district);
        regency.districtIndexBySanitizedId.set(district.sanitizedId, district);
        regency.districtIndexByName.set(district.normalizedName, district);
    }

    for (const record of kelurahanRecords) {
        const segments = record.id.split('.');
        if (segments.length < 4) {
            continue;
        }

        const provinceId = segments[0];
        const regencyKey = sanitizeCode(`${segments[0]}.${segments[1]}`);
        const districtKey = sanitizeCode(`${segments[0]}.${segments[1]}.${segments[2]}`);
        const province = dataset.provincesById.get(provinceId);
        if (!province) {
            continue;
        }

        const regency = province.regencyIndexBySanitizedId.get(regencyKey);
        if (!regency) {
            continue;
        }

        const district = regency.districtIndexBySanitizedId.get(districtKey);
        if (!district) {
            continue;
        }

        const subdistrict = {
            id: record.id,
            sanitizedId: sanitizeCode(record.id),
            name: record.name,
            normalizedName: normalizeName(record.name),
            provinceId,
            regencyId: `${segments[0]}.${segments[1]}`,
            districtId: `${segments[0]}.${segments[1]}.${segments[2]}`
        };

        district.subdistricts.push(subdistrict);
        district.subdistrictIndexBySanitizedId.set(subdistrict.sanitizedId, subdistrict);
        district.subdistrictIndexByName.set(subdistrict.normalizedName, subdistrict);
    }

    wilayahDatasetCache = dataset;
    return dataset;
}

async function getAllCatatanWithFallback() {
    try {
        return await withContract(async (contract) => {
            const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
            const jsonString = decoder.decode(resultBytes);
            if (!jsonString) {
                return [];
            }
            const parsed = JSON.parse(jsonString);
            return Array.isArray(parsed) ? parsed : [];
        });
    } catch (err) {
        console.warn('Gagal mengambil catatan dari blockchain, menggunakan data sampel:', err.message);
        try {
            const sampleRaw = await fs.readFile(sampleDataPath, 'utf8');
            const sampleNotes = JSON.parse(sampleRaw);
            return Array.isArray(sampleNotes) ? sampleNotes : [];
        } catch (fallbackError) {
            console.error('Gagal memuat data sampel catatan:', fallbackError.message);
            return [];
        }
    }
}

function findProvinceForNote(dataset, note) {
    const provinceIdRaw = getFieldValue(note, ['provinceId', 'province_id', 'provinsiId', 'provinsi_id']);
    const provinceNameRaw = getFieldValue(note, ['provinceName', 'province_name', 'provinsiName', 'provinsi_name']);
    const sanitizedId = sanitizeCode(provinceIdRaw);

    let province = null;
    if (sanitizedId) {
        province = dataset.provincesBySanitizedId.get(sanitizedId);
    }

    if (!province && provinceNameRaw) {
        const normalized = normalizeName(provinceNameRaw);
        province = dataset.provincesByName.get(normalized);
    }

    return province || null;
}

function findRegencyForNote(province, note) {
    const regencyIdRaw = getFieldValue(note, ['cityId', 'city_id', 'regencyId', 'regency_id', 'kabupatenId', 'kabupaten_id']);
    const regencyNameRaw = getFieldValue(note, ['cityName', 'city_name', 'regencyName', 'regency_name', 'kabupatenName', 'kabupaten_name']);
    let regency = null;

    const sanitizedId = sanitizeCode(regencyIdRaw);
    if (sanitizedId) {
        regency = province.regencyIndexBySanitizedId.get(sanitizedId);
        if (!regency && sanitizedId.length > 4) {
            regency = province.regencyIndexBySanitizedId.get(sanitizedId.slice(0, 4));
        }
    }

    if (!regency && regencyNameRaw) {
        const normalized = normalizeName(regencyNameRaw);
        regency = province.regencyIndexByName.get(normalized);
    }

    return regency || null;
}

function findDistrictForNote(regency, note) {
    const districtNameRaw = getFieldValue(note, ['districtName', 'district_name', 'kecamatanName', 'kecamatan_name']);
    if (districtNameRaw) {
        const normalized = normalizeName(districtNameRaw);
        const byName = regency.districtIndexByName.get(normalized);
        if (byName) {
            return byName;
        }
    }

    const districtIdRaw = getFieldValue(note, ['districtId', 'district_id', 'kecamatanId', 'kecamatan_id']);
    const sanitizedId = sanitizeCode(districtIdRaw);
    if (!sanitizedId) {
        return null;
    }

    let district = regency.districtIndexBySanitizedId.get(sanitizedId);
    if (district) {
        return district;
    }

    const fallbackLength = regency.sanitizedId.length + 2;
    if (sanitizedId.length >= fallbackLength) {
        district = regency.districtIndexBySanitizedId.get(sanitizedId.slice(0, fallbackLength));
        if (district) {
            return district;
        }
    }

    if (sanitizedId.length >= 6) {
        district = regency.districtIndexBySanitizedId.get(sanitizedId.slice(0, 6));
        if (district) {
            return district;
        }
    }

    return null;
}

function findSubdistrictForNote(district, note) {
    const subdistrictNameRaw = getFieldValue(note, ['subdistrictName', 'subdistrict_name', 'kelurahanName', 'kelurahan_name', 'desaName', 'desa_name']);
    if (subdistrictNameRaw) {
        const normalized = normalizeName(subdistrictNameRaw);
        const byName = district.subdistrictIndexByName.get(normalized);
        if (byName) {
            return byName;
        }
    }

    const subdistrictIdRaw = getFieldValue(note, ['subdistrictId', 'subdistrict_id', 'kelurahanId', 'kelurahan_id', 'desaId', 'desa_id']);
    const sanitizedId = sanitizeCode(subdistrictIdRaw);
    if (!sanitizedId) {
        return null;
    }

    let subdistrict = district.subdistrictIndexBySanitizedId.get(sanitizedId);
    if (subdistrict) {
        return subdistrict;
    }

    const fallbackLength = district.sanitizedId.length + 4;
    if (sanitizedId.length >= fallbackLength) {
        subdistrict = district.subdistrictIndexBySanitizedId.get(sanitizedId.slice(0, fallbackLength));
        if (subdistrict) {
            return subdistrict;
        }
    }

    if (sanitizedId.length >= 10) {
        subdistrict = district.subdistrictIndexBySanitizedId.get(sanitizedId.slice(0, 10));
        if (subdistrict) {
            return subdistrict;
        }
    }

    return null;
}

function aggregateWilayahCounts(dataset, notes) {
    const counts = {
        totalReports: Array.isArray(notes) ? notes.length : 0,
        provinces: new Map(),
        regencies: new Map(),
        districts: new Map(),
        subdistricts: new Map()
    };

    if (!Array.isArray(notes)) {
        return counts;
    }

    for (const note of notes) {
        const province = findProvinceForNote(dataset, note);
        if (!province) {
            continue;
        }

        incrementCount(counts.provinces, province.id);

        const regency = findRegencyForNote(province, note);
        if (!regency) {
            continue;
        }

        incrementCount(counts.regencies, regency.sanitizedId);

        const district = findDistrictForNote(regency, note);
        if (!district) {
            continue;
        }

        incrementCount(counts.districts, district.sanitizedId);

        const subdistrict = findSubdistrictForNote(district, note);
        if (!subdistrict) {
            continue;
        }

        incrementCount(counts.subdistricts, subdistrict.sanitizedId);
    }

    return counts;
}

let wilayahAggregationCache = null;
let wilayahAggregationCacheTimestamp = 0;
const WILAYAH_AGGREGATION_TTL_MS = 30 * 1000;

async function buildWilayahReportContext() {
    const now = Date.now();
    if (wilayahAggregationCache && (now - wilayahAggregationCacheTimestamp) < WILAYAH_AGGREGATION_TTL_MS) {
        return wilayahAggregationCache;
    }

    const dataset = await loadWilayahDataset();
    const notes = await getAllCatatanWithFallback();
    const counts = aggregateWilayahCounts(dataset, notes);

    wilayahAggregationCache = { dataset, counts };
    wilayahAggregationCacheTimestamp = now;
    return wilayahAggregationCache;
}

function analyzeMaladministrasiSimulation(input) {
    const simulationName = typeof input.simulationName === 'string' && input.simulationName.trim()
        ? input.simulationName.trim()
        : 'Simulasi Maladministrasi';

    const analysisPeriodDays = Math.max(toNonNegativeNumber(input.analysisPeriodDays, 30), 1);
    const totalReports = toNonNegativeNumber(input.totalReports, 0);
    const maladministrationRaw = toNonNegativeNumber(input.maladministrationCases, 0);
    const resolvedRaw = toNonNegativeNumber(input.resolvedCases, 0);
    const escalatedRaw = toNonNegativeNumber(input.escalatedCases, 0);
    const averageResolutionDays = toNonNegativeNumber(input.averageResolutionDays, 0);
    const satisfactionScore = clampNumber(toNonNegativeNumber(input.satisfactionScore, 0), 0, 100);

    const normalizationNotes = [];

    let maladministrationCases = Math.min(maladministrationRaw, totalReports);
    if (maladministrationRaw > totalReports) {
        normalizationNotes.push('Kasus maladministrasi melebihi total laporan dan telah disesuaikan ke nilai maksimal yang wajar.');
    }

    let resolvedCases = Math.min(resolvedRaw, maladministrationCases);
    if (resolvedRaw > maladministrationCases) {
        normalizationNotes.push('Kasus selesai melebihi jumlah maladministrasi dan telah disesuaikan.');
    }

    let escalatedCases = Math.min(escalatedRaw, maladministrationCases);
    if (escalatedRaw > maladministrationCases) {
        normalizationNotes.push('Kasus eskalasi melebihi jumlah maladministrasi dan telah dipangkas.');
    }

    const combinedHandled = resolvedCases + escalatedCases;
    if (combinedHandled > maladministrationCases) {
        const overflow = combinedHandled - maladministrationCases;
        if (overflow > 0) {
            const adjustment = Math.min(overflow, resolvedCases);
            resolvedCases -= adjustment;
            normalizationNotes.push('Total kasus selesai dan eskalasi melampaui jumlah maladministrasi, sehingga nilai penyelesaian disesuaikan.');
        }
    }

    const backlogCases = Math.max(maladministrationCases - resolvedCases - escalatedCases, 0);
    const detectionRate = clampNumber(safeDivide(maladministrationCases, totalReports) * 100, 0, 100);
    const resolutionRate = clampNumber(safeDivide(resolvedCases, maladministrationCases || 1) * 100, 0, 100);
    const escalationRate = clampNumber(safeDivide(escalatedCases, maladministrationCases || 1) * 100, 0, 100);
    const backlogRate = clampNumber(safeDivide(backlogCases, maladministrationCases || 1) * 100, 0, 100);
    const throughputPerDay = Number(safeDivide(maladministrationCases, analysisPeriodDays).toFixed(2));
    const resolutionSpeedScore = clampNumber(100 - Math.min((averageResolutionDays / 7) * 100, 100), 0, 100);
    const serviceQualityIndex = clampNumber(
        Number(((resolutionRate * 0.4) + ((100 - escalationRate) * 0.2) + (resolutionSpeedScore * 0.2) + (satisfactionScore * 0.2)).toFixed(2)),
        0,
        100
    );

    const risk = determineMaladministrasiRisk(serviceQualityIndex, backlogRate, escalationRate);
    const summary = buildMaladministrasiSummary(simulationName, analysisPeriodDays, {
        totalReports,
        maladministrationCases,
        resolvedCases,
        escalatedCases,
        backlogCases,
        detectionRate,
        resolutionRate,
        escalationRate,
        backlogRate,
        throughputPerDay,
        averageResolutionDays,
        satisfactionScore,
        resolutionSpeedScore,
        serviceQualityIndex
    }, risk);

    const recommendations = buildMaladministrasiRecommendations({
        backlogRate,
        resolutionRate,
        escalationRate,
        resolutionSpeedScore,
        satisfactionScore
    });

    return {
        simulationName,
        generatedAt: new Date().toISOString(),
        analysisPeriodDays,
        metrics: {
            totalReports,
            maladministrationCases,
            resolvedCases,
            escalatedCases,
            backlogCases,
            detectionRate,
            resolutionRate,
            escalationRate,
            backlogRate,
            throughputPerDay,
            averageResolutionDays,
            satisfactionScore,
            resolutionSpeedScore,
            serviceQualityIndex,
            riskLevel: risk.level
        },
        summary,
        recommendations,
        metadata: {
            normalizationNotes,
            rawInput: {
                totalReports,
                maladministrationCases: maladministrationRaw,
                resolvedCases: resolvedRaw,
                escalatedCases: escalatedRaw,
                averageResolutionDays,
                satisfactionScore
            }
        }
    };
}

function formatMetricValue(value, precision) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Number(numeric.toFixed(precision));
}

function getPerformanceValue(block, key) {
    if (block?.performance && typeof block.performance[key] === 'number') {
        return block.performance[key];
    }
    return defaultPerformanceSnapshot()[key];
}

function collectMetricValues(blocks, key) {
    if (!blocks.length) {
        return [defaultPerformanceSnapshot()[key]];
    }

    return blocks.map((block) => getPerformanceValue(block, key));
}

function determineTrend(change, percentChange) {
    if (percentChange === null) {
        return 'stable';
    }

    if (Math.abs(percentChange) < 0.5) {
        return 'stable';
    }

    if (change > 0) {
        return 'increasing';
    }

    if (change < 0) {
        return 'decreasing';
    }

    return 'stable';
}

function analyzeMetric(blocks, key) {
    const { precision } = PERFORMANCE_METRICS[key] ?? { precision: 2 };
    const baselineSnapshot = defaultPerformanceSnapshot();
    const baselineValue = baselineSnapshot[key];
    const values = collectMetricValues(blocks, key);

    const start = values[0];
    const end = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const total = values.reduce((sum, value) => sum + value, 0);
    const average = total / values.length;
    const change = end - start;
    const percentChange = start !== 0 ? (change / start) * 100 : null;

    return {
        baseline: formatMetricValue(baselineValue, precision),
        start: formatMetricValue(start, precision),
        end: formatMetricValue(end, precision),
        min: formatMetricValue(min, precision),
        max: formatMetricValue(max, precision),
        average: formatMetricValue(average, precision),
        change: formatMetricValue(change, Math.max(2, precision)),
        percentChange: percentChange === null ? null : Number(percentChange.toFixed(2)),
        trend: determineTrend(change, percentChange)
    };
}

function buildPerformanceAnalysis(blocks) {
    return PERFORMANCE_METRIC_KEYS.reduce((analysis, key) => {
        analysis[key] = analyzeMetric(blocks, key);
        return analysis;
    }, {});
}

function buildMetricSeries(blocks, key, generatedAt) {
    const { precision } = PERFORMANCE_METRICS[key] ?? { precision: 2 };

    if (!blocks.length) {
        return [{
            blockNumber: 0,
            timestamp: generatedAt,
            value: formatMetricValue(defaultPerformanceSnapshot()[key], precision),
            isBaseline: true
        }];
    }

    return blocks.map((block) => ({
        blockNumber: block.blockNumber,
        timestamp: block.timestamp,
        value: formatMetricValue(getPerformanceValue(block, key), precision)
    }));
}

function buildPerformanceSeries(blocks, generatedAt) {
    return PERFORMANCE_METRIC_KEYS.reduce((series, key) => {
        series[key] = buildMetricSeries(blocks, key, generatedAt);
        return series;
    }, {});
}

function buildBlockPerformanceResponse(blocks, generatedAt) {
    const baselineSnapshot = defaultPerformanceSnapshot();

    if (!blocks.length) {
        const performance = PERFORMANCE_METRIC_KEYS.reduce((acc, key) => {
            const { precision } = PERFORMANCE_METRICS[key];
            acc[key] = formatMetricValue(baselineSnapshot[key], precision);
            return acc;
        }, {});

        return [{
            blockNumber: 0,
            timestamp: generatedAt,
            isBaseline: true,
            performance,
            deltas: {
                fromBaseline: PERFORMANCE_METRIC_KEYS.reduce((acc, key) => {
                    acc[key] = 0;
                    return acc;
                }, {}),
                fromPreviousBlock: null
            }
        }];
    }

    return blocks.map((block, index) => {
        const snapshot = block.performance || baselineSnapshot;
        const previousBlock = index > 0 ? blocks[index - 1] : null;
        const previousSnapshot = previousBlock?.performance || (previousBlock ? baselineSnapshot : null);

        const performance = PERFORMANCE_METRIC_KEYS.reduce((acc, key) => {
            const { precision } = PERFORMANCE_METRICS[key];
            acc[key] = formatMetricValue(snapshot[key] ?? baselineSnapshot[key], precision);
            return acc;
        }, {});

        const deltasFromBaseline = PERFORMANCE_METRIC_KEYS.reduce((acc, key) => {
            const { precision } = PERFORMANCE_METRICS[key];
            const value = snapshot[key] ?? baselineSnapshot[key];
            acc[key] = formatMetricValue(value - baselineSnapshot[key], Math.max(2, precision));
            return acc;
        }, {});

        let deltasFromPrevious = null;
        if (previousSnapshot) {
            deltasFromPrevious = PERFORMANCE_METRIC_KEYS.reduce((acc, key) => {
                const { precision } = PERFORMANCE_METRICS[key];
                const value = snapshot[key] ?? baselineSnapshot[key];
                const previousValue = previousSnapshot[key] ?? baselineSnapshot[key];
                acc[key] = formatMetricValue(value - previousValue, Math.max(2, precision));
                return acc;
            }, {});
        }

        return {
            blockNumber: block.blockNumber,
            timestamp: block.timestamp,
            isBaseline: false,
            performance,
            deltas: {
                fromBaseline: deltasFromBaseline,
                fromPreviousBlock: deltasFromPrevious
            }
        };
    });
}

function generatePerformanceMetrics(index, totalBlocks) {
    if (totalBlocks <= 1) {
        return defaultPerformanceSnapshot();
    }

    const angle = (index / totalBlocks) * Math.PI * 2;
    const sinComponent = Math.sin(angle);
    const cosComponent = Math.cos(angle);

    return {
        averageLatencyMs: Math.max(
            120,
            Math.round(
                PERFORMANCE_BASELINE.latencyMs + sinComponent * 8 + cosComponent * 4
            )
        ),
        peakThroughputTPS: Math.max(
            64,
            Math.round(
                PERFORMANCE_BASELINE.throughputTps + sinComponent * 6 + cosComponent * 3
            )
        ),
        blockSizeKB: Math.max(
            128,
            Number(
                (
                    PERFORMANCE_BASELINE.blockSizeKb +
                    sinComponent * 28 +
                    cosComponent * 14
                ).toFixed(1)
            )
        ),
        commitTimeSec: Math.max(
            1.2,
            Number(
                (
                    PERFORMANCE_BASELINE.commitTimeSec +
                    sinComponent * 0.18 +
                    cosComponent * 0.09
                ).toFixed(2)
            )
        )
    };
}

function generateHashChainBlocks(notes) {
    const blocks = [];
    const totalBlocks = notes.length || 0;
    let previousHash = crypto.createHash('sha256').update('genesis-block').digest('hex');
    const baseTime = Date.now();

    notes.forEach((note, index) => {
        const blockNumber = index + 1;
        const timestamp = new Date(
            baseTime - (totalBlocks - index) * BLOCK_INTERVAL_MS
        ).toISOString();

        const blockData = {
            blockNumber,
            timestamp,
            data: note,
            previousHash
        };

        const currentHash = crypto.createHash('sha256')
            .update(JSON.stringify(blockData))
            .digest('hex');

        blocks.push({
            ...blockData,
            currentHash,
            isValid: true,
            performance: generatePerformanceMetrics(index, Math.max(totalBlocks, 1))
        });

        previousHash = currentHash;
    });

    return blocks;
}

function summarizePerformance(blocks) {
    if (!blocks.length) {
        return {
            averageLatencyMs: PERFORMANCE_BASELINE.latencyMs,
            peakThroughputTPS: PERFORMANCE_BASELINE.throughputTps,
            averageBlockSizeKB: PERFORMANCE_BASELINE.blockSizeKb,
            averageCommitTimeSec: PERFORMANCE_BASELINE.commitTimeSec
        };
    }

    const totals = blocks.reduce((acc, block) => {
        const metrics = block.performance || defaultPerformanceSnapshot();
        acc.latency += metrics.averageLatencyMs;
        acc.throughput += metrics.peakThroughputTPS;
        acc.blockSize += metrics.blockSizeKB;
        acc.commit += metrics.commitTimeSec;
        return acc;
    }, {
        latency: 0,
        throughput: 0,
        blockSize: 0,
        commit: 0
    });

    return {
        averageLatencyMs: Math.round(totals.latency / blocks.length),
        peakThroughputTPS: Math.round(totals.throughput / blocks.length),
        averageBlockSizeKB: Number((totals.blockSize / blocks.length).toFixed(1)),
        averageCommitTimeSec: Number((totals.commit / blocks.length).toFixed(2))
    };
}

async function loadLogoSvg() {
    const now = Date.now();
    if (cachedLogoSvg && (now - cachedLogoFetchedAt) < LOGO_CACHE_TTL_MS) {
        return cachedLogoSvg;
    }

    try {
        const response = await fetch(remoteLogoUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch remote logo asset. Status: ${response.status}`);
        }

        const logoSvg = await response.text();
        cachedLogoSvg = logoSvg;
        cachedLogoFetchedAt = now;
        return logoSvg;
    } catch (err) {
        if (cachedLogoSvg) {
            console.warn('Falling back to cached logo asset after fetch failure:', err);
            return cachedLogoSvg;
        }
        throw err;
    }
}

function normalizeSampleRecord(record, index, total) {
    const fallbackTimestamp = new Date(
        Date.now() - (total - index) * BLOCK_INTERVAL_MS
    ).toISOString();

    const createdAt = record.createdAt || fallbackTimestamp;
    const createdAtDisplay = record.createdAtDisplay || createdAt;

    return {
        ...record,
        id: record.id || `sample-note-${String(index + 1).padStart(3, '0')}`,
        createdAt,
        createdAtDisplay
    };
}

async function readSampleCatatan() {
    try {
        const sampleContent = await fs.readFile(sampleDataPath, 'utf8');
        const parsed = JSON.parse(sampleContent);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.map((record, index) =>
            normalizeSampleRecord(record, index, parsed.length)
        );
    } catch (err) {
        console.error('Failed to read sample catatan data for fallback usage:', err);
        return [];
    }
}

async function readCatatanFromBlockchain() {
    return await withContract(async (contract) => {
        const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
        const jsonString = decoder.decode(resultBytes);
        if (!jsonString) {
            return [];
        }
        return JSON.parse(jsonString);
    });
}

async function loadCatatanData(options = {}) {
    const {
        fallbackToSample = false,
        ensureMinimumRecords = false
    } = options;
    try {
        const catatan = await readCatatanFromBlockchain();
        const records = Array.isArray(catatan) ? catatan : [];
        let metadata = {
            source: 'blockchain',
            fallbackUsed: false
        };

        if (ensureMinimumRecords && records.length === 0 && fallbackToSample) {
            const sampleRecords = await readSampleCatatan();
            if (sampleRecords.length > 0) {
                return {
                    records: sampleRecords,
                    metadata: {
                        source: 'sample',
                        fallbackUsed: true,
                        fallbackReason: 'No blockchain records were available to generate performance metrics'
                    }
                };
            }
        }

        return { records, metadata };
    } catch (err) {
        if (!fallbackToSample) {
            throw err;
        }

        console.warn('Falling back to bundled sample data after blockchain read failure:', err);
        const sampleRecords = await readSampleCatatan();
        let metadata = {
            source: 'sample',
            fallbackUsed: true,
            fallbackReason: err instanceof Error ? err.message : String(err)
        };

        if (ensureMinimumRecords && sampleRecords.length === 0) {
            metadata = {
                ...metadata,
                fallbackReason: `${metadata.fallbackReason}; bundled sample dataset is empty`
            };
        }

        return {
            records: sampleRecords,
            metadata
        };
    }
}

async function sendLogoSvg(res) {
    try {
        const logoSvg = await loadLogoSvg();
        res.type('image/svg+xml');
        res.send(logoSvg);
    } catch (err) {
        console.error('Failed to serve logo asset:', err);
        res.status(500).json({
            error: true,
            message: 'Unable to load logo asset'
        });
    }
}

async function headLogoSvg(res) {
    try {
        const logoSvg = await loadLogoSvg();
        res.type('image/svg+xml');
        res.setHeader('Content-Length', Buffer.byteLength(logoSvg));
        res.status(200).end();
    } catch (err) {
        console.error('Failed to respond to HEAD request for logo asset:', err);
        res.sendStatus(500);
    }
}

app.get('/logo-gasnyoba.svg', async (_req, res) => {
    await sendLogoSvg(res);
});

app.head('/logo-gasnyoba.svg', async (_req, res) => {
    await headLogoSvg(res);
});

app.get('/favicon.ico', async (_req, res) => {
    await sendLogoSvg(res);
});

app.head('/favicon.ico', async (_req, res) => {
    await headLogoSvg(res);
});

// 🔗 Koneksi Fabric
async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
        'grpc.keepalive_time_ms': 120000,
        'grpc.keepalive_timeout_ms': 20000,
        'grpc.keepalive_permit_without_calls': true,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.min_ping_interval_without_data_ms': 300000
    });
}

async function newIdentity() {
    const [certFile] = await fs.readdir(certDirPath);
    const credentials = await fs.readFile(path.join(certDirPath, certFile));
    return { mspId, credentials };
}

async function newSigner() {
    const [keyFile] = await fs.readdir(keyDirPath);
    const privateKeyPem = await fs.readFile(path.join(keyDirPath, keyFile));
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

async function withContract(handler) {
    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        hash: hash.sha256,
        evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
        endorseOptions: () => ({ deadline: Date.now() + 15000 }),
        submitOptions: () => ({ deadline: Date.now() + 30000 })
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);
        return await handler(contract);
    } finally {
        gateway.close();
        client.close();
    }
}

async function submitWithRetry(contract, functionName, ...args) {
    const maxRetries = 3;
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await contract.submitTransaction(functionName, ...args);
            return result;
        } catch (err) {
            lastError = err;
            console.error(`Attempt ${i+1} failed:`, err.message);
            
            // Handle specific endorsement errors
            if ((err.message.includes('failed to collect enough transaction endorsements') || 
                 err.message.includes('ProposalResponsePayloads do not match')) && 
                 i < maxRetries - 1) {
                const backoffTime = 1000 * Math.pow(2, i); // Exponential backoff
                console.log(`Retrying in ${backoffTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                continue;
            }
            throw err;
        }
    }
    
    throw lastError;
}

// Serve API documentation at root route
app.get('/', (req, res) => {
    const docsPath = path.resolve(__dirname, '../dashboard.html');
    res.sendFile(docsPath);
});

// 🔄 API Endpoints

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const health = await checkNetworkHealth();
        if (health.status === 'healthy') {
            res.json({
                error: false,
                message: 'System is healthy',
                data: health
            });
        } else {
            res.status(503).json({
                error: true,
                message: 'System is unhealthy',
                data: health
            });
        }
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// Endpoint untuk mendapatkan informasi blockchain
app.get('/api/blockchain/info', async (req, res) => {
    try {
        const catatan = await withContract(async (contract) => {
            const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
            const jsonString = decoder.decode(resultBytes);
            if (!jsonString) {
                return [];
            }
            return JSON.parse(jsonString);
        });

        const notesArray = Array.isArray(catatan) ? catatan : [];
        const dataString = JSON.stringify(notesArray);
        const timestamp = new Date().toISOString();
        const currentBlockHash = crypto.createHash('sha256').update(dataString + timestamp).digest('hex');
        const previousBlockHash = crypto.createHash('sha256').update(dataString).digest('hex');
        const genesisHash = crypto.createHash('sha256').update('pelaporan-standard-genesis').digest('hex');

        res.json({
            error: false,
            message: 'Blockchain info retrieved successfully',
            data: {
                network: {
                    channelName,
                    chaincodeName,
                    mspId,
                    peerEndpoint
                },
                blockchain: {
                    currentBlockHash: currentBlockHash.substring(0, 32),
                    previousBlockHash: previousBlockHash.substring(0, 32),
                    genesisHash: genesisHash.substring(0, 32),
                    blockHeight: notesArray.length + 1,
                    transactionCount: notesArray.length
                },
                timestamp
            }
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// Endpoint untuk mendapatkan hash dari catatan tertentu
app.get('/api/catatan/:id/hash', async (req, res) => {
    try {
        const data = await withContract(async (contract) => {
            const resultBytes = await contract.evaluateTransaction('ReadCatatan', req.params.id);
            return JSON.parse(decoder.decode(resultBytes));
        });

        const dataString = JSON.stringify(data);
        const catatanHash = crypto.createHash('sha256').update(dataString).digest('hex');
        const shortHash = catatanHash.substring(0, 16);
        const previousHash = crypto.createHash('sha256').update(req.params.id).digest('hex').substring(0, 16);

        res.json({
            error: false,
            message: 'Catatan hash retrieved successfully',
            data: {
                id: req.params.id,
                currentHash: catatanHash,
                shortHash,
                previousHash,
                dataSize: dataString.length,
                timestamp: new Date().toISOString(),
                blockchain: {
                    channelName,
                    chaincodeName,
                    mspId
                }
            }
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// Mendapatkan daftar catatan digital
app.get('/api/catatan', async (req, res) => {
    try {
        const catatan = await withContract(async (contract) => {
            const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
            const jsonString = decoder.decode(resultBytes);
            if (!jsonString) {
                return [];
            }
            return JSON.parse(jsonString);
        });

        const normalized = Array.isArray(catatan) ? catatan : [];
        const sorted = normalized.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
            const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
            return dateB - dateA;
        });

        res.json({
            error: false,
            message: 'success',
            total_data: sorted.length,
            data: sorted.map(item => ({
                ...item,
                createdAtDisplay: item.createdAtDisplay || item.createdAt || null
            }))
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

// Mendapatkan catatan berdasarkan ID
app.get('/api/catatan/:id', async (req, res) => {
    try {
        const data = await withContract(async (contract) => {
            const resultBytes = await contract.evaluateTransaction('ReadCatatan', req.params.id);
            return JSON.parse(decoder.decode(resultBytes));
        });

        res.json({
            error: false,
            message: 'success',
            total_data: 1,
            data
        });
    } catch (err) {
        res.status(404).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

// Menambahkan catatan baru ke blockchain
app.post('/api/catatan', async (req, res) => {
    try {
        const incoming = req.body || {};
        const generatedId = incoming.id || `catatan-${crypto.randomUUID()}`;
        const newCatatan = {
            ...incoming,
            id: generatedId,
        };

        if (!newCatatan.createdAt) {
            const now = new Date().toISOString();
            newCatatan.createdAt = now;
            newCatatan.createdAtDisplay = now;
        } else if (!newCatatan.createdAtDisplay) {
            newCatatan.createdAtDisplay = newCatatan.createdAt;
        }

        await withContract(async (contract) => {
            await submitWithRetry(contract, 'CreateCatatan', newCatatan.id, JSON.stringify(newCatatan));
        });

        res.status(201).json({
            error: false,
            message: 'Catatan berhasil dibuat',
            total_data: 1,
            data: newCatatan
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

// Mengimpor data sampel catatan digital ke blockchain
app.post('/api/catatan/seed', async (req, res) => {
    try {
        const samplePath = path.resolve(__dirname, '../sample.json');
        const sampleRaw = await fs.readFile(samplePath, 'utf8');
        const sampleNotes = JSON.parse(sampleRaw);

        const result = await withContract(async (contract) => {
            const existingBytes = await contract.evaluateTransaction('GetAllCatatan');
            const existingString = decoder.decode(existingBytes);
            const existingNotes = existingString ? JSON.parse(existingString) : [];
            const existingIds = new Set((existingNotes || []).map(note => note.id));

            const created = [];
            const skipped = [];

            for (const note of sampleNotes) {
                if (!note.id) {
                    continue;
                }

                if (existingIds.has(note.id)) {
                    skipped.push(note.id);
                    continue;
                }

                await submitWithRetry(contract, 'CreateCatatan', note.id, JSON.stringify(note));
                created.push(note.id);
            }

            return {
                created,
                skipped,
                requested: sampleNotes.length
            };
        });

        res.json({
            error: false,
            message: 'Sample catatan imported successfully',
            total_data: result.created.length,
            data: result
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

app.get('/api/wilayah/pelaporan', async (_req, res) => {
    try {
        const { dataset, counts } = await buildWilayahReportContext();
        const provinces = dataset.provinces
            .map(province => ({
                id: province.id,
                sanitizedId: province.sanitizedId,
                name: province.name,
                totalReports: counts.provinces.get(province.id) || 0,
                regencyCount: province.regencies.length
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));

        res.json({
            error: false,
            message: 'success',
            total_reports: counts.totalReports,
            total_data: provinces.length,
            data: provinces
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_reports: 0,
            total_data: 0,
            data: null
        });
    }
});

app.get('/api/wilayah/pelaporan/provinsi/:provinceId', async (req, res) => {
    try {
        const provinceId = sanitizeCode(req.params.provinceId);
        const { dataset, counts } = await buildWilayahReportContext();
        const province = dataset.provincesBySanitizedId.get(provinceId);

        if (!province) {
            res.status(404).json({
                error: true,
                message: 'Provinsi tidak ditemukan',
                total_reports: counts.totalReports,
                total_data: 0,
                data: null
            });
            return;
        }

        const regencies = province.regencies
            .map(regency => ({
                id: regency.id,
                sanitizedId: regency.sanitizedId,
                name: regency.name,
                totalReports: counts.regencies.get(regency.sanitizedId) || 0,
                districtCount: regency.districts.length
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));

        res.json({
            error: false,
            message: 'success',
            total_reports: counts.totalReports,
            total_data: regencies.length,
            parent: {
                id: province.id,
                sanitizedId: province.sanitizedId,
                name: province.name,
                totalReports: counts.provinces.get(province.id) || 0
            },
            data: regencies
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_reports: 0,
            total_data: 0,
            data: null
        });
    }
});

app.get('/api/wilayah/pelaporan/provinsi/:provinceId/kabupaten/:regencyId', async (req, res) => {
    try {
        const provinceId = sanitizeCode(req.params.provinceId);
        const regencyId = sanitizeCode(req.params.regencyId);
        const { dataset, counts } = await buildWilayahReportContext();
        const province = dataset.provincesBySanitizedId.get(provinceId);

        if (!province) {
            res.status(404).json({
                error: true,
                message: 'Provinsi tidak ditemukan',
                total_reports: counts.totalReports,
                total_data: 0,
                data: null
            });
            return;
        }

        const regency = province.regencyIndexBySanitizedId.get(regencyId);
        if (!regency) {
            res.status(404).json({
                error: true,
                message: 'Kabupaten/kota tidak ditemukan',
                total_reports: counts.totalReports,
                total_data: 0,
                data: null
            });
            return;
        }

        const districts = regency.districts
            .map(district => ({
                id: district.id,
                sanitizedId: district.sanitizedId,
                name: district.name,
                totalReports: counts.districts.get(district.sanitizedId) || 0,
                subdistrictCount: district.subdistricts.length
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));

        res.json({
            error: false,
            message: 'success',
            total_reports: counts.totalReports,
            total_data: districts.length,
            parent: {
                province: {
                    id: province.id,
                    sanitizedId: province.sanitizedId,
                    name: province.name,
                    totalReports: counts.provinces.get(province.id) || 0
                },
                regency: {
                    id: regency.id,
                    sanitizedId: regency.sanitizedId,
                    name: regency.name,
                    totalReports: counts.regencies.get(regency.sanitizedId) || 0
                }
            },
            data: districts
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_reports: 0,
            total_data: 0,
            data: null
        });
    }
});

app.get('/api/wilayah/pelaporan/provinsi/:provinceId/kabupaten/:regencyId/kecamatan/:districtId', async (req, res) => {
    try {
        const provinceId = sanitizeCode(req.params.provinceId);
        const regencyId = sanitizeCode(req.params.regencyId);
        const districtId = sanitizeCode(req.params.districtId);
        const { dataset, counts } = await buildWilayahReportContext();
        const province = dataset.provincesBySanitizedId.get(provinceId);

        if (!province) {
            res.status(404).json({
                error: true,
                message: 'Provinsi tidak ditemukan',
                total_reports: counts.totalReports,
                total_data: 0,
                data: null
            });
            return;
        }

        const regency = province.regencyIndexBySanitizedId.get(regencyId);
        if (!regency) {
            res.status(404).json({
                error: true,
                message: 'Kabupaten/kota tidak ditemukan',
                total_reports: counts.totalReports,
                total_data: 0,
                data: null
            });
            return;
        }

        const district = regency.districtIndexBySanitizedId.get(districtId);
        if (!district) {
            res.status(404).json({
                error: true,
                message: 'Kecamatan tidak ditemukan',
                total_reports: counts.totalReports,
                total_data: 0,
                data: null
            });
            return;
        }

        const subdistricts = district.subdistricts
            .map(subdistrict => ({
                id: subdistrict.id,
                sanitizedId: subdistrict.sanitizedId,
                name: subdistrict.name,
                totalReports: counts.subdistricts.get(subdistrict.sanitizedId) || 0
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));

        res.json({
            error: false,
            message: 'success',
            total_reports: counts.totalReports,
            total_data: subdistricts.length,
            parent: {
                province: {
                    id: province.id,
                    sanitizedId: province.sanitizedId,
                    name: province.name,
                    totalReports: counts.provinces.get(province.id) || 0
                },
                regency: {
                    id: regency.id,
                    sanitizedId: regency.sanitizedId,
                    name: regency.name,
                    totalReports: counts.regencies.get(regency.sanitizedId) || 0
                },
                district: {
                    id: district.id,
                    sanitizedId: district.sanitizedId,
                    name: district.name,
                    totalReports: counts.districts.get(district.sanitizedId) || 0
                }
            },
            data: subdistricts
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_reports: 0,
            total_data: 0,
            data: null
        });
    }
});

// Endpoint untuk metrik performa blockchain per blok
app.get('/api/blockchain/performance', async (_req, res) => {
    try {
        const { records, metadata } = await loadCatatanData({
            fallbackToSample: true,
            ensureMinimumRecords: true
        });
        const blocks = generateHashChainBlocks(records);
        const generatedAt = new Date().toISOString();
        const summary = summarizePerformance(blocks);
        const analysis = buildPerformanceAnalysis(blocks);
        const series = buildPerformanceSeries(blocks, generatedAt);
        const blockDetails = buildBlockPerformanceResponse(blocks, generatedAt);
        const baselineSnapshot = defaultPerformanceSnapshot();
        const usingBaselineOnly = blocks.length === 0;
        const responseMetadata = {
            ...metadata,
            recordCount: records.length,
            generatedAt,
            metricsTracked: PERFORMANCE_METRIC_KEYS,
            baseline: baselineSnapshot,
            usesBaselineOnly: usingBaselineOnly
        };

        res.json({
            error: false,
            message: metadata.fallbackUsed
                ? 'Blockchain performance metrics generated from fallback dataset'
                : 'Blockchain performance metrics generated successfully',
            data: {
                generatedAt,
                totalBlocks: blocks.length,
                summary,
                analysis,
                series,
                blocks: blockDetails,
                metadata: responseMetadata
            }
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

app.post('/api/simulasi/maladministrasi/analyze', (req, res) => {
    try {
        const {
            simulationName,
            analysisPeriodDays,
            totalReports,
            maladministrationCases,
            resolvedCases,
            escalatedCases,
            averageResolutionDays,
            satisfactionScore
        } = req.body || {};

        const payload = analyzeMaladministrasiSimulation({
            simulationName,
            analysisPeriodDays,
            totalReports,
            maladministrationCases,
            resolvedCases,
            escalatedCases,
            averageResolutionDays,
            satisfactionScore
        });

        res.json({
            error: false,
            message: 'Analisa simulasi maladministrasi berhasil dibuat',
            data: payload
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// Endpoint untuk simulasi hash chain verification
app.get('/api/blockchain/verify-chain', async (req, res) => {
    try {
        const data = await withContract(async (contract) => {
            const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
            const jsonString = decoder.decode(resultBytes);
            return jsonString ? JSON.parse(jsonString) : [];
        });

        const blocks = generateHashChainBlocks(data);
        
        // Simulasi tampering pada block tengah
        if (blocks.length > 1) {
            const tamperedIndex = Math.floor(blocks.length / 2);
            blocks[tamperedIndex].data.description = `[TAMPERED] ${blocks[tamperedIndex].data.description || ''}`.trim();

            // Recalculate hash untuk block yang tampered
            const tamperedBlockData = {
                blockNumber: blocks[tamperedIndex].blockNumber,
                timestamp: blocks[tamperedIndex].timestamp,
                data: blocks[tamperedIndex].data,
                previousHash: blocks[tamperedIndex].previousHash
            };
            
            blocks[tamperedIndex].currentHash = crypto.createHash('sha256')
                .update(JSON.stringify(tamperedBlockData))
                .digest('hex');
            blocks[tamperedIndex].isValid = false;
            
            // Recalculate hash chain untuk block setelahnya
            for (let i = tamperedIndex + 1; i < blocks.length; i++) {
                blocks[i].previousHash = blocks[i-1].currentHash;
                
                const blockData = {
                    blockNumber: blocks[i].blockNumber,
                    timestamp: blocks[i].timestamp,
                    data: blocks[i].data,
                    previousHash: blocks[i].previousHash
                };
                
                blocks[i].currentHash = crypto.createHash('sha256')
                    .update(JSON.stringify(blockData))
                    .digest('hex');
                blocks[i].isValid = false;
            }
        }
        
        const brokenChain = blocks.some(block => !block.isValid);
        
        res.json({
            error: false,
            message: brokenChain ? "Hash chain is BROKEN - Tampering detected!" : "Hash chain is valid",
            data: {
                chainStatus: brokenChain ? "BROKEN" : "VALID",
                totalBlocks: blocks.length,
                tamperedBlocks: blocks.filter(b => !b.isValid).length,
                blocks: blocks.map(b => ({
                    blockNumber: b.blockNumber,
                    currentHash: b.currentHash.substring(0, 16),
                    previousHash: b.previousHash.substring(0, 16),
                    isValid: b.isValid,
                    status: b.isValid ? "✅ VALID" : "❌ TAMPERED",
                    averageLatencyMs: b.performance?.averageLatencyMs ?? PERFORMANCE_BASELINE.latencyMs,
                    peakThroughputTPS: b.performance?.peakThroughputTPS ?? PERFORMANCE_BASELINE.throughputTps,
                    blockSizeKB: b.performance?.blockSizeKB ?? PERFORMANCE_BASELINE.blockSizeKb,
                    commitTimeSec: b.performance?.commitTimeSec ?? PERFORMANCE_BASELINE.commitTimeSec
                }))
            }
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// Endpoint untuk memperbaiki tampered block
app.post('/api/blockchain/fix-chain', async (req, res) => {
    try {
        const data = await withContract(async (contract) => {
            const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
            const jsonString = decoder.decode(resultBytes);
            return jsonString ? JSON.parse(jsonString) : [];
        });
        
        const fixedBlocks = generateHashChainBlocks(data).map(block => ({
            ...block,
            status: "🔧 FIXED"
        }));
        
        res.json({
            error: false,
            message: "Hash chain has been fixed - All blocks are now valid",
            data: {
                chainStatus: "FIXED",
                totalBlocks: fixedBlocks.length,
                fixedBlocks: fixedBlocks.length,
                blocks: fixedBlocks.map(b => ({
                    blockNumber: b.blockNumber,
                    currentHash: b.currentHash.substring(0, 16),
                    previousHash: b.previousHash.substring(0, 16),
                    isValid: b.isValid,
                    status: b.status,
                    averageLatencyMs: b.performance?.averageLatencyMs ?? PERFORMANCE_BASELINE.latencyMs,
                    peakThroughputTPS: b.performance?.peakThroughputTPS ?? PERFORMANCE_BASELINE.throughputTps,
                    blockSizeKB: b.performance?.blockSizeKB ?? PERFORMANCE_BASELINE.blockSizeKb,
                    commitTimeSec: b.performance?.commitTimeSec ?? PERFORMANCE_BASELINE.commitTimeSec
                }))
            }
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// Error handling middleware
app.use((err, req, res, _next) => {
    console.error('Error occurred:', err);
    void _next;

    // Check for specific Fabric errors
    if (err.message && err.message.includes('ProposalResponsePayloads do not match')) {
        console.error('Endorsement policy failure - Peers returned different results');
        return res.status(500).json({
            error: true,
            message: 'Transaction could not be processed due to endorsement policy failure. Please try again.',
            details: err.message,
            total_data: 0,
            data: null
        });
    }
    
    // General error handler
    res.status(500).json({
        error: true,
        message: err.message || 'An unexpected error occurred',
        total_data: 0,
        data: null
    });
});

// ▶️ Jalankan server
const PORT = process.env.PORT || 5176;
app.listen(PORT, () => {
    console.log(`✅ API Gateway running at http://localhost:${PORT}`);
});
