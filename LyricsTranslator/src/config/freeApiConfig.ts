import { ServiceConfig } from '../types';

export const FREE_API_CONFIGS = {
  // Audio Recognition Services
  audioRecognition: {
    acrCloud: {
      apiKey: process.env.ACRCLOUD_API_KEY || '',
      accessKey: process.env.ACRCLOUD_ACCESS_KEY || '',
      accessSecret: process.env.ACRCLOUD_ACCESS_SECRET || '',
      baseUrl: 'https://identify-eu-west-1.acrcloud.com/v1/identify',
      rateLimit: {
        requests: 500, // 500 recognitions/month free
        window: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      retryAttempts: 2,
      timeout: 10000,
    },
    auddIo: {
      apiKey: process.env.AUDD_API_KEY || '',
      baseUrl: 'https://api.audd.io/recognize',
      rateLimit: {
        requests: 1000, // 1000 requests/month free
        window: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      retryAttempts: 2,
      timeout: 10000,
    },
  },

  // Lyrics Services
  lyrics: {
    lyricsOvh: {
      baseUrl: 'https://api.lyrics.ovh/v1',
      rateLimit: {
        requests: 1000, // Conservative estimate
        window: 24 * 60 * 60 * 1000, // 24 hours
      },
      retryAttempts: 3,
      timeout: 8000,
    },
    musixmatch: {
      apiKey: process.env.MUSIXMATCH_API_KEY || '',
      baseUrl: 'https://api.musixmatch.com/ws/1.1',
      rateLimit: {
        requests: 2000, // 2000 requests/day free
        window: 24 * 60 * 60 * 1000, // 24 hours
      },
      retryAttempts: 3,
      timeout: 8000,
    },
    lyricsApi: {
      baseUrl: 'https://api.lyrics.com/lyric', // Alternative free API
      rateLimit: {
        requests: 500,
        window: 24 * 60 * 60 * 1000, // 24 hours
      },
      retryAttempts: 2,
      timeout: 8000,
    },
  },

  // Translation Services
  translation: {
    libreTranslate: {
      baseUrl: 'https://libretranslate.de/translate',
      rateLimit: {
        requests: 20, // 20 requests/day without API key
        window: 24 * 60 * 60 * 1000, // 24 hours
      },
      retryAttempts: 2,
      timeout: 15000,
    },
    myMemory: {
      baseUrl: 'https://api.mymemory.translated.net/get',
      rateLimit: {
        requests: 1000, // 1000 words/day free
        window: 24 * 60 * 60 * 1000, // 24 hours
      },
      retryAttempts: 2,
      timeout: 10000,
    },
    googleTranslateFree: {
      baseUrl: 'https://translate.googleapis.com/translate_a/single',
      rateLimit: {
        requests: 100, // Conservative estimate for free usage
        window: 60 * 60 * 1000, // 1 hour
      },
      retryAttempts: 1,
      timeout: 8000,
    },
  },
};

export const SUPPORTED_LANGUAGES = {
  translation: [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'sv', name: 'Swedish' },
  ],
};

// Environment variable validation
export const validateApiKeys = (): { [key: string]: boolean } => {
  return {
    acrCloud: !!(process.env.ACRCLOUD_API_KEY && process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_ACCESS_SECRET),
    auddIo: !!process.env.AUDD_API_KEY,
    musixmatch: !!process.env.MUSIXMATCH_API_KEY,
    // Note: Other services work without API keys but with rate limits
    lyricsOvh: true,
    libreTranslate: true,
    myMemory: true,
    googleTranslateFree: true,
  };
};