import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Egg, Wheat, Fish, Leaf, Droplets, Dna, Bot, Store, BookCopy, LayoutGrid, Dumbbell, Activity, ShieldAlert, UtensilsCrossed, Users, Building } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuth } from '@/contexts/AuthContext';

const ContentButton = ({ icon: Icon, title, to, hasPending, count, disabled }) => {
    const navigate = useNavigate();
    if (disabled) return null;

    return (
        <button
            onClick={() => navigate(to)}
            className="relative flex flex-col items-center justify-center p-6 w-full text-center rounded-xl bg-gradient-to-br from-slate-900 via-slate-850 to-emerald-950 border border-emerald-900/30 shadow-lg transition-all duration-500 ease-out hover:from-slate-800 hover:via-emerald-950 hover:to-emerald-900 hover:border-emerald-600/40 hover:shadow-emerald-500/20 group"

        >
            <Icon className="w-10 h-10 mb-3 text-green-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold">{title}</span>
            {hasPending && (
                <div className="absolute top-3 right-3">
                     <span className="relative flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-purple-500 text-[10px] text-white font-bold items-center justify-center">
                          {count > 9 ? '9+' : count}
                      </span>
                    </span>
                </div>
            )}
        </button>
    );
};

const SectionHeader = ({ title, visible = true }) => (
    visible ? (
        <h2
            className="text-2xl font-bold mb-4 text-green-300 col-span-1 md:col-span-2 lg:col-span-3 mt-4 first:mt-0"
        >
            {title}
        </h2>
    ) : null
);

const ContentManagement = () => {
    // Destructure counts from context
    const { pendingFoodCount, pendingFreeRecipeCount, pendingDietChangeCount } = useNotifications();
    
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const isCoach = user?.role === 'coach';

    const getLink = (path) => {
        if (isCoach && !path.startsWith('/coach')) {
             if (path.startsWith('/admin/')) return path.replace('/admin/', '/coach/');
        }
        return path;
    }

    return (
        <div className="p-4 md:p-8 text-white max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-8 border-b border-gray-700 pb-4">
                Gestión de Contenidos
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SectionHeader title="Creación y Solicitudes" />
                <ContentButton icon={Utensils} title="Alimentos de la App" to={getLink("/admin/create-food")} />
                <ContentButton icon={BookCopy} title="Plantillas de Recetas" to={getLink("/admin/create-recipe")} />
                {(isAdmin || isCoach) && <ContentButton icon={LayoutGrid} title="Gestión Global de Plantillas de Dietas" to="/admin-panel/content/plan-templates" />}
                
                {/* Requests Buttons with badges */}
                {(isAdmin || isCoach) && (
                    <>
                        {isAdmin && (
                            <ContentButton 
                                icon={Egg} 
                                title="Solicitudes de Alimentos" 
                                to="/admin-panel/content/food-requests" 
                                hasPending={pendingFoodCount > 0} 
                                count={pendingFoodCount}
                            />
                        )}
                        <ContentButton 
                            icon={UtensilsCrossed} 
                            title="Solicitudes de Recetas Libres" 
                            to="/admin-panel/content/free-recipe-requests" 
                            hasPending={pendingFreeRecipeCount > 0} 
                            count={pendingFreeRecipeCount}
                        />
                        <ContentButton 
                            icon={Wheat} 
                            title="Solicitudes de Cambios de Recetas" 
                            to="/admin-panel/content/diet-requests" 
                            hasPending={pendingDietChangeCount > 0}
                            count={pendingDietChangeCount}
                        />
                    </>
                )}
                
                <SectionHeader title="Bases de Datos de Nutrientes" />
                <ContentButton icon={Dna} title="Gestionar Aminogramas" to={getLink("/admin/manage-aminograms")} />
                <ContentButton icon={Leaf} title="Gestionar Antioxidantes" to={getLink("/admin/manage-antioxidants")} />
                <ContentButton icon={Droplets} title="Gestionar Tipos de Grasa" to={getLink("/admin/manage-fat-types")} />
                <ContentButton icon={Bot} title="Gestionar Tipos de Carbohidrato" to={getLink("/admin/manage-carb-types")} />
                
                {!isCoach && <ContentButton icon={Store} title="Gestionar Tiendas" to={getLink("/admin/manage-stores")} />}

                {isAdmin && (
                    <>
                        <SectionHeader title="Organización" />
                        <ContentButton icon={Building} title="Gestión de Centros" to="/admin-panel/content/centers" />
                        <ContentButton icon={Users} title="Gestor de Usuarios" to="/admin-panel/content/users-manager" />

                        <SectionHeader title="Seguridad" />
                        <ContentButton icon={ShieldAlert} title="Gestor de Restricciones" to="/admin-panel/content/food-restrictions" />
                    </>
                )}

                <SectionHeader title="Entrenamiento" />
                <ContentButton icon={Dumbbell} title="Crear/Editar Ejercicios" to={getLink("/admin/create-exercise")} />
                <ContentButton icon={Activity} title="Crear/Editar Rutinas" to={getLink("/admin/create-routine")} />

            </div>
        </div>
    );
};

export default ContentManagement;