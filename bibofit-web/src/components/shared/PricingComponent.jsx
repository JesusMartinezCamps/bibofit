import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getPricingPlans, subscribePricingChanges } from '@/lib/pricingService';

const PERIOD_LABEL = {
  monthly: '/mes',
  one_time: 'pago único',
};

const PricingComponent = ({ showTitle = true, className, surface = 'home' }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const refreshTimerRef = useRef(null);

  const fetchPlans = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await getPricingPlans({ surface });
      setPlans(data);
      setLoadError('');
    } catch (error) {
      console.error('[PricingComponent] Failed to fetch pricing plans:', error);
      setLoadError('No se pudieron cargar los planes en este momento.');
      if (!silent) setPlans([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [surface]);

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

  const visiblePlans = useMemo(() => plans.filter((plan) => plan.isActive !== false), [plans]);

  return (
    <section id="pricing" className={cn('py-12 bg-transparent', className)}>
      <div className="container mx-auto px-4 md:px-6">
        {showTitle && (
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Planes flexibles</h2>
            <p className="text-muted-foreground">Comienza gratis y escala a medida que crece tu negocio.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          </div>
        ) : loadError ? (
          <div className="max-w-2xl mx-auto rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-center">
            <p className="text-red-700 dark:text-red-300">{loadError}</p>
            <Button onClick={() => fetchPlans()} className="mt-4 bg-green-600 hover:bg-green-700 text-white">
              Reintentar
            </Button>
          </div>
        ) : visiblePlans.length === 0 ? (
          <div className="max-w-2xl mx-auto rounded-xl border border-border bg-card/60 p-5 text-center text-muted-foreground">
            No hay planes disponibles para mostrar ahora mismo.
          </div>
        ) : (
          <div className={cn('grid gap-8 max-w-6xl mx-auto', visiblePlans.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
            {visiblePlans.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  'bg-card border-border flex flex-col relative transition-all duration-300 hover:border-border',
                  plan.isPopular && 'border-green-500/50 shadow-2xl shadow-green-900/10 transform md:-translate-y-4 z-10'
                )}
              >
                {plan.isPopular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Badge className="bg-green-500 text-black hover:bg-green-600 px-4 py-1">Más popular</Badge>
                  </div>
                )}

                <CardHeader>
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  <div className="text-3xl font-bold text-foreground mt-2">
                    {plan.displayPrice || `${plan.priceAmount}€`}{' '}
                    <span className="text-sm font-normal text-muted-foreground">{PERIOD_LABEL[plan.billingType] || '/mes'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.subtitle || plan.description}</p>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature.id} className="flex items-start gap-3 text-sm">
                        {feature.included ? (
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={feature.included ? 'text-muted-foreground' : 'text-muted-foreground'}>{feature.featureText}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Link to={plan.ctaLink || '/signup'} className="w-full">
                    <Button
                      variant={plan.isPopular ? 'default' : 'outline'}
                      className={cn(
                        'w-full font-semibold',
                        plan.isPopular
                          ? 'bg-green-500 hover:bg-green-600 text-black shadow-lg shadow-green-900/20'
                          : 'border-border text-green-400 bg-muted hover:text-green-300 hover:bg-muted hover:border-input'
                      )}
                    >
                      {plan.ctaLabel || 'Empezar'}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default PricingComponent;
