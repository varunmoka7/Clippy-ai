module.exports = {
  dependencies: {
    'react-native-dotenv': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-dotenv/android',
          packageImportPath: 'import io.github.elyx0.reactnativedotenv.RNDotEnvPackage;',
        },
        ios: {
          podspecPath: '../node_modules/react-native-dotenv/react-native-dotenv.podspec',
        },
      },
    },
  },
};