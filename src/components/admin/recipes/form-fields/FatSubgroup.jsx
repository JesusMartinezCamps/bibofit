import React from 'react';
import { Label } from '@/components/ui/label';
import FatInputRow from './FatInputRow';
import { cn } from '@/lib/utils';

const FatSubgroup = ({ title, fatTypes, breakdown, onChange, isFirstRow = false }) => {
    const gridColsClass = fatTypes.length === 2 ? 'grid-cols-2' : fatTypes.length === 1 ? 'grid-cols-1 justify-center' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    
    return (
        <div className="macro-subgroup">
            {title && <Label className="text-gray-300 mb-4 block px-4">{title}</Label>}
            <div className={cn("px-4 grid gap-x-6 gap-y-4", gridColsClass)}>
                {fatTypes.map(type => (
                    <FatInputRow
                        key={type.id}
                        type={type}
                        value={breakdown[type.id] || ''}
                        onChange={(value) => onChange('fatType', type.id, value)}
                    />
                ))}
            </div>
        </div>
    );
};

export default FatSubgroup;