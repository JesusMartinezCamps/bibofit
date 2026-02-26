import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import LandingNavbar from '@/components/landing/LandingNavbar';
import HeroSection from '@/components/landing/HeroSection';
import ProblemSolution from '@/components/landing/ProblemSolution';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import HowItWorks from '@/components/landing/HowItWorks';
import Testimonials from '@/components/landing/Testimonials';
import ForWhom from '@/components/landing/ForWhom';
import PricingPreview from '@/components/landing/PricingPreview';
import FAQPreview from '@/components/landing/FAQPreview';
import FinalCTA from '@/components/landing/FinalCTA';
import LandingFooter from '@/components/landing/LandingFooter';
import WhatsAppButton from '@/components/landing/WhatsAppButton';

const HomePage = () => {
    const [audience, setAudience] = useState('coach');

    return (
        <div className="min-h-screen bg-[#1a1e23] font-sans selection:bg-green-500/30 text-white">
            <Helmet>
                <title>Bibofit | Software para Nutricionistas y Entrenadores</title>
                <meta name="description" content="La plataforma todo en uno para gestionar planes de nutrición, rutinas de entrenamiento y seguimiento de clientes. Escala tu negocio fitness con Bibofit." />
            </Helmet>

            <LandingNavbar />
            
            <main>
                <HeroSection />
                <ProblemSolution audience={audience} onAudienceChange={setAudience} />
                <FeaturesGrid audience={audience} onAudienceChange={setAudience} />
                <HowItWorks audience={audience} onAudienceChange={setAudience} />
                <ForWhom audience={audience} onAudienceChange={setAudience} />
                {/* <Testimonials /> */}
                <PricingPreview />
                <FAQPreview />
                <FinalCTA />
            </main>

            <LandingFooter />
            <WhatsAppButton />
        </div>
    );
};

export default HomePage;
