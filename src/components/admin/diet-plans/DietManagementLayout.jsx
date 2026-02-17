import React from 'react';
import { motion } from 'framer-motion';

const DietManagementLayout = ({ title, headerContent, gridContent }) => {
    return (
        <div className="text-white">
            <motion.h1 
                className="text-3xl font-bold mb-6 text-green-400"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {title}
            </motion.h1>

            {headerContent && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    {headerContent}
                </motion.div>
            )}

            {gridContent && (
                <motion.div 
                    className="mt-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    {gridContent}
                </motion.div>
            )}
        </div>
    );
};

export default DietManagementLayout;