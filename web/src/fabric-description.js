import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use PROJECT_ROOT environment variable if set, otherwise use relative path from __dirname
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');

const FABRIC3_STANDARD_NETWORK_ROOT = path.join(PROJECT_ROOT, 'fabric-3', 'raft-standard', 'network');
const FABRIC3_VARIANT_NETWORK_ROOT = path.join(PROJECT_ROOT, 'fabric-3', 'raft-variant', 'network');

const NETWORK_SOURCES = [
    {
        id: 'fabric3-raft-standard',
        label: 'Fabric 3 Raft',
        root: FABRIC3_STANDARD_NETWORK_ROOT,
        ordererServiceName: 'orderer.fabric3.standard',
    },
    {
        id: 'fabric3-raft-variant',
        label: 'Fabric 3 SmartBFT',
        root: FABRIC3_VARIANT_NETWORK_ROOT,
        ordererServiceName: 'orderer.fabric3.variant',
    },
];

const COMPOSE_RELATIVE_PATH = 'compose/compose-test-net.yaml';
const NETWORK_CONFIG_RELATIVE_PATH = 'network.config';
const UTILS_SCRIPT_RELATIVE_PATH = 'scripts/utils.sh';

const ARRAY_KEYS = new Set(['environment', 'ports', 'volumes', 'networks']);

function parseConfigtxYaml(content) {
    if (!content || typeof content !== 'string') {
        return null;
    }

    try {
        return parseYaml(content);
    } catch {
        return null;
    }
}

function extractRaftConsenters(consenters) {
    if (!Array.isArray(consenters)) {
        return [];
    }

    return consenters.map(consenter => ({
        host: consenter?.Host ?? null,
        port: consenter?.Port ?? null,
        clientTlsCert: consenter?.ClientTLSCert ?? null,
        serverTlsCert: consenter?.ServerTLSCert ?? null,
    }));
}

function extractRaftOptions(options) {
    if (!options || typeof options !== 'object') {
        return null;
    }

    return {
        tickInterval: options.TickInterval ?? null,
        electionTick: options.ElectionTick ?? null,
        heartbeatTick: options.HeartbeatTick ?? null,
        maxInflightBlocks: options.MaxInflightBlocks ?? null,
        snapshotIntervalSize: options.SnapshotIntervalSize ?? null,
    };
}

function selectChannelProfile(profiles) {
    if (!profiles || typeof profiles !== 'object') {
        return null;
    }

    if (profiles.ChannelUsingRaft && typeof profiles.ChannelUsingRaft === 'object') {
        return profiles.ChannelUsingRaft;
    }

    const matchedProfile = Object.values(profiles).find(profile => (
        profile?.Orderer?.OrdererType === 'etcdraft'
    ));

    return matchedProfile ?? null;
}

function extractRaftConfiguration(configtxDoc) {
    if (!configtxDoc || typeof configtxDoc !== 'object') {
        return null;
    }

    const ordererDefaults = configtxDoc.Orderer && typeof configtxDoc.Orderer === 'object'
        ? configtxDoc.Orderer
        : null;

    const channelProfile = selectChannelProfile(configtxDoc.Profiles);
    const profileOrderer = channelProfile?.Orderer && typeof channelProfile.Orderer === 'object'
        ? channelProfile.Orderer
        : null;

    const resolvedOrderer = profileOrderer || ordererDefaults;

    if (!resolvedOrderer) {
        return null;
    }

    const batchSize = resolvedOrderer.BatchSize && typeof resolvedOrderer.BatchSize === 'object'
        ? resolvedOrderer.BatchSize
        : (ordererDefaults?.BatchSize && typeof ordererDefaults.BatchSize === 'object'
            ? ordererDefaults.BatchSize
            : null);

    const etcdRaftSection = resolvedOrderer.EtcdRaft && typeof resolvedOrderer.EtcdRaft === 'object'
        ? resolvedOrderer.EtcdRaft
        : (ordererDefaults?.EtcdRaft && typeof ordererDefaults.EtcdRaft === 'object'
            ? ordererDefaults.EtcdRaft
            : null);

    const ordererAddresses = Array.isArray(resolvedOrderer.Addresses)
        ? resolvedOrderer.Addresses
        : Array.isArray(ordererDefaults?.Addresses)
            ? ordererDefaults.Addresses
            : [];

    return {
        ordererType: resolvedOrderer.OrdererType ?? null,
        addresses: ordererAddresses.filter(address => typeof address === 'string'),
        batchTimeout: resolvedOrderer.BatchTimeout ?? ordererDefaults?.BatchTimeout ?? null,
        batchSize: {
            maxMessageCount: batchSize?.MaxMessageCount ?? null,
            absoluteMaxBytes: batchSize?.AbsoluteMaxBytes ?? null,
            preferredMaxBytes: batchSize?.PreferredMaxBytes ?? null,
        },
        etcdRaft: etcdRaftSection
            ? {
                consenters: extractRaftConsenters(etcdRaftSection.Consenters),
                options: extractRaftOptions(etcdRaftSection.Options),
            }
            : null,
    };
}

