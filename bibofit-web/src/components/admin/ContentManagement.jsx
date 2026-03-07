import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Egg, Wheat, Leaf, Droplets, Dna, Bot, Store, BookCopy, LayoutGrid, Dumbbell, Activity, ShieldAlert, UtensilsCrossed, Users, Building, ArrowLeftRight, CreditCard, Link2 } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuth } from '@/contexts/AuthContext';

const ContentButton = ({ icon: Icon, title, to, hasPending, count, disabled }) => {
    const navigate = useNavigate();
    if (disabled) return null;

    return (
        <button
            onClick={() => navigate(to)}
            className="relative flex w-full items-center gap-3 px-3 py-2.5 min-h-[46px] text-left bg-gradient-to-r from-indigo-800/45 via-slate-900/85 to-cyan-950/80 border-cyan-900/30 border-x border-b first:border-t shadow-sm transition-all duration-300 ease-out hover:from-indigo-800/70 hover:via-cyan-950/80 hover:to-cyan-900/80 hover:border-cyan-600/40 group rounded-none first:rounded-t-xl last:rounded-b-xl md:flex-col md:items-center md:justify-center md:p-6 md:text-center md:min-h-[170px] md:bg-gradient-to-br md:from-indigo-800/50 md:via-slate-850 md:to-cyan-950 md:rounded-xl md:border md:shadow-lg md:hover:shadow-cyan-500/20"

        >
            <Icon className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform md:w-10 md:h-10 md:mb-3 md:text-cyan-500" />
            <span className="text-white font-semibold text-sm leading-tight flex-1 md:flex-none md:text-base">{title}</span>
            {hasPending && (
                <div className="absolute top-2 right-2 md:top-3 md:right-3">
                     <span className="relative flex h-4 w-4 md:h-5 md:w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 md:h-5 md:w-5 bg-purple-500 text-[9px] md:text-[10px] text-white font-bold items-center justify-center">
                          {count > 9 ? '9+' : count}
                      </span>
                    </span>
                </div>
            )}
        </button>
    );
};

const ContentSection = ({ title, children }) => (
    <section className="space-y-2 md:space-y-4">
        <h2 className="text-lg md:text-2xl font-bold text-white">
            {title}
        </h2>
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {children}
        </div>
    </section>
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
        <div className="p-2 sm:p-3 md:p-8 text-white max-w-7xl mx-auto">
            <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-8 border-b border-border pb-2 md:pb-4">
                Gestión de Contenidos
            </h1>

            <div className="space-y-3 md:space-y-10">
                <ContentSection title="Creación y Solicitudes">
                <ContentButton icon={Utensils} title="Alimentos de la App" to={getLink("/admin/create-food")} />
                <ContentButton icon={BookCopy} title="Plantillas de Recetas" to={getLink("/admin/create-recipe")} />
                {(isAdmin || isCoach) && (
                    <ContentButton icon={LayoutGrid} title="Gestión Global de Plantillas de Dietas" to="/admin-panel/content/plan-templates" />
                )}
                
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
                </ContentSection>
                
                <ContentSection title="Bases de Datos de Nutrientes">
                <ContentButton icon={Dna} title="Gestionar Aminogramas" to={getLink("/admin/manage-aminograms")} />
                <ContentButton icon={Leaf} title="Gestionar Antioxidantes" to={getLink("/admin/manage-antioxidants")} />
                <ContentButton icon={Droplets} title="Gestionar Tipos de Grasa" to={getLink("/admin/manage-fat-types")} />
                <ContentButton icon={Bot} title="Gestionar Tipos de Carbohidrato" to={getLink("/admin/manage-carb-types")} />
                
                {!isCoach && <ContentButton icon={Store} title="Gestionar Tiendas" to={getLink("/admin/manage-stores")} />}
                </ContentSection>

                {isAdmin && (
                    <>
                        <ContentSection title="Organización">
                        <ContentButton icon={Building} title="Gestión de Centros" to="/admin-panel/content/centers" />
                        <ContentButton icon={Users} title="Gestor de Usuarios" to="/admin-panel/content/users-manager" />
                        <ContentButton icon={CreditCard} title="Planes y Suscripciones" to="/admin-panel/content/pricing" />
                        <ContentButton icon={Link2} title="Generar Link de Invitación" to="/admin-panel/content/invitation-links" />
                        </ContentSection>

                        <ContentSection title="Seguridad">
                        <ContentButton icon={ShieldAlert} title="Gestor de Restricciones" to="/admin-panel/content/food-restrictions" />
                        <ContentButton icon={ArrowLeftRight} title="Normas de Sustitución" to="/admin-panel/content/food-substitutions" />
                        </ContentSection>
                    </>
                )}

                <ContentSection title="Entrenamiento">
                <ContentButton icon={Dumbbell} title="Crear/Editar Ejercicios" to={getLink("/admin/create-exercise")} />
                <ContentButton icon={Activity} title="Crear/Editar Rutinas" to={getLink("/admin/create-routine")} />
                </ContentSection>
            </div>
        </div>
    );
};

export default ContentManagement;
