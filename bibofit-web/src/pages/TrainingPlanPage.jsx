import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TrainingPlanPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/plan/entreno/sesion', { replace: true });
  }, [navigate]);

  return (
    <>
      <Helmet>
        <title>Zona de Entrenamiento - Bibofit</title>
        <meta name="description" content="Preparando tu sesión de entrenamiento de hoy." />
      </Helmet>
      <main className="w-full px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card/70 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#F44C40]" />
          <p className="mt-3 text-sm text-muted-foreground">Preparando tu entrenamiento...</p>
        </div>
      </main>
    </>
  );
};

export default TrainingPlanPage;
