import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native shell.
 *
 * `server.url` is the whole point: the app loads the live web app rather than a
 * bundled copy, so one deploy updates web, iOS and Android at the same moment
 * and a copy change never waits on App Store review. Only changes to this shell
 * — new plugins, permissions, icons — need a store submission.
 *
 * `webDir` is not the app. It is a small bundled fallback that Capacitor shows
 * when the device cannot reach the server, and it renders itineraries the
 * traveller saved for offline use. See mobile/public/index.html.
 *
 * Set CAP_SERVER_URL for local development against a machine on your network
 * (localhost is the device itself, not your laptop).
 */
const serverUrl = process.env.CAP_SERVER_URL ?? 'https://wayfare.app';

const config: CapacitorConfig = {
  appId: 'app.wayfare.mobile',
  appName: 'Wayfare',
  webDir: 'mobile/public',

  server: {
    url: serverUrl,
    // Never allow plaintext against production. A dev override on a LAN address
    // is the only reason this would ever be true.
    cleartext: serverUrl.startsWith('http://'),
    // Shown when the webview cannot load the server at all.
    errorPath: 'index.html',
  },

  ios: {
    contentInset: 'never',
    // The web app paints its own background; a white webview flashes on push.
    backgroundColor: '#f6f7fb',
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    backgroundColor: '#f6f7fb',
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#f6f7fb',
      showSpinner: false,
      launchAutoHide: false, // the web app hides it once it has painted
    },
    StatusBar: {
      style: 'LIGHT', // dark text on our light background
      backgroundColor: '#f6f7fb',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
