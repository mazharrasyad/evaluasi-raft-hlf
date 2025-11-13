import { connect, signers, hash } from '@hyperledger/fabric-gateway';
import { peer } from '@hyperledger/fabric-protos';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import grpc from '@grpc/grpc-js';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mspId = 'Org1MSP';
const chaincodeName = 'pelaporan';
const defaultPeerEndpoint = 'localhost:7051';

const networkTargets = [
    {
        id: 'channel-standard',
        label: 'RAFT Standard',
        scope: 'fabric-2',
        networkDir: path.resolve(__dirname, '../../fabric-2/raft-standard/network'),
        channelName: 'fabric2-channel-standard',
        peerEndpoint: 'localhost:7051',
        domain: 'standard.com',
        peerHostAlias: 'peer0.org1.fabric2.standard.com',
    },
    {
        id: 'channel-variant',
        label: 'RAFT Variant',
        scope: 'fabric-2',
        networkDir: path.resolve(__dirname, '../../fabric-2/raft-variant/network'),
        channelName: 'fabric2-channel-variant',
        peerEndpoint: 'localhost:7052',
        domain: 'variant.com',
        peerHostAlias: 'peer0.org1.fabric2.variant.com',
    },
    {
        id: 'channel-fabric3-standard',
        label: 'Fabric 3 RAFT Standard',
        scope: 'fabric-3',
        networkDir: path.resolve(__dirname, '../../fabric-3/raft-standard/network'),
        channelName: 'fabric3-channel-standard',
        peerEndpoint: 'localhost:7153',
        domain: 'fabric3.standard',
        peerHostAlias: 'peer0.org1.fabric3.standard',
    },
    {
        id: 'channel-fabric3-variant',
        label: 'Fabric 3 RAFT Variant',
        scope: 'fabric-3',
        networkDir: path.resolve(__dirname, '../../fabric-3/raft-variant/network'),
        channelName: 'fabric3-channel-variant',
        peerEndpoint: 'localhost:7353',
        domain: 'fabric3.variant',
        peerHostAlias: 'peer0.org1.fabric3.variant',
    },
];

const networkTargetIndex = new Map(networkTargets.map(target => [target.id, target]));

const logsRoot = path.resolve(__dirname, '../logs');
const ingestLogPath = path.resolve(logsRoot, 'simulation-ingest.log');

async function logIngestResult(result, error) {
    try {
        await fs.mkdir(logsRoot, { recursive: true });

        const timestamp = new Date().toISOString();
        const {
            label,
            networkDir,
            channel,
            status,
            message,
            transactionId,
            commitStatus,
            startedAt,
            completedAt,
        } = result;

        const logLines = [
            `[${timestamp}] Pengiriman catatan ke ${label ?? '-'} (${channel ?? '-'})`,
            `Status: ${status ?? '-'}`,
            `Direktori: ${networkDir ?? '-'}`,
            `Waktu mulai: ${startedAt ?? '-'}`,
            `Waktu selesai: ${completedAt ?? '-'}`,
        ];

        if (transactionId) {
            logLines.push(`Transaction ID: ${transactionId}`);
        }

        if (commitStatus) {
            const commitLines = [];
            if (commitStatus.transactionId) {
                commitLines.push(`TX: ${commitStatus.transactionId}`);
            }
            if (commitStatus.codeName || commitStatus.code !== undefined) {
                commitLines.push(`Status: ${commitStatus.codeName ?? commitStatus.code}`);
            }
            if (commitStatus.blockNumber !== undefined && commitStatus.blockNumber !== null) {
                commitLines.push(`Block: ${commitStatus.blockNumber}`);
            }
            if (commitStatus.successful !== undefined) {
                commitLines.push(`Successful: ${commitStatus.successful}`);
            }
            if (commitLines.length) {
                logLines.push(`Commit: ${commitLines.join(', ')}`);
            }
        }

        if (message) {
            logLines.push(`Pesan: ${message}`);
        }

        if (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logLines.push(`Error: ${errorMessage}`);
            if (error instanceof Error && error.stack) {
                logLines.push('Stacktrace:');
                logLines.push(error.stack);
            }
        }

        const logEntry = `${logLines.join('\n')}\n\n`;
        await fs.appendFile(ingestLogPath, logEntry, 'utf8');
    } catch (loggingError) {
        console.error('Failed to write simulation ingest log:', loggingError);
    }
}

async function readFirstVisibleFile(directory) {
    const entries = await fs.readdir(directory);
    const candidate = entries.find(entry => !entry.startsWith('.'));
    if (!candidate) {
        throw new Error(`Folder ${directory} tidak berisi berkas yang diperlukan.`);
    }
    return path.join(directory, candidate);
}

