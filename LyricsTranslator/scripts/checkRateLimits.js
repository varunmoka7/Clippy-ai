#!/usr/bin/env node

/**
 * Rate limit checker script
 * Run with: npm run check-limits
 */

require('dotenv').config();

// Mock the services for rate limit checking
class MockRateLimiter {
  constructor() {
    this.limits = new Map();
  }
  
  // Simulate getting rate limit status
  getRemainingRequests(serviceName) {
    // In real implementation, this would come from actual usage tracking
    const mockData = {
      'audioRecognition_acrCloud': Math.floor(Math.random() * 500),
      'audioRecognition_auddIo': Math.floor(Math.random() * 1000),
      'lyrics_musixmatch': Math.floor(Math.random() * 2000),
      'lyrics_lyricsOvh': 999, // Unlimited but with rate limiting
      'translation_myMemory': Math.floor(Math.random() * 1000),
      'translation_libreTranslate': Math.floor(Math.random() * 20),
    };
    
    return mockData[serviceName] || 0;
  }
  
  getResetTime(serviceName) {
    const now = Date.now();
    const resetTimes = {
      'audioRecognition_acrCloud': now + (30 * 24 * 60 * 60 * 1000), // 30 days
      'audioRecognition_auddIo': now + (30 * 24 * 60 * 60 * 1000), // 30 days
      'lyrics_musixmatch': now + (24 * 60 * 60 * 1000), // 24 hours
      'lyrics_lyricsOvh': now + (60 * 60 * 1000), // 1 hour (rate limiting)
      'translation_myMemory': now + (24 * 60 * 60 * 1000), // 24 hours
      'translation_libreTranslate': now + (24 * 60 * 60 * 1000), // 24 hours
    };
    
    return resetTimes[serviceName] || now;
  }
}

const mockRateLimiter = new MockRateLimiter();

function formatTimeRemaining(resetTime) {
  const now = Date.now();
  const diff = resetTime - now;
  
  if (diff <= 0) return 'Now';
  
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  
  const minutes = Math.floor(diff / (60 * 1000));
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

function getHealthStatus(remaining, total) {
  const percentage = (remaining / total) * 100;
  
  if (percentage > 70) return { status: '🟢', text: 'Healthy' };
  if (percentage > 30) return { status: '🟡', text: 'Warning' };
  if (percentage > 0) return { status: '🟠', text: 'Critical' };
  return { status: '🔴', text: 'Exhausted' };
}

function checkAudioRecognitionLimits() {
  console.log('\n🎵 Audio Recognition Services:');
  console.log('==============================');
  
  const services = [
    {
      name: 'ACRCloud',
      key: 'audioRecognition_acrCloud',
      total: 500,
      window: 'month',
      configured: !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_ACCESS_SECRET),
    },
    {
      name: 'AudD.io',
      key: 'audioRecognition_auddIo',
      total: 1000,
      window: 'month',
      configured: !!process.env.AUDD_API_KEY,
    },
  ];
  
  let totalRemaining = 0;
  let configuredServices = 0;
  
  for (const service of services) {
    if (!service.configured) {
      console.log(`  ${service.name}: ❌ Not configured`);
      continue;
    }
    
    configuredServices++;
    const remaining = mockRateLimiter.getRemainingRequests(service.key);
    const resetTime = mockRateLimiter.getResetTime(service.key);
    const health = getHealthStatus(remaining, service.total);
    const resetText = formatTimeRemaining(resetTime);
    
    totalRemaining += remaining;
    
    console.log(`  ${service.name}: ${health.status} ${remaining}/${service.total} (resets in ${resetText})`);
  }
  
  if (configuredServices === 0) {
    console.log('  ⚠️  No audio recognition services configured!');
  } else {
    console.log(`\n  Total capacity remaining: ${totalRemaining} recognitions`);
  }
}

function checkLyricsLimits() {
  console.log('\n📝 Lyrics Services:');
  console.log('===================');
  
  const services = [
    {
      name: 'Musixmatch',
      key: 'lyrics_musixmatch',
      total: 2000,
      window: 'day',
      configured: !!process.env.MUSIXMATCH_API_KEY,
    },
    {
      name: 'Lyrics.ovh',
      key: 'lyrics_lyricsOvh',
      total: '∞',
      window: 'rate limited',
      configured: true,
    },
  ];
  
  for (const service of services) {
    if (!service.configured) {
      console.log(`  ${service.name}: ❌ Not configured`);
      continue;
    }
    
    if (service.total === '∞') {
      console.log(`  ${service.name}: 🟢 Unlimited (with rate limiting)`);
    } else {
      const remaining = mockRateLimiter.getRemainingRequests(service.key);
      const resetTime = mockRateLimiter.getResetTime(service.key);
      const health = getHealthStatus(remaining, service.total);
      const resetText = formatTimeRemaining(resetTime);
      
      console.log(`  ${service.name}: ${health.status} ${remaining}/${service.total} (resets in ${resetText})`);
    }
  }
}

function checkTranslationLimits() {
  console.log('\n🌍 Translation Services:');
  console.log('========================');
  
  const services = [
    {
      name: 'MyMemory',
      key: 'translation_myMemory',
      total: 1000,
      unit: 'words',
      window: 'day',
    },
    {
      name: 'LibreTranslate',
      key: 'translation_libreTranslate',
      total: 20,
      unit: 'requests',
      window: 'day',
    },
    {
      name: 'Google Translate (Free)',
      key: 'translation_googleFree',
      total: '~100',
      unit: 'requests',
      window: 'hour',
    },
  ];
  
  for (const service of services) {
    if (service.total.toString().startsWith('~')) {
      console.log(`  ${service.name}: 🟡 ${service.total} ${service.unit}/${service.window} (estimated)`);
    } else {
      const remaining = mockRateLimiter.getRemainingRequests(service.key);
      const resetTime = mockRateLimiter.getResetTime(service.key);
      const health = getHealthStatus(remaining, service.total);
      const resetText = formatTimeRemaining(resetTime);
      
      console.log(`  ${service.name}: ${health.status} ${remaining}/${service.total} ${service.unit} (resets in ${resetText})`);
    }
  }
}

function showUsageRecommendations() {
  console.log('\n💡 Usage Optimization Tips:');
  console.log('============================');
  console.log('  • Cache recognition results to avoid re-processing same audio');
  console.log('  • Batch similar requests to minimize API calls');
  console.log('  • Use manual input when recognition limits are hit');
  console.log('  • Consider self-hosted LibreTranslate for unlimited translation');
  console.log('  • Monitor usage through service dashboards');
  
  console.log('\n🔄 Fallback Strategy:');
  console.log('  1. Primary service → Backup service → Manual input');
  console.log('  2. Automatic service switching when limits are reached');
  console.log('  3. Graceful degradation with user notifications');
}

function estimateUsageCapacity() {
  console.log('\n📊 Daily Usage Estimate:');
  console.log('========================');
  
  // Mock current usage - in real app, this would come from actual tracking
  const audioRecognitions = Math.floor(Math.random() * 50);
  const lyricsRequests = Math.floor(Math.random() * 100);
  const translationWords = Math.floor(Math.random() * 500);
  
  console.log(`  Today's Usage:`);
  console.log(`    Audio Recognitions: ${audioRecognitions}`);
  console.log(`    Lyrics Requests: ${lyricsRequests}`);
  console.log(`    Translation Words: ${translationWords}`);
  
  // Calculate remaining capacity for today
  const remainingAudio = Math.max(0, 50 - audioRecognitions); // Assuming daily limit of ~50
  const remainingTranslation = Math.max(0, 1000 - translationWords);
  
  console.log(`\n  Remaining Today:`);
  console.log(`    Audio Recognitions: ~${remainingAudio}`);
  console.log(`    Lyrics Requests: Unlimited*`);
  console.log(`    Translation Words: ${remainingTranslation}`);
  
  console.log('\n  * Subject to rate limiting');
}

function main() {
  console.log('📈 Rate Limit Status Monitor');
  console.log('============================');
  console.log('Note: This is a simulation. Real usage tracking would show actual consumption.\n');
  
  checkAudioRecognitionLimits();
  checkLyricsLimits();
  checkTranslationLimits();
  estimateUsageCapacity();
  showUsageRecommendations();
  
  console.log('\n🔗 Service Dashboards:');
  console.log('  ACRCloud: https://console.acrcloud.com/');
  console.log('  AudD.io: https://dashboard.audd.io/');
  console.log('  Musixmatch: https://developer.musixmatch.com/');
  
  console.log('\n💾 To implement real tracking:');
  console.log('  1. Store API usage in AsyncStorage or local database');
  console.log('  2. Update counters after each successful API call');
  console.log('  3. Reset counters based on service reset windows');
  console.log('  4. Implement usage warnings before hitting limits');
}

main();