import React from 'react';
import PricingComponent from '@/components/shared/PricingComponent';
import { PRICING_PRODUCT_AREAS } from '@/lib/pricingService';

const PricingPreview = () => {
    return (
        <div className="bg-background">
            <PricingComponent productArea={PRICING_PRODUCT_AREAS.NUTRITION} />
        </div>
    );
};

export default PricingPreview;
