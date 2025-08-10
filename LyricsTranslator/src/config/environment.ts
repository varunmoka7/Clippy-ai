// Environment configuration for free API services
// Make sure to set these environment variables in your .env file

export const ENV_VARIABLES = {
  // ACRCloud (Audio Recognition)
  ACRCLOUD_API_KEY: 'ACRCLOUD_API_KEY',
  ACRCLOUD_ACCESS_KEY: 'ACRCLOUD_ACCESS_KEY',
  ACRCLOUD_ACCESS_SECRET: 'ACRCLOUD_ACCESS_SECRET',

  // AudD.io (Audio Recognition)
  AUDD_API_KEY: 'AUDD_API_KEY',

  // Musixmatch (Lyrics)
  MUSIXMATCH_API_KEY: 'MUSIXMATCH_API_KEY',

  // Note: Other services (Lyrics.ovh, LibreTranslate, MyMemory) work without API keys
  // but have more restrictive rate limits
} as const;

export const validateEnvironment = (): {
  valid: boolean;
  warnings: string[];
  recommendations: string[];
} => {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check for ACRCloud credentials
  if (!process.env.ACRCLOUD_API_KEY || !process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_ACCESS_SECRET) {
    warnings.push('ACRCloud credentials not found - audio recognition will be limited to AudD.io only');
    recommendations.push('Sign up for ACRCloud free account at https://console.acrcloud.com/signup');
  }

  // Check for AudD.io API key
  if (!process.env.AUDD_API_KEY) {
    warnings.push('AudD.io API key not found - audio recognition will be limited to ACRCloud only');
    recommendations.push('Get free AudD.io API key at https://dashboard.audd.io/');
  }

  // Check for Musixmatch API key
  if (!process.env.MUSIXMATCH_API_KEY) {
    warnings.push('Musixmatch API key not found - lyrics fetching will be limited to Lyrics.ovh only');
    recommendations.push('Sign up for Musixmatch developer account at https://developer.musixmatch.com/signup');
  }

  // At least one audio recognition service should be available
  const hasAudioRecognition = (
    (process.env.ACRCLOUD_API_KEY && process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_ACCESS_SECRET) ||
    process.env.AUDD_API_KEY
  );

  if (!hasAudioRecognition) {
    warnings.push('No audio recognition services configured - only manual song input will work');
  }

  return {
    valid: warnings.length === 0 || hasAudioRecognition, // Consider valid if at least audio recognition works
    warnings,
    recommendations,
  };
};

// Service URLs for reference
export const SERVICE_URLS = {
  signup: {
    acrcloud: 'https://console.acrcloud.com/signup',
    auddio: 'https://dashboard.audd.io/',
    musixmatch: 'https://developer.musixmatch.com/signup',
  },
  docs: {
    acrcloud: 'https://docs.acrcloud.com/',
    auddio: 'https://docs.audd.io/',
    musixmatch: 'https://developer.musixmatch.com/documentation',
    lyricsovh: 'https://lyricsovh.docs.apiary.io/',
    libretranslate: 'https://libretranslate.com/docs/',
    mymemory: 'https://mymemory.translated.net/doc/spec.php',
  },
  free_tiers: {
    acrcloud: '500 recognitions/month',
    auddio: '1000 requests/month',
    musixmatch: '2000 requests/day',
    lyricsovh: 'Unlimited (with rate limiting)',
    libretranslate: '20 requests/day (no key) or unlimited with self-hosted',
    mymemory: '1000 words/day',
  },
} as const;