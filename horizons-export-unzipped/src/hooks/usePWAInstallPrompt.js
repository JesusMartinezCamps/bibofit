
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function usePWAInstallPrompt() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
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
    const dismissedAt = localStorage.getItem('pwaInstallDismissedAt');
    if (dismissedAt) {
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      const timePassed = Date.now() - parseInt(dismissedAt, 10);
      
      if (timePassed < thirtyDaysInMs) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem('pwaInstallDismissed');
        localStorage.removeItem('pwaInstallDismissedAt');
        setIsDismissed(false);
      }
    }
  }, []);

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
    localStorage.setItem('pwaInstallDismissed', 'true');
    localStorage.setItem('pwaInstallDismissedAt', Date.now().toString());
    setIsDismissed(true);
    setInstallPrompt(null);
  };

  const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = window.navigator.standalone === true;

  const showPrompt = isAuthenticated && isMobile && !isDismissed && installPrompt !== null && !isInstalled && !isStandalone && !isIosStandalone;

  return {
    showPrompt,
    installPrompt,
    handleInstall,
    handleDismiss,
    isAuthenticated,
    isMobile
  };
}
