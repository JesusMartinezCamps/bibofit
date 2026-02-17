import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Apple } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const LandingNavbar = ({ showNavigationOptions = true }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/home' || location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Problema', href: '#problem', type: 'scroll' },
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
        navigate('/home');
        requestAnimationFrame(() => {
          setTimeout(() => {
            const element = document.querySelector(link.href);
            element?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        });
      } else {
        const element = document.querySelector(link.href);
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent',
        isScrolled ? 'bg-[#1a1e23]/90 backdrop-blur-md border-gray-800 py-3' : 'bg-transparent py-5'
      )}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link to="/home" className="flex items-center gap-2 font-bold text-2xl text-white">
          <div className="bg-gradient-to-br from-green-400 to-green-600 p-1.5 rounded-lg">
            <Apple className="h-6 w-6 text-black" />
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
                  className="text-sm font-medium text-gray-300 hover:text-green-400 transition-colors"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={(e) => handleNavLinkClick(e, link)}
                  className="text-sm font-medium text-gray-300 hover:text-green-400 transition-colors"
                >
                  {link.name}
                </Link>
              )
            ))}
          </div>
        )}

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login">
            <Button variant="ghost" className="text-white hover:text-green-400 hover:bg-white/5">
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
          className="md:hidden text-white p-2"
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
            className="md:hidden bg-[#1a1e23] border-b border-gray-800 overflow-hidden"
          >
            <div className="flex flex-col p-4 space-y-4">
              {showNavigationOptions && navLinks.map((link) => (
                link.type === 'scroll' ? (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => handleNavLinkClick(e, link)}
                    className="text-base font-medium text-gray-300 hover:text-green-400 py-2"
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={(e) => handleNavLinkClick(e, link)}
                    className="text-base font-medium text-gray-300 hover:text-green-400 py-2"
                  >
                    {link.name}
                  </Link>
                )
              ))}

              <div className={cn("flex flex-col gap-3", showNavigationOptions && "pt-2 border-t border-gray-700")}>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="ghost" className="text-white bg-gray-500/10 hover:text-green-400 hover:bg-white/5 w-full">
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