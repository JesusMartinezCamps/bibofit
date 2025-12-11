import React from 'react';
import { Helmet } from 'react-helmet';
import ContentManagement from '@/components/admin/ContentManagement';

const CoachContentPage = () => {
    return (
        <>
            <Helmet>
                <title>Gestión de Contenidos - Coach</title>
            </Helmet>
            <ContentManagement />
        </>
    );
};

export default CoachContentPage;