#!/usr/bin/env node

import { checkNetworkHealth } from './src/network-check.js';

const COLORS = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

const STATUS_META = {
    healthy: {
        icon: '✅',
        color: COLORS.green,
        message: 'Jaringan siap digunakan.'
    },
    unhealthy: {
        icon: '❌',
        color: COLORS.red,
        message: 'Jaringan tidak merespons.'
    },
    not_found: {
        icon: '⚠️',
        color: COLORS.yellow,
        message: 'Direktori jaringan belum tersedia.'
    },
    incomplete: {
        icon: '⚠️',
        color: COLORS.yellow,
        message: 'Material jaringan belum lengkap.'
    }
};

function colorize(text, color) {
    if (!color) {
        return text;
    }
    return `${color}${text}${COLORS.reset}`;
}

function printBanner() {
    const border = '═'.repeat(54);
    console.log(colorize(`╔${border}╗`, COLORS.cyan));
    console.log(colorize('║   Evaluasi Kesehatan Jaringan Hyperledger Fabric   ║', COLORS.cyan));
    console.log(colorize(`╚${border}╝`, COLORS.cyan));
}

function printInstructions(instructions) {
    if (!instructions) {
        return;
    }

    if (instructions.up) {
        console.log(`${COLORS.gray}   • Mulai jaringan :${COLORS.reset} ${instructions.up}`);
    }
    if (instructions.deploy) {
        console.log(`${COLORS.gray}   • Deploy chaincode:${COLORS.reset} ${instructions.deploy}`);
    }
}

function printResult(result) {
    const meta = STATUS_META[result.status] || STATUS_META.unhealthy;
    console.log('');
    console.log(colorize(result.label, COLORS.bold));
    console.log(colorize(`${meta.icon} ${meta.message}`, meta.color));

    console.log(`${COLORS.gray}   Direktori: ${COLORS.reset}${result.networkDir}`);
    console.log(`${COLORS.gray}   Channel  : ${COLORS.reset}${result.channel}`);
    console.log(`${COLORS.gray}   Chaincode: ${COLORS.reset}${result.chaincode}`);
    console.log(`${COLORS.gray}   Peer     : ${COLORS.reset}${result.peer}`);

    if (result.status !== 'healthy' && result.message) {
        console.log(colorize(`   Catatan  : ${result.message}`, COLORS.yellow));
    }

    printInstructions(result.instructions);
}

async function main() {
    try {
        printBanner();
        const rawResults = await checkNetworkHealth();
        const results = Array.isArray(rawResults) ? rawResults : [rawResults];

        results.forEach(printResult);

        const allHealthy = results.length > 0 && results.every(item => item.status === 'healthy');
        console.log('');
        if (allHealthy) {
            console.log(colorize('Semua jaringan RAFT siap digunakan ✅', COLORS.green));
            process.exit(0);
        } else {
            console.log(colorize('Beberapa jaringan membutuhkan perhatian lebih lanjut.', COLORS.yellow));
            process.exit(1);
        }
    } catch (error) {
        console.error(colorize('❌ Gagal memeriksa kesehatan jaringan.', COLORS.red));
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
