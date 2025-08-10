import { useState, useCallback, useEffect } from 'react';
import { 
  lyricsTranslatorService, 
  LyricsTranslationPipeline, 
  TranslationOptions, 
  ServiceError 
} from '../services';

export interface UseLyricsTranslatorState {
  // Current operation states
  isRecognizing: boolean;
  isFetchingLyrics: boolean;
  isTranslating: boolean;
  
  // Results
  result: LyricsTranslationPipeline | null;
  
  // Error handling
  errors: ServiceError[];
  
  // Service status
  serviceStatus: {
    audioRecognition: boolean;
    lyrics: boolean;
    translation: boolean;
  };
  
  // Progress tracking
  currentStep: 'idle' | 'recognizing' | 'fetching-lyrics' | 'translating' | 'complete' | 'error';
  progress: number;
}

export interface UseLyricsTranslatorActions {
  // Main actions
  translateFromAudio: (audioBuffer: ArrayBuffer, options: TranslationOptions) => Promise<void>;
  translateFromSongInfo: (artist: string, title: string, targetLanguage: string, sourceLanguage?: string) => Promise<void>;
  translateLyricsOnly: (lyrics: string, targetLanguage: string, sourceLanguage?: string) => Promise<void>;
  
  // Utility actions
  reset: () => void;
  checkServiceStatus: () => Promise<void>;
  
  // Batch operations
  batchTranslate: (requests: Array<{ artist: string; title: string; targetLanguage: string; sourceLanguage?: string }>) => Promise<void>;
}

export interface UseLyricsTranslatorReturn extends UseLyricsTranslatorState, UseLyricsTranslatorActions {}

