const IS_DEV = process.env.APP_VARIANT === 'development';
const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

module.exports = {
  expo: {
    name: IS_DEV ? 'HK Life Dev' : 'HK Life App',
    slug: 'hk-life-app',
    version: '1.0.0',
    orientation: 'default',
    icon: './assets/images/icon.png',
    scheme: IS_DEV ? 'hk-life-app-dev' : 'hk-life-app',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#111111',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? 'com.hklife.app.dev' : 'com.hklife.app',
      buildNumber: '1',
      deploymentTarget: '15.1',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSFaceIDUsageDescription: 'HK Life uses Face ID to lock the app.',
        NSAppleMusicUsageDescription: 'HK Life needs access to your Apple Music library to show and play your playlists.',
        UIBackgroundModes: ['audio'],
        LSApplicationQueriesSchemes: ['spotify'],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [IS_DEV ? 'hk-life-app-dev' : 'hk-life-app'],
          },
        ],
      },
    },
    android: {
      package: IS_DEV ? 'com.hklife.app.dev' : 'com.hklife.app',
      adaptiveIcon: {
        foregroundImage: './assets/images/icon.png',
        backgroundColor: '#111111',
      },
      permissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_CALENDAR',
        'android.permission.WRITE_CALENDAR',
        'android.permission.RECORD_AUDIO',
      ],
    },
    web: {
      favicon: './assets/images/icon.png',
    },
    plugins: [
      [
        'expo-router',
        {
          origin: 'https://replit.com/',
        },
      ],
      'expo-font',
      'expo-web-browser',
      [
        'expo-media-library',
        {
          photosPermission: 'Allow Mi Corazon to access your photos and videos.',
        },
      ],
      [
        'expo-calendar',
        {
          calendarPermission: 'Allow this app to access your calendar events.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Mi Corazon to access your photos and videos.',
        },
      ],
      'expo-screen-orientation',
      './plugins/withAppleMusicKit',
      ...(SPOTIFY_CLIENT_ID ? [
        [
          'react-native-spotify-remote',
          {
            spotifyClientID: SPOTIFY_CLIENT_ID,
            spotifyRedirectURL: IS_DEV ? 'hk-life-app-dev://spotify-callback' : 'hk-life-app://spotify-callback',
          },
        ],
      ] : []),
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: 'a4b0c416-348f-4f50-914c-76e1b191ca72',
      },
      easBuildId: process.env.EAS_BUILD_ID?.slice(0, 8) ?? null,
    },
    owner: 'hk1811',
  },
};
