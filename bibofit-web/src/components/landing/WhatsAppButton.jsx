import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

const WhatsAppButton = () => {
    return (
        <motion.a
            href="https://wa.me/1234567890" // Replace with real number
            target="_blank"
            rel="noopener noreferrer"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: 'spring' }}
            whileHover={{ scale: 1.1 }}
            className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:shadow-green-500/30 transition-shadow flex items-center justify-center"
            aria-label="Contactar por WhatsApp"
        >
            <MessageCircle className="h-7 w-7 fill-current" />
        </motion.a>
    );
};

export default WhatsAppButton;