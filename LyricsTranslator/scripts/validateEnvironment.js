#!/usr/bin/env node

/**
 * Environment validation script
 * Run with: npm run validate-env
 */

require('dotenv').config();

const REQUIRED_FOR_AUDIO = [
  { name: 'ACRCloud', keys: ['ACRCLOUD_ACCESS_KEY', 'ACRCLOUD_ACCESS_SECRET'], limit: '500/month' },
  { name: 'AudD.io', keys: ['AUDD_API_KEY'], limit: '1000/month' },
];

const REQUIRED_FOR_LYRICS = [
  { name: 'Musixmatch', keys: ['MUSIXMATCH_API_KEY'], limit: '2000/day' },
];

const OPTIONAL_SERVICES = [
  { name: 'Lyrics.ovh', limit: 'Free with rate limiting' },
  { name: 'MyMemory', limit: '1000 words/day' },
  { name: 'LibreTranslate', limit: '20 requests/day' },
  { name: 'Google Translate (Free)', limit: 'Conservative limits' },
];

function checkServiceConfiguration(services, category) {
  console.log(`\n${category}:`);
  console.log('='.repeat(category.length + 1));
  
  let hasAnyConfigured = false;
  
  for (const service of services) {
    const hasAllKeys = service.keys.every(key => process.env[key]);
    const status = hasAllKeys ? '✅ Configured' : '❌ Missing keys';
    
    console.log(`  ${service.name}: ${status} (${service.limit})`);
    
    if (!hasAllKeys) {
      console.log(`    Required: ${service.keys.join(', ')}`);
    }
    
    if (hasAllKeys) {
      hasAnyConfigured = true;
    }
  }
  
  return hasAnyConfigured;
}

function showOptionalServices() {
  console.log('\n📋 Always Available Services (No API Key Required):');
  console.log('==================================================');
  
  for (const service of OPTIONAL_SERVICES) {
    console.log(`  ${service.name}: ✅ Available (${service.limit})`);
  }
}

function generateSignupInstructions() {
  console.log('\n🔗 Quick Signup Links:');
  console.log('======================');
  console.log('  ACRCloud: https://console.acrcloud.com/signup');
  console.log('  AudD.io: https://dashboard.audd.io/');
  console.log('  Musixmatch: https://developer.musixmatch.com/signup');
  
  console.log('\n⏱️  Setup Time Estimate:');
  console.log('  ACRCloud: ~2 minutes');
  console.log('  AudD.io: ~1 minute');
  console.log('  Musixmatch: ~2 minutes');
  console.log('  Total: ~5 minutes for full setup');
}

function calculateCapacity() {
  const hasACRCloud = process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_ACCESS_SECRET;
  const hasAudD = process.env.AUDD_API_KEY;
  const hasMusixmatch = process.env.MUSIXMATCH_API_KEY;
  
  console.log('\n📊 Monthly Capacity Estimate:');
  console.log('=============================');
  
  let audioCapacity = 0;
  if (hasACRCloud) audioCapacity += 500;
  if (hasAudD) audioCapacity += 1000;
  
  let lyricsCapacity = 'Unlimited*';
  if (hasMusixmatch) lyricsCapacity = '60,000+ songs';
  
  const translationCapacity = '~100-150 songs (30,000 words)';
  
  console.log(`  Audio Recognition: ${audioCapacity || 'Manual input only'} songs`);
  console.log(`  Lyrics Fetching: ${lyricsCapacity}`);
  console.log(`  Translation: ${translationCapacity}`);
  
  if (!hasMusixmatch) {
    console.log('  * Lyrics.ovh has rate limiting but no hard daily/monthly limits');
  }
}

function showRecommendations() {
  const hasAudio = (process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_ACCESS_SECRET) || process.env.AUDD_API_KEY;
  const hasLyrics = process.env.MUSIXMATCH_API_KEY;
  
  console.log('\n💡 Recommendations:');
  console.log('===================');
  
  if (!hasAudio) {
    console.log('  🔴 HIGH PRIORITY: Set up at least one audio recognition service');
    console.log('     → Without this, users must manually enter song information');
  }
  
  if (!hasLyrics) {
    console.log('  🟡 RECOMMENDED: Add Musixmatch API key for better lyrics coverage');
    console.log('     → Lyrics.ovh works but has limited catalog');
  }
  
  if (hasAudio && hasLyrics) {
    console.log('  🟢 EXCELLENT: You have a robust setup with multiple fallbacks!');
  }
  
  console.log('\n🚀 Pro Tips:');
  console.log('  • Start with free tiers to test functionality');
  console.log('  • Monitor usage through service dashboards');
  console.log('  • Set up self-hosted LibreTranslate for unlimited translation');
  console.log('  • Consider upgrading to paid tiers as your app grows');
}

function main() {
  console.log('🔍 Environment Configuration Validator');
  console.log('======================================');
  
  const hasAudioService = checkServiceConfiguration(REQUIRED_FOR_AUDIO, '🎵 Audio Recognition Services');
  const hasLyricsService = checkServiceConfiguration(REQUIRED_FOR_LYRICS, '📝 Lyrics Services');
  
  showOptionalServices();
  calculateCapacity();
  
  const overallScore = (hasAudioService ? 1 : 0) + (hasLyricsService ? 1 : 0);
  
  console.log('\n🎯 Overall Assessment:');
  console.log('======================');
  
  switch (overallScore) {
    case 2:
      console.log('  Status: 🟢 EXCELLENT - Full functionality available');
      break;
    case 1:
      console.log('  Status: 🟡 GOOD - Core functionality available with limitations');
      break;
    case 0:
      console.log('  Status: 🔴 NEEDS SETUP - Limited functionality without API keys');
      break;
  }
  
  showRecommendations();
  generateSignupInstructions();
  
  console.log('\n📚 For detailed setup instructions, see: SETUP-INSTRUCTIONS.md');
}

main();