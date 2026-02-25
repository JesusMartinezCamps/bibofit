import React, { useMemo, useState } from 'react';
import { useFoodForm } from '@/components/admin/recipes/hooks/useFoodForm.js';
import { Loader2, ChevronsUpDown, Leaf, Shield, Droplets, Zap, HeartPulse, Info, Scale, BrainCircuit, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import FoodFormSection from './FoodFormSection';
import BasicInfoFields from './form-fields/BasicInfoFields';
import MineralFields from './form-fields/MineralFields';
import VitaminFields from './form-fields/VitaminFields';
import { Combobox } from '@/components/ui/combobox';
import ProteinFields from './form-fields/ProteinFields';
import FatFields from './form-fields/FatFields';
import CarbFields from './form-fields/CarbFields';
import FatsIcon from '@/components/icons/FatsIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import MedicalConditionFields from './form-fields/MedicalConditionFields';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const CreateFoodForm = ({ foodToEdit, onFoodActionComplete, isEditing, isClientRequest }) => {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';
  const isReadOnly = isCoach; // Coaches are read-only for this form in both edit and create contexts within this page
  
  const {
    state,
    formHandlers,
    formState,
    isSubmitting,
    isLoading,
    handleSubmit,
    groupedCarbSubtypes,
    groupedFatTypes,
  } = useFoodForm({ foodToEdit, onFoodActionComplete, isEditing, isClientRequest });

  const {
    allFoodGroups,
    allSeasons,
    allStores,
    allProteinSources,
    allAminograms,
    allFatTypes,
    allFatClassifications,
    allCarbClassifications,
    allCarbTypes,
    allVitamins,
    allMinerals,
    allSensitivities,
    allAntioxidants,
    allMedicalConditions,
    allMacroRoles,
  } = state;

  const [openSections, setOpenSections] = useState({
    details: true,
    macros: true,
    micros: false,
    restrictions: false,
    proteins: false,
    fats: false,
    carbs: false,
    vitamins: false,
    minerals: false,
    antioxidants: false,
    sensitivities: false,
    medical_conditions: false,
  });

  const toggleSection = (sectionId) => {
    setOpenSections(prev => {
      const isOpening = !prev[sectionId];
      const newSections = { ...prev, [sectionId]: isOpening };

      if (sectionId === 'micros' && isOpening) {
        newSections.vitamins = true;
        newSections.minerals = true;
        newSections.antioxidants = true;
      }
      if (sectionId === 'restrictions' && isOpening) {
        newSections.sensitivities = true;
        newSections.medical_conditions = true;
      }

      return newSections;
    });
  };

  const {
    formData,
    manualFatClassificationBreakdown,
    fatClassificationBreakdown,
    fatTypeBreakdown,
    manualCarbTypeBreakdown,
    manualCarbClassificationBreakdown,
    carbTypeBreakdown,
    carbClassificationBreakdown,
    carbSubtypeBreakdown,
    aminoAcidBreakdown,
    selectedVitamins,
    selectedMinerals,
    selectedSensitivities,
    selectedAntioxidants,
    selectedMedicalConditions,
    selectedFoodGroups,
    selectedSeasons,
    selectedStores,
    selectedDominantAminos,
    selectedLimitingAminos,
    selectedMacroRoles,
  } = formState;

  const {
    handleChange,
    handleManualBreakdownChange,
    handleFatTypeChange,
    handleCarbSubtypeChange,
    handleSelectChange,
    setAminoAcidBreakdown,
    setSelectedVitamins,
    setSelectedMinerals,
    setSelectedSensitivities,
    setSelectedAntioxidants,
    setSelectedMedicalConditions,
    setSelectedFoodGroups,
    handleSeasonChange,
    setSelectedStores,
    setSelectedDominantAminos,
    setSelectedLimitingAminos,
    setSelectedMacroRoles,
    handleTotalCarbsSync,
    handleCarbTypeSync,
    handleCarbClassificationSync,
    handleTotalFatsSync,
    handleFatClassificationSync,
  } = formHandlers;

  const isProteinSourceDisabled = useMemo(() => {
    if (selectedFoodGroups.length === 0 || !allFoodGroups) return false;
    const selectedGroupsData = allFoodGroups.filter(fg => selectedFoodGroups.includes(fg.id));
    const proteinSourceIds = new Set(selectedGroupsData.map(fg => fg.protein_source_id).filter(Boolean));
    return proteinSourceIds.size === 1;
  }, [selectedFoodGroups, allFoodGroups]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>;
  }

  const buttonText = isSubmitting 
    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</> 
    : isClientRequest
      ? 'Enviar Solicitud'
      : (isEditing ? 'Actualizar Alimento' : 'Crear Alimento');

  const renderCollapsibleSection = (id, title, icon, borderColor, children) => (
    <Collapsible open={openSections[id]} onOpenChange={() => toggleSection(id)} className={cn('w-full p-4 mt-4 rounded-lg border', borderColor)}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-md p-2 -m-2">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <ChevronsUpDown className={`h-5 w-5 text-gray-400 transition-transform ${openSections[id] ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );

  const shouldDisable = isReadOnly || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Hide top button for coach */}
      {!isReadOnly && <Button type="submit" variant="diet" className="w-full mb-4" disabled={shouldDisable}>{buttonText}</Button>}
      
      <div className={cn(isReadOnly && "pointer-events-none opacity-80")}>
          {renderCollapsibleSection('details', 'Detalles', <Info className="h-6 w-6 text-blue-400" />, 'border-blue-500/50',
            <BasicInfoFields 
              formData={formData} 
              handleChange={handleChange} 
              handleSelectChange={handleSelectChange} 
              foodGroups={allFoodGroups} 
              seasons={allSeasons} 
              stores={allStores}
              macroRoles={allMacroRoles}
              selectedFoodGroups={selectedFoodGroups}
              onSelectedFoodGroupsChange={setSelectedFoodGroups}
              selectedSeasons={selectedSeasons}
              onSelectedSeasonsChange={handleSeasonChange}
              selectedStores={selectedStores}
              onSelectedStoresChange={setSelectedStores}
              selectedMacroRoles={selectedMacroRoles}
              onSelectedMacroRolesChange={setSelectedMacroRoles}
            />
          )}

          {renderCollapsibleSection('macros', 'Macronutrientes', <Scale className="h-6 w-6 mt-4 text-cyan-400" />, 'border-cyan-500/50',
            <>
              <FoodFormSection 
                title="Proteínas" icon={<ProteinIcon className="h-6 w-6 text-red-500" />} borderColor="border-red-500/50" isCollapsible={true} isOpen={openSections.proteins} onToggle={() => toggleSection('proteins')}
                formData={formData} allProteinSources={allProteinSources}
              >
                <ProteinFields formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} allProteinSources={allProteinSources} allAminograms={allAminograms} aminoAcidBreakdown={aminoAcidBreakdown} setAminoAcidBreakdown={setAminoAcidBreakdown} selectedDominantAminos={selectedDominantAminos} onSelectedDominantAminosChange={setSelectedDominantAminos} selectedLimitingAminos={selectedLimitingAminos} onSelectedLimitingAminosChange={setSelectedLimitingAminos} isProteinSourceDisabled={isProteinSourceDisabled} />
              </FoodFormSection>
              <FoodFormSection 
                title="Carbohidratos" icon={<CarbsIcon className="h-6 w-6 text-orange-500" />} borderColor="border-orange-500/50" isCollapsible={true} isOpen={openSections.carbs} onToggle={() => toggleSection('carbs')} formData={formData}
              >
                <CarbFields formData={formData} manualCarbTypeBreakdown={manualCarbTypeBreakdown} manualCarbClassificationBreakdown={manualCarbClassificationBreakdown} carbSubtypeBreakdown={carbSubtypeBreakdown} carbClassificationBreakdown={carbClassificationBreakdown} carbTypeBreakdown={carbTypeBreakdown} onManualBreakdownChange={handleManualBreakdownChange} onSubtypeChange={handleCarbSubtypeChange} allCarbTypes={allCarbTypes} allCarbClassifications={allCarbClassifications} groupedCarbSubtypes={groupedCarbSubtypes} handleTotalCarbsSync={handleTotalCarbsSync} handleCarbTypeSync={handleCarbTypeSync} handleCarbClassificationSync={handleCarbClassificationSync} />
              </FoodFormSection>
              <FoodFormSection 
                title="Grasas" icon={<FatsIcon className="h-6 w-6 text-green-500" />} borderColor="border-green-500/50" isCollapsible={true} isOpen={openSections.fats} onToggle={() => toggleSection('fats')} formData={formData}
              >
                <FatFields formData={formData} manualFatClassificationBreakdown={manualFatClassificationBreakdown} fatClassificationBreakdown={fatClassificationBreakdown} fatTypeBreakdown={fatTypeBreakdown} onManualBreakdownChange={handleManualBreakdownChange} onFatTypeChange={handleFatTypeChange} allFatClassifications={allFatClassifications} groupedFatTypes={groupedFatTypes} setOpenSection={setOpenSections} handleTotalFatsSync={handleTotalFatsSync} handleFatClassificationSync={handleFatClassificationSync} />
              </FoodFormSection>
            </>
          )}

          {renderCollapsibleSection('micros', 'Micronutrientes', <BrainCircuit className="h-6 w-6 text-purple-400" />, 'border-purple-500/50',
            <>
              <FoodFormSection title="Vitaminas" icon={<Zap className="h-5 w-5 text-blue-400" />} borderColor="border-blue-500/50" isCollapsible={true} isOpen={openSections.vitamins} onToggle={() => toggleSection('vitamins')}>
                <VitaminFields allVitamins={allVitamins} selectedVitamins={selectedVitamins} onSelectedVitaminsChange={setSelectedVitamins} />
              </FoodFormSection>
              <FoodFormSection title="Minerales" icon={<Droplets className="h-5 w-5 text-gray-400" />} borderColor="border-gray-500/50" isCollapsible={true} isOpen={openSections.minerals} onToggle={() => toggleSection('minerals')}>
                 <MineralFields allMinerals={allMinerals} selectedMinerals={selectedMinerals} onSelectedMineralsChange={setSelectedMinerals} />
              </FoodFormSection>
              <FoodFormSection title="Antioxidantes" icon={<Leaf className="h-5 w-5 text-purple-400" />} borderColor="border-purple-500/50" isCollapsible={true} isOpen={openSections.antioxidants} onToggle={() => toggleSection('antioxidants')}>
                <Combobox options={allAntioxidants.map(a => ({ value: a.id, label: a.name }))} selectedValues={selectedAntioxidants} onSelectedValuesChange={setSelectedAntioxidants} placeholder="Seleccionar antioxidantes..." searchPlaceholder="Buscar antioxidante..." noResultsText="No se encontraron antioxidantes." keepOptionsOnSelect={true} />
              </FoodFormSection>
            </>
          )}

          {renderCollapsibleSection('restrictions', 'Restricciones', <Flame className="h-6 w-6 text-red-400" />, 'border-red-500/50',
            <>
              <FoodFormSection title="Sensibilidades" icon={<Shield className="h-5 w-5 text-orange-400" />} borderColor="border-orange-500/50" isCollapsible={true} isOpen={openSections.sensitivities} onToggle={() => toggleSection('sensitivities')}>
                <Combobox options={allSensitivities.map(a => ({ value: a.id, label: a.name }))} selectedValues={selectedSensitivities} onSelectedValuesChange={setSelectedSensitivities} placeholder="Seleccionar sensibilidades..." searchPlaceholder="Buscar sensibilidad..." noResultsText="No se encontraron sensibilidades." keepOptionsOnSelect={true} />
              </FoodFormSection>
              <FoodFormSection title="Condiciones Médicas" icon={<HeartPulse className="h-5 w-5 text-red-400" />} borderColor="border-red-500/50" isCollapsible={true} isOpen={openSections.medical_conditions} onToggle={() => toggleSection('medical_conditions')}>
                <MedicalConditionFields allMedicalConditions={allMedicalConditions} selectedMedicalConditions={selectedMedicalConditions} onSelectedMedicalConditionsChange={setSelectedMedicalConditions} />
              </FoodFormSection>
            </>
          )}
      </div>

      {/* Hide bottom button for coach */}
      {!isReadOnly && <Button type="submit" variant="diet" className="w-full" disabled={shouldDisable}>{buttonText}</Button>}
    </form>
  );
};

export default CreateFoodForm;