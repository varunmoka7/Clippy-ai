export interface AudioRecognitionResult {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  confidence?: number;
  source: string;
}

export interface LyricsResult {
  lyrics: string;
  title: string;
  artist: string;
  source: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  source: string;
}

export interface ServiceConfig {
  apiKey?: string;
  baseUrl: string;
  rateLimit: {
    requests: number;
    window: number; // in milliseconds
  };
  retryAttempts: number;
  timeout: number;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  lastRequest: number;
}

export interface ServiceError {
  service: string;
  error: string;
  code?: string;
  retryAfter?: number;
}