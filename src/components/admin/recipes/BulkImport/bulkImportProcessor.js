import { supabase } from '@/lib/supabaseClient';

export const validateData = (data) => {
  const errors = [];
  if (!Array.isArray(data)) {
    errors.push({ item: null, message: 'El archivo JSON debe contener un array de alimentos.' });
    return errors;
  }

  data.forEach((food, index) => {
    if (!food.name) {
      errors.push({ item: food, message: `El alimento en el índice ${index} no tiene nombre.` });
    }
  });

  return errors;
};

export const processAndImportFoods = async (foods) => {
  const success = [];
  const errors = [];

  for (const foodData of foods) {
    try {
      // Aquí iría la lógica completa para buscar y mapear relaciones
      // (food_groups, season, store, etc.) por nombre y obtener sus IDs.
      // Por simplicidad, este ejemplo asume que los datos ya vienen con IDs
      // o que se pueden insertar directamente.

      const { name, food_unit, proteins, ...otherData } = foodData;

      const payload = {
        name,
        food_unit: food_unit || 'gramos',
        proteins: proteins ? parseFloat(proteins) : null,
        // Mapear otros campos si es necesario
      };

      // Comprobar si el alimento ya existe
      let { data: existingFood, error: findError } = await supabase
        .from('food')
        .select('id')
        .eq('name', name)
        .single();

      if (findError && findError.code !== 'PGRST116') { // 'PGRST116' es "queried row does not exist"
        throw new Error(`Error buscando el alimento: ${findError.message}`);
      }

      if (existingFood) {
        // Actualizar alimento existente
        const { error: updateError } = await supabase
          .from('food')
          .update(payload)
          .eq('id', existingFood.id);
        if (updateError) throw updateError;
      } else {
        // Insertar nuevo alimento
        const { error: insertError } = await supabase
          .from('food')
          .insert(payload);
        if (insertError) throw insertError;
      }
      
      // Aquí también se manejarían las tablas de unión (food_vitamins, food_minerals, etc.)

      success.push({ name: foodData.name });
    } catch (error) {
      errors.push({ item: foodData, error: error.message });
    }
  }

  return { success, errors };
};