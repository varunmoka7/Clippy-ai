// Main exports for the free backend services
export { freeAudioRecognitionService } from './freeAudioRecognition';
export { freeLyricsService } from './freeLyricsService';
export { freeTranslationService } from './freeTranslationService';
export { lyricsTranslatorService } from './lyricsTranslatorService';
export { rateLimiter } from './rateLimiter';

// Export types
export type {
  AudioRecognitionResult,
  LyricsResult,
  TranslationResult,
  ServiceError,
  ServiceConfig,
  RateLimitInfo,
} from '../types';

export type {
  LyricsTranslationPipeline,
  TranslationOptions,
} from './lyricsTranslatorService';

// Export configuration
export { 
  FREE_API_CONFIGS, 
  SUPPORTED_LANGUAGES, 
  validateApiKeys 
} from '../config/freeApiConfig';

export { 
  ENV_VARIABLES, 
  validateEnvironment, 
  SERVICE_URLS 
} from '../config/environment';