function splitKeyValue(text) {
    const separatorIndex = text.indexOf(':');
    if (separatorIndex === -1) {
        return [text.trim(), undefined];
    }

    const key = text.slice(0, separatorIndex).trim();
    const value = text.slice(separatorIndex + 1).trim();
    return [key, value];
}

function parseComposeFile(content) {
    const services = {};
    const networks = {};

    const lines = content.split(/\r?\n/);
    let section = null;
    let currentService = null;
    let currentServiceName = null;
    let currentKey = null;
    let currentKeyType = null;
    let currentNetwork = null;

    lines.forEach(line => {
        const indentMatch = line.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0].length : 0;
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        if (indent === 0) {
            if (trimmed.startsWith('services:')) {
                section = 'services';
            } else if (trimmed.startsWith('networks:')) {
                section = 'networks';
            } else {
                section = null;
            }

            currentService = null;
            currentServiceName = null;
            currentKey = null;
            currentKeyType = null;
            currentNetwork = null;
            return;
        }

        if (section === 'networks') {
            if (indent === 2 && trimmed.endsWith(':')) {
                currentNetwork = trimmed.slice(0, -1);
                networks[currentNetwork] = {};
                return;
            }

            if (indent === 4 && currentNetwork) {
                const [key, value = ''] = splitKeyValue(trimmed);
                networks[currentNetwork][key] = value ?? '';
            }

            return;
        }

        if (section === 'services') {
            if (indent === 2 && trimmed.endsWith(':')) {
                currentServiceName = trimmed.slice(0, -1);
                currentService = {};
                services[currentServiceName] = currentService;
                currentKey = null;
                currentKeyType = null;
                return;
            }

            if (!currentService) {
                return;
            }

            if (indent === 4) {
                if (!trimmed.includes(':')) {
                    return;
                }

                const [key, value] = splitKeyValue(trimmed);

                if (value === undefined || value === '') {
                    currentKey = key;
                    if (ARRAY_KEYS.has(key)) {
                        currentService[key] = [];
                        currentKeyType = 'array';
                    } else if (key === 'labels') {
                        currentService[key] = {};
                        currentKeyType = 'object';
                    } else {
                        currentService[key] = {};
                        currentKeyType = 'object';
                    }
                } else {
                    currentService[key] = value;
                    currentKey = null;
                    currentKeyType = null;
                }

                return;
            }

            if (indent >= 6 && currentKey) {
                if (currentKeyType === 'array') {
                    const value = trimmed.startsWith('- ')
                        ? trimmed.slice(2).trim()
                        : trimmed;
                    currentService[currentKey].push(value);
                } else if (currentKeyType === 'object') {
                    if (!trimmed.includes(':')) {
                        return;
                    }

                    const [key, value = ''] = splitKeyValue(trimmed);
                    currentService[currentKey][key] = value ?? '';
                }

                return;
            }
        }
    });

    return {
        services,
        networks,
    };
}

const KEY_VALUE_LINE_REGEX = /^\s*([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#\s]+))?/;

function parseKeyValueContent(content) {
    const result = {};

    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        const match = KEY_VALUE_LINE_REGEX.exec(trimmed);
        if (!match) {
            return;
        }

        const key = match[1];
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        result[key] = value;
    });

    return result;
}

function parseEnvironmentVariables(envArray) {
    if (!Array.isArray(envArray)) {
        return {};
    }

    const envMap = {};

    envArray.forEach(entry => {
        if (typeof entry !== 'string') {
            return;
        }

        const separatorIndex = entry.indexOf('=');
        if (separatorIndex === -1) {
            return;
        }

        const key = entry.slice(0, separatorIndex).trim();
        const value = entry.slice(separatorIndex + 1).trim();
        if (!key) {
            return;
        }

        envMap[key] = value;
    });

    return envMap;
}

