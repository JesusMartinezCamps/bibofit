import React, { createContext, useContext, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// Contexto global para gestionar suscripciones Realtime sin duplicados
export const RealtimeContext = createContext(null);
export const useRealtime = () => useContext(RealtimeContext);

export const RealtimeProvider = ({ children }) => {
  // Almacena canales ya creados: { key: supabaseChannel }
  const channelsRef = useRef({});

  // Almacena callbacks activos por canal: { key: [callback1, callback2] }
  const listenersRef = useRef({});

  /**
   * subscribe(key, config, callback)
   * - Garantiza que SOLO exista un canal por key
   * - Permite múltiples callbacks por canal
   * - No recrea el canal nunca más
   */
  const subscribe = (key, config, callback) => {
    if (!listenersRef.current[key]) {
      listenersRef.current[key] = [];
    }
    listenersRef.current[key].push(callback);

    // Si el canal YA existe → no crear otro
    if (channelsRef.current[key]) return;

    // Crear canal UNA SOLA VEZ
    const channel = supabase.channel(key)
      .on('postgres_changes', config, (payload) => {
        // Ejecutar todos los callbacks registrados en ese canal
        listenersRef.current[key]?.forEach(cb => cb(payload));
      })
      .subscribe();

    channelsRef.current[key] = channel;
  };

  /**
   * unregister(key, callback)
   * - Quita un callback concreto
   * - Si ya no quedan callbacks → cierra el canal
   */
  const unregister = (key, callback) => {
    if (!listenersRef.current[key]) return;

    // Quitar callback específico
    listenersRef.current[key] = listenersRef.current[key].filter(cb => cb !== callback);

    // Si ya NO quedan callbacks → eliminar canal
    if (listenersRef.current[key].length === 0) {
      const channel = channelsRef.current[key];
      if (channel) supabase.removeChannel(channel);

      delete channelsRef.current[key];
      delete listenersRef.current[key];
    }
  };

  return (
    <RealtimeContext.Provider value={{ subscribe, unregister }}>
      {children}
    </RealtimeContext.Provider>
  );
};