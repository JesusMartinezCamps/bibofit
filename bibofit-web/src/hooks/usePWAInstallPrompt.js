
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function usePWAInstallPrompt() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const hasCompletedOnboarding = !!user?.onboarding_completed_at;
  const userDismissedAtKey = user?.id ? `pwaInstallDismissedAt:${user.id}` : null;
  const legacyDismissedAtKey = 'pwaInstallDismissedAt';
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
      const isSmallViewport = window.innerWidth <= 768;
      setIsMobile(mobileUserAgent || isSmallViewport);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!userDismissedAtKey) {
      setIsDismissed(false);
      return;
    }

    // Backward compatibility: migrate old global key to per-user key once.
    const legacyDismissedAt = localStorage.getItem(legacyDismissedAtKey);
    if (legacyDismissedAt && !localStorage.getItem(userDismissedAtKey)) {
      localStorage.setItem(userDismissedAtKey, legacyDismissedAt);
      localStorage.removeItem(legacyDismissedAtKey);
      localStorage.removeItem('pwaInstallDismissed');
    }

    const dismissedAt = localStorage.getItem(userDismissedAtKey);
    if (!dismissedAt) {
      setIsDismissed(false);
      return;
    }

    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const timePassed = Date.now() - parseInt(dismissedAt, 10);
    
    if (timePassed < thirtyDaysInMs) {
      setIsDismissed(true);
    } else {
      localStorage.removeItem(userDismissedAtKey);
      setIsDismissed(false);
    }
  }, [userDismissedAtKey]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    if (userDismissedAtKey) {
      localStorage.setItem(userDismissedAtKey, Date.now().toString());
    }
    setIsDismissed(true);
    setInstallPrompt(null);
  };

  const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = window.navigator.standalone === true;

  const showPrompt = isAuthenticated && hasCompletedOnboarding && isMobile && !isDismissed && installPrompt !== null && !isInstalled && !isStandalone && !isIosStandalone;

  return {
    showPrompt,
    installPrompt,
    handleInstall,
    handleDismiss,
    isAuthenticated,
    isMobile
  };
}
