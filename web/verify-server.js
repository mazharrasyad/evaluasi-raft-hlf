/**
 * Server Verification Script
 * Verifies that the server is running and API endpoints are functioning correctly
 */

const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 5176;

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            hostname: SERVER_HOST,
            port: SERVER_PORT,
            path: path,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: 10000,
        };

        const req = http.request(requestOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = data ? JSON.parse(data) : null;
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: parsedData,
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data,
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

async function verifyServerRunning() {
    log('\n=== Verifying Server ===\n', 'cyan');

    try {
        log(`🔍 Checking if server is running on http://${SERVER_HOST}:${SERVER_PORT}...`, 'blue');
        const response = await makeRequest('/');

        if (response.statusCode === 200) {
            log('✅ Server is running!', 'green');
            return true;
        } else {
            log(`⚠️  Server responded with status code: ${response.statusCode}`, 'yellow');
            return false;
        }
    } catch (error) {
        log('❌ Server is NOT running!', 'red');
        log(`   Error: ${error.message}`, 'red');
        log('\n💡 To start the server, run:', 'yellow');
        log('   cd c:\\xampp\\htdocs\\evaluasi-raft-hlf\\web', 'yellow');
        log('   npm start', 'yellow');
        return false;
    }
}

async function verifyCheckNetworkEndpoint() {
    log('\n=== Verifying /api/check-network Endpoint ===\n', 'cyan');

    try {
        log('🔍 Checking /api/check-network endpoint...', 'blue');
        const response = await makeRequest('/api/check-network');

        if (response.statusCode === 200) {
            log('✅ /api/check-network is working!', 'green');

            if (response.data && response.data.results) {
                log(`   Found ${response.data.results.length} network(s):`, 'green');
                response.data.results.forEach((network, index) => {
                    const statusIcon = network.status === 'healthy' ? '✅' : '❌';
                    log(`   ${index + 1}. ${statusIcon} ${network.label} (${network.targetId}) - ${network.status}`, 'green');
                    if (network.blockHeight !== null && network.blockHeight !== undefined) {
                        log(`      Block Height: ${network.blockHeight}`, 'green');
                    }
                });
            }
            return true;
        } else {
            log(`⚠️  Endpoint responded with status code: ${response.statusCode}`, 'yellow');
            return false;
        }
    } catch (error) {
        log('❌ Failed to verify /api/check-network endpoint!', 'red');
        log(`   Error: ${error.message}`, 'red');
        return false;
    }
}

async function verifyCatatanEndpoint() {
    log('\n=== Verifying /api/catatan Endpoint ===\n', 'cyan');

    try {
        log('🔍 Checking /api/catatan endpoint...', 'blue');
        const response = await makeRequest('/api/catatan');

        if (response.statusCode === 200) {
            log('✅ /api/catatan is working!', 'green');

            if (response.data && response.data.results) {
                log(`   Found ${response.data.results.length} network(s):`, 'green');

                let totalRecords = 0;
                response.data.results.forEach((network, index) => {
                    const statusIcon = network.status === 'healthy' ? '✅' : '❌';
                    const recordCount = network.records ? network.records.length : 0;
                    totalRecords += recordCount;

                    log(`   ${index + 1}. ${statusIcon} ${network.label} (${network.targetId})`, 'green');
                    log(`      Status: ${network.status}`, 'green');
                    log(`      Records: ${recordCount}`, 'green');

                    if (network.records && network.records.length > 0) {
                        log(`      Sample Record:`, 'green');
                        const sample = network.records[0];
                        log(`        - Report ID: ${sample.reportId || 'N/A'}`, 'green');
                        log(`        - Substance: ${sample.substance || 'N/A'}`, 'green');
                        log(`        - Status: ${sample.status || 'N/A'}`, 'green');
                    }
                });

                log(`\n   📊 Total Records Across All Networks: ${totalRecords}`, 'green');

                if (totalRecords === 0) {
                    log('\n⚠️  No records found in any network!', 'yellow');
                    log('   💡 To add data, visit: http://localhost:5176/penelitian/pelaksanaan-simulasi/input-data-simulasi', 'yellow');
                }
            }
            return true;
        } else {
            log(`⚠️  Endpoint responded with status code: ${response.statusCode}`, 'yellow');
            return false;
        }
    } catch (error) {
        log('❌ Failed to verify /api/catatan endpoint!', 'red');
        log(`   Error: ${error.message}`, 'red');
        return false;
    }
}

async function main() {
    log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║         Gateway Server Verification Tool                  ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝', 'cyan');

    const serverRunning = await verifyServerRunning();

    if (!serverRunning) {
        log('\n❌ Cannot proceed with endpoint verification because server is not running.', 'red');
        process.exit(1);
    }

    const checkNetworkOk = await verifyCheckNetworkEndpoint();
    const catatanOk = await verifyCatatanEndpoint();

    log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                   Verification Summary                     ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝', 'cyan');

    log(`\n  Server Running:         ${serverRunning ? '✅ Yes' : '❌ No'}`, serverRunning ? 'green' : 'red');
    log(`  /api/check-network:     ${checkNetworkOk ? '✅ Working' : '❌ Failed'}`, checkNetworkOk ? 'green' : 'red');
    log(`  /api/catatan:           ${catatanOk ? '✅ Working' : '❌ Failed'}`, catatanOk ? 'green' : 'red');

    if (serverRunning && checkNetworkOk && catatanOk) {
        log('\n✅ All checks passed! Server is ready.', 'green');
        log('   🌐 Access the application at: http://localhost:5176', 'green');
    } else {
        log('\n❌ Some checks failed. Please review the errors above.', 'red');
        process.exit(1);
    }

    log('');
}

main().catch((error) => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    process.exit(1);
});
