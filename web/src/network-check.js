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

// Use PROJECT_ROOT environment variable if set, otherwise use relative path from __dirname
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');

// Configuration
const mspId = 'Org1MSP';
const chaincodeName = 'pelaporan';
const standardNetworkDir = path.join(PROJECT_ROOT, 'fabric-2/raft-standard/network');
const variantNetworkDir = path.join(PROJECT_ROOT, 'fabric-2/raft-variant/network');
const fabric3StandardNetworkDir = path.join(PROJECT_ROOT, 'fabric-3/raft-standard/network');
const fabric3VariantNetworkDir = path.join(PROJECT_ROOT, 'fabric-3/raft-variant/network');

const networkConfigurations = [
    {
        targetId: 'channel-standard',
        label: 'Fabric 2 RAFT Standard',
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
        targetId: 'channel-variant',
        label: 'Fabric 2 RAFT Variant',
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
        targetId: 'channel-fabric3-standard',
        label: 'Fabric 3 RAFT Standard',
        networkDir: fabric3StandardNetworkDir,
        channelName: 'fabric3-channel-standard',
        peerEndpoint: 'localhost:7153',
        peerHostAlias: 'peer0.org1.fabric3.standard',
        domain: 'fabric3.standard',
        instructions: {
            up: `cd ${fabric3StandardNetworkDir} && ./network.sh up && ./network.sh createChannel -c fabric3-channel-standard`,
            deploy: `cd ${fabric3StandardNetworkDir} && ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c fabric3-channel-standard`
        }
    },
    {
        targetId: 'channel-fabric3-variant',
        label: 'Fabric 3 RAFT Variant',
        networkDir: fabric3VariantNetworkDir,
        channelName: 'fabric3-channel-variant',
        peerEndpoint: 'localhost:7353',
        peerHostAlias: 'peer0.org1.fabric3.variant',
        domain: 'fabric3.variant',
        instructions: {
            up: `cd ${fabric3VariantNetworkDir} && ./network.sh up && ./network.sh createChannel -c fabric3-channel-variant`,
            deploy: `cd ${fabric3VariantNetworkDir} && ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c fabric3-channel-variant`
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

async function checkSingleNetwork({ targetId, label, networkDir, channelName, instructions, peerEndpoint, domain, peerHostAlias: configuredPeerHostAlias, orgName = 'org1', peerName = 'peer0' }) {
    const effectivePeerEndpoint = peerEndpoint || 'localhost:7051';
    const effectiveDomain = domain ?? 'standard.com';
    const orgDomain = `${orgName}.${effectiveDomain}`;
    const mspUser = `User1@${orgDomain}`;
    const peerHostAlias = configuredPeerHostAlias ?? `${peerName}.${orgDomain}`;
    const timestamp = new Date().toISOString();
    const baseResult = {
        targetId,
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

function decodeBlock(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    const result = {
        header: {},
        data: {},
        metadata: {},
    };

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 1 && wireType === 2) {
            // header
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            const headerBytes = buffer.slice(offset, sliceEnd);
            result.header = decodeBlockHeader(headerBytes);
            offset = sliceEnd;
            continue;
        }

        if (fieldNumber === 2 && wireType === 2) {
            // data
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            const dataBytes = buffer.slice(offset, sliceEnd);
            result.data = decodeBlockData(dataBytes);
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return result;
}

function decodeBlockHeader(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    const result = {
        number: null,
        previousHash: null,
        dataHash: null,
    };

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 1 && wireType === 0) {
            // number
            const { value, offset: nextOffset } = readVarint(buffer, offset);
            result.number = value;
            offset = nextOffset;
            continue;
        }

        if ((fieldNumber === 2 || fieldNumber === 3) && wireType === 2) {
            // hash fields
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            const hashValue = buffer.slice(offset, sliceEnd);
            if (fieldNumber === 2) {
                result.previousHash = hashValue.toString('hex');
            } else {
                result.dataHash = hashValue.toString('hex');
            }
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return result;
}

function decodeBlockData(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    const transactions = [];

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 1 && wireType === 2) {
            // data field (transactions)
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            transactions.push(buffer.slice(offset, sliceEnd));
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return { transactionCount: transactions.length, transactions };
}

// Decode transaction envelope to extract payload
function decodeEnvelope(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    let payload = null;

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 1 && wireType === 2) {
            // payload field
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            payload = buffer.slice(offset, sliceEnd);
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return payload;
}

// Decode payload to extract transaction data
function decodePayload(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    let data = null;

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 2 && wireType === 2) {
            // data field (contains Transaction)
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            data = buffer.slice(offset, sliceEnd);
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return data;
}

// Decode transaction to extract chaincode action payload
function decodeTransaction(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    const actions = [];

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 1 && wireType === 2) {
            // actions field
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            actions.push(buffer.slice(offset, sliceEnd));
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return actions;
}

// Decode chaincode action to extract proposal response payload
function decodeChaincodeActionPayload(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    let action = null;

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 2 && wireType === 2) {
            // action field (contains ChaincodeEndorsedAction)
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            action = buffer.slice(offset, sliceEnd);
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return action;
}

// Decode chaincode endorsed action to extract proposal response payload
function decodeChaincodeEndorsedAction(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    let proposalResponsePayload = null;

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 1 && wireType === 2) {
            // proposal_response_payload field
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            proposalResponsePayload = buffer.slice(offset, sliceEnd);
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return proposalResponsePayload;
}

// Decode proposal response payload to extract chaincode action
function decodeProposalResponsePayload(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    let extension = null;

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 2 && wireType === 2) {
            // extension field (contains ChaincodeAction)
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            extension = buffer.slice(offset, sliceEnd);
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return extension;
}

// Decode chaincode action to extract response
function decodeChaincodeAction(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    let response = null;

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 2 && wireType === 2) {
            // response field
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            response = buffer.slice(offset, sliceEnd);
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return response;
}

// Decode response to extract payload
function decodeResponse(bytes) {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    let payload = null;

    while (offset < buffer.length) {
        const key = buffer[offset++];
        if (typeof key === 'undefined') break;

        const fieldNumber = key >> 3;
        const wireType = key & 0x07;

        if (fieldNumber === 2 && wireType === 2) {
            // payload field
            const { value: lengthValue, offset: lengthOffset } = readVarint(buffer, offset);
            const length = Number(lengthValue);
            offset = lengthOffset;
            const sliceEnd = Math.min(buffer.length, offset + length);
            payload = buffer.slice(offset, sliceEnd);
            offset = sliceEnd;
            continue;
        }

        offset = skipUnknownField(buffer, offset, wireType);
    }

    return payload;
}

// Extract simulation data from transaction
function extractSimulationData(transactionBytes) {
    try {
        // Decode envelope
        const payloadBytes = decodeEnvelope(transactionBytes);
        if (!payloadBytes) return null;

        // Decode payload to get transaction
        const transactionBytes2 = decodePayload(payloadBytes);
        if (!transactionBytes2) return null;

        // Decode transaction to get actions
        const actions = decodeTransaction(transactionBytes2);
        if (!actions || actions.length === 0) return null;

        // Decode first action (usually there's only one)
        const actionPayload = decodeChaincodeActionPayload(actions[0]);
        if (!actionPayload) return null;

        // Decode chaincode endorsed action
        const proposalResponsePayload = decodeChaincodeEndorsedAction(actionPayload);
        if (!proposalResponsePayload) return null;

        // Decode proposal response payload
        const extension = decodeProposalResponsePayload(proposalResponsePayload);
        if (!extension) return null;

        // Decode chaincode action
        const response = decodeChaincodeAction(extension);
        if (!response) return null;

        // Decode response to get payload
        const responsePayload = decodeResponse(response);
        if (!responsePayload) return null;

        // Try to parse as JSON
        const payloadString = responsePayload.toString('utf8');
        try {
            return JSON.parse(payloadString);
        } catch {
            return { rawData: payloadString };
        }
    } catch (error) {
        console.warn('Failed to extract simulation data from transaction:', error);
        return null;
    }
}

async function getAllBlocksFromNetwork({ targetId, label, networkDir, channelName, peerEndpoint, domain, peerHostAlias: configuredPeerHostAlias, orgName = 'org1', peerName = 'peer0' }) {
    const effectivePeerEndpoint = peerEndpoint || 'localhost:7051';
    const effectiveDomain = domain ?? 'standard.com';
    const orgDomain = `${orgName}.${effectiveDomain}`;
    const mspUser = `User1@${orgDomain}`;
    const peerHostAlias = configuredPeerHostAlias ?? `${peerName}.${orgDomain}`;
    const timestamp = new Date().toISOString();
    const baseResult = {
        targetId,
        label,
        networkDir,
        channel: channelName,
        peer: effectivePeerEndpoint,
        timestamp,
        blocks: []
    };

    if (!existsSync(networkDir)) {
        return {
            ...baseResult,
            status: 'not_found',
            message: 'Direktori jaringan tidak ditemukan.'
        };
    }

    const cryptoPath = path.resolve(networkDir, `organizations/peerOrganizations/${orgDomain}`);
    const userPath = path.resolve(cryptoPath, `users/${mspUser}/msp`);
    const keyDirPath = path.resolve(userPath, 'keystore');
    const certDirPath = path.resolve(userPath, 'signcerts');
    const tlsCertPath = path.resolve(cryptoPath, `peers/${peerHostAlias}/tls/ca.crt`);

    const requiredPaths = [cryptoPath, userPath, keyDirPath, certDirPath, tlsCertPath];
    const missing = requiredPaths.filter(p => !existsSync(p));
    if (missing.length) {
        return {
            ...baseResult,
            status: 'incomplete',
            message: 'Material kriptografi tidak lengkap.'
        };
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
        const qscc = network.getContract('qscc');

        // Get blockchain info first
        const chainInfoBytes = await qscc.evaluateTransaction('GetChainInfo', channelName);
        const chainInfo = decodeBlockchainInfo(chainInfoBytes);

        let blockHeight = 0;
        if (chainInfo.height !== null && chainInfo.height !== undefined) {
            const heightBigInt = chainInfo.height;
            if (typeof heightBigInt === 'bigint') {
                blockHeight = Number(heightBigInt);
            } else if (typeof heightBigInt === 'number') {
                blockHeight = heightBigInt;
            }
        }

        // Fetch all blocks
        const blocks = [];
        for (let i = 0; i < blockHeight; i++) {
            try {
                const blockBytes = await qscc.evaluateTransaction('GetBlockByNumber', channelName, i.toString());
                const blockData = decodeBlock(blockBytes);

                // Extract simulation data from transactions
                let simulationData = null;
                if (blockData.data.transactions && blockData.data.transactions.length > 0) {
                    // Try to extract data from the last transaction (most recent)
                    const lastTx = blockData.data.transactions[blockData.data.transactions.length - 1];
                    simulationData = extractSimulationData(lastTx);
                }

                blocks.push({
                    blockNumber: typeof blockData.header.number === 'bigint' ? Number(blockData.header.number) : blockData.header.number,
                    previousHash: blockData.header.previousHash || '',
                    dataHash: blockData.header.dataHash || '',
                    transactionCount: blockData.data.transactionCount || 0,
                    timestamp: new Date().toISOString(), // This would ideally come from block metadata
                    simulationData: simulationData // Add simulation data
                });
            } catch (error) {
                console.warn(`Failed to fetch block ${i} from ${label}:`, error);
            }
        }

        return {
            ...baseResult,
            status: 'healthy',
            blockHeight,
            blocks
        };
    } catch (error) {
        return {
            ...baseResult,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengakses blockchain.'
        };
    } finally {
        if (gateway) {
            gateway.close();
        }
        if (client) {
            client.close();
        }
    }
}

async function getAllBlocks() {
    const results = [];
    for (const config of networkConfigurations) {
        const result = await getAllBlocksFromNetwork(config);
        results.push(result);
    }
    return results;
}

async function getAllCatatanFromNetwork({ targetId, label, networkDir, channelName, peerEndpoint, domain, peerHostAlias: configuredPeerHostAlias, orgName = 'org1', peerName = 'peer0' }) {
    const effectivePeerEndpoint = peerEndpoint || 'localhost:7051';
    const effectiveDomain = domain ?? 'standard.com';
    const orgDomain = `${orgName}.${effectiveDomain}`;
    const mspUser = `User1@${orgDomain}`;
    const peerHostAlias = configuredPeerHostAlias ?? `${peerName}.${orgDomain}`;
    const timestamp = new Date().toISOString();
    const baseResult = {
        targetId,
        label,
        networkDir,
        channel: channelName,
        peer: effectivePeerEndpoint,
        timestamp,
        records: []
    };

    if (!existsSync(networkDir)) {
        return {
            ...baseResult,
            status: 'not_found',
            message: 'Direktori jaringan tidak ditemukan.'
        };
    }

    const cryptoPath = path.resolve(networkDir, `organizations/peerOrganizations/${orgDomain}`);
    const userPath = path.resolve(cryptoPath, `users/${mspUser}/msp`);
    const keyDirPath = path.resolve(userPath, 'keystore');
    const certDirPath = path.resolve(userPath, 'signcerts');
    const tlsCertPath = path.resolve(cryptoPath, `peers/${peerHostAlias}/tls/ca.crt`);

    const requiredPaths = [cryptoPath, userPath, keyDirPath, certDirPath, tlsCertPath];
    const missing = requiredPaths.filter(p => !existsSync(p));
    if (missing.length) {
        return {
            ...baseResult,
            status: 'incomplete',
            message: 'Material kriptografi tidak lengkap.'
        };
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

        // Get all catatan from the ledger
        const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
        const resultString = resultBytes.toString('utf8');

        // Clean up response - remove any console.log output or emoji
        let cleanString = resultString.trim();

        // Try to find JSON array start
        const jsonStartIndex = cleanString.indexOf('[');
        if (jsonStartIndex > 0) {
            cleanString = cleanString.substring(jsonStartIndex);
        }

        // Parse cleaned JSON
        let records = [];
        try {
            records = JSON.parse(cleanString);
        } catch (parseError) {
            console.error('Failed to parse GetAllCatatan response:', cleanString.substring(0, 100));
            throw new Error(`Invalid JSON response from chaincode: ${parseError.message}`);
        }

        return {
            ...baseResult,
            status: 'healthy',
            records: Array.isArray(records) ? records : []
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat mengakses blockchain.';
        console.error(`Error in getAllCatatanFromNetwork for ${label}:`, errorMessage);

        return {
            ...baseResult,
            status: 'unhealthy',
            message: errorMessage
        };
    } finally {
        if (gateway) {
            gateway.close();
        }
        if (client) {
            client.close();
        }
    }
}

async function getAllCatatan() {
    const results = [];
    for (const config of networkConfigurations) {
        const result = await getAllCatatanFromNetwork(config);
        results.push(result);
    }
    return results;
}

async function checkNetworkHealth() {
    const results = [];
    for (const config of networkConfigurations) {
        const result = await checkSingleNetwork(config);
        results.push(result);
    }
    return results;
}

export { checkNetworkHealth, getAllBlocks, getAllCatatan };
