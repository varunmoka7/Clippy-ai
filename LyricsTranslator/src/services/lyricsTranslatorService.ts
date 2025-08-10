import { AudioRecognitionResult, LyricsResult, TranslationResult, ServiceError } from '../types';
import { freeAudioRecognitionService } from './freeAudioRecognition';
import { freeLyricsService } from './freeLyricsService';
import { freeTranslationService } from './freeTranslationService';

export interface LyricsTranslationPipeline {
  audioRecognition?: AudioRecognitionResult;
  lyrics?: LyricsResult;
  translation?: TranslationResult;
  errors: ServiceError[];
  processingTime: number;
  confidence: number;
}

export interface TranslationOptions {
  targetLanguage: string;
  sourceLanguage?: string;
  skipAudioRecognition?: boolean;
  manualSongInfo?: {
    artist: string;
    title: string;
  };
  qualityThreshold?: number;
}

class LyricsTranslatorService {
  private readonly maxRetries = 2;
  private readonly retryDelay = 1000;

  /**
   * Complete pipeline: Audio Recognition -> Lyrics Fetching -> Translation
   */
  async translateFromAudio(
    audioBuffer: ArrayBuffer,
    options: TranslationOptions
  ): Promise<LyricsTranslationPipeline> {
    const startTime = Date.now();
    const result: LyricsTranslationPipeline = {
      errors: [],
      processingTime: 0,
      confidence: 0,
    };

    try {
      // Step 1: Audio Recognition (if not skipped)
      if (!options.skipAudioRecognition && !options.manualSongInfo) {
        console.log('Starting audio recognition...');
        result.audioRecognition = await this.recognizeAudioWithRetry(audioBuffer);
        
        if (!result.audioRecognition) {
          result.errors.push({
            service: 'audioRecognition',
            error: 'Failed to recognize audio from all available services',
          });
          result.processingTime = Date.now() - startTime;
          return result;
        }
      }

      // Step 2: Get Lyrics
      const songInfo = options.manualSongInfo || {
        artist: result.audioRecognition?.artist || '',
        title: result.audioRecognition?.title || '',
      };

      if (!songInfo.artist || !songInfo.title) {
        result.errors.push({
          service: 'lyrics',
          error: 'Missing artist or title information',
        });
        result.processingTime = Date.now() - startTime;
        return result;
      }

      console.log(`Fetching lyrics for: ${songInfo.artist} - ${songInfo.title}`);
      result.lyrics = await this.getLyricsWithRetry(songInfo.artist, songInfo.title);

      if (!result.lyrics) {
        result.errors.push({
          service: 'lyrics',
          error: 'Failed to fetch lyrics from all available services',
        });
        result.processingTime = Date.now() - startTime;
        return result;
      }

      // Step 3: Translation
      console.log(`Translating lyrics to ${options.targetLanguage}...`);
      result.translation = await this.translateWithRetry(
        result.lyrics.lyrics,
        options.targetLanguage,
        options.sourceLanguage
      );

      if (!result.translation) {
        result.errors.push({
          service: 'translation',
          error: 'Failed to translate lyrics from all available services',
        });
        result.processingTime = Date.now() - startTime;
        return result;
      }

      // Calculate overall confidence
      result.confidence = this.calculateOverallConfidence(result);

    } catch (error) {
      result.errors.push({
        service: 'pipeline',
        error: error instanceof Error ? error.message : 'Unknown pipeline error',
      });
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Simplified pipeline: Manual Song Info -> Lyrics -> Translation
   */
  async translateFromSongInfo(
    artist: string,
    title: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<LyricsTranslationPipeline> {
    return this.translateFromAudio(new ArrayBuffer(0), {
      targetLanguage,
      sourceLanguage,
      skipAudioRecognition: true,
      manualSongInfo: { artist, title },
    });
  }

  /**
   * Direct lyrics translation (when you already have lyrics)
   */
  async translateLyricsOnly(
    lyrics: string,
    targetLanguage: string,
    sourceLanguage?: string,
    songInfo?: { artist: string; title: string }
  ): Promise<LyricsTranslationPipeline> {
    const startTime = Date.now();
    const result: LyricsTranslationPipeline = {
      lyrics: {
        lyrics,
        artist: songInfo?.artist || 'Unknown Artist',
        title: songInfo?.title || 'Unknown Title',
        source: 'Manual',
      },
      errors: [],
      processingTime: 0,
      confidence: 0,
    };

    try {
      result.translation = await this.translateWithRetry(lyrics, targetLanguage, sourceLanguage);
      
      if (!result.translation) {
        result.errors.push({
          service: 'translation',
          error: 'Failed to translate lyrics from all available services',
        });
      }

      result.confidence = this.calculateOverallConfidence(result);
    } catch (error) {
      result.errors.push({
        service: 'translation',
        error: error instanceof Error ? error.message : 'Translation failed',
      });
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Batch processing for multiple songs
   */
  async batchTranslate(
    requests: Array<{
      artist: string;
      title: string;
      targetLanguage: string;
      sourceLanguage?: string;
    }>
  ): Promise<LyricsTranslationPipeline[]> {
    const results: LyricsTranslationPipeline[] = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      
      console.log(`Processing batch item ${i + 1}/${requests.length}: ${request.artist} - ${request.title}`);
      
      try {
        const result = await this.translateFromSongInfo(
          request.artist,
          request.title,
          request.targetLanguage,
          request.sourceLanguage
        );
        results.push(result);
      } catch (error) {
        results.push({
          errors: [{
            service: 'pipeline',
            error: error instanceof Error ? error.message : 'Batch processing failed',
          }],
          processingTime: 0,
          confidence: 0,
        });
      }

      // Add delay between batch requests
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  private async recognizeAudioWithRetry(audioBuffer: ArrayBuffer): Promise<AudioRecognitionResult | null> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await freeAudioRecognitionService.recognizeAudio(audioBuffer);
        if (result) return result;
      } catch (error) {
        if (attempt === this.maxRetries - 1) {
          console.error('Audio recognition failed after all retries:', error);
        } else {
          console.warn(`Audio recognition attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    return null;
  }

  private async getLyricsWithRetry(artist: string, title: string): Promise<LyricsResult | null> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await freeLyricsService.getLyrics(artist, title);
        if (result && result.lyrics.trim().length > 0) return result;
      } catch (error) {
        if (attempt === this.maxRetries - 1) {
          console.error('Lyrics fetching failed after all retries:', error);
        } else {
          console.warn(`Lyrics fetching attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    return null;
  }

  private async translateWithRetry(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult | null> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await freeTranslationService.translateText(text, targetLanguage, sourceLanguage);
        if (result && result.translatedText.trim().length > 0) return result;
      } catch (error) {
        if (attempt === this.maxRetries - 1) {
          console.error('Translation failed after all retries:', error);
        } else {
          console.warn(`Translation attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    return null;
  }

  private calculateOverallConfidence(result: LyricsTranslationPipeline): number {
    let confidence = 0.5; // Base confidence

    // Audio recognition confidence
    if (result.audioRecognition?.confidence) {
      confidence = Math.max(confidence, result.audioRecognition.confidence * 0.3);
    }

    // Lyrics quality indicators
    if (result.lyrics) {
      if (result.lyrics.lyrics.length > 100) confidence += 0.1;
      if (result.lyrics.lyrics.length > 500) confidence += 0.1;
      if (result.lyrics.source === 'Musixmatch') confidence += 0.05;
    }

    // Translation quality indicators
    if (result.translation) {
      const lengthRatio = result.translation.translatedText.length / (result.lyrics?.lyrics.length || 1);
      if (lengthRatio > 0.3 && lengthRatio < 3) confidence += 0.1;
      if (result.translation.source === 'MyMemory') confidence += 0.05;
    }

    // Penalize for errors
    confidence -= result.errors.length * 0.1;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Get service status and rate limits
   */
  getServiceStatus(): {
    audioRecognition: { [service: string]: { remaining: number; resetTime: number } };
    lyrics: { [service: string]: { remaining: number; resetTime: number } };
    translation: { [service: string]: { remaining: number; resetTime: number } };
    availability: {
      audioRecognition: boolean;
      lyrics: boolean;
      translation: boolean;
    };
  } {
    return {
      audioRecognition: freeAudioRecognitionService.getRateLimitStatus(),
      lyrics: freeLyricsService.getRateLimitStatus(),
      translation: freeTranslationService.getRateLimitStatus(),
      availability: {
        audioRecognition: freeAudioRecognitionService.hasAvailableService(),
        lyrics: freeLyricsService.hasAvailableService(),
        translation: freeTranslationService.hasAvailableService(),
      },
    };
  }

  /**
   * Get supported languages for translation
   */
  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return freeTranslationService.getSupportedLanguages();
  }

  /**
   * Search for lyrics with fuzzy matching
   */
  async searchLyrics(query: string): Promise<LyricsResult[]> {
    return freeLyricsService.searchLyrics(query);
  }

  /**
   * Get all errors from the last operation
   */
  getAllErrors(): ServiceError[] {
    return [
      ...freeAudioRecognitionService.getErrors(),
      ...freeLyricsService.getErrors(),
      ...freeTranslationService.getErrors(),
    ];
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      audioRecognition: boolean;
      lyrics: boolean;
      translation: boolean;
    };
    details: string[];
  }> {
    const services = {
      audioRecognition: freeAudioRecognitionService.hasAvailableService(),
      lyrics: freeLyricsService.hasAvailableService(),
      translation: freeTranslationService.hasAvailableService(),
    };

    const availableServices = Object.values(services).filter(Boolean).length;
    const details: string[] = [];

    if (!services.audioRecognition) details.push('Audio recognition services unavailable');
    if (!services.lyrics) details.push('Lyrics services unavailable');
    if (!services.translation) details.push('Translation services unavailable');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (availableServices === 3) {
      status = 'healthy';
    } else if (availableServices >= 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, services, details };
  }
}

export const lyricsTranslatorService = new LyricsTranslatorService();