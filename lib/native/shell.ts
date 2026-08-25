'use client';

import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { hasPlugin, isNative } from './platform';

/**
 * Native shell wiring.
 *
 * Everything here is a no-op on the web, so there is exactly one app and one
 * deploy — the browser build simply skips it.
 */
export async function initNativeShell(navigate: (path: string) => void): Promise<() => void> {
  if (!isNative()) return () => {};

  const teardown: (() => void)[] = [];

  if (hasPlugin('StatusBar')) {
    // Dark glyphs, because the app background is light paper.
    await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  }

  // Held until the web app has actually painted, so the first frame is content
  // rather than a white flash. `launchAutoHide` is false, so if this never runs
  // the app sits on the launch image — hence the catch, and hence the bundled
  // offline page hiding it too.
  if (hasPlugin('SplashScreen')) {
    await SplashScreen.hide().catch(() => {});
  }

  if (hasPlugin('App')) {
    // Universal links and app links: a shared /t/<slug> opens the app, on the
    // right page, instead of bouncing to the browser.
    const deepLink = await App.addListener('appUrlOpen', ({ url }) => {
      try {
        const parsed = new URL(url);
        navigate(`${parsed.pathname}${parsed.search}`);
      } catch {
        /* a malformed link is not worth crashing over */
      }
    });
    teardown.push(() => void deepLink.remove());

    // Android hardware back should walk history, and only exit at the root.
    const back = await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void App.exitApp();
    });
    teardown.push(() => void back.remove());
  }

  return () => {
    for (const off of teardown) off();
  };
}
