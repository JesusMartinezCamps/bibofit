import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { parseISO } from 'date-fns';
import StepsLogDialog from '@/components/shared/StepsLogDialog';

const StepsLogPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const dateParam = searchParams.get('date');
  const initialDate = dateParam ? parseISO(dateParam) : new Date();

  return (
    <>
      <Helmet>
        <title>Registro de Pasos - Bibofit</title>
      </Helmet>
      <div className="w-full h-full flex flex-col">
        <StepsLogDialog initialDate={initialDate} onClose={() => navigate(-1)} />
      </div>
    </>
  );
};

export default StepsLogPage;
