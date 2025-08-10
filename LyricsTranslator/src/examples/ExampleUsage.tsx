import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLyricsTranslator, useServiceStatus, useSupportedLanguages } from '../hooks/useLyricsTranslator';

const ExampleUsage: React.FC = () => {
  const [artist, setArtist] = useState('Beatles');
  const [title, setTitle] = useState('Yesterday');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [customLyrics, setCustomLyrics] = useState('');
  
  const translator = useLyricsTranslator();
  const serviceStatus = useServiceStatus();
  const supportedLanguages = useSupportedLanguages();

  const handleTranslateFromSongInfo = async () => {
    if (!artist.trim() || !title.trim()) {
      Alert.alert('Error', 'Please enter both artist and title');
      return;
    }
    
    await translator.translateFromSongInfo(artist, title, targetLanguage);
  };

  const handleTranslateLyrics = async () => {
    if (!customLyrics.trim()) {
      Alert.alert('Error', 'Please enter lyrics to translate');
      return;
    }
    
    await translator.translateLyricsOnly(customLyrics, targetLanguage);
  };

  const renderServiceStatus = () => (
    <View style={styles.statusContainer}>
      <Text style={styles.sectionTitle}>Service Status</Text>
      <Text style={styles.statusText}>
        Overall: {serviceStatus.overall.toUpperCase()}
      </Text>
      <View style={styles.servicesList}>
        <Text>Audio Recognition: {serviceStatus.services.audioRecognition ? '✅' : '❌'}</Text>
        <Text>Lyrics: {serviceStatus.services.lyrics ? '✅' : '❌'}</Text>
        <Text>Translation: {serviceStatus.services.translation ? '✅' : '❌'}</Text>
      </View>
      {serviceStatus.details.length > 0 && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Issues:</Text>
          {serviceStatus.details.map((detail, index) => (
            <Text key={index} style={styles.detailText}>• {detail}</Text>
          ))}
        </View>
      )}
    </View>
  );

  const renderLanguageSelector = () => (
    <View style={styles.languageContainer}>
      <Text style={styles.label}>Target Language:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {supportedLanguages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageButton,
              targetLanguage === lang.code && styles.selectedLanguage,
            ]}
            onPress={() => setTargetLanguage(lang.code)}
          >
            <Text style={styles.languageText}>{lang.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderProgress = () => {
    if (translator.currentStep === 'idle') return null;

    const stepMessages = {
      recognizing: 'Recognizing audio...',
      'fetching-lyrics': 'Fetching lyrics...',
      translating: 'Translating...',
      complete: 'Complete!',
      error: 'Error occurred',
    };

    return (
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {stepMessages[translator.currentStep]}
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[styles.progressFill, { width: `${translator.progress}%` }]} 
          />
        </View>
        {translator.currentStep !== 'complete' && translator.currentStep !== 'error' && (
          <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />
        )}
      </View>
    );
  };

  const renderResult = () => {
    if (!translator.result) return null;

    return (
      <View style={styles.resultContainer}>
        <Text style={styles.sectionTitle}>Results</Text>
        
        {translator.result.audioRecognition && (
          <View style={styles.resultSection}>
            <Text style={styles.resultTitle}>Audio Recognition:</Text>
            <Text>Title: {translator.result.audioRecognition.title}</Text>
            <Text>Artist: {translator.result.audioRecognition.artist}</Text>
            <Text>Confidence: {(translator.result.audioRecognition.confidence || 0) * 100}%</Text>
            <Text>Source: {translator.result.audioRecognition.source}</Text>
          </View>
        )}

        {translator.result.lyrics && (
          <View style={styles.resultSection}>
            <Text style={styles.resultTitle}>Original Lyrics:</Text>
            <ScrollView style={styles.lyricsContainer}>
              <Text style={styles.lyricsText}>{translator.result.lyrics.lyrics}</Text>
            </ScrollView>
            <Text style={styles.sourceText}>Source: {translator.result.lyrics.source}</Text>
          </View>
        )}

        {translator.result.translation && (
          <View style={styles.resultSection}>
            <Text style={styles.resultTitle}>Translated Lyrics:</Text>
            <ScrollView style={styles.lyricsContainer}>
              <Text style={styles.lyricsText}>{translator.result.translation.translatedText}</Text>
            </ScrollView>
            <Text style={styles.sourceText}>
              Translation: {translator.result.translation.sourceLanguage} → {translator.result.translation.targetLanguage}
            </Text>
            <Text style={styles.sourceText}>Source: {translator.result.translation.source}</Text>
          </View>
        )}

        <View style={styles.metadataContainer}>
          <Text>Processing Time: {translator.result.processingTime}ms</Text>
          <Text>Confidence: {(translator.result.confidence * 100).toFixed(1)}%</Text>
        </View>
      </View>
    );
  };

  const renderErrors = () => {
    if (translator.errors.length === 0) return null;

    return (
      <View style={styles.errorsContainer}>
        <Text style={styles.errorTitle}>Errors & Warnings:</Text>
        {translator.errors.map((error, index) => (
          <Text key={index} style={styles.errorText}>
            {error.service}: {error.error}
            {error.retryAfter && ` (retry in ${Math.ceil(error.retryAfter / 1000)}s)`}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Free Lyrics Translator</Text>
      
      {renderServiceStatus()}
      {renderLanguageSelector()}

      <View style={styles.inputContainer}>
        <Text style={styles.sectionTitle}>Translate from Song Info</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Artist (e.g., Beatles)"
          value={artist}
          onChangeText={setArtist}
        />
        <TextInput
          style={styles.textInput}
          placeholder="Title (e.g., Yesterday)"
          value={title}
          onChangeText={setTitle}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={handleTranslateFromSongInfo}
          disabled={translator.currentStep !== 'idle'}
        >
          <Text style={styles.buttonText}>Translate from Song Info</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.sectionTitle}>Translate Custom Lyrics</Text>
        <TextInput
          style={[styles.textInput, styles.multilineInput]}
          placeholder="Enter lyrics to translate..."
          value={customLyrics}
          onChangeText={setCustomLyrics}
          multiline
        />
        <TouchableOpacity
          style={styles.button}
          onPress={handleTranslateLyrics}
          disabled={translator.currentStep !== 'idle'}
        >
          <Text style={styles.buttonText}>Translate Lyrics</Text>
        </TouchableOpacity>
      </View>

      {renderProgress()}
      {renderResult()}
      {renderErrors()}

      <TouchableOpacity
        style={[styles.button, styles.resetButton]}
        onPress={translator.reset}
      >
        <Text style={styles.buttonText}>Reset</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  servicesList: {
    marginLeft: 8,
  },
  detailsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 4,
  },
  detailsTitle: {
    fontWeight: '500',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#856404',
  },
  languageContainer: {
    marginBottom: 16,
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 16,
    marginRight: 8,
  },
  selectedLanguage: {
    backgroundColor: '#007AFF',
  },
  languageText: {
    color: '#333',
  },
  inputContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
    marginBottom: 32,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  loader: {
    marginTop: 8,
  },
  resultContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  resultSection: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  lyricsContainer: {
    maxHeight: 200,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  lyricsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sourceText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  metadataContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  errorsContainer: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#d32f2f',
    marginBottom: 4,
  },
});

export default ExampleUsage;