function getStatusName(code) {
    if (code === null || code === undefined) {
        return null;
    }

    if (typeof peer?.TxValidationCode === 'object' && peer.TxValidationCode !== null) {
        const direct = peer.TxValidationCode[code];
        if (typeof direct === 'string') {
            return direct;
        }

        const entries = Object.entries(peer.TxValidationCode);
        for (const [key, value] of entries) {
            if (value === code) {
                return key;
            }
        }
    }

    return null;
}

function normalizeBlockNumber(blockNumber) {
    if (blockNumber === null || blockNumber === undefined) {
        return null;
    }

    if (typeof blockNumber === 'bigint') {
        return blockNumber <= BigInt(Number.MAX_SAFE_INTEGER)
            ? Number(blockNumber)
            : blockNumber.toString();
    }

    if (typeof blockNumber === 'number' && Number.isFinite(blockNumber)) {
        return blockNumber;
    }

    const parsed = Number.parseInt(blockNumber, 10);
    if (!Number.isNaN(parsed)) {
        return parsed;
    }

    return String(blockNumber);
}

async function newGrpcConnection(tlsCertPath, peerEndpoint, peerHostAlias) {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
        'grpc.keepalive_time_ms': 120000,
        'grpc.keepalive_timeout_ms': 20000,
        'grpc.keepalive_permit_without_calls': true,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.min_ping_interval_without_data_ms': 300000,
    });
}

async function newIdentity(certDirPath) {
    const certFile = await readFirstVisibleFile(certDirPath);
    const credentials = await fs.readFile(certFile);
    return { mspId, credentials };
}

