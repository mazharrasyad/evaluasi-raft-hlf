import { connect, signers, hash } from '@hyperledger/fabric-gateway';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import grpc from '@grpc/grpc-js';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const mspId = 'Org1MSP';
const chaincodeName = 'pelaporan';
const standardNetworkDir = path.resolve(__dirname, '../../fabric-2/raft-standard/network');
const variantNetworkDir = path.resolve(__dirname, '../../fabric-2/raft-variant/network');
const fabric3StandardNetworkDir = path.resolve(__dirname, '../../fabric-3/raft-standard/network');

const networkConfigurations = [
    {
        label: 'RAFT Standard',
        networkDir: standardNetworkDir,
        channelName: 'fabric2-channel-standard',
        peerEndpoint: 'localhost:7051',
        peerHostAlias: 'peer0.org1.fabric2.standard.com',
        domain: 'standard.com',
        instructions: {
            up: `cd ${standardNetworkDir} && ./network.sh up -ca && ./network.sh createChannel -c fabric2-channel-standard -ca`,
            deploy: `cd ${standardNetworkDir} && ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-standard`
        }
    },
    {
        label: 'RAFT Variant',
        networkDir: variantNetworkDir,
        channelName: 'fabric2-channel-variant',
        peerEndpoint: 'localhost:7052',
        peerHostAlias: 'peer0.org1.fabric2.variant.com',
        domain: 'variant.com',
        instructions: {
            up: `cd ${variantNetworkDir} && ./network.sh up -ca -bft && ./network.sh createChannel -c fabric2-channel-variant -ca -bft`,
            deploy: `cd ${variantNetworkDir} && ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-variant -bft`
        }
    },
    {
        label: 'Fabric 3 RAFT Standard',
        networkDir: fabric3StandardNetworkDir,
        channelName: 'fabric3-channel-standard',
        peerEndpoint: 'localhost:7053',
        peerHostAlias: 'peer0.org1.fabric3.standard',
        domain: 'fabric3.standard',
        instructions: {
            up: `cd ${fabric3StandardNetworkDir} && ./network.sh up && ./network.sh createChannel -c fabric3-channel-standard`,
            deploy: `cd ${fabric3StandardNetworkDir} && ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c fabric3-channel-standard`
        }
    }
];

const logsRoot = path.resolve(__dirname, '../logs');
const networkCheckLogPath = path.resolve(logsRoot, 'network-check.log');

async function logNetworkCheckIssue(result, error) {
    try {
        await fs.mkdir(logsRoot, { recursive: true });

        const timestamp = new Date().toISOString();
        const {
            label,
            networkDir,
            channel,
            chaincode,
            peer,
            status,
            message,
        } = result;

        const logLines = [
            `[${timestamp}] Pemeriksaan jaringan: ${label ?? '-'}`,
            `Status: ${status ?? '-'}`,
            `Direktori: ${networkDir ?? '-'}`,
            `Channel: ${channel ?? '-'}`,
            `Chaincode: ${chaincode ?? '-'}`,
            `Peer: ${peer ?? '-'}`,
        ];

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
        await fs.appendFile(networkCheckLogPath, logEntry, 'utf8');
    } catch (loggingError) {
        console.error('Failed to write network check log:', loggingError);
    }
}

function readVarint(buffer, offset) {
    let result = 0n;
    let shift = 0n;
    let position = offset;

    while (position < buffer.length) {
        const byte = buffer[position++];
        result |= BigInt(byte & 0x7F) << shift;
        if ((byte & 0x80) === 0) {
            break;
        }
        shift += 7n;
    }

    return { value: result, offset: position };
}

function skipUnknownField(buffer, offset, wireType) {
    switch (wireType) {
        case 0: { // varint
            const { offset: nextOffset } = readVarint(buffer, offset);
            return nextOffset;
        }
        case 1: // 64-bit
            return Math.min(buffer.length, offset + 8);
        case 2: { // length-delimited
            const { value, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(value);
            return Math.min(buffer.length, lengthOffset + length);
        }
        case 5: // 32-bit
            return Math.min(buffer.length, offset + 4);
        default:
            return buffer.length;
    }
}

function decodeBlockchainInfo(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    const result = {
        height: null,
        currentBlockHash: null,
        previousBlockHash: null,
    };

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') {
            break;
        }

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 1 && wireType === 0) {
            const { value, offset: nextOffset } = readVarint(buffer, offset);
            result.height = value;
            offset = nextOffset;
            continue;
        }

        if ((fieldNumber === 2 || fieldNumber === 3) && wireType === 2) {
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            const hashValue = buffer.slice(offset, sliceEnd);
            if (fieldNumber === 2) {
                result.currentBlockHash = hashValue;
            } else {
                result.previousBlockHash = hashValue;
            }
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return result;
}

