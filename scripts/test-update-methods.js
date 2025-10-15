#!/usr/bin/env node

/**
 * Test Script for AlphaDroid Update Methods
 * 
 * This script helps test and debug the various update methods
 * without requiring GitHub Actions to run.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const OTA_REPO = 'AlphaDroid-devices/OTA';
const API_BASE = `https://api.github.com/repos/${OTA_REPO}`;
const TOKEN = process.env.GITHUB_TOKEN; // Optional

const opts = { 
  headers: { 
    'User-Agent': 'AlphaDroid-Test-Script/1.0',
    'Accept': 'application/vnd.github.v3+json',
    ...(TOKEN ? { 'Authorization': `token ${TOKEN}` } : {})
  }
};

function get(url) {
  return new Promise((resolve, reject) => {
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

async function testApiConnectivity() {
  console.log('🔌 Testing API connectivity...');
  try {
    const repoInfo = await get(`${API_BASE}`);
    console.log(`✅ API connected successfully`);
    console.log(`   Repository: ${repoInfo.body.full_name}`);
    console.log(`   Default branch: ${repoInfo.body.default_branch}`);
    console.log(`   Size: ${repoInfo.body.size} KB`);
    return true;
  } catch (error) {
    console.log(`❌ API connection failed: ${error.message}`);
    return false;
  }
}

async function testRecentCommits(minutes = 30) {
  console.log(`📝 Checking for recent commits (last ${minutes} minutes)...`);
  try {
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const commits = await get(`${API_BASE}/commits?since=${since}&per_page=5`);
    
    console.log(`✅ Found ${commits.body.length} recent commits`);
    
    if (commits.body.length > 0) {
      console.log('   Recent commits:');
      commits.body.forEach((commit, index) => {
        const date = new Date(commit.commit.author.date).toLocaleString();
        const message = commit.commit.message.split('\n')[0];
        console.log(`   ${index + 1}. ${commit.sha.substring(0, 7)} - ${message} (${date})`);
      });
    }
    
    return commits.body;
  } catch (error) {
    console.log(`❌ Failed to get recent commits: ${error.message}`);
    return [];
  }
}

async function testJsonFiles() {
  console.log('📄 Checking for JSON files...');
  try {
    const contents = await get(`${API_BASE}/contents/`);
    const jsonFiles = contents.body.filter(item => 
      item.type === 'file' && item.name.toLowerCase().endsWith('.json')
    );
    
    console.log(`✅ Found ${jsonFiles.length} JSON files`);
    
    if (jsonFiles.length > 0) {
      console.log('   JSON files:');
      jsonFiles.slice(0, 10).forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.name} (${file.size} bytes)`);
      });
      
      if (jsonFiles.length > 10) {
        console.log(`   ... and ${jsonFiles.length - 10} more files`);
      }
    }
    
    return jsonFiles;
  } catch (error) {
    console.log(`❌ Failed to get JSON files: ${error.message}`);
    return [];
  }
}

async function testFileDownload(jsonFiles) {
  if (jsonFiles.length === 0) {
    console.log('⚠️ No JSON files to test download');
    return;
  }
  
  console.log('⬇️ Testing file download...');
  const testFile = jsonFiles[0];
  
  try {
    const response = await get(testFile.download_url);
    const data = response.body;
    
    if (typeof data === 'object' && data !== null) {
      console.log(`✅ Successfully downloaded ${testFile.name}`);
      console.log(`   Size: ${JSON.stringify(data).length} characters`);
      console.log(`   Type: ${Array.isArray(data) ? 'Array' : 'Object'}`);
      
      // Check if it looks like device data
      if (Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        if (firstItem.response || firstItem.device || firstItem.oem) {
          console.log(`   ✅ Looks like device data`);
        } else {
          console.log(`   ⚠️ May not be device data format`);
        }
      }
    } else {
      console.log(`⚠️ Downloaded file doesn't look like JSON`);
    }
  } catch (error) {
    console.log(`❌ Failed to download ${testFile.name}: ${error.message}`);
  }
}

async function testDataFreshness() {
  console.log('📊 Checking local data freshness...');
  
  const devicesPath = path.join('data', 'devices.json');
  if (!fs.existsSync(devicesPath)) {
    console.log('⚠️ Local devices.json not found');
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
    const metadata = data.metadata || {};
    
    if (metadata.fetchedAt) {
      const fetchTime = new Date(metadata.fetchedAt);
      const now = new Date();
      const ageMinutes = Math.floor((now - fetchTime) / (1000 * 60));
      
      console.log(`✅ Local data found`);
      console.log(`   Fetched: ${fetchTime.toLocaleString()}`);
      console.log(`   Age: ${ageMinutes} minutes`);
      console.log(`   Device count: ${data.devices?.length || 0}`);
      console.log(`   Last trigger: ${metadata.trigger || 'unknown'}`);
      
      if (ageMinutes > 60) {
        console.log(`⚠️ Data is ${ageMinutes} minutes old`);
      } else {
        console.log(`✅ Data is fresh`);
      }
    } else {
      console.log(`⚠️ No fetch timestamp in metadata`);
    }
  } catch (error) {
    console.log(`❌ Failed to read local data: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🧪 AlphaDroid Update Methods Test Suite');
  console.log('=====================================\n');
  
  const results = {
    apiConnectivity: false,
    recentCommits: 0,
    jsonFiles: 0,
    fileDownload: false,
    localData: false
  };
  
  // Test 1: API Connectivity
  results.apiConnectivity = await testApiConnectivity();
  console.log('');
  
  if (!results.apiConnectivity) {
    console.log('❌ API connectivity failed. Please check your internet connection and GitHub token.');
    return;
  }
  
  // Test 2: Recent Commits
  const recentCommits = await testRecentCommits(60);
  results.recentCommits = recentCommits.length;
  console.log('');
  
  // Test 3: JSON Files
  const jsonFiles = await testJsonFiles();
  results.jsonFiles = jsonFiles.length;
  console.log('');
  
  // Test 4: File Download
  if (jsonFiles.length > 0) {
    await testFileDownload(jsonFiles);
    results.fileDownload = true;
  }
  console.log('');
  
  // Test 5: Local Data
  await testDataFreshness();
  console.log('');
  
  // Summary
  console.log('📋 Test Summary');
  console.log('===============');
  console.log(`API Connectivity: ${results.apiConnectivity ? '✅' : '❌'}`);
  console.log(`Recent Commits: ${results.recentCommits} found`);
  console.log(`JSON Files: ${results.jsonFiles} found`);
  console.log(`File Download: ${results.fileDownload ? '✅' : '❌'}`);
  
  if (results.apiConnectivity && results.jsonFiles > 0) {
    console.log('\n🎉 All critical tests passed! Your update methods should work correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the issues above.');
  }
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'api':
    testApiConnectivity();
    break;
  case 'commits':
    const minutes = parseInt(args[1]) || 30;
    testRecentCommits(minutes);
    break;
  case 'files':
    testJsonFiles();
    break;
  case 'data':
    testDataFreshness();
    break;
  case 'all':
  default:
    runAllTests();
    break;
}

// Usage information
if (command === 'help' || command === '--help' || command === '-h') {
  console.log('AlphaDroid Update Methods Test Script');
  console.log('=====================================');
  console.log('');
  console.log('Usage: node test-update-methods.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  all      Run all tests (default)');
  console.log('  api      Test API connectivity only');
  console.log('  commits  Test recent commits (optionally specify minutes)');
  console.log('  files    Test JSON files listing');
  console.log('  data     Test local data freshness');
  console.log('  help     Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node test-update-methods.js');
  console.log('  node test-update-methods.js api');
  console.log('  node test-update-methods.js commits 60');
  console.log('');
  console.log('Environment Variables:');
  console.log('  GITHUB_TOKEN  Optional GitHub token for higher rate limits');
}
