import React, { useEffect, useState } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { motion } from 'framer-motion';
    import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
    import { Loader2, Heart, Utensils, Dumbbell, Sun, MessageSquare, ChevronDown } from 'lucide-react';
    import DetailItem from '@/components/profile/DetailItem';
    import MetabolismCard from '@/components/profile/MetabolismCard';
    import { cn } from '@/lib/utils';
    import { Link } from 'react-router-dom';
    import { calculateAge, calculateAndSaveMetabolism } from '@/lib/metabolismCalculator';
    import { format } from 'date-fns';
    import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
    
    const ProfileView = ({ userId, className, isAdminView = false, refreshKey }) => {
      const [profile, setProfile] = useState(null);
      const [dietPrefs, setDietPrefs] = useState(null);
      const [trainingPrefs, setTrainingPrefs] = useState(null);
      const [sensitivities, setSensitivities] = useState([]);
      const [utilities, setUtilities] = useState([]);
      const [preferredFoods, setPreferredFoods] = useState([]);
      const [nonPreferredFoods, setNonPreferredFoods] = useState([]);
      const [dayMeals, setDayMeals] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      
      const todayDateString = format(new Date(), 'yyyy-MM-dd');
    
      useEffect(() => {
        const fetchClientData = async () => {
          if (!userId) {
            setLoading(false);
            setError('No se ha proporcionado un ID de usuario.');
            return;
          }
          setLoading(true);
          setError(null);
          // Reset state on user change
          setProfile(null);
          setDietPrefs(null);
          setTrainingPrefs(null);
          setDayMeals([]);

          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select(`
                *,
                activity_levels(name, description, factor)
              `)
              .eq('user_id', userId)
              .single();
            
            if (profileError && profileError.code !== 'PGRST116') throw profileError;
            if (!profileData) {
              setError('No se encontró el perfil para este usuario.');
              setLoading(false);
              return;
            }
    
            if (profileData.current_weight_kg && profileData.height_cm && profileData.birth_date && profileData.sex) {
              const metabolismResult = await calculateAndSaveMetabolism(userId, profileData);
              if (metabolismResult.success) {
                profileData.ger_kcal = metabolismResult.ger;
                profileData.tdee_kcal = metabolismResult.tdee;
              }
            }
    
            setProfile(profileData);
    
            const { data: dayMealsData, error: dayMealsError } = await supabase
              .from('user_day_meals')
              .select('*, day_meals(name)')
              .eq('user_id', userId)
              .order('display_order', { foreignTable: 'day_meals', ascending: true });
            if (dayMealsError) console.error("Day Meals Error:", dayMealsError);
            else setDayMeals(dayMealsData);
    
            const { data: dietData, error: dietError } = await supabase.from('diet_preferences').select('*, diet_types(name)').eq('user_id', userId).maybeSingle();
            if (dietError && dietError.code !== 'PGRST116') console.error("Diet Prefs Error:", dietError);
            else setDietPrefs(dietData);
    
            const { data: trainingData, error: trainingError } = await supabase.from('training_preferences').select('*').eq('user_id', userId).maybeSingle();
            if (trainingError && trainingError.code !== 'PGRST116') console.error("Training Prefs Error:", trainingError);
            else setTrainingPrefs(trainingData);
    
            const { data: userSensitivitiesData, error: userSensitivitiesError } = await supabase.from('user_sensitivities').select('sensitivities(name)').eq('user_id', userId);
            if (userSensitivitiesError) console.error("User Sensitivities Error:", userSensitivitiesError);
            else {
                setSensitivities(userSensitivitiesData.map(s => s.sensitivities.name));
            }
    
            const { data: userUtilitiesData, error: userUtilitiesError } = await supabase.from('user_utilities').select('utility_id').eq('user_id', userId);
            if (userUtilitiesError) console.error("User Utilities Error:", userUtilitiesError);
            else {
              const utilityIds = userUtilitiesData.map(u => u.utility_id);
              if (utilityIds.length > 0) {
                const { data: utilityNames, error: utilityNamesError } = await supabase.from('utilities').select('name').in('id', utilityIds);
                if (utilityNamesError) console.error("Utility Names Error:", utilityNamesError);
                else setUtilities(utilityNames.map(u => u.name));
              } else {
                setUtilities([]);
              }
            }
    
            const { data: preferredFoodsData, error: preferredFoodsError } = await supabase
              .from('preferred_foods')
              .select('food(name)')
              .eq('user_id', userId);
            if (preferredFoodsError) console.error("Preferred Foods Error:", preferredFoodsError);
            else setPreferredFoods(preferredFoodsData.map(pf => pf.food.name));
    
            const { data: nonPreferredFoodsData, error: nonPreferredFoodsError } = await supabase
              .from('non_preferred_foods')
              .select('food(name)')
              .eq('user_id', userId);
            if (nonPreferredFoodsError) console.error("Non-Preferred Foods Error:", nonPreferredFoodsError);
            else setNonPreferredFoods(nonPreferredFoodsData.map(npf => npf.food.name));
    
          } catch (e) {
            console.error('Error fetching client data:', e);
            setError('Ocurrió un error al cargar los datos del usuario.');
          } finally {
            setLoading(false);
          }
        };
        
        fetchClientData();
      }, [userId, refreshKey]);
    
      if (loading) {
        return (
          <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-[#9B4467]" />
          </div>
        );
      }
    
      if (error) {
        return <div className="text-center text-red-400 p-8"><p>{error}</p></div>;
      }
    
      const SectionTitle = ({ children, to, isAction, colorClass, Icon, isCollapsible = false }) => {
        const content = (
            <div className="flex items-center text-2xl font-bold">
                <Icon className={cn("mr-3 h-6 w-6", colorClass)} />
                <span className="pb-1 border-b-2" style={{ borderColor: isAction ? 'transparent' : colorClass.replace('text-', '') }}>
                    {children}
                </span>
                {isCollapsible && <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />}
            </div>
        );
    
        if (isAction) {
            return (
                <Link to={to} className={cn("inline-block border-b-2 transition-colors", colorClass, `border-${colorClass.split('-')[1]}-500 hover:text-${colorClass.split('-')[1]}-400`)}>
                    {content}
                </Link>
            );
        }
        
        return <div className={cn('border-b-2', `border-${colorClass.split('-')[1]}-500`)}>{content}</div>;
    };
    
      const age = calculateAge(profile?.birth_date);
      
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <Card className={cn("w-full mx-auto bg-[#1a1e23] border-gray-700 text-white shadow-2xl shadow-[#9B4467]/10", className)}>
            <CardHeader className="text-center border-b border-gray-700 pb-6">
              <CardTitle className="text-4xl font-bold text-white">{profile?.full_name}</CardTitle>
              <CardDescription className="text-gray-400 font-small text-md">Toda la información en un único lugar.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              
              <div className="mb-8">
                <MetabolismCard 
                  ger={profile?.ger_kcal} 
                  tdee={profile?.tdee_kcal} 
                />
              </div>
    
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <Collapsible className="lg:col-span-1 lg:block space-y-4 group" defaultOpen={true}>
                  <CollapsibleTrigger className="w-full lg:hidden">
                    <SectionTitle colorClass="text-[#9B4467]" Icon={Heart} isCollapsible={true}>Datos Personales</SectionTitle>
                  </CollapsibleTrigger>
                  <div className="hidden lg:block pb-2">
                    <SectionTitle colorClass="text-[#9B4467]" Icon={Heart}>Datos Personales</SectionTitle>
                  </div>
                  <CollapsibleContent className="space-y-4 lg:block">
                    <DetailItem label="Nombre Completo" value={profile?.full_name} />
                    <DetailItem label="Email" value={profile?.email} />
                    <DetailItem label="Teléfono" value={profile?.phone} />
                    <DetailItem label="Sexo" value={profile?.sex} />
                    <DetailItem label="Edad" value={age ? `${age} años` : null} />
                    <DetailItem label="Altura" value={profile?.height_cm ? `${profile.height_cm} cm` : null} />
                    <DetailItem label="Peso Actual" value={profile?.current_weight_kg ? `${profile.current_weight_kg} kg` : null} />
                    <DetailItem label="Peso Objetivo" value={profile?.goal_weight_kg ? `${profile.goal_weight_kg} kg` : null} />
                    <DetailItem label="Nivel de Actividad" value={profile?.activity_levels?.name} />
                  </CollapsibleContent>
                </Collapsible>
    
                <Collapsible className="lg:col-span-1 lg:block space-y-4 group" defaultOpen={true}>
                  <CollapsibleTrigger className="w-full lg:hidden">
                    <SectionTitle 
                      to={`/plan/dieta/${userId}/${todayDateString}`}
                      isAction={isAdminView} 
                      colorClass="text-[#5ebe7d]" 
                      Icon={Utensils}
                      isCollapsible={true}
                    >
                      Preferencias de Dieta
                    </SectionTitle>
                  </CollapsibleTrigger>
                  <div className="hidden lg:block pb-2">
                    <SectionTitle 
                      to={`/plan/dieta/${userId}/${todayDateString}`}
                      isAction={isAdminView} 
                      colorClass="text-[#5ebe7d]" 
                      Icon={Utensils}
                    >
                      Preferencias de Dieta
                    </SectionTitle>
                  </div>
                  <CollapsibleContent className="space-y-4 lg:block">
                    {dietPrefs ? <>
                      <DetailItem label="Objetivo Principal" value={dietPrefs.diet_goal} />
                      <DetailItem label="Tipo de Dieta" value={dietPrefs.diet_types?.name} />
                      <DetailItem label="Sensibilidades" value={sensitivities.length > 0 ? sensitivities.join(', ') : 'Ninguna'} />
                      <div className="space-y-2 pt-2">
                        <h4 className="text-sm font-semibold text-gray-400 flex items-center"><Sun className="w-4 h-4 mr-2 text-yellow-400"/>Comidas del Día</h4>
                        {dayMeals.length > 0 ? (
                          <div className="p-3 bg-gray-800/50 rounded-lg space-y-3">
                            {dayMeals.map(meal => (
                              <div key={meal.day_meal_id}>
                                <p className="font-semibold text-gray-200">{meal.day_meals.name}</p>
                                {meal.preferences && (
                                    <div className="flex items-start text-xs text-gray-400 mt-1 pl-2 border-l-2 border-gray-600">
                                      <MessageSquare className="w-3 h-3 mr-2 mt-0.5 flex-shrink-0"/>
                                      <p className="italic">{meal.preferences}</p>
                                    </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-gray-500">No se han configurado las comidas del día.</p>}
                      </div>
                    </> : <p className="text-gray-400">No se han especificado preferencias de dieta.</p>}
                  </CollapsibleContent>
                </Collapsible>
                
                <Collapsible className="lg:col-span-1 lg:block space-y-4 group" defaultOpen={true}>
                  <CollapsibleTrigger className="w-full lg:hidden">
                    <SectionTitle 
                      to={`/admin/manage-training/${userId}`} 
                      isAction={isAdminView} 
                      colorClass="text-[#F44C40]"
                      Icon={Dumbbell}
                      isCollapsible={true}
                    >
                      Preferencias de Entreno
                    </SectionTitle>
                  </CollapsibleTrigger>
                  <div className="hidden lg:block pb-2">
                    <SectionTitle 
                      to={`/admin/manage-training/${userId}`} 
                      isAction={isAdminView} 
                      colorClass="text-[#F44C40]"
                      Icon={Dumbbell}
                    >
                      Preferencias de Entreno
                    </SectionTitle>
                  </div>
                  <CollapsibleContent className="space-y-4 lg:block">
                    {trainingPrefs ? <>
                      <DetailItem label="Sesiones por Semana" value={trainingPrefs.sessions_per_week} />
                      <DetailItem label="Objetivo de Entrenamiento" value={trainingPrefs.training_goal} />
                      <DetailItem label="Molestias / Lesiones" value={trainingPrefs.discomforts} />
                      <DetailItem label="Lugar de Entrenamiento" value={trainingPrefs.training_location} />
                    </> : <p className="text-gray-400">No se han especificado preferencias de entrenamiento.</p>}
                  </CollapsibleContent>
                </Collapsible>
    
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    };
    
    export default ProfileView;