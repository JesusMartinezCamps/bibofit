import { supabase } from '@/lib/supabaseClient';

    export const loadFoodForEditing = async (foodId, setFormState, toast, isClientRequest) => {
        const query = supabase
            .from('food')
            .select(`
                *,
                food_to_food_groups(food_group_id),
                food_to_macro_roles(macro_role_id),
                food_to_seasons(season_id),
                food_to_stores(store_id),
                food_sensitivities(sensitivity_id),
                food_medical_conditions(condition_id, relation_type),
                food_antioxidants(antioxidant_id),
                food_vitamins(vitamin_id, mg_per_100g),
                food_minerals(mineral_id, mg_per_100g),
                food_aminograms(aminogram_id, mg_per_100g),
                food_aminogram_properties(aminogram_id, property_type),
                food_fats(fat_type_id, grams),
                food_to_carb_subtypes(subtype_id, grams_per_100g, classification_id),
                food_carbs(carb_type_id, grams),
                food_fat_classification(fat_classification_id, grams),
                food_carb_classification(classification_id, grams)
            `)
            .eq('id', foodId)
            .single();


        let { data, error } = await query;

        if (error) {
            toast({
                title: 'Error de carga',
                description: `Error al cargar los datos del alimento: ${error.message}`,
                variant: 'destructive'
            });
            throw error;
        }

        if (!data) {
            toast({
                title: 'Error de carga',
                description: `No se encontró el alimento con ID ${foodId}.`,
                variant: 'destructive'
            });
            throw new Error(`Food with id ${foodId} not found.`);
        }
        
        const saltValue = (data.food_minerals || []).find(m => m.mineral_id === 37)?.mg_per_100g; // Assuming 37 is Sodio

        setFormState({
            formData: {
                name: data?.name || '',
                food_unit: data?.food_unit || 'gramos',
                food_url: data?.food_url || '',
                proteins: data?.proteins,
                protein_source_id: data?.protein_source_id,
                total_carbs: data?.total_carbs,
                total_fats: data?.total_fats,
                salt: saltValue ? (saltValue / 400).toFixed(2) : '',
            },
            selectedFoodGroups: (data.food_to_food_groups || []).map(r => r.food_group_id),
            selectedMacroRoles: (data.food_to_macro_roles || []).map(r => r.macro_role_id),
            selectedSeasons: (data.food_to_seasons || []).map(r => r.season_id),
            selectedStores: (data.food_to_stores || []).map(r => r.store_id),
            selectedSensitivities: (data.food_sensitivities || []).map(r => r.sensitivity_id),
            selectedMedicalConditions: (data.food_medical_conditions || []).map(r => ({
                condition_id: r.condition_id,
                relation_type: r.relation_type,
            })),
            selectedAntioxidants: (data.food_antioxidants || []).map(r => r.antioxidant_id),
            selectedVitamins: (data.food_vitamins || []).map(r => ({
                vitamin_id: r.vitamin_id,
                mg_per_100g: r.mg_per_100g,
            })),
            selectedMinerals: (data.food_minerals || []).map(r => ({
                mineral_id: r.mineral_id,
                mg_per_100g: r.mg_per_100g,
            })),
            aminoAcidBreakdown: (data.food_aminograms || []).reduce((acc, r) => {
                acc[r.aminogram_id] = r.mg_per_100g;
                return acc;
            }, {}),
            selectedDominantAminos: (data.food_aminogram_properties || [])
                .filter(r => r.property_type === 'dominant')
                .map(r => r.aminogram_id),
            selectedLimitingAminos: (data.food_aminogram_properties || [])
                .filter(r => r.property_type === 'limiting')
                .map(r => r.aminogram_id),
            fatTypeBreakdown: (data.food_fats || []).reduce((acc, r) => {
                acc[r.fat_type_id] = r.grams;
                return acc;
            }, {}),
            carbSubtypeBreakdown: (data.food_to_carb_subtypes || []).reduce((acc, r) => {
                if (!acc[r.classification_id]) acc[r.classification_id] = {};
                acc[r.classification_id][r.subtype_id] = r.grams_per_100g;
                return acc;
            }, {}),
            manualFatClassificationBreakdown: (data.food_fat_classification || []).reduce((acc, r) => {
                acc[r.fat_classification_id] = r.grams;
                return acc;
            }, {}),
            manualCarbClassificationBreakdown: (data.food_carb_classification || []).reduce((acc, r) => {
                acc[r.classification_id] = r.grams;
                return acc;
            }, {}),
            manualCarbTypeBreakdown: (data.food_carbs || []).reduce((acc, r) => {
                acc[r.carb_type_id] = r.grams;
                return acc;
            }, {}),
        });
    };

    export const saveFoodData = async (isEditing, foodId, formState, allCarbTypes, isClientRequest) => {
      const {
        formData, selectedFoodGroups, selectedMacroRoles, selectedSeasons, selectedStores,
        aminoAcidBreakdown, selectedDominantAminos, selectedLimitingAminos,
        fatTypeBreakdown, fatClassificationBreakdown,
        carbSubtypeBreakdown, carbClassificationBreakdown, carbTypeBreakdown,
        selectedVitamins, selectedMinerals, selectedSensitivities, selectedAntioxidants,
        selectedMedicalConditions, manualCarbTypeBreakdown, manualFatClassificationBreakdown, manualCarbClassificationBreakdown
      } = formState;

      // Unified food creation/editing for admin and client requests
      
      const updatedFormData = { ...formData };
      // We trust formData.total_carbs which comes from the input field (or synced calc).
      // We remove 'salt' as it is not a column in the 'food' table.
      delete updatedFormData.salt;
      
      // Clean up undefined or empty strings for numeric fields if necessary, 
      // although Supabase/Postgres often handles '123' string as number fine.
      // Important: Remove 'id' from object if we are CREATING, let DB handle it.
      // If isEditing is true, we can include ID or just use it in the query matcher (but upsert needs it in body or matcher).
      
      const payload = { ...updatedFormData };
      if (isClientRequest) {
        const { data: authData } = await supabase.auth.getUser();
        payload.user_id = authData?.user?.id || payload.user_id || null;
        payload.status = 'pending';
      }
      if (isEditing) {
        payload.id = foodId;
      } else {
        delete payload.id; 
      }

      const { data: savedFood, error: foodError } = await supabase
        .from('food')
        .upsert(payload)
        .select()
        .single();

      if (foodError) throw foodError;
      const newFoodId = savedFood.id;
      
      const createPromise = async (tableName, data, idField = 'food_id') => {
        // We delete existing relations to ensure clean state (avoiding duplicates or stale relations)
        const { error: deleteError } = await supabase.from(tableName).delete().eq(idField, newFoodId);
        if(deleteError) {
          // PGRST204 = No rows deleted, which is fine.
          if (deleteError.code !== 'PGRST204') {
            throw deleteError;
          }
        }
        
        if (data.length > 0) {
          const { error: insertError } = await supabase.from(tableName).insert(data);
          if (insertError) throw insertError;
        }
      };

      const foodCarbsToSave = Object.entries(manualCarbTypeBreakdown || {})
        .filter(([, grams]) => parseFloat(grams) > 0)
        .map(([typeId, grams]) => ({ food_id: newFoodId, carb_type_id: parseInt(typeId), grams: parseFloat(grams) }));
      
      const foodCarbClassificationsToSave = Object.entries(manualCarbClassificationBreakdown || {})
        .filter(([, grams]) => parseFloat(grams) > 0)
        .map(([classId, grams]) => ({ food_id: newFoodId, classification_id: parseInt(classId), grams: parseFloat(grams) }));
      
      const foodCarbSubtypesToSave = Object.entries(carbSubtypeBreakdown || {})
        .flatMap(([classId, subtypes]) => 
          Object.entries(subtypes)
            .filter(([, grams]) => parseFloat(grams) > 0)
            .map(([subtypeId, grams]) => ({ 
                food_id: newFoodId, 
                subtype_id: parseInt(subtypeId), 
                grams_per_100g: parseFloat(grams), 
                classification_id: parseInt(classId)
            }))
        );
      
      const foodFatsToSave = Object.entries(fatTypeBreakdown || {})
        .filter(([, val]) => parseFloat(val) > 0)
        .map(([id, val]) => ({ food_id: newFoodId, fat_type_id: id, grams: val }));

      const foodFatClassificationToSave = Object.entries(manualFatClassificationBreakdown || {})
        .filter(([, grams]) => parseFloat(grams) > 0)
        .map(([classId, grams]) => ({ food_id: newFoodId, fat_classification_id: parseInt(classId), grams: parseFloat(grams) }));

      const operations = [
        createPromise('food_to_food_groups', selectedFoodGroups.map(id => ({ food_id: newFoodId, food_group_id: id }))),
        createPromise('food_to_macro_roles', selectedMacroRoles.map(id => ({ food_id: newFoodId, macro_role_id: id }))),
        createPromise('food_to_seasons', selectedSeasons.map(id => ({ food_id: newFoodId, season_id: id }))),
        createPromise('food_to_stores', selectedStores.map(id => ({ food_id: newFoodId, store_id: id }))),
        createPromise('food_aminograms', Object.entries(aminoAcidBreakdown).filter(([, val]) => parseFloat(val) > 0).map(([id, val]) => ({ food_id: newFoodId, aminogram_id: id, mg_per_100g: val }))),
        createPromise('food_aminogram_properties', [
          ...selectedDominantAminos.map(id => ({ food_id: newFoodId, aminogram_id: id, property_type: 'dominant' })),
          ...selectedLimitingAminos.map(id => ({ food_id: newFoodId, aminogram_id: id, property_type: 'limiting' }))
        ]),
        createPromise('food_fats', foodFatsToSave),
        createPromise('food_fat_classification', foodFatClassificationToSave),
        createPromise('food_to_carb_subtypes', foodCarbSubtypesToSave),
        createPromise('food_carb_classification', foodCarbClassificationsToSave),
        createPromise('food_carbs', foodCarbsToSave),
        createPromise('food_vitamins', selectedVitamins.filter(v => parseFloat(v.mg_per_100g) > 0).map(v => ({ food_id: newFoodId, vitamin_id: v.vitamin_id, mg_per_100g: v.mg_per_100g }))),
        createPromise('food_minerals', selectedMinerals.filter(m => parseFloat(m.mg_per_100g) > 0).map(m => ({ food_id: newFoodId, mineral_id: m.mineral_id, mg_per_100g: m.mg_per_100g }))),
        createPromise('food_sensitivities', selectedSensitivities.map(id => ({ food_id: newFoodId, sensitivity_id: id }))),
        createPromise('food_medical_conditions', selectedMedicalConditions.map(mc => ({ food_id: newFoodId, condition_id: mc.condition_id, relation_type: mc.relation_type }))),
        createPromise('food_antioxidants', selectedAntioxidants.map(id => ({ food_id: newFoodId, antioxidant_id: id }))),
      ];

      await Promise.all(operations);

      return newFoodId;
    };