async function newSigner(keyDirPath) {
    const keyFile = await readFirstVisibleFile(keyDirPath);
    const privateKeyPem = await fs.readFile(keyFile);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

function formatResolutionFromError(errorMessage) {
    if (!errorMessage) {
        return null;
    }

    if (/already exists/i.test(errorMessage)) {
        return 'Gunakan ID berbeda atau kosongkan ledger sebelum mengulang.';
    }

    if (/failed to connect/i.test(errorMessage) || /connect ECONNREFUSED/i.test(errorMessage)) {
        return 'Pastikan jaringan Fabric berjalan dan endpoint peer dapat diakses.';
    }

    return null;
}

async function submitToSingleNetwork(target, record) {
    const { id, label, networkDir, channelName } = target;
    const targetPeerEndpoint = target.peerEndpoint || defaultPeerEndpoint;
    const domain = target.domain ?? 'standard.com';
    const orgDomain = `org1.${domain}`;
    const mspUser = `User1@${orgDomain}`;
    const peerHostAlias = target.peerHostAlias ?? `peer0.${orgDomain}`;
    const startedAt = new Date().toISOString();

    const baseResult = {
        targetId: id,
        label,
        scope: target.scope || null,
        networkDir,
        channel: channelName,
        peer: targetPeerEndpoint,
        chaincode: chaincodeName,
        startedAt,
        status: 'unknown',
    };

    if (!existsSync(networkDir)) {
        const result = {
            ...baseResult,
            status: 'not_found',
            message: 'Direktori jaringan tidak ditemukan.',
            payload: record,
        };
        await logIngestResult(result);
        return result;
    }

    const cryptoPath = path.resolve(networkDir, `organizations/peerOrganizations/${orgDomain}`);
    const userPath = path.resolve(cryptoPath, `users/${mspUser}/msp`);
    const keyDirPath = path.resolve(userPath, 'keystore');
    const certDirPath = path.resolve(userPath, 'signcerts');
    const tlsCertPath = path.resolve(cryptoPath, `peers/${peerHostAlias}/tls/ca.crt`);

    const requiredPaths = [
        { path: cryptoPath, message: 'Material kriptografi tidak ditemukan.' },
        { path: userPath, message: `Identitas ${mspUser} tidak ditemukan.` },
        { path: keyDirPath, message: 'Direktori keystore kosong atau tidak tersedia.' },
        { path: certDirPath, message: 'Direktori sertifikat tidak tersedia.' },
        { path: tlsCertPath, message: 'Berkas TLS CA tidak ditemukan.' },
    ];

    const missing = requiredPaths.find(entry => !existsSync(entry.path));
    if (missing) {
        const result = {
            ...baseResult,
            status: 'incomplete',
            message: missing.message,
            payload: record,
        };
        await logIngestResult(result);
        return result;
    }

    let client;
    let gateway;
    let submitError;

    try {
        client = await newGrpcConnection(tlsCertPath, targetPeerEndpoint, peerHostAlias);
        gateway = connect({
            client,
            identity: await newIdentity(certDirPath),
            signer: await newSigner(keyDirPath),
            hash: hash.sha256,
        });

        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        const payloadJson = JSON.stringify(record);
        const payloadSizeBytes = Buffer.byteLength(payloadJson, 'utf8');

        const timerStart = process.hrtime.bigint();
        const submittedTransaction = await contract.submitAsync('CreateCatatan', {
            arguments: [record.id, payloadJson],
        });
        const transactionId = submittedTransaction.getTransactionId();
        const transactionResult = submittedTransaction.getResult();
        const transactionResultBuffer = transactionResult
            ? Buffer.from(transactionResult)
            : null;
        let commitStatus;
        try {
            commitStatus = await submittedTransaction.getStatus();
        } catch (statusError) {
            submitError = statusError;
        }
        const timerEnd = process.hrtime.bigint();

        const latencyMs = Number(timerEnd - timerStart) / 1e6;
        const normalizedBlock = commitStatus ? normalizeBlockNumber(commitStatus.blockNumber) : null;
        const commitStatusSummary = commitStatus
            ? {
                transactionId: commitStatus.transactionId,
                successful: commitStatus.successful,
                code: commitStatus.code,
                codeName: getStatusName(commitStatus.code),
                blockNumber: normalizedBlock,
            }
            : null;
        const resultSizeBytes = transactionResultBuffer ? transactionResultBuffer.length : null;
        const resultUtf8 = resultSizeBytes ? transactionResultBuffer.toString('utf8') : null;

        const completedAt = new Date().toISOString();

        if (submitError) {
            const message = submitError instanceof Error ? submitError.message : String(submitError);
            const errorStack = submitError instanceof Error && submitError.stack ? submitError.stack : null;
            const result = {
                ...baseResult,
                status: 'commit_failed',
                message,
                transactionId,
                latencyMs,
                payloadSizeBytes,
                resultSizeBytes,
                resultUtf8,
                commitStatus: commitStatusSummary,
                completedAt,
                resolution: formatResolutionFromError(message),
                payload: record,
                errorMessage: message,
                errorStack: errorStack,
            };
            await logIngestResult(result, submitError);
            return result;
        }

        const success = commitStatusSummary?.successful === true;
        const result = {
            ...baseResult,
            status: success ? 'success' : 'commit_failed',
            message: success
                ? 'Transaksi berhasil dikomit ke ledger.'
                : 'Transaksi tidak berhasil dikomit ke ledger.',
            transactionId,
            latencyMs,
            payloadSizeBytes,
            resultSizeBytes,
            resultUtf8,
            commitStatus: commitStatusSummary,
            completedAt,
            payload: record,
        };

        await logIngestResult(result);
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error && error.stack ? error.stack : null;
        const result = {
            ...baseResult,
            status: 'error',
            message: errorMessage,
            resolution: formatResolutionFromError(errorMessage),
            completedAt: new Date().toISOString(),
            payload: record,
            errorMessage: errorMessage,
            errorStack: errorStack,
        };
        await logIngestResult(result, error);
        return result;
    } finally {
        if (gateway) {
            gateway.close();
        }
        if (client) {
            client.close();
        }
    }
}

function validateRecord(record) {
    if (!record || typeof record !== 'object') {
        throw new Error('Payload record tidak valid.');
    }

    if (!record.id || typeof record.id !== 'string') {
        throw new Error('Record harus memiliki properti id bertipe string.');
    }
}

function resolveRequestedTargets(targetIds) {
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
        return networkTargets.slice();
    }

    const resolvedTargets = [];
    const seen = new Set();

    for (const rawId of targetIds) {
        if (typeof rawId !== 'string') {
            continue;
        }

        const trimmedId = rawId.trim();
        if (!trimmedId || seen.has(trimmedId)) {
            continue;
        }

        const target = networkTargetIndex.get(trimmedId);
        if (!target) {
            const error = new Error(`Target jaringan ${trimmedId} tidak dikenali.`);
            error.statusCode = 400;
            error.code = 'invalid_target_id';
            throw error;
        }

        resolvedTargets.push(target);
        seen.add(trimmedId);
    }

    if (!resolvedTargets.length) {
        const error = new Error('Tidak ada target jaringan yang valid diberikan.');
        error.statusCode = 400;
        error.code = 'empty_target_selection';
        throw error;
    }

    return resolvedTargets;
}

async function submitSimulationRecord(record, options = {}) {
    validateRecord(record);

    const enrichedRecord = {
        ...record,
    };

    if (!enrichedRecord.createdAt) {
        enrichedRecord.createdAt = new Date().toISOString();
    }

    const targetsToSubmit = resolveRequestedTargets(options.targetIds);
    const results = [];

    for (const target of targetsToSubmit) {
        const result = await submitToSingleNetwork(target, enrichedRecord);
        results.push(result);
    }

    return results;
}

export { submitSimulationRecord };
