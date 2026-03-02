import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getFallbackPricingPlans, getPricingPlans } from '@/lib/pricingService';

const PERIOD_LABEL = {
  monthly: '/mes',
  one_time: 'pago unico',
};

const PricingComponent = ({ showTitle = true, className, surface = 'home' }) => {
  const [plans, setPlans] = useState(getFallbackPricingPlans());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchPlans = async () => {
      try {
        const data = await getPricingPlans({ surface });
        if (!cancelled && data.length > 0) {
          setPlans(data);
        }
      } catch (error) {
        console.error('[PricingComponent] Failed to fetch pricing plans:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPlans();

    return () => {
      cancelled = true;
    };
  }, [surface]);

  const visiblePlans = useMemo(() => plans.filter((plan) => plan.isActive !== false), [plans]);

  return (
    <section id="pricing" className={cn('py-12 bg-transparent', className)}>
      <div className="container mx-auto px-4 md:px-6">
        {showTitle && (
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Planes flexibles</h2>
            <p className="text-muted-foreground">Comienza gratis y escala a medida que crece tu negocio.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          </div>
        ) : (
          <div className={cn('grid gap-8 max-w-6xl mx-auto', visiblePlans.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
            {visiblePlans.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  'bg-[#15191e] border-border flex flex-col relative transition-all duration-300 hover:border-border',
                  plan.isPopular && 'border-green-500/50 shadow-2xl shadow-green-900/10 transform md:-translate-y-4 z-10'
                )}
              >
                {plan.isPopular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Badge className="bg-green-500 text-black hover:bg-green-600 px-4 py-1">Mas Popular</Badge>
                  </div>
                )}

                <CardHeader>
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <div className="text-3xl font-bold text-white mt-2">
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
                          <X className="h-5 w-5 text-gray-600 flex-shrink-0" />
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
