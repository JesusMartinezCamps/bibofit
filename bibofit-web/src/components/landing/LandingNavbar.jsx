import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/icons/AppIcon';

const LandingNavbar = ({ showNavigationOptions = true }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/home' || location.pathname === '/';

  const getNavbarOffset = useCallback(() => {
    const navbarBar = document.querySelector('[data-landing-navbar-bar]');
    const navbar = document.getElementById('landing-navbar');
    const navbarHeight = navbarBar?.getBoundingClientRect().height ?? navbar?.getBoundingClientRect().height ?? 84;
    const extraSpacing = window.innerWidth < 768 ? 16 : 12;
    return navbarHeight + extraSpacing;
  }, []);

  const scrollToSection = useCallback((selector, behavior = 'smooth') => {
    const element = document.querySelector(selector);
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY - getNavbarOffset();

    window.scrollTo({
      top: Math.max(0, top),
      behavior,
    });
  }, [getNavbarOffset]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isHome || !location.hash) return;

    const frameId = requestAnimationFrame(() => {
      scrollToSection(location.hash, 'smooth');
    });

    return () => cancelAnimationFrame(frameId);
  }, [isHome, location.hash, scrollToSection]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  const navLinks = [
    { name: 'Solución', href: '#problem', type: 'scroll' },
    { name: 'Funcionalidades', href: '#features', type: 'scroll' },
    { name: 'Cómo funciona', href: '#how-it-works', type: 'scroll' },
    { name: 'Para quién', href: '#for-whom', type: 'scroll' },
    { name: 'Precios', href: '/pricing', type: 'route' },
    { name: 'FAQ', href: '#faq', type: 'scroll' },
  ];

  const handleNavLinkClick = (e, link) => {
    if (link.type === 'scroll') {
      e.preventDefault();
      if (!isHome) {
        setIsMobileMenuOpen(false);
        navigate(`/home${link.href}`);
      } else {
        setIsMobileMenuOpen(false);
        requestAnimationFrame(() => {
          scrollToSection(link.href);
        });
      }
      return;
    }

    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      id="landing-navbar"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent',
        isScrolled
          ? 'bg-background/90 backdrop-blur-md border-border/80 py-3 shadow-sm'
          : 'bg-background/70 backdrop-blur-sm border-border/50 py-5'
      )}
    >
      <div data-landing-navbar-bar className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link to="/home" className="flex items-center gap-2 font-bold text-2xl text-foreground">
          <div className="bg-gradient-to-br from-green-400/20 to-green-600/20 p-1.5 rounded-lg flex items-center justify-center">
            <AppIcon className="h-6 w-6 text-black" />
          </div>
          <span>Bibofit</span>
        </Link>

        {showNavigationOptions && (
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.type === 'scroll' ? (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavLinkClick(e, link)}
                  className="text-sm font-medium text-muted-foreground hover:text-green-400 transition-colors"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={(e) => handleNavLinkClick(e, link)}
                  className="text-sm font-medium text-muted-foreground hover:text-green-400 transition-colors"
                >
                  {link.name}
                </Link>
              )
            ))}
          </div>
        )}

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login">
            <Button variant="ghost" className="text-foreground hover:text-green-500 hover:bg-muted/70">
              Iniciar Sesión
            </Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-green-500 hover:bg-green-600 text-green-950 font-semibold">
              Empezar Gratis Ahora
            </Button>
          </Link>
        </div>

        <button
          className="md:hidden text-foreground p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-popover text-popover-foreground border border-border shadow-lg shadow-black/15 overflow-hidden rounded-b-xl"
          >
            <div className="flex flex-col p-4 space-y-4">
              {showNavigationOptions && navLinks.map((link) => (
                link.type === 'scroll' ? (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => handleNavLinkClick(e, link)}
                    className="text-base font-medium text-muted-foreground hover:text-green-400 py-2"
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={(e) => handleNavLinkClick(e, link)}
                    className="text-base font-medium text-muted-foreground hover:text-green-400 py-2"
                  >
                    {link.name}
                  </Link>
                )
              ))}

              <div className={cn("flex flex-col gap-3", showNavigationOptions && "pt-2 border-t border-border")}>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="ghost" className="text-foreground bg-muted/60 hover:text-green-500 hover:bg-muted w-full">
                    Iniciar Sesión
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button className="bg-green-500 hover:bg-green-600 text-green-950 font-semibold w-full">
                    Empezar Gratis Ahora
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default LandingNavbar;
