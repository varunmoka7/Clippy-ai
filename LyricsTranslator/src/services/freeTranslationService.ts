import { TranslationResult, ServiceError } from '../types';
import { FREE_API_CONFIGS, SUPPORTED_LANGUAGES } from '../config/freeApiConfig';
import { rateLimiter } from './rateLimiter';

interface LibreTranslateResponse {
  translatedText: string;
  detectedLanguage?: {
    confidence: number;
    language: string;
  };
}

interface MyMemoryResponse {
  responseData: {
    translatedText: string;
    match: number;
  };
  responseStatus: number;
  responseDetails?: string;
  matches?: Array<{
    translation: string;
    quality: number;
    reference: string;
  }>;
}

interface GoogleTranslateResponse extends Array<any> {
  0: Array<Array<string>>;
  2?: string; // detected source language
}

class FreeTranslationService {
  private readonly services = ['myMemory', 'libreTranslate', 'googleTranslateFree'] as const;
  private errors: ServiceError[] = [];

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult | null> {
    this.errors = [];

    // Validate target language
    if (!this.isSupportedLanguage(targetLanguage)) {
      throw new Error(`Unsupported target language: ${targetLanguage}`);
    }

    // Split long text into chunks
    const chunks = this.splitTextIntoChunks(text, 1000);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      let chunkResult: TranslationResult | null = null;

      for (const serviceName of this.services) {
        try {
          const config = FREE_API_CONFIGS.translation[serviceName];
          
          if (!rateLimiter.isAllowed(`translation_${serviceName}`, config)) {
            const retryAfter = rateLimiter.getRetryAfter(`translation_${serviceName}`, config);
            this.errors.push({
              service: serviceName,
              error: 'Rate limit exceeded',
              retryAfter: retryAfter,
            });
            continue;
          }

          switch (serviceName) {
            case 'myMemory':
              chunkResult = await this.translateWithMyMemory(chunk, targetLanguage, sourceLanguage);
              break;
            case 'libreTranslate':
              chunkResult = await this.translateWithLibreTranslate(chunk, targetLanguage, sourceLanguage);
              break;
            case 'googleTranslateFree':
              chunkResult = await this.translateWithGoogleFree(chunk, targetLanguage, sourceLanguage);
              break;
          }

          if (chunkResult) {
            rateLimiter.recordRequest(`translation_${serviceName}`);
            break;
          }

        } catch (error) {
          this.errors.push({
            service: serviceName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (!chunkResult) {
        return null; // Failed to translate this chunk
      }

      translatedChunks.push(chunkResult.translatedText);
      sourceLanguage = chunkResult.sourceLanguage; // Use detected language for subsequent chunks

      // Add delay between chunks to respect rate limits
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (translatedChunks.length === 0) {
      return null;
    }

    return {
      translatedText: translatedChunks.join('\n'),
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      source: translatedChunks.length > 0 ? 'Combined' : 'Unknown',
    };
  }

  private async translateWithMyMemory(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult | null> {
    const config = FREE_API_CONFIGS.translation.myMemory;
    
    // MyMemory uses language pairs
    const langPair = sourceLanguage === 'auto' 
      ? `${this.detectLanguage(text)}|${targetLanguage}`
      : `${sourceLanguage}|${targetLanguage}`;

    const url = `${config.baseUrl}?q=${encodeURIComponent(text)}&langpair=${langPair}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'LyricsTranslator/1.0',
      },
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      throw new Error(`MyMemory API error: ${response.status}`);
    }

    const data: MyMemoryResponse = await response.json();

    if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
      throw new Error(`MyMemory translation failed: ${data.responseDetails || 'Unknown error'}`);
    }

    return {
      translatedText: data.responseData.translatedText,
      sourceLanguage: sourceLanguage === 'auto' ? this.detectLanguage(text) : sourceLanguage,
      targetLanguage: targetLanguage,
      source: 'MyMemory',
    };
  }

  private async translateWithLibreTranslate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult | null> {
    const config = FREE_API_CONFIGS.translation.libreTranslate;

    const requestBody = {
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: 'text',
    };

    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LyricsTranslator/1.0',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('LibreTranslate rate limit exceeded');
      }
      throw new Error(`LibreTranslate API error: ${response.status}`);
    }

    const data: LibreTranslateResponse = await response.json();

    if (!data.translatedText) {
      throw new Error('LibreTranslate returned empty translation');
    }

    return {
      translatedText: data.translatedText,
      sourceLanguage: data.detectedLanguage?.language || sourceLanguage,
      targetLanguage: targetLanguage,
      source: 'LibreTranslate',
    };
  }

  private async translateWithGoogleFree(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult | null> {
    const config = FREE_API_CONFIGS.translation.googleTranslateFree;
    
    // Google Translate free endpoint parameters
    const params = new URLSearchParams({
      client: 'gtx',
      sl: sourceLanguage,
      tl: targetLanguage,
      dt: 't',
      q: text,
    });

    const url = `${config.baseUrl}?${params}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const data: GoogleTranslateResponse = await response.json();

    if (!data[0] || !Array.isArray(data[0])) {
      throw new Error('Invalid Google Translate response format');
    }

    const translatedText = data[0]
      .filter((item: any) => Array.isArray(item) && item[0])
      .map((item: any) => item[0])
      .join('');

    const detectedLang = data[2] || sourceLanguage;

    return {
      translatedText: translatedText.trim(),
      sourceLanguage: detectedLang,
      targetLanguage: targetLanguage,
      source: 'Google Translate (Free)',
    };
  }

  // Batch translation for multiple texts
  async batchTranslate(
    texts: string[],
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<(TranslationResult | null)[]> {
    const results: (TranslationResult | null)[] = [];
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      
      // Add delay between requests to respect rate limits
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      try {
        const result = await this.translateText(text, targetLanguage, sourceLanguage);
        results.push(result);
      } catch (error) {
        results.push(null);
      }
    }
    
    return results;
  }

  // Language detection (simple heuristic-based approach)
  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    // This is a basic implementation - in production, use a proper language detection service
    
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\u0400-\u04ff]/.test(text)) return 'ru';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    if (/[\u0900-\u097f]/.test(text)) return 'hi';
    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i.test(text)) {
      // Latin script with diacritics - could be many languages
      if (/\b(el|la|los|las|un|una|de|del|en|con|por|para|que|no|se|es|son|está|están)\b/i.test(text)) return 'es';
      if (/\b(le|la|les|des|du|de|et|est|sont|dans|avec|pour|que|ne|pas|se|ce|il|elle)\b/i.test(text)) return 'fr';
      if (/\b(der|die|das|und|ist|sind|in|mit|für|dass|nicht|sich|es|er|sie)\b/i.test(text)) return 'de';
      if (/\b(il|la|le|di|del|in|con|per|che|non|si|è|sono|questo|questa)\b/i.test(text)) return 'it';
      if (/\b(o|a|os|as|do|da|em|com|para|que|não|se|é|são|este|esta)\b/i.test(text)) return 'pt';
    }
    
    return 'en'; // Default to English
  }

  // Split text into manageable chunks for translation
  private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }

    return chunks;
  }

  private isSupportedLanguage(languageCode: string): boolean {
    return SUPPORTED_LANGUAGES.translation.some(lang => lang.code === languageCode);
  }

  // Get available languages
  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return SUPPORTED_LANGUAGES.translation;
  }

  // Language code conversion utilities
  normalizeLanguageCode(code: string): string {
    const normalizedCodes: { [key: string]: string } = {
      'zh-cn': 'zh',
      'zh-tw': 'zh',
      'pt-br': 'pt',
      'pt-pt': 'pt',
      'en-us': 'en',
      'en-gb': 'en',
    };

    return normalizedCodes[code.toLowerCase()] || code.toLowerCase();
  }

  getErrors(): ServiceError[] {
    return this.errors;
  }

  getRateLimitStatus(): { [service: string]: { remaining: number; resetTime: number } } {
    const status: { [service: string]: { remaining: number; resetTime: number } } = {};
    
    for (const serviceName of this.services) {
      status[serviceName] = {
        remaining: rateLimiter.getRemainingRequests(`translation_${serviceName}`),
        resetTime: rateLimiter.getResetTime(`translation_${serviceName}`),
      };
    }
    
    return status;
  }

  hasAvailableService(): boolean {
    return this.services.some(serviceName => {
      const config = FREE_API_CONFIGS.translation[serviceName];
      return rateLimiter.isAllowed(`translation_${serviceName}`, config);
    });
  }

  // Quality assessment for translations
  async getTranslationWithQuality(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<{ result: TranslationResult | null; quality: number }> {
    const result = await this.translateText(text, targetLanguage, sourceLanguage);
    
    if (!result) {
      return { result: null, quality: 0 };
    }

    let quality = 0.5; // Base quality score

    // Assess quality based on various factors
    const originalLength = text.length;
    const translatedLength = result.translatedText.length;
    const lengthRatio = translatedLength / originalLength;

    // Reasonable length ratio indicates good translation
    if (lengthRatio > 0.3 && lengthRatio < 3) {
      quality += 0.2;
    }

    // Check if translation contains original text (poor translation indicator)
    if (!result.translatedText.toLowerCase().includes(text.toLowerCase().substring(0, 20))) {
      quality += 0.1;
    }

    // Check for common translation artifacts
    if (!result.translatedText.includes('???') && !result.translatedText.includes('[') && !result.translatedText.includes('{')) {
      quality += 0.1;
    }

    // Boost quality for more reliable services
    if (result.source === 'MyMemory') quality += 0.1;

    return { result, quality: Math.min(1, Math.max(0, quality)) };
  }

  // Translate with multiple services and return best result
  async translateWithBestQuality(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult | null> {
    const attempts: Array<{ result: TranslationResult; quality: number }> = [];

    for (const serviceName of this.services) {
      try {
        const config = FREE_API_CONFIGS.translation[serviceName];
        
        if (!rateLimiter.isAllowed(`translation_${serviceName}`, config)) {
          continue;
        }

        let result: TranslationResult | null = null;

        switch (serviceName) {
          case 'myMemory':
            result = await this.translateWithMyMemory(text, targetLanguage, sourceLanguage);
            break;
          case 'libreTranslate':
            result = await this.translateWithLibreTranslate(text, targetLanguage, sourceLanguage);
            break;
          case 'googleTranslateFree':
            result = await this.translateWithGoogleFree(text, targetLanguage, sourceLanguage);
            break;
        }

        if (result) {
          const qualityAssessment = await this.getTranslationWithQuality(text, targetLanguage, sourceLanguage);
          if (qualityAssessment.result) {
            attempts.push({ result: result, quality: qualityAssessment.quality });
            rateLimiter.recordRequest(`translation_${serviceName}`);
          }
        }

        // Small delay between service attempts
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        // Continue with next service
      }
    }

    if (attempts.length === 0) {
      return null;
    }

    // Return the translation with the highest quality score
    attempts.sort((a, b) => b.quality - a.quality);
    return attempts[0].result;
  }
}

export const freeTranslationService = new FreeTranslationService();