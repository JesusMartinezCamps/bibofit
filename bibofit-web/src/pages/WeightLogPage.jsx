import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { parseISO } from 'date-fns';
import WeightLogDialog from '@/components/shared/WeightLogDialog';

const WeightLogPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const dateParam = searchParams.get('date');
  const userIdParam = searchParams.get('userId');

  const initialDate = dateParam ? parseISO(dateParam) : new Date();

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <>
      <Helmet>
        <title>Registro de Peso - Bibofit</title>
      </Helmet>
      <div className="w-full h-full flex flex-col">
        <WeightLogDialog
          asPage={true}
          open={true}
          onOpenChange={(open) => { if (!open) handleClose(); }}
          initialDate={initialDate}
          userId={userIdParam || undefined}
        />
      </div>
    </>
  );
};

export default WeightLogPage;