function parsePorts(portsArray) {
    if (!Array.isArray(portsArray)) {
        return [];
    }

    return portsArray
        .map(entry => {
            if (typeof entry !== 'string') {
                return null;
            }

            const parts = entry.split(':');
            if (parts.length < 2) {
                return null;
            }

            const hostPort = parts[0];
            const containerPort = parts[parts.length - 1];

            const host = hostPort.includes('0.0.0.0')
                ? hostPort.split('0.0.0.0').pop()?.replace(/^:/, '') || hostPort
                : hostPort;

            return {
                raw: entry,
                host,
                container: containerPort,
            };
        })
        .filter(Boolean);
}

function findPortMapping(ports, containerPort) {
    if (!Array.isArray(ports)) {
        return null;
    }

    const target = String(containerPort);
    return ports.find(port => port.container === target) ?? null;
}

async function extractVersionDefaults(utilsScriptPath) {
    try {
        const content = await fs.readFile(utilsScriptPath, 'utf8');
        const fabricMatch = content.match(/FabricVersion \(default: '([^']+)'\)/);
        const caMatch = content.match(/Fabric CA Version \(default: '([^']+)'\)/);

        return {
            fabric: fabricMatch?.[1] ?? null,
            ca: caMatch?.[1] ?? null,
        };
    } catch {
        return {
            fabric: null,
            ca: null,
        };
    }
}

function normalizeVersionValue(configValue, defaultValue) {
    if (!configValue) {
        return {
            value: null,
            label: defaultValue ? `${defaultValue} (default)` : null,
        };
    }

    if (configValue === 'default') {
        return {
            value: defaultValue ?? 'default',
            label: defaultValue ? `${defaultValue} (default)` : 'default',
        };
    }

    return {
        value: configValue,
        label: configValue,
    };
}

function formatAddress(address) {
    if (!address) {
        return null;
    }

    return address.replace(/^0\.0\.0\.0:/, '');
}

function buildOrdererSummary(serviceName, service, envMap) {
    if (!service) {
        return null;
    }

    const ports = parsePorts(service.ports);
    const grpcPort = envMap.ORDERER_GENERAL_LISTENPORT ?? null;
    const adminAddress = formatAddress(envMap.ORDERER_ADMIN_LISTENADDRESS ?? null);
    const operationsAddress = formatAddress(envMap.ORDERER_OPERATIONS_LISTENADDRESS ?? null);

    const grpcMapping = grpcPort ? findPortMapping(ports, grpcPort) : null;
    const adminPort = adminAddress?.split(':').pop() ?? null;
    const adminMapping = adminPort ? findPortMapping(ports, adminPort) : null;
    const operationsPort = operationsAddress?.split(':').pop() ?? null;
    const operationsMapping = operationsPort ? findPortMapping(ports, operationsPort) : null;

    const resolvedServiceName = serviceName ?? service.container_name ?? service.hostname ?? null;

    return {
        serviceName: resolvedServiceName,
        containerName: service.container_name ?? null,
        hostname: service.hostname ?? null,
        image: service.image ?? null,
        mspId: envMap.ORDERER_GENERAL_LOCALMSPID ?? null,
        tlsEnabled: envMap.ORDERER_GENERAL_TLS_ENABLED === 'true',
        listenAddress: envMap.ORDERER_GENERAL_LISTENADDRESS ?? null,
        listenPort: grpcPort,
        grpcMapping,
        adminAddress,
        adminMapping,
        operationsAddress,
        operationsMapping,
        metricsProvider: envMap.ORDERER_METRICS_PROVIDER ?? null,
        labels: service.labels ?? null,
        ports,
    };
}

function buildPeerSummary(serviceName, service) {
    if (!service) {
        return null;
    }

    const envMap = parseEnvironmentVariables(service.environment);
    const ports = parsePorts(service.ports);
    const listenAddress = envMap.CORE_PEER_LISTENADDRESS ?? null;
    const listenPort = listenAddress?.split(':').pop() ?? null;
    const listenMapping = listenPort ? findPortMapping(ports, listenPort) : null;

    const chaincodeAddress = envMap.CORE_PEER_CHAINCODEADDRESS ?? null;
    const chaincodePort = chaincodeAddress?.split(':').pop() ?? null;
    const chaincodeMapping = chaincodePort ? findPortMapping(ports, chaincodePort) : null;

    const operationsAddress = formatAddress(envMap.CORE_OPERATIONS_LISTENADDRESS ?? null);
    const operationsPort = operationsAddress?.split(':').pop() ?? null;
    const operationsMapping = operationsPort ? findPortMapping(ports, operationsPort) : null;

    return {
        serviceName,
        containerName: service.container_name ?? null,
        hostname: service.hostname ?? null,
        image: service.image ?? null,
        mspId: envMap.CORE_PEER_LOCALMSPID ?? null,
        tlsEnabled: envMap.CORE_PEER_TLS_ENABLED === 'true',
        address: envMap.CORE_PEER_ADDRESS ?? null,
        listenAddress,
        listenPort,
        listenMapping,
        chaincodeAddress,
        chaincodePort,
        chaincodeMapping,
        operationsAddress,
        operationsMapping,
        metricsProvider: envMap.CORE_METRICS_PROVIDER ?? null,
        chaincodeListenAddress: envMap.CORE_PEER_CHAINCODELISTENADDRESS ?? null,
        gossipBootstrap: envMap.CORE_PEER_GOSSIP_BOOTSTRAP ?? null,
        gossipEndpoint: envMap.CORE_PEER_GOSSIP_EXTERNALENDPOINT ?? null,
        ports,
    };
}

function buildPeerSummaries(services) {
    if (!services || typeof services !== 'object') {
        return [];
    }

    return Object.entries(services)
        .filter(([name]) => name.startsWith('peer'))
        .map(([name, service]) => buildPeerSummary(name, service))
        .filter(Boolean);
}

export async function loadFabricDescriptions() {
    const descriptions = [];

    for (const source of NETWORK_SOURCES) {
        try {
            const composePath = path.resolve(source.root, COMPOSE_RELATIVE_PATH);
            const composeContent = await fs.readFile(composePath, 'utf8');
            const compose = parseComposeFile(composeContent);
            const services = compose?.services ?? {};
            const preferredOrderer = source.ordererServiceName ?? null;
            const ordererEntry = findOrdererService(services, preferredOrderer);
            const ordererEnv = parseEnvironmentVariables(ordererEntry.service?.environment ?? []);
            const ordererSummary = buildOrdererSummary(ordererEntry.name, ordererEntry.service, ordererEnv);
            const peerSummaries = buildPeerSummaries(services);

            const networkConfigPath = path.resolve(source.root, NETWORK_CONFIG_RELATIVE_PATH);
            const networkConfigContent = await fs.readFile(networkConfigPath, 'utf8');
            const configValues = parseKeyValueContent(networkConfigContent);

            const configtxPath = path.resolve(source.root, 'configtx', 'configtx.yaml');
            const configtxContent = await fs.readFile(configtxPath, 'utf8');
            const configtxDoc = parseConfigtxYaml(configtxContent);
            const raftConfiguration = extractRaftConfiguration(configtxDoc);

            const utilsScriptPath = path.resolve(source.root, UTILS_SCRIPT_RELATIVE_PATH);
            const versionDefaults = await extractVersionDefaults(utilsScriptPath);

            const fabricVersion = normalizeVersionValue(configValues.IMAGETAG, versionDefaults.fabric);
            const fabricCAVersion = normalizeVersionValue(configValues.CA_IMAGETAG, versionDefaults.ca);

            descriptions.push({
                id: source.id,
                label: source.label,
                composeNetwork: compose?.networks?.test?.name ?? null,
                dockerProject: configValues.COMPOSE_PROJECT_NAME ?? null,
                fabricVersion,
                fabricCAVersion,
                channelName: configValues.CHANNEL_NAME ?? null,
                database: configValues.DATABASE ?? null,
                chaincode: {
                    name: configValues.CC_NAME ?? null,
                    version: configValues.CC_VERSION ?? null,
                    language: configValues.CC_SRC_LANGUAGE ?? null,
                    path: configValues.CC_SRC_PATH ?? null,
                },
                orderer: ordererSummary,
                peers: peerSummaries,
                raft: raftConfiguration,
                config: {
                    raw: configValues,
                },
            });
        } catch (error) {
            descriptions.push({
                id: source.id,
                label: source.label,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return descriptions;
}

function findOrdererService(services, preferredName) {
    if (!services || typeof services !== 'object') {
        return { name: null, service: null };
    }

    if (preferredName && services[preferredName]) {
        return { name: preferredName, service: services[preferredName] };
    }

    const ordererEntry = Object.entries(services).find(([, service]) => {
        const image = service?.image;
        if (typeof image === 'string' && image.includes('fabric-orderer')) {
            return true;
        }

        const env = parseEnvironmentVariables(service?.environment);
        return env.ORDERER_GENERAL_LOCALMSPID !== undefined;
    });

    if (!ordererEntry) {
        return { name: null, service: null };
    }

    return { name: ordererEntry[0], service: ordererEntry[1] };
}
