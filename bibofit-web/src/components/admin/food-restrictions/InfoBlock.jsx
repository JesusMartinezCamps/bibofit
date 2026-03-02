import React from 'react';

const InfoBlock = ({ children, className }) => (
    <div className={`bg-card/40 p-3 rounded-md border border-border/50 w-full ${className}`}>
        {children}
    </div>
);

export default InfoBlock;