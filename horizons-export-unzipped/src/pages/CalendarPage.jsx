// This file is deprecated. Redirects to /dashboard if accessed.
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CalendarPage = () => {
    const navigate = useNavigate();
    useEffect(() => {
        navigate('/dashboard', { replace: true });
    }, [navigate]);
    return null;
};

export default CalendarPage;