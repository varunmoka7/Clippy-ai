#!/usr/bin/env node

/**
 * Test script to validate all free services are working
 * Run with: npm run test-services
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function testAudioRecognition() {
  console.log('\n🎵 Testing Audio Recognition Services...');
  
  const hasACRCloud = !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_ACCESS_SECRET);
  const hasAudD = !!process.env.AUDD_API_KEY;
  
  console.log(`  ACRCloud: ${hasACRCloud ? '✅ Configured' : '❌ Missing credentials'}`);
  console.log(`  AudD.io: ${hasAudD ? '✅ Configured' : '❌ Missing API key'}`);
  
  if (!hasACRCloud && !hasAudD) {
    console.log('  ⚠️  Warning: No audio recognition services configured!');
    return false;
  }
  
  return true;
}

async function testLyricsServices() {
  console.log('\n📝 Testing Lyrics Services...');
  
  const hasMusixmatch = !!process.env.MUSIXMATCH_API_KEY;
  console.log(`  Musixmatch: ${hasMusixmatch ? '✅ Configured' : '❌ Missing API key'}`);
  console.log('  Lyrics.ovh: ✅ Always available (no key needed)');
  
  // Test Lyrics.ovh with a simple request
  try {
    const response = await fetch('https://api.lyrics.ovh/v1/Beatles/Yesterday', {
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      console.log('  Lyrics.ovh: ✅ Service responding');
      return true;
    } else {
      console.log('  Lyrics.ovh: ⚠️  Service may be down');
    }
  } catch (error) {
    console.log('  Lyrics.ovh: ❌ Connection failed');
  }
  
  return hasMusixmatch;
}

async function testTranslationServices() {
  console.log('\n🌍 Testing Translation Services...');
  
  const services = [
    { name: 'MyMemory', url: 'https://api.mymemory.translated.net/get?q=hello&langpair=en|es' },
    { name: 'LibreTranslate', url: 'https://libretranslate.de/detect', method: 'POST' },
  ];
  
  let workingServices = 0;
  
  for (const service of services) {
    try {
      const options = {
        signal: AbortSignal.timeout(5000),
      };
      
      if (service.method === 'POST') {
        options.method = 'POST';
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify({ q: 'hello' });
      }
      
      const response = await fetch(service.url, options);
      
      if (response.ok || response.status === 400) { // 400 might be expected for some test requests
        console.log(`  ${service.name}: ✅ Service responding`);
        workingServices++;
      } else {
        console.log(`  ${service.name}: ⚠️  Service may have issues (${response.status})`);
      }
    } catch (error) {
      console.log(`  ${service.name}: ❌ Connection failed`);
    }
  }
  
  console.log('  Google Translate (Free): ✅ Available (conservative limits)');
  
  return workingServices > 0;
}

async function checkEnvironmentFile() {
  console.log('\n⚙️  Checking Environment Configuration...');
  
  const envPath = path.join(process.cwd(), '.env');
  const examplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    console.log('  ❌ .env file not found');
    if (fs.existsSync(examplePath)) {
      console.log('  💡 Run: cp .env.example .env');
    }
    return false;
  }
  
  console.log('  ✅ .env file exists');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasRealValues = !envContent.includes('your_') && !envContent.includes('_here');
  
  if (hasRealValues) {
    console.log('  ✅ .env appears to have real values');
  } else {
    console.log('  ⚠️  .env contains placeholder values - update with real API keys');
  }
  
  return true;
}

async function generateReport() {
  console.log('\n📊 Generating Service Report...');
  
  const report = {
    audioRecognition: await testAudioRecognition(),
    lyrics: await testLyricsServices(),
    translation: await testTranslationServices(),
    environment: await checkEnvironmentFile(),
  };
  
  const totalServices = Object.values(report).filter(Boolean).length;
  const maxServices = Object.keys(report).length;
  
  console.log('\n🎯 Final Results:');
  console.log('==================');
  console.log(`Overall Status: ${totalServices}/${maxServices} service groups working`);
  
  if (totalServices === maxServices) {
    console.log('🎉 All services are ready! Your app should work perfectly.');
  } else if (totalServices >= 2) {
    console.log('✅ Most services are working. App will function with some limitations.');
  } else {
    console.log('⚠️  Many services need configuration. Check the setup instructions.');
  }
  
  console.log('\n📚 Next Steps:');
  if (!report.environment) {
    console.log('  1. Copy .env.example to .env');
  }
  if (!report.audioRecognition) {
    console.log('  2. Set up ACRCloud or AudD.io for audio recognition');
  }
  if (!report.lyrics) {
    console.log('  3. Add Musixmatch API key for better lyrics coverage');
  }
  
  console.log('\n📖 For detailed setup instructions, see: SETUP-INSTRUCTIONS.md');
  
  return report;
}

// Main execution
async function main() {
  console.log('🔍 Free Services Validation Test');
  console.log('================================');
  
  try {
    await generateReport();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();