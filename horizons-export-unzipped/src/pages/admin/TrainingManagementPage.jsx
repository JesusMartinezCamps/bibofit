import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Construction, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TrainingManagementPage = () => {
    const { userId } = useParams();

    return (
        <>
            <Helmet>
                <title>Gestión de Entrenamiento - Gsus Martz</title>
                <meta name="description" content="Gestión del plan de entrenamiento del cliente." />
            </Helmet>
            <main className="container mx-auto px-4 py-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <div className="flex justify-between items-center mb-6 relative">
                        <Button asChild variant="outline" className="border-[#F44C40] text-[#F44C40] hover:bg-[#F44C40]/10 hover:text-[#F44C40]">
                            <Link to={`/client-profile/${userId}`}><ArrowLeft className="mr-2 h-4 w-4"/> Volver al Perfil</Link>
                        </Button>
                         <div className="absolute left-1/2 -translate-x-1/2">
                           <Button asChild variant="secondary" className="bg-[#5ebe7d]/20 hover:bg-[#5ebe7d]/40 text-white">
                             <Link to={`/admin/manage-diet/${userId}`}><Utensils className="mr-2 h-4 w-4 text-[#5ebe7d]"/> Ir a Dieta</Link>
                           </Button>
                        </div>
                    </div>
                    <Card className="bg-[#1a1e23] border-gray-700 text-white">
                        <CardHeader>
                            <CardTitle className="text-2xl font-bold flex items-center text-white">
                                <Construction className="mr-3 text-[#F44C40]" />
                                Gestión de Entrenamiento
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-16">
                                <h2 className="text-3xl font-bold text-gray-400">Página en Construcción</h2>
                                <p className="text-gray-500 mt-2">Esta sección estará disponible próximamente.</p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </main>
        </>
    );
};

export default TrainingManagementPage;