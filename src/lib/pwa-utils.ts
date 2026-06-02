/**
 * PWA Utilities
 * 
 * This module provides utility functions for PWA functionality
 * including installation detection, standalone mode handling,
 * and offline status management.
 */

export interface PWAInstallPrompt extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWACapabilities {
  isInstallable: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  supportsServiceWorker: boolean;
  supportsNotifications: boolean;
  supportsPushNotifications: boolean;
  supportsBackgroundSync: boolean;
  isOnline: boolean;
}

/**
 * Check if the app is running in standalone mode
 */
export function isStandaloneMode(): boolean {
  // Check for display-mode: standalone
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Check for iOS standalone mode
  const isIOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  
  // Check for Android TWA (Trusted Web Activity)
  const isTWA = document.referrer.includes('android-app://');
  
  return isStandalone || isIOSStandalone || isTWA;
}

/**
 * Check if the app can be installed
 */
export function canInstallPWA(): boolean {
  // Check if beforeinstallprompt is supported
  return 'onbeforeinstallprompt' in window;
}

/**
 * Get PWA capabilities
 */
export function getPWACapabilities(): PWACapabilities {
  return {
    isInstallable: canInstallPWA(),
    isInstalled: isStandaloneMode(),
    isStandalone: isStandaloneMode(),
    supportsServiceWorker: 'serviceWorker' in navigator,
    supportsNotifications: 'Notification' in window,
    supportsPushNotifications: 'PushManager' in window,
    supportsBackgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
    isOnline: navigator.onLine
  };
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Show a notification
 */
export function showNotification(
  title: string,
  options: NotificationOptions = {}
): Notification | null {
  if (Notification.permission !== 'granted') {
    return null;
  }

  const defaultOptions: NotificationOptions = {
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    ...options
  };

  // Add vibration separately if supported
  if ('vibrate' in navigator && navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }

  return new Notification(title, defaultOptions);
}

/**
 * Handle PWA installation
 */
export class PWAInstaller {
  private deferredPrompt: PWAInstallPrompt | null = null;
  private installCallbacks: Array<(installed: boolean) => void> = [];

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as PWAInstallPrompt;
    });

    // Listen for appinstalled
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.notifyInstallCallbacks(true);
    });
  }

  /**
   * Check if installation is available
   */
  public isInstallAvailable(): boolean {
    return this.deferredPrompt !== null;
  }

  /**
   * Trigger installation prompt
   */
  public async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      this.deferredPrompt = null;
      
      if (choiceResult.outcome === 'accepted') {
        this.notifyInstallCallbacks(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('PWA installation failed:', error);
      return false;
    }
  }

  /**
   * Add callback for installation events
   */
  public onInstall(callback: (installed: boolean) => void): void {
    this.installCallbacks.push(callback);
  }

  private notifyInstallCallbacks(installed: boolean): void {
    this.installCallbacks.forEach(callback => callback(installed));
  }
}

/**
 * Offline status manager
 */
export class OfflineManager {
  private onlineCallbacks: Array<() => void> = [];
  private offlineCallbacks: Array<() => void> = [];
  private isCurrentlyOnline: boolean = navigator.onLine;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isCurrentlyOnline = true;
      this.notifyOnlineCallbacks();
    });

    window.addEventListener('offline', () => {
      this.isCurrentlyOnline = false;
      this.notifyOfflineCallbacks();
    });
  }

  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.isCurrentlyOnline;
  }

  /**
   * Add callback for online events
   */
  public onOnline(callback: () => void): void {
    this.onlineCallbacks.push(callback);
  }

  /**
   * Add callback for offline events
   */
  public onOffline(callback: () => void): void {
    this.offlineCallbacks.push(callback);
  }

  /**
   * Remove callback
   */
  public removeCallback(callback: () => void): void {
    this.onlineCallbacks = this.onlineCallbacks.filter(cb => cb !== callback);
    this.offlineCallbacks = this.offlineCallbacks.filter(cb => cb !== callback);
  }

  private notifyOnlineCallbacks(): void {
    this.onlineCallbacks.forEach(callback => callback());
  }

  private notifyOfflineCallbacks(): void {
    this.offlineCallbacks.forEach(callback => callback());
  }
}

/**
 * PWA update manager
 */
export class PWAUpdateManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateCallbacks: Array<(available: boolean) => void> = [];

  constructor(registration?: ServiceWorkerRegistration) {
    if (registration) {
      this.setRegistration(registration);
    }
  }

  /**
   * Set service worker registration
   */
  public setRegistration(registration: ServiceWorkerRegistration): void {
    this.registration = registration;
    this.setupUpdateListener();
  }

  private setupUpdateListener(): void {
    if (!this.registration) return;

    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.notifyUpdateCallbacks(true);
          }
        });
      }
    });
  }

  /**
   * Check for updates manually
   */
  public async checkForUpdates(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  /**
   * Apply pending update
   */
  public async applyUpdate(): Promise<void> {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  /**
   * Add callback for update events
   */
  public onUpdate(callback: (available: boolean) => void): void {
    this.updateCallbacks.push(callback);
  }

  private notifyUpdateCallbacks(available: boolean): void {
    this.updateCallbacks.forEach(callback => callback(available));
  }
}

/**
 * PWA analytics helper
 */
export function trackPWAEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
): void {
  // Track PWA-specific events
  const pwaProperties = {
    ...properties,
    isStandalone: isStandaloneMode(),
    isOnline: navigator.onLine,
    timestamp: new Date().toISOString()
  };

  // Send to analytics service (Google Analytics, etc.)
  if ('gtag' in window) {
    (window as Window & { gtag: (...args: unknown[]) => void }).gtag('event', eventName, {
      event_category: 'pwa',
      custom_parameters: pwaProperties
    });
  }

  // Log for debugging
  console.log(`[PWA Analytics] ${eventName}:`, pwaProperties);
}

/**
 * Get device information for PWA optimization
 */
export function getDeviceInfo(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  platform: string;
  userAgent: string;
  screenSize: { width: number; height: number };
  pixelRatio: number;
  connectionType?: string;
} {
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;

  let platform = 'unknown';
  if (/iPhone|iPad|iPod/i.test(userAgent)) platform = 'ios';
  else if (/Android/i.test(userAgent)) platform = 'android';
  else if (/Windows/i.test(userAgent)) platform = 'windows';
  else if (/Mac/i.test(userAgent)) platform = 'macos';
  else if (/Linux/i.test(userAgent)) platform = 'linux';

  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  const connectionType = connection ? connection.effectiveType : undefined;

  return {
    isMobile,
    isTablet,
    isDesktop,
    platform,
    userAgent,
    screenSize: {
      width: window.screen.width,
      height: window.screen.height
    },
    pixelRatio: window.devicePixelRatio || 1,
    connectionType
  };
}

// Export singleton instances
export const pwaInstaller = new PWAInstaller();
export const offlineManager = new OfflineManager();
export const pwaUpdateManager = new PWAUpdateManager();