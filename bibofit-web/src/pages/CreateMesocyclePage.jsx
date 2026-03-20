import React from 'react';
import { Helmet } from 'react-helmet';
import CreateRoutineWizard from '@/components/training/wizard/CreateRoutineWizard';

const CreateMesocyclePage = () => (
  <>
    <Helmet>
      <title>Nueva rutina - Bibofit</title>
      <meta
        name="description"
        content="Crea una nueva rutina semanal paso a paso: nombre, días, distribución y ejercicios."
      />
    </Helmet>
    <CreateRoutineWizard />
  </>
);

export default CreateMesocyclePage;
