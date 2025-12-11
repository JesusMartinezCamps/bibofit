import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Egg, Wheat, Fish, Leaf, Droplets, Dna, Bot, Store, Weight, Upload, BookCopy, LayoutGrid, Dumbbell, Activity, ShieldAlert, UtensilsCrossed, Users, Building } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuth } from '@/contexts/AuthContext';

const ContentButton = ({ icon: Icon, title, to, hasPending, disabled }) => {
    const navigate = useNavigate();
    if (disabled) return null;

    return (
        <button
            onClick={() => navigate(to)}
            className="relative flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl hover:bg-slate-800 transition-all duration-300 border border-slate-700/50 shadow-lg hover:shadow-green-500/20 w-full text-center"
        >
            <Icon className="w-10 h-10 mb-3 text-green-400" />
            <span className="text-white font-semibold">{title}</span>
            {hasPending && (
                <span className="absolute top-3 right-3 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
            )}
        </button>
    );
};

const SectionHeader = ({ title, visible = true }) => (
    visible ? (
        <h2
            className="text-2xl font-bold mb-4 text-green-300 col-span-1 md:col-span-2 lg:col-span-3"
        >
            {title}
        </h2>
    ) : null
);

const ContentManagement = () => {
    const { pendingFoodCount, pendingFreeRecipeCount, pendingDietChangeCount } = useNotifications();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const isCoach = user?.role === 'coach';

    // Base path for routes depends on role (if pages are reused but accessed differently)
    // However, the component links usually point to fixed routes.
    // We'll use the /coach/ prefix for routes that we've exposed to coaches in App.jsx

    const getLink = (path) => {
        if (isCoach && !path.startsWith('/coach')) {
             // Map admin paths to coach paths if necessary, or use shared paths
             if (path.startsWith('/admin/')) return path.replace('/admin/', '/coach/');
             if (path.startsWith('/admin-panel/content/')) return path; // These likely need route handling in App.jsx
        }
        return path;
    }

    return (
        <div className="p-4 md:p-8 text-white">
            <h1
                className="text-3xl md:text-4xl font-bold mb-8"
            >
                Gestión de Contenidos
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:col-span-3 gap-6">
                <SectionHeader title="Creación y Solicitudes" />
                <ContentButton icon={Utensils} title={isCoach ? "Alimentos de la App" : "Alimentos de la App"} to={getLink("/admin/create-food")} />
                <ContentButton icon={BookCopy} title={isCoach ? "Plantillas de Recetas" : "Plantillas de Recetas"} to={getLink("/admin/create-recipe")} />
                {(isAdmin || isCoach) && <ContentButton icon={LayoutGrid} title="Gestión Global de Plantillas de Dietas" to="/admin-panel/content/plan-templates" />}
                
                {/* Requests are usually handled by Admin only, but if Coach needs them, enable here */}
                {isAdmin && (
                    <>
                        <ContentButton icon={Egg} title="Solicitudes de Alimentos" to="/admin-panel/content/food-requests" hasPending={pendingFoodCount > 0} />
                        <ContentButton icon={UtensilsCrossed} title="Solicitudes de Recetas Libres" to="/admin-panel/content/free-recipe-requests" hasPending={pendingFreeRecipeCount > 0} />
                        <ContentButton icon={Wheat} title="Solicitudes de Cambios de Recetas" to="/admin-panel/content/diet-requests" hasPending={pendingDietChangeCount > 0} />
                    </>
                )}
                
                <SectionHeader title="Bases de Datos de Nutrientes" />
                <ContentButton icon={Dna} title={isCoach ? "Aminogramas" : "Gestionar Aminogramas"} to={getLink("/admin/manage-aminograms")} />
                <ContentButton icon={Leaf} title={isCoach ? "Antioxidantes" : "Gestionar Antioxidantes"} to={getLink("/admin/manage-antioxidants")} />
                <ContentButton icon={Droplets} title={isCoach ? "Tipos de Grasa" : "Gestionar Tipos de Grasa"} to={getLink("/admin/manage-fat-types")} />
                <ContentButton icon={Bot} title={isCoach ? "Tipos de Carbohidrato" : "Gestionar Tipos de Carbohidrato"} to={getLink("/admin/manage-carb-types")} />
                
                {/* Hide Stores for Coaches */}
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
                <ContentButton icon={Dumbbell} title={isCoach ? "Ejercicios" : "Crear/Editar Ejercicios"} to={getLink("/admin/create-exercise")} />
                <ContentButton icon={Activity} title={isCoach ? "Rutinas" : "Crear/Editar Rutinas"} to={getLink("/admin/create-routine")} />

            </div>
        </div>
    );
};

export default ContentManagement;