# Free Backend Setup Instructions

This guide will help you set up a completely free backend architecture for the lyrics translation app using free-tier APIs.

## Overview

Our free backend uses:
- **Audio Recognition**: ACRCloud (500/month), AudD.io (1000/month)
- **Lyrics**: Lyrics.ovh (free), Musixmatch (2000/day)
- **Translation**: MyMemory (1000 words/day), LibreTranslate (20/day), Google Translate (unofficial)

## Quick Start (5 minutes)

### 1. Clone and Install
```bash
cd LyricsTranslator
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your API keys (see step 3)
```

### 3. Get Free API Keys (Required)

#### ACRCloud (Audio Recognition) - **RECOMMENDED**
1. Visit: https://console.acrcloud.com/signup
2. Create free account (500 recognitions/month)
3. Go to "Audio Recognition" → "Create Project"
4. Choose "Audio Recognition"
5. Copy: `Access Key`, `Access Secret`, and note your `Host`
6. Add to `.env`:
```
ACRCLOUD_ACCESS_KEY=your_access_key
ACRCLOUD_ACCESS_SECRET=your_access_secret
ACRCLOUD_API_KEY=your_host_url
```

#### AudD.io (Audio Recognition Backup)
1. Visit: https://dashboard.audd.io/
2. Create free account (1000 requests/month)
3. Get API token from dashboard
4. Add to `.env`:
```
AUDD_API_KEY=your_audd_token
```

#### Musixmatch (Lyrics) - **RECOMMENDED**
1. Visit: https://developer.musixmatch.com/signup
2. Create developer account (2000 requests/day)
3. Create new application
4. Copy API key
5. Add to `.env`:
```
MUSIXMATCH_API_KEY=your_musixmatch_key
```

### 4. Test the Setup
```bash
# Run the test script to verify all services
npm run test-services
```

## Service Details

### Audio Recognition Services

#### ACRCloud (Primary)
- **Free Tier**: 500 recognitions/month
- **Accuracy**: Very high
- **Speed**: ~3-5 seconds
- **Setup Time**: 2 minutes

#### AudD.io (Backup)
- **Free Tier**: 1000 requests/month
- **Accuracy**: Good
- **Speed**: ~2-4 seconds
- **Setup Time**: 1 minute

### Lyrics Services

#### Lyrics.ovh (Always Free)
- **Free Tier**: Unlimited with rate limiting
- **Coverage**: Good for popular songs
- **Setup Time**: 0 minutes (no API key needed)

#### Musixmatch (Primary)
- **Free Tier**: 2000 requests/day
- **Coverage**: Excellent
- **Lyrics Quality**: High (official lyrics)
- **Setup Time**: 2 minutes

### Translation Services

#### MyMemory (Primary)
- **Free Tier**: 1000 words/day
- **Quality**: Good
- **Languages**: 50+
- **Setup Time**: 0 minutes (no API key needed)

#### LibreTranslate (Backup)
- **Free Tier**: 20 requests/day (public instance)
- **Quality**: Good for major languages
- **Privacy**: High (open source)
- **Setup Time**: 0 minutes

#### Google Translate (Emergency Backup)
- **Free Tier**: Unofficial API, conservative limits
- **Quality**: Excellent
- **Languages**: 100+
- **Setup Time**: 0 minutes

## Advanced Setup

### Self-Hosted LibreTranslate (Unlimited Free)
For unlimited translations, host your own LibreTranslate instance:

```bash
# Using Docker
docker run -ti --rm -p 5000:5000 libretranslate/libretranslate

# Or using Python
pip install libretranslate
libretranslate
```

Add to `.env`:
```
LIBRETRANSLATE_URL=http://localhost:5000
```

### Rate Limit Management

The system automatically manages rate limits:
- **Fallback Strategy**: If one service hits limits, automatically switches to next
- **Rate Tracking**: Tracks usage across time windows
- **Smart Caching**: Caches results to minimize API calls
- **Batch Processing**: Efficiently handles multiple requests

### Usage Examples

#### Basic Usage
```typescript
import { lyricsTranslatorService } from './src/services/lyricsTranslatorService';

// From audio file
const result = await lyricsTranslatorService.translateFromAudio(audioBuffer, {
  targetLanguage: 'es', // Spanish
});

// From song info
const result = await lyricsTranslatorService.translateFromSongInfo(
  'The Beatles', 'Hey Jude', 'fr' // French
);

// Direct lyrics translation
const result = await lyricsTranslatorService.translateLyricsOnly(
  'Hello, how are you?', 'de' // German
);
```

#### Batch Processing
```typescript
const requests = [
  { artist: 'Queen', title: 'Bohemian Rhapsody', targetLanguage: 'es' },
  { artist: 'Beatles', title: 'Yesterday', targetLanguage: 'fr' },
  { artist: 'Led Zeppelin', title: 'Stairway to Heaven', targetLanguage: 'de' },
];

const results = await lyricsTranslatorService.batchTranslate(requests);
```

#### Service Status Monitoring
```typescript
const status = lyricsTranslatorService.getServiceStatus();
console.log('Available services:', status.availability);
console.log('Rate limits:', status.translation);
```

## Cost Analysis

### Monthly Free Usage
- **Audio Recognition**: 1,500 songs (500 ACRCloud + 1000 AudD.io)
- **Lyrics Fetching**: 60,000+ songs (2000/day × 30 days Musixmatch + unlimited Lyrics.ovh)
- **Translation**: 30,000+ words (1000/day × 30 days MyMemory + others)

### Typical Song Processing
- Average song lyrics: ~200-300 words
- Monthly translation capacity: ~100-150 songs
- Daily capacity: ~3-5 songs

### Scaling Strategy
1. **Phase 1**: Use free tiers (good for development/testing)
2. **Phase 2**: Add self-hosted LibreTranslate for unlimited translation
3. **Phase 3**: Upgrade to paid tiers of critical services as needed

## Troubleshooting

### Common Issues

#### "Audio recognition failed"
- **Cause**: No API keys configured or rate limits hit
- **Solution**: Add ACRCloud and AudD.io API keys to `.env`

#### "Lyrics not found"
- **Cause**: Song not in databases or spelling mismatch
- **Solution**: Try alternative spellings or use manual lyrics input

#### "Translation rate limit exceeded"
- **Cause**: Hit daily/monthly limits
- **Solution**: Wait for reset or set up self-hosted LibreTranslate

### Service Availability Check
```bash
# Check which services are working
node -e "
import('./src/services/lyricsTranslatorService.js').then(async ({ lyricsTranslatorService }) => {
  const health = await lyricsTranslatorService.healthCheck();
  console.log('System Health:', health.status);
  console.log('Details:', health.details);
});
"
```

### Debug Mode
Set `DEBUG=true` in `.env` for detailed logging:
```bash
DEBUG=true npm start
```

## API Limits Summary

| Service | Free Limit | Resets | Fallback |
|---------|------------|--------|-----------|
| ACRCloud | 500/month | Monthly | AudD.io |
| AudD.io | 1000/month | Monthly | Manual input |
| Musixmatch | 2000/day | Daily | Lyrics.ovh |
| Lyrics.ovh | Rate limited | Continuous | Manual lyrics |
| MyMemory | 1000 words/day | Daily | LibreTranslate |
| LibreTranslate | 20/day | Daily | Google Translate |

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify API keys in `.env` file
3. Test individual services using the debug mode
4. Check service status pages for outages

The fallback system ensures the app works even if some services are down or have reached their limits.