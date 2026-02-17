import React from 'react';

const InfoBlock = ({ children, className }) => (
    <div className={`bg-slate-900/40 p-3 rounded-md border border-slate-700/50 w-full ${className}`}>
        {children}
    </div>
);

export default InfoBlock;