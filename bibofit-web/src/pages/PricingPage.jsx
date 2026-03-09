import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import LandingFooter from '@/components/landing/LandingFooter';
import { useAuth } from '@/contexts/AuthContext';
import PricingComponent from '@/components/shared/PricingComponent';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Check, X, Loader2 } from 'lucide-react';
import {
  buildFeatureMatrix,
  getPricingPlans,
  PRICING_PRODUCT_AREAS,
  subscribePricingChanges,
} from '@/lib/pricingService';

const PricingPage = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(true);
  const [comparisonError, setComparisonError] = useState('');
  const refreshTimerRef = useRef(null);

  const faqs = [
    {
      question: '¿Puedo cambiar de plan en cualquier momento?',
      answer:
        'Sí, puedes actualizar o degradar tu plan en cualquier momento desde la configuración de tu cuenta. Los cambios de precio se aplicarán en el siguiente ciclo de facturación.',
    },
    {
      question: '¿Qué es el autocuadre de macros?',
      answer:
        'Es nuestra tecnología exclusiva de nutrición que recalcula automáticamente las cantidades de tus otras comidas cuando añades una receta libre o cambias un ingrediente.',
    },
    {
      question: '¿Hay algún compromiso de permanencia?',
      answer: 'No, nuestros planes son mensuales y puedes cancelar cuando quieras sin penalización alguna.',
    },
    {
      question: '¿Cómo funciona la asesoría personalizada?',
      answer:
        'Te asignaremos un dietista certificado que diseñará tu plan nutricional desde cero, lo revisará semanalmente y estará disponible para tus dudas por chat privado.',
    },
  ];

  const fetchPlans = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingComparison(true);
    try {
      const data = await getPricingPlans({ surface: 'pricing', productArea: PRICING_PRODUCT_AREAS.NUTRITION });
      setPlans(data);
      setComparisonError('');
    } catch (error) {
      console.error('[PricingPage] Failed to fetch plans:', error);
      setComparisonError('No se pudo cargar la comparativa de planes.');
      if (!silent) setPlans([]);
    } finally {
      if (!silent) setLoadingComparison(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        fetchPlans({ silent: true });
      }, 250);
    };

    const unsubscribe = subscribePricingChanges(scheduleRefresh);

    const onFocus = () => {
      fetchPlans({ silent: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPlans({ silent: true });
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [fetchPlans]);

  const visiblePlans = useMemo(() => plans.filter((plan) => plan.isActive !== false && plan.showOnPricing !== false), [plans]);
  const comparisonRows = useMemo(() => buildFeatureMatrix(visiblePlans), [visiblePlans]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Helmet>
        <title>Precios y Planes | Bibofit</title>
        <meta name="description" content="Elige el plan de nutrición que mejor se adapta a tus objetivos." />
      </Helmet>

      <main className={`${!user ? 'pt-28 md:pt-32' : 'pt-8'} pb-20 flex-grow`}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 via-emerald-500 to-teal-400 dark:from-white dark:via-green-200 dark:to-emerald-400 mb-6">
              Invierte en tu salud
            </h1>
            <p className="text-xl text-muted-foreground">
              Herramientas profesionales para nutrición con una base preparada para entreno y futuros bundles.
            </p>
          </div>

          <PricingComponent showTitle={false} surface="pricing" productArea={PRICING_PRODUCT_AREAS.NUTRITION} />

          <div className="max-w-6xl mx-auto mt-24 mb-24">
            <h2 className="text-3xl font-bold text-center mb-12">Comparativa Detallada</h2>
            <div className="overflow-x-auto bg-card rounded-xl border border-border p-6">
              {loadingComparison ? (
                <div className="flex justify-center items-center h-24">
                  <Loader2 className="h-7 w-7 animate-spin text-green-500" />
                </div>
              ) : comparisonError ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center">
                  <p className="text-red-700 dark:text-red-300">{comparisonError}</p>
                </div>
              ) : visiblePlans.length === 0 ? (
                <div className="rounded-xl border border-border bg-card/60 p-4 text-center text-muted-foreground">
                  No hay planes activos visibles en la comparativa.
                </div>
              ) : (
                <table className="w-full text-left min-w-[620px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-4 px-4 text-muted-foreground font-medium">Funcionalidad</th>
                      {visiblePlans.map((plan) => (
                        <th key={plan.id} className="py-4 px-4 text-center text-foreground font-bold">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.feature} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-4 px-4 text-muted-foreground">{row.feature}</td>
                        {visiblePlans.map((plan) => {
                          const included = !!row.byPlan[plan.id];
                          return (
                            <td key={`${row.feature}-${plan.id}`} className="py-4 px-4 text-center">
                              {included ? (
                                <Check className="mx-auto h-5 w-5 text-green-500" />
                              ) : (
                                <X className="mx-auto h-5 w-5 text-muted-foreground" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Preguntas Frecuentes</h2>
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, idx) => (
                <AccordionItem key={idx} value={`item-${idx}`} className="bg-card border border-border rounded-lg px-6">
                  <AccordionTrigger className="text-lg font-medium hover:text-green-400 hover:no-underline py-6">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </main>

      {!user && <LandingFooter />}
    </div>
  );
};

export default PricingPage;
