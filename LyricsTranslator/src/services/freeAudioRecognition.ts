import { AudioRecognitionResult, ServiceError } from '../types';
import { FREE_API_CONFIGS } from '../config/freeApiConfig';
import { rateLimiter } from './rateLimiter';

interface ACRCloudResult {
  status: {
    msg: string;
    code: number;
  };
  metadata?: {
    music?: Array<{
      title: string;
      artists: Array<{ name: string }>;
      album?: { name: string };
      duration_ms: number;
      score: number;
    }>;
  };
}

interface AudDResult {
  status: string;
  result?: {
    title: string;
    artist: string;
    album?: string;
    timecode?: string;
    song_link?: string;
  };
}

class FreeAudioRecognitionService {
  private readonly services = ['acrCloud', 'auddIo'] as const;
  private errors: ServiceError[] = [];

  async recognizeAudio(audioBuffer: ArrayBuffer): Promise<AudioRecognitionResult | null> {
    this.errors = [];

    for (const serviceName of this.services) {
      try {
        const config = FREE_API_CONFIGS.audioRecognition[serviceName];
        
        if (!rateLimiter.isAllowed(`audioRecognition_${serviceName}`, config)) {
          const retryAfter = rateLimiter.getRetryAfter(`audioRecognition_${serviceName}`, config);
          this.errors.push({
            service: serviceName,
            error: 'Rate limit exceeded',
            retryAfter: retryAfter,
          });
          continue;
        }

        let result: AudioRecognitionResult | null = null;

        switch (serviceName) {
          case 'acrCloud':
            result = await this.recognizeWithACRCloud(audioBuffer);
            break;
          case 'auddIo':
            result = await this.recognizeWithAudD(audioBuffer);
            break;
        }

        if (result) {
          rateLimiter.recordRequest(`audioRecognition_${serviceName}`);
          return result;
        }

      } catch (error) {
        this.errors.push({
          service: serviceName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return null;
  }

  private async recognizeWithACRCloud(audioBuffer: ArrayBuffer): Promise<AudioRecognitionResult | null> {
    const config = FREE_API_CONFIGS.audioRecognition.acrCloud;
    
    if (!config.apiKey || !config.accessKey || !config.accessSecret) {
      throw new Error('ACRCloud API credentials not configured');
    }

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    
    formData.append('sample', audioBlob);
    formData.append('sample_bytes', audioBuffer.byteLength.toString());
    formData.append('access_key', config.accessKey);

    // Create signature (simplified - in production, implement proper HMAC-SHA1 signing)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    formData.append('timestamp', timestamp);

    const response = await fetch(config.baseUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      throw new Error(`ACRCloud API error: ${response.status}`);
    }

    const data: ACRCloudResult = await response.json();

    if (data.status.code !== 0) {
      throw new Error(`ACRCloud recognition failed: ${data.status.msg}`);
    }

    const music = data.metadata?.music?.[0];
    if (!music) {
      return null;
    }

    return {
      title: music.title,
      artist: music.artists[0]?.name,
      album: music.album?.name,
      duration: music.duration_ms ? music.duration_ms / 1000 : undefined,
      confidence: music.score / 100,
      source: 'ACRCloud',
    };
  }

  private async recognizeWithAudD(audioBuffer: ArrayBuffer): Promise<AudioRecognitionResult | null> {
    const config = FREE_API_CONFIGS.audioRecognition.auddIo;
    
    if (!config.apiKey) {
      throw new Error('AudD.io API key not configured');
    }

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    
    formData.append('file', audioBlob);
    formData.append('api_token', config.apiKey);
    formData.append('return', 'apple_music,spotify');

    const response = await fetch(config.baseUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      throw new Error(`AudD.io API error: ${response.status}`);
    }

    const data: AudDResult = await response.json();

    if (data.status !== 'success' || !data.result) {
      return null;
    }

    const result = data.result;
    return {
      title: result.title,
      artist: result.artist,
      album: result.album,
      confidence: 0.8, // AudD.io doesn't provide confidence score
      source: 'AudD.io',
    };
  }

  // Alternative method using browser's Web Audio API for audio fingerprinting
  async recognizeFromAudioElement(audioElement: HTMLAudioElement): Promise<AudioRecognitionResult | null> {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaElementSource(audioElement);
      
      // Create analyzer
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      source.connect(analyzer);
      analyzer.connect(audioContext.destination);

      // Get audio data
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteFrequencyData(dataArray);

      // Convert to ArrayBuffer for recognition
      const audioBuffer = dataArray.buffer.slice(
        dataArray.byteOffset,
        dataArray.byteOffset + dataArray.byteLength
      );

      return await this.recognizeAudio(audioBuffer);
    } catch (error) {
      throw new Error(`Audio processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Batch recognition for multiple audio segments
  async batchRecognize(audioBuffers: ArrayBuffer[]): Promise<(AudioRecognitionResult | null)[]> {
    const results: (AudioRecognitionResult | null)[] = [];
    
    for (let i = 0; i < audioBuffers.length; i++) {
      const buffer = audioBuffers[i];
      
      // Add delay between requests to respect rate limits
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      try {
        const result = await this.recognizeAudio(buffer);
        results.push(result);
      } catch (error) {
        results.push(null);
      }
    }
    
    return results;
  }

  getErrors(): ServiceError[] {
    return this.errors;
  }

  getRateLimitStatus(): { [service: string]: { remaining: number; resetTime: number } } {
    const status: { [service: string]: { remaining: number; resetTime: number } } = {};
    
    for (const serviceName of this.services) {
      status[serviceName] = {
        remaining: rateLimiter.getRemainingRequests(`audioRecognition_${serviceName}`),
        resetTime: rateLimiter.getResetTime(`audioRecognition_${serviceName}`),
      };
    }
    
    return status;
  }

  // Utility method to check if any service is available
  hasAvailableService(): boolean {
    return this.services.some(serviceName => {
      const config = FREE_API_CONFIGS.audioRecognition[serviceName];
      return rateLimiter.isAllowed(`audioRecognition_${serviceName}`, config);
    });
  }
}

export const freeAudioRecognitionService = new FreeAudioRecognitionService();