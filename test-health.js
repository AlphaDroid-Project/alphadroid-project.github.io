const https = require('https');
const fs = require('fs');
const path = require('path');

const OTA_REPO = 'AlphaDroid-devices/OTA';
const API_BASE = `https://api.github.com/repos/${OTA_REPO}`;
const TOKEN = process.env.GITHUB_TOKEN;
const CHECK_TYPE = process.env.CHECK_TYPE || 'full';

const opts = {
    headers: {
        'User-Agent': 'AlphaDroid-Health-Bot/1.0',
        'Accept': 'application/vnd.github.v3+json',
        ...(TOKEN ? { 'Authorization': `token ${TOKEN}` } : {})
    }
};

function get(url) {
    return new Promise((resolve, reject) => {
        // Mock for local test since we don't want to hit API really, and we are testing data freshness
        if (url.includes('api.github.com')) {
            resolve({ statusCode: 200, headers: {}, body: {} }); // Mock response
            return;
        }
        const request = https.get(url, opts, response => {
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: JSON.parse(body)
                    });
                } else {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }
            });
        });

        request.on('error', reject);
        request.setTimeout(10000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function checkApiStatus() {
    console.log('🔍 Checking GitHub API status...');
    // Mocked for local test
    return { status: 'healthy', lastCommit: 'mock', repoSize: 0, defaultBranch: 'main' };
}

async function checkDataFreshness() {
    console.log('📊 Checking data freshness...');

    const devicesPath = path.join('data', 'devices.json');
    if (!fs.existsSync(devicesPath)) {
        return {
            status: 'missing',
            error: 'devices.json file not found'
        };
    }

    try {
        const data = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
        const metadata = data.metadata || {};
        const fetchedAt = metadata.fetchedAt;

        if (!fetchedAt) {
            return {
                status: 'unknown',
                error: 'No fetch timestamp in metadata'
            };
        }

        const fetchTime = new Date(fetchedAt);
        const now = new Date(); // Simulating current time
        // For testing, let's assume 'now' is indeed now.

        const ageMinutes = Math.floor((now - fetchTime) / (1000 * 60));
        const ageHours = Math.floor(ageMinutes / 60);
        const ageDays = Math.floor(ageHours / 24);

        let status = 'fresh';
        let warning = null;

        if (ageMinutes > 13 * 60) {
            status = 'stale';
            warning = `Data is ${Math.floor(ageMinutes / 60)} hours old (expected < 13h)`;
        }
        if (ageHours > 25) {
            status = 'old';
            warning = `Data is ${ageHours} hours old (expected < 25h)`;
        }
        if (ageDays > 3) {
            status = 'very_old';
            warning = `Data is ${ageDays} days old`;
        }

        return {
            status,
            fetchedAt,
            ageMinutes,
            ageHours,
            ageDays,
            warning,
            deviceCount: data.devices?.length || 0,
            lastTrigger: metadata.trigger || 'unknown'
        };
    } catch (error) {
        return {
            status: 'corrupt',
            error: error.message
        };
    }
}

async function checkWebsiteStatus() {
    return { status: 'healthy', checks: {}, missingFiles: [] }; // Mock
}

async function checkWorkflowStatus() {
    return { status: 'healthy', workflows: {}, missingWorkflows: [] }; // Mock
}

async function performHealthCheck() {
    console.log(`🏥 Starting ${CHECK_TYPE} health check...`);
    const startTime = Date.now();

    const results = {
        timestamp: new Date().toISOString(),
        checkType: CHECK_TYPE,
        overallStatus: 'healthy',
        checks: {},
        warnings: [],
        errors: []
    };

    try {
        // API Status Check
        if (CHECK_TYPE === 'full' || CHECK_TYPE === 'api_status') {
            results.checks.apiStatus = await checkApiStatus();
            if (results.checks.apiStatus.status !== 'healthy') {
                results.overallStatus = 'degraded';
                results.errors.push(`API Status: ${results.checks.apiStatus.error}`);
            }
        }

        // Data Freshness Check
        if (CHECK_TYPE === 'full' || CHECK_TYPE === 'data_freshness') {
            results.checks.dataFreshness = await checkDataFreshness();
            if (results.checks.dataFreshness.status === 'missing' ||
                results.checks.dataFreshness.status === 'corrupt') {
                results.overallStatus = 'unhealthy';
                results.errors.push(`Data Status: ${results.checks.dataFreshness.error}`);
            } else if (results.checks.dataFreshness.warning) {
                results.overallStatus = 'degraded';
                results.warnings.push(`Data Freshness: ${results.checks.dataFreshness.warning}`);
            }
        }

        // Website Status Check
        if (CHECK_TYPE === 'full' || CHECK_TYPE === 'website_status') {
            results.checks.websiteStatus = await checkWebsiteStatus();
            if (results.checks.websiteStatus.status !== 'healthy') {
                results.overallStatus = 'unhealthy';
                results.errors.push(`Website Status: Missing files: ${results.checks.websiteStatus.missingFiles.join(', ')}`);
            }
        }

        // Workflow Status Check
        if (CHECK_TYPE === 'full') {
            results.checks.workflowStatus = await checkWorkflowStatus();
            if (results.checks.workflowStatus.status !== 'healthy') {
                results.overallStatus = 'degraded';
                results.warnings.push(`Workflow Status: Missing workflows: ${results.checks.workflowStatus.missingWorkflows.join(', ')}`);
            }
        }

        results.duration = Date.now() - startTime;

        // Write health check results
        const resultsPath = 'health-check-results-test.json';
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

        console.log(`\n🏥 Health Check Results:`);
        console.log(`Overall Status: ${results.overallStatus.toUpperCase()}`);
        console.log(`Duration: ${results.duration}ms`);

        if (results.errors.length > 0) {
            console.log(`\n❌ Errors:`);
            results.errors.forEach(error => console.log(`  - ${error}`));
        }

        if (results.warnings.length > 0) {
            console.log(`\n⚠️ Warnings:`);
            results.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        if (results.overallStatus === 'healthy' && results.warnings.length === 0) {
            console.log(`\n✅ All systems healthy!`);
        }

        return results;

    } catch (error) {
        console.error('Health check failed:', error.message);
        return {
            timestamp: new Date().toISOString(),
            checkType: CHECK_TYPE,
            overallStatus: 'error',
            error: error.message,
            duration: Date.now() - startTime
        };
    }
}

performHealthCheck()
    .then(results => {
        // Write results to file for next step
        fs.writeFileSync('health-results-test.json', JSON.stringify(results));

        if (results.overallStatus === 'healthy' || results.overallStatus === 'degraded') {
            console.log(`Health check completed successfully (Status: ${results.overallStatus})`);
            process.exit(0);
        } else {
            console.log(`Health check failed with status: ${results.overallStatus}`);
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('Unexpected error during health check:', error);
        process.exit(1);
    });