export const useLyricsTranslator = (): UseLyricsTranslatorReturn => {
  const [state, setState] = useState<UseLyricsTranslatorState>({
    isRecognizing: false,
    isFetchingLyrics: false,
    isTranslating: false,
    result: null,
    errors: [],
    serviceStatus: {
      audioRecognition: false,
      lyrics: false,
      translation: false,
    },
    currentStep: 'idle',
    progress: 0,
  });

  // Update progress and step
  const updateProgress = useCallback((step: UseLyricsTranslatorState['currentStep'], progress: number) => {
    setState(prev => ({
      ...prev,
      currentStep: step,
      progress,
      isRecognizing: step === 'recognizing',
      isFetchingLyrics: step === 'fetching-lyrics',
      isTranslating: step === 'translating',
    }));
  }, []);

  // Main translation from audio
  const translateFromAudio = useCallback(async (audioBuffer: ArrayBuffer, options: TranslationOptions) => {
    try {
      setState(prev => ({ ...prev, result: null, errors: [] }));
      
      updateProgress('recognizing', 10);
      
      const result = await lyricsTranslatorService.translateFromAudio(audioBuffer, options);
      
      updateProgress('complete', 100);
      
      setState(prev => ({
        ...prev,
        result,
        errors: result.errors,
        currentStep: result.translation ? 'complete' : 'error',
        isRecognizing: false,
        isFetchingLyrics: false,
        isTranslating: false,
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        currentStep: 'error',
        errors: [...prev.errors, { service: 'pipeline', error: errorMessage }],
        isRecognizing: false,
        isFetchingLyrics: false,
        isTranslating: false,
      }));
    }
  }, [updateProgress]);

  // Translation from song info
  const translateFromSongInfo = useCallback(async (
    artist: string, 
    title: string, 
    targetLanguage: string, 
    sourceLanguage?: string
  ) => {
    try {
      setState(prev => ({ ...prev, result: null, errors: [] }));
      
      updateProgress('fetching-lyrics', 33);
      
      const result = await lyricsTranslatorService.translateFromSongInfo(
        artist, 
        title, 
        targetLanguage, 
        sourceLanguage
      );
      
      updateProgress('complete', 100);
      
      setState(prev => ({
        ...prev,
        result,
        errors: result.errors,
        currentStep: result.translation ? 'complete' : 'error',
        isFetchingLyrics: false,
        isTranslating: false,
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        currentStep: 'error',
        errors: [...prev.errors, { service: 'pipeline', error: errorMessage }],
        isFetchingLyrics: false,
        isTranslating: false,
      }));
    }
  }, [updateProgress]);

  // Direct lyrics translation
  const translateLyricsOnly = useCallback(async (
    lyrics: string, 
    targetLanguage: string, 
    sourceLanguage?: string
  ) => {
    try {
      setState(prev => ({ ...prev, result: null, errors: [] }));
      
      updateProgress('translating', 50);
      
      const result = await lyricsTranslatorService.translateLyricsOnly(
        lyrics, 
        targetLanguage, 
        sourceLanguage
      );
      
      updateProgress('complete', 100);
      
      setState(prev => ({
        ...prev,
        result,
        errors: result.errors,
        currentStep: result.translation ? 'complete' : 'error',
        isTranslating: false,
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        currentStep: 'error',
        errors: [...prev.errors, { service: 'pipeline', error: errorMessage }],
        isTranslating: false,
      }));
    }
  }, [updateProgress]);

  // Batch translation
  const batchTranslate = useCallback(async (requests: Array<{
    artist: string;
    title: string;
    targetLanguage: string;
    sourceLanguage?: string;
  }>) => {
    try {
      setState(prev => ({ ...prev, result: null, errors: [] }));
      
      updateProgress('fetching-lyrics', 20);
      
      const results = await lyricsTranslatorService.batchTranslate(requests);
      
      updateProgress('complete', 100);
      
      // For batch results, we'll store the first successful result or the first result with errors
      const successfulResult = results.find(r => r.translation) || results[0];
      const allErrors = results.flatMap(r => r.errors);
      
      setState(prev => ({
        ...prev,
        result: successfulResult || null,
        errors: allErrors,
        currentStep: successfulResult?.translation ? 'complete' : 'error',
        isFetchingLyrics: false,
        isTranslating: false,
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        currentStep: 'error',
        errors: [...prev.errors, { service: 'batch', error: errorMessage }],
        isFetchingLyrics: false,
        isTranslating: false,
      }));
    }
  }, [updateProgress]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isRecognizing: false,
      isFetchingLyrics: false,
      isTranslating: false,
      result: null,
      errors: [],
      serviceStatus: {
        audioRecognition: false,
        lyrics: false,
        translation: false,
      },
      currentStep: 'idle',
      progress: 0,
    });
  }, []);

  // Check service status
  const checkServiceStatus = useCallback(async () => {
    try {
      const healthCheck = await lyricsTranslatorService.healthCheck();
      
      setState(prev => ({
        ...prev,
        serviceStatus: healthCheck.services,
      }));
    } catch (error) {
      console.warn('Failed to check service status:', error);
    }
  }, []);

  // Check service status on mount
  useEffect(() => {
    checkServiceStatus();
  }, [checkServiceStatus]);

  return {
    // State
    ...state,
    
    // Actions
    translateFromAudio,
    translateFromSongInfo,
    translateLyricsOnly,
    batchTranslate,
    reset,
    checkServiceStatus,
  };
};

// Additional utility hooks

export const useServiceStatus = () => {
  const [status, setStatus] = useState({
    overall: 'checking' as 'healthy' | 'degraded' | 'unhealthy' | 'checking',
    services: {
      audioRecognition: false,
      lyrics: false,
      translation: false,
    },
    details: [] as string[],
  });

  const checkStatus = useCallback(async () => {
    try {
      const healthCheck = await lyricsTranslatorService.healthCheck();
      setStatus({
        overall: healthCheck.status,
        services: healthCheck.services,
        details: healthCheck.details,
      });
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        overall: 'unhealthy',
        details: ['Failed to check service status'],
      }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
    
    // Check status every 5 minutes
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { ...status, refresh: checkStatus };
};

export const useSupportedLanguages = () => {
  const [languages, setLanguages] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    const supportedLanguages = lyricsTranslatorService.getSupportedLanguages();
    setLanguages(supportedLanguages);
  }, []);

  return languages;
};