async function readFirstVisibleFile(directory) {
    const entries = await fs.readdir(directory);
    const candidate = entries.find(entry => !entry.startsWith('.'));
    if (!candidate) {
        throw new Error(`Folder ${directory} tidak berisi berkas yang diperlukan.`);
    }
    return path.join(directory, candidate);
}

async function checkSingleNetwork({ label, networkDir, channelName, instructions, peerEndpoint, domain, peerHostAlias: configuredPeerHostAlias, orgName = 'org1', peerName = 'peer0' }) {
    const effectivePeerEndpoint = peerEndpoint || 'localhost:7051';
    const effectiveDomain = domain ?? 'standard.com';
    const orgDomain = `${orgName}.${effectiveDomain}`;
    const mspUser = `User1@${orgDomain}`;
    const peerHostAlias = configuredPeerHostAlias ?? `${peerName}.${orgDomain}`;
    const timestamp = new Date().toISOString();
    const baseResult = {
        label,
        networkDir,
        channel: channelName,
        chaincode: chaincodeName,
        peer: effectivePeerEndpoint,
        instructions,
        timestamp
    };

    if (!existsSync(networkDir)) {
        const failureResult = {
            ...baseResult,
            status: 'not_found',
            message: 'Direktori jaringan tidak ditemukan.'
        };

        await logNetworkCheckIssue(failureResult);

        return failureResult;
    }

    const cryptoPath = path.resolve(networkDir, `organizations/peerOrganizations/${orgDomain}`);
    const userPath = path.resolve(cryptoPath, `users/${mspUser}/msp`);
    const keyDirPath = path.resolve(userPath, 'keystore');
    const certDirPath = path.resolve(userPath, 'signcerts');
    const tlsCertPath = path.resolve(cryptoPath, `peers/${peerHostAlias}/tls/ca.crt`);

    const requiredPaths = [
        { path: cryptoPath, description: 'Material kriptografi tidak ditemukan.' },
        { path: userPath, description: `Identitas ${mspUser} tidak ditemukan.` },
        { path: keyDirPath, description: 'Direktori keystore kosong atau tidak tersedia.' },
        { path: certDirPath, description: 'Direktori sertifikat tidak tersedia.' },
        { path: tlsCertPath, description: 'Berkas TLS CA tidak ditemukan.' }
    ];

    const missing = requiredPaths.filter(entry => !existsSync(entry.path));
    if (missing.length) {
        const failureResult = {
            ...baseResult,
            status: 'incomplete',
            message: missing[0].description
        };

        await logNetworkCheckIssue(failureResult);

        return failureResult;
    }

    async function newGrpcConnection() {
        const tlsRootCert = await fs.readFile(tlsCertPath);
        const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
        return new grpc.Client(effectivePeerEndpoint, tlsCredentials, {
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
        const certFile = await readFirstVisibleFile(certDirPath);
        const credentials = await fs.readFile(certFile);
        return { mspId, credentials };
    }

    async function newSigner() {
        const keyFile = await readFirstVisibleFile(keyDirPath);
        const privateKeyPem = await fs.readFile(keyFile);
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        return signers.newPrivateKeySigner(privateKey);
    }

    let client;
    let gateway;

    try {
        client = await newGrpcConnection();
        gateway = connect({
            client,
            identity: await newIdentity(),
            signer: await newSigner(),
            hash: hash.sha256,
        });

        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        await contract.evaluateTransaction('GetAllCatatan');

        let blockHeight = null;

        try {
            const qscc = network.getContract('qscc');
            const chainInfoBytes = await qscc.evaluateTransaction('GetChainInfo', channelName);
            const decoded = decodeBlockchainInfo(chainInfoBytes);
            if (decoded.height !== null && decoded.height !== undefined) {
                const heightBigInt = decoded.height;
                if (typeof heightBigInt === 'bigint') {
                    blockHeight = heightBigInt <= BigInt(Number.MAX_SAFE_INTEGER)
                        ? Number(heightBigInt)
                        : heightBigInt.toString();
                } else if (typeof heightBigInt === 'number' && Number.isFinite(heightBigInt)) {
                    blockHeight = heightBigInt;
                }
            }
        } catch (error) {
            console.warn(`Gagal mengambil informasi blok untuk ${label}:`, error);
        }

        return {
            ...baseResult,
            status: 'healthy',
            blockHeight
        };
    } catch (error) {
        const failureResult = {
            ...baseResult,
            status: 'unhealthy',
            message: error instanceof Error
                ? error.message
                : 'Terjadi kesalahan saat mengakses chaincode.'
        };

        await logNetworkCheckIssue(failureResult, error);

        return failureResult;
    } finally {
        if (gateway) {
            gateway.close();
        }
        if (client) {
            client.close();
        }
    }
}

async function checkNetworkHealth() {
    const results = [];
    for (const config of networkConfigurations) {
        const result = await checkSingleNetwork(config);
        results.push(result);
    }
    return results;
}

export { checkNetworkHealth };
