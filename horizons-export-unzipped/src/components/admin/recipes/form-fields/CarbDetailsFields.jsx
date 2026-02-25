import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CarbDetailsFields = ({ allSubtypes, selectedSubtypeIds, carbData, onCarbDataChange }) => {
    
    const getSubtypeName = (id) => allSubtypes.find(s => s.id === id)?.name || 'Subtipo desconocido';

    return (
        <div className="space-y-6">
            {selectedSubtypeIds.map((subtypeId) => {
                const data = carbData.find(d => d.subtype_id === subtypeId) || {};
                return (
                    <div key={subtypeId} className="p-4 bg-gray-900/40 rounded-lg border border-gray-700">
                        <h5 className="font-semibold text-green-400 mb-4">{getSubtypeName(subtypeId)}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor={`grams_per_100g_${subtypeId}`}>g / 100g</Label>
                                <Input
                                    id={`grams_per_100g_${subtypeId}`}
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={data.grams_per_100g || ''}
                                    onChange={(e) => onCarbDataChange(subtypeId, 'grams_per_100g', e.target.value)}
                                    placeholder="0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`percent_added_sugars_${subtypeId}`}>% Azúcares Añadidos</Label>
                                <Input
                                    id={`percent_added_sugars_${subtypeId}`}
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={data.percent_added_sugars || ''}
                                    onChange={(e) => onCarbDataChange(subtypeId, 'percent_added_sugars', e.target.value)}
                                    placeholder="0.0"
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor={`nature_${subtypeId}`}>Naturaleza</Label>
                                <Select
                                    value={data.nature || 'Natural'}
                                    onValueChange={(value) => onCarbDataChange(subtypeId, 'nature', value)}
                                >
                                    <SelectTrigger id={`nature_${subtypeId}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Natural">Natural</SelectItem>
                                        <SelectItem value="Añadido">Añadido</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`form_${subtypeId}`}>Forma</Label>
                                 <Select
                                    value={data.form || 'Libre'}
                                    onValueChange={(value) => onCarbDataChange(subtypeId, 'form', value)}
                                >
                                    <SelectTrigger id={`form_${subtypeId}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Libre">Libre</SelectItem>
                                        <SelectItem value="Ligada en matriz vegetal">Ligada en matriz vegetal</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CarbDetailsFields;