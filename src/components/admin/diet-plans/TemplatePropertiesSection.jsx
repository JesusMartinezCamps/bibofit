import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Combobox } from '@/components/ui/combobox';
import RestrictionsManager from './RestrictionsManager';
import { AXIS_OPTIONS_STATIC } from './ClassificationManager';
import { Globe, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TemplatePropertiesSection = ({ plan, creator, onUpdate }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [name, setName] = useState(plan.name);
    const [isSavingName, setIsSavingName] = useState(false);
    const [classifications, setClassifications] = useState({
        objective: plan.classification_objective || [],
        lifestyle: plan.classification_lifestyle || [],
        nutrition_style: plan.classification_nutrition_style || []
    });
    const [dietTypes, setDietTypes] = useState([]);
    const [scope, setScope] = useState(plan.template_scope || 'global');
    const [centerName, setCenterName] = useState('');
    const [userCenterId, setUserCenterId] = useState(null);
    
    // For Admin Center Selection
    const [centersList, setCentersList] = useState([]);
    const [selectedCenterId, setSelectedCenterId] = useState(plan.center_id?.toString() || null);

    const debounceTimeout = useRef(null);

    const isCreator = user?.id === plan.created_by;
    const isAdmin = user?.role === 'admin';
    const canEdit = isAdmin || isCreator;

    // Fetch dynamic data
    useEffect(() => {
        const fetchData = async () => {
            // 1. Diet Types
            const { data: dietData } = await supabase.from('diet_types').select('name').order('name');
            if (dietData) setDietTypes(dietData.map(d => d.name));

            // 2. Admin Logic: Fetch all centers
            if (user?.role === 'admin') {
                const { data: centers } = await supabase.from('centers').select('id, name').order('name');
                setCentersList(centers || []);
                
                // Initialize selected center from plan if exists
                if (plan.center_id) {
                     const currentCenter = centers?.find(c => c.id === plan.center_id);
                     if (currentCenter) setCenterName(currentCenter.name);
                }
            } else {
                // 3. Coach Logic: Fetch own center
                 const { data: centerData } = await supabase.from('user_centers').select('center_id').eq('user_id', user.id).maybeSingle();
                if (centerData) {
                    setUserCenterId(centerData.center_id);
                    
                    if (centerData.center_id) {
                         const { data: cName } = await supabase.from('centers').select('name').eq('id', centerData.center_id).single();
                         if (cName) setCenterName(cName.name);
                    }
                }
            }
        };
        fetchData();
    }, [user, plan.center_id]);

    const saveName = async (newName) => {
        setIsSavingName(true);
        const { error } = await supabase
            .from('diet_plans')
            .update({ name: newName })
            .eq('id', plan.id);

        if (error) {
            toast({ title: 'Error', description: 'No se pudo actualizar el nombre', variant: 'destructive' });
        } else {
            if(onUpdate) onUpdate();
        }
        setIsSavingName(false);
    };

    const handleNameChange = (e) => {
        if (!canEdit) return;
        const newName = e.target.value;
        setName(newName);
        
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            if (newName.trim() !== plan.name) saveName(newName.trim());
        }, 1000);
    };
    
    const handleScopeChange = async (newScope) => {
        if (!canEdit) return;

        if (newScope === 'center' && user.role === 'admin' && !selectedCenterId) {
             // Just update state, don't save yet if no center selected for admin
             setScope(newScope);
             return;
        }
        
        // Determine center ID to save
        let targetCenterId = null;
        if (newScope === 'center') {
            if (user.role === 'admin') targetCenterId = selectedCenterId;
            else targetCenterId = userCenterId;
        }

        await saveScope(newScope, targetCenterId);
    };

    const handleCenterSelect = async (centerId) => {
        if (!canEdit) return;
        setSelectedCenterId(centerId);
        if (scope === 'center') {
            await saveScope('center', centerId);
        }
    };

    const saveScope = async (newScope, targetCenterId) => {
        let updateData = {
            template_scope: newScope,
            center_id: targetCenterId
        };

        const { error } = await supabase
            .from('diet_plans')
            .update(updateData)
            .eq('id', plan.id);

        if (error) {
            toast({ title: 'Error', description: 'No se pudo actualizar el ámbito', variant: 'destructive' });
        } else {
            setScope(newScope);
            if(targetCenterId) {
                 const c = centersList.find(x => x.id.toString() === targetCenterId.toString());
                 if(c) setCenterName(c.name);
            } else {
                setCenterName(''); // Clear center name if scope changed to global
            }
            toast({ title: 'Actualizado', description: `Ámbito actualizado correctamente.` });
            if(onUpdate) onUpdate();
        }
    };

    const handleClassificationChange = async (axis, newValues) => {
        if (!canEdit) return;
        const updatedClassifications = { ...classifications, [axis]: newValues };
        setClassifications(updatedClassifications);

        // Save immediately
        const dbColumnMap = {
            objective: 'classification_objective',
            lifestyle: 'classification_lifestyle',
            nutrition_style: 'classification_nutrition_style'
        };

        const { error } = await supabase
            .from('diet_plans')
            .update({ [dbColumnMap[axis]]: newValues })
            .eq('id', plan.id);

        if (error) {
            toast({ title: 'Error', description: 'No se pudo guardar la clasificación', variant: 'destructive' });
        }
    };

    const getOptions = (axis) => {
        if (axis === 'nutrition_style') return dietTypes;
        return AXIS_OPTIONS_STATIC[axis] || [];
    };

    const axisConfig = [
        { key: 'objective', label: 'Objetivo' },
        { key: 'lifestyle', label: 'Estilo de Vida' },
        { key: 'nutrition_style', label: 'Estilo Nutricional' }
    ];

    return (
        <Card className="bg-slate-900/50 border-gray-700 text-white">
            <CardHeader>
                <CardTitle className="text-xl font-bold text-green-400 flex items-center gap-2">
                    Propiedades de la Dieta
                    {isSavingName && <span className="text-xs font-normal text-gray-500 animate-pulse ml-auto">Guardando...</span>}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Name Input */}
                    <div className="md:col-span-2 space-y-2">
                        <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nombre de la Plantilla</Label>
                        <Input 
                            value={name} 
                            onChange={handleNameChange} 
                            disabled={!canEdit}
                            className="bg-[#0F1627] border-gray-700 text-lg font-medium disabled:opacity-70"
                            placeholder="Ej: Hipertrofia Avanzada..."
                        />
                         {creator && (
                            <p className="text-xs text-gray-500 pt-1">
                                {isCreator ? 'Creado por ti' : `Creado por: ${creator.full_name}`}
                            </p>
                        )}
                    </div>

                    {/* Scope Selector */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ámbito</Label>
                        
                        {canEdit ? (
                             <div className="space-y-2">
                                <div className="flex bg-[#0F1627] rounded-lg border border-gray-700 p-1">
                                    <button
                                        type="button"
                                        onClick={() => handleScopeChange('global')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md text-sm font-medium transition-all ${
                                            scope === 'global' 
                                            ? 'bg-blue-900/40 text-blue-400 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                        Global
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleScopeChange('center')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md text-sm font-medium transition-all ${
                                            scope === 'center' 
                                            ? 'bg-amber-900/40 text-amber-400 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        <Building2 className="w-3.5 h-3.5" />
                                        Centro
                                    </button>
                                </div>
                                {scope === 'center' && user.role === 'admin' && (
                                    <Select value={selectedCenterId || ''} onValueChange={handleCenterSelect}>
                                        <SelectTrigger className="bg-[#0F1627] border-gray-700 h-9 text-xs">
                                            <SelectValue placeholder="Seleccionar centro..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                                            {centersList.map(center => (
                                                <SelectItem key={center.id} value={center.id.toString()}>
                                                    {center.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {scope === 'center' && user.role !== 'admin' && (
                                     <p className="text-xs text-gray-500 text-center">Asignado a: {centerName || 'Tu centro'}</p>
                                )}
                             </div>
                        ) : (
                             // Read-only for non-creators/non-admins
                             <div className="flex bg-[#0F1627] rounded-lg border border-gray-700 p-2 items-center justify-center gap-2 text-gray-400">
                                 {scope === 'global' ? <Globe className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                                 <span className="text-sm font-medium">
                                     {scope === 'global' ? 'Global' : (centerName || 'Centro')}
                                 </span>
                             </div>
                        )}
                    </div>
                </div>

                {/* Classification Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {axisConfig.map(axis => (
                        <div key={axis.key} className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">{axis.label}</Label>
                            <Combobox
                                options={getOptions(axis.key).map(opt => ({ value: opt, label: opt }))}
                                selectedValues={classifications[axis.key]}
                                onSelectedValuesChange={(vals) => handleClassificationChange(axis.key, vals)}
                                placeholder="Seleccionar..."
                                searchPlaceholder={`Buscar ${axis.label.toLowerCase()}...`}
                                triggerClassName="bg-[#0F1627] border-gray-700 w-full"
                                showSelectedBadges={true}
                                disabled={!canEdit}
                            />
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-800 my-4"></div>

                {/* Restrictions embedded */}
                <RestrictionsManager 
                    entityId={plan.id} 
                    entityType="diet_plans" 
                    onUpdate={onUpdate} 
                    hideHeader={true}
                    readOnly={!canEdit}
                />
            </CardContent>
        </Card>
    );
};

export default TemplatePropertiesSection;