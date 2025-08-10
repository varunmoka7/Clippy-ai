import { LyricsResult, ServiceError } from '../types';
import { FREE_API_CONFIGS } from '../config/freeApiConfig';
import { rateLimiter } from './rateLimiter';

interface LyricsOvhResponse {
  lyrics?: string;
  error?: string;
}

interface MusixmatchResponse {
  message: {
    header: {
      status_code: number;
      hint?: string;
    };
    body: {
      lyrics?: {
        lyrics_body: string;
        lyrics_language: string;
      };
    };
  };
}

interface LyricsApiResponse {
  response?: {
    lyrics?: string;
  };
  error?: string;
}

class FreeLyricsService {
  private readonly services = ['lyricsOvh', 'musixmatch', 'lyricsApi'] as const;
  private errors: ServiceError[] = [];

  async getLyrics(artist: string, title: string): Promise<LyricsResult | null> {
    this.errors = [];
    
    // Clean and normalize inputs
    const cleanArtist = this.cleanSearchTerm(artist);
    const cleanTitle = this.cleanSearchTerm(title);

    for (const serviceName of this.services) {
      try {
        const config = FREE_API_CONFIGS.lyrics[serviceName];
        
        if (!rateLimiter.isAllowed(`lyrics_${serviceName}`, config)) {
          const retryAfter = rateLimiter.getRetryAfter(`lyrics_${serviceName}`, config);
          this.errors.push({
            service: serviceName,
            error: 'Rate limit exceeded',
            retryAfter: retryAfter,
          });
          continue;
        }

        let result: LyricsResult | null = null;

        switch (serviceName) {
          case 'lyricsOvh':
            result = await this.getLyricsFromOvh(cleanArtist, cleanTitle);
            break;
          case 'musixmatch':
            result = await this.getLyricsFromMusixmatch(cleanArtist, cleanTitle);
            break;
          case 'lyricsApi':
            result = await this.getLyricsFromLyricsApi(cleanArtist, cleanTitle);
            break;
        }

        if (result && result.lyrics.trim().length > 0) {
          rateLimiter.recordRequest(`lyrics_${serviceName}`);
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

  private async getLyricsFromOvh(artist: string, title: string): Promise<LyricsResult | null> {
    const config = FREE_API_CONFIGS.lyrics.lyricsOvh;
    const url = `${config.baseUrl}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LyricsTranslator/1.0',
      },
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Lyrics not found
      }
      throw new Error(`Lyrics.ovh API error: ${response.status}`);
    }

    const data: LyricsOvhResponse = await response.json();

    if (!data.lyrics || data.error) {
      return null;
    }

    return {
      lyrics: data.lyrics.trim(),
      title: title,
      artist: artist,
      source: 'Lyrics.ovh',
    };
  }

  private async getLyricsFromMusixmatch(artist: string, title: string): Promise<LyricsResult | null> {
    const config = FREE_API_CONFIGS.lyrics.musixmatch;
    
    if (!config.apiKey) {
      throw new Error('Musixmatch API key not configured');
    }

    // First, search for the track
    const searchUrl = `${config.baseUrl}/track.search?q_artist=${encodeURIComponent(artist)}&q_track=${encodeURIComponent(title)}&page_size=1&apikey=${config.apiKey}`;
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!searchResponse.ok) {
      throw new Error(`Musixmatch search error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const track = searchData.message?.body?.track_list?.[0]?.track;
    
    if (!track) {
      return null;
    }

    // Get lyrics for the track
    const lyricsUrl = `${config.baseUrl}/track.lyrics.get?track_id=${track.track_id}&apikey=${config.apiKey}`;
    
    const lyricsResponse = await fetch(lyricsUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!lyricsResponse.ok) {
      throw new Error(`Musixmatch lyrics error: ${lyricsResponse.status}`);
    }

    const lyricsData: MusixmatchResponse = await lyricsResponse.json();

    if (lyricsData.message.header.status_code !== 200 || !lyricsData.message.body.lyrics) {
      return null;
    }

    const lyrics = lyricsData.message.body.lyrics.lyrics_body;
    
    // Remove Musixmatch watermark
    const cleanLyrics = lyrics.replace(/\n?\*+\s*This Lyrics is NOT for Commercial use.*$/i, '').trim();

    return {
      lyrics: cleanLyrics,
      title: track.track_name || title,
      artist: track.artist_name || artist,
      source: 'Musixmatch',
    };
  }

  private async getLyricsFromLyricsApi(artist: string, title: string): Promise<LyricsResult | null> {
    const config = FREE_API_CONFIGS.lyrics.lyricsApi;
    
    // This is a fallback service - implement based on available free lyrics APIs
    const searchQuery = `${artist} ${title}`;
    const url = `${config.baseUrl}?q=${encodeURIComponent(searchQuery)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LyricsTranslator/1.0',
        },
        signal: AbortSignal.timeout(config.timeout),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Lyrics API error: ${response.status}`);
      }

      const data: LyricsApiResponse = await response.json();

      if (!data.response?.lyrics) {
        return null;
      }

      return {
        lyrics: data.response.lyrics.trim(),
        title: title,
        artist: artist,
        source: 'LyricsAPI',
      };
    } catch (error) {
      // This service might not always be available, so fail silently
      return null;
    }
  }

  // Alternative method to search for lyrics with fuzzy matching
  async searchLyrics(query: string): Promise<LyricsResult[]> {
    const results: LyricsResult[] = [];
    
    // Extract potential artist and title from query
    const parts = query.split(' - ');
    let artist = '';
    let title = '';
    
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else {
      // Try to guess format
      const words = query.split(' ');
      if (words.length > 2) {
        // Assume first word is artist, rest is title
        artist = words[0];
        title = words.slice(1).join(' ');
      } else {
        title = query;
        artist = '';
      }
    }

    // Try with extracted artist and title
    if (artist && title) {
      const result = await this.getLyrics(artist, title);
      if (result) {
        results.push(result);
      }
    }

    // Try with reversed order
    if (artist && title && results.length === 0) {
      const result = await this.getLyrics(title, artist);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // Batch lyrics fetching
  async batchGetLyrics(requests: Array<{ artist: string; title: string }>): Promise<(LyricsResult | null)[]> {
    const results: (LyricsResult | null)[] = [];
    
    for (let i = 0; i < requests.length; i++) {
      const { artist, title } = requests[i];
      
      // Add delay between requests to respect rate limits
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      try {
        const result = await this.getLyrics(artist, title);
        results.push(result);
      } catch (error) {
        results.push(null);
      }
    }
    
    return results;
  }

  private cleanSearchTerm(term: string): string {
    return term
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses content
      .replace(/\s*\[.*?\]\s*/g, '') // Remove brackets content
      .replace(/\s*feat\..*$/i, '') // Remove "feat." and everything after
      .replace(/\s*ft\..*$/i, '') // Remove "ft." and everything after
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  getErrors(): ServiceError[] {
    return this.errors;
  }

  getRateLimitStatus(): { [service: string]: { remaining: number; resetTime: number } } {
    const status: { [service: string]: { remaining: number; resetTime: number } } = {};
    
    for (const serviceName of this.services) {
      status[serviceName] = {
        remaining: rateLimiter.getRemainingRequests(`lyrics_${serviceName}`),
        resetTime: rateLimiter.getResetTime(`lyrics_${serviceName}`),
      };
    }
    
    return status;
  }

  hasAvailableService(): boolean {
    return this.services.some(serviceName => {
      const config = FREE_API_CONFIGS.lyrics[serviceName];
      return rateLimiter.isAllowed(`lyrics_${serviceName}`, config);
    });
  }

  // Utility to validate lyrics content
  private isValidLyrics(lyrics: string): boolean {
    if (!lyrics || lyrics.trim().length < 10) {
      return false;
    }

    // Check for common error messages
    const errorPatterns = [
      /not found/i,
      /no lyrics/i,
      /instrumental/i,
      /error/i,
      /unavailable/i,
    ];

    return !errorPatterns.some(pattern => pattern.test(lyrics));
  }

  // Get lyrics with confidence scoring
  async getLyricsWithConfidence(artist: string, title: string): Promise<{ result: LyricsResult | null; confidence: number }> {
    const result = await this.getLyrics(artist, title);
    
    if (!result) {
      return { result: null, confidence: 0 };
    }

    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on lyrics length
    if (result.lyrics.length > 100) confidence += 0.2;
    if (result.lyrics.length > 500) confidence += 0.2;
    
    // Increase confidence if source is more reliable
    if (result.source === 'Musixmatch') confidence += 0.1;
    
    // Decrease confidence if lyrics seem incomplete
    if (result.lyrics.includes('...') || result.lyrics.length < 50) {
      confidence -= 0.2;
    }

    return { result, confidence: Math.min(1, Math.max(0, confidence)) };
  }
}

export const freeLyricsService = new FreeLyricsService();