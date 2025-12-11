import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, Scale } from 'lucide-react';
import { ResponsiveLine } from '@nivo/line';
import { format, subMonths, startOfDay, isAfter, isBefore, isEqual, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import WeightLogDialog from '@/components/shared/WeightLogDialog';
import { cn } from '@/lib/utils';

// 🔽 Función de downsampling (estilo apps profesionales)
const downsampleLogs = (logs, maxPoints) => {
  if (!logs || logs.length <= maxPoints) return logs;
  const step = Math.ceil(logs.length / maxPoints);
  return logs.filter((_, index) => index % step === 0);
};

const WeightHistoryPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('1M'); // 1M, 3M, 6M, CUSTOM
  const [customDateRange, setCustomDateRange] = useState([null, null]);
  const [startDate, endDate] = customDateRange;
  
  const [selectedLogDate, setSelectedLogDate] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*, satiety_levels(emoji, name)')
        .eq('user_id', user.id)
        .order('logged_on', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching weight logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const filteredLogs = useMemo(() => {
    if (!logs.length) return [];

    const today = startOfDay(new Date());
    let cutoffDate = startOfDay(subMonths(today, 1));

    if (range === '3M') {
      cutoffDate = startOfDay(subMonths(today, 3));
    } else if (range === '6M') {
      cutoffDate = startOfDay(subMonths(today, 6));
    } else if (range === 'CUSTOM') {
      if (startDate && endDate) {
        return logs.filter(log => {
          const logDate = parseISO(log.logged_on);
          return (isAfter(logDate, startDate) || isEqual(logDate, startDate)) && 
                 (isBefore(logDate, endDate) || isEqual(logDate, endDate));
        });
      }
      // Si el rango personalizado no está completo, mostramos todo para no dejar la gráfica vacía
      return logs;
    }

    return logs.filter(log => {
      const logDate = parseISO(log.logged_on);
      return isAfter(logDate, cutoffDate) || isEqual(logDate, cutoffDate);
    });
  }, [logs, range, startDate, endDate]);

  // 🔽 Datos para la gráfica con downsampling
  const chartData = useMemo(() => {
    if (!filteredLogs.length) return [];

    // Ordenar por fecha ascendente solo para la gráfica
    const sortedForChart = [...filteredLogs].sort(
      (a, b) => new Date(a.logged_on) - new Date(b.logged_on)
    );

    // Limite de puntos visibles según rango (estilo app profesional)
    const maxPoints =
      range === '1M'
        ? 15
        : range === '3M'
        ? 25
        : range === '6M'
        ? 35
        : 40; // CUSTOM o cualquier otro caso

    const downsampled = downsampleLogs(sortedForChart, maxPoints);

    return [
      {
        id: 'peso',
        color: 'hsl(256, 70%, 90%)',
        data: downsampled.map(log => ({
          x: log.logged_on,
          y: log.weight_kg,
        })),
      },
    ];
  }, [filteredLogs, range]);

  const handleLogClick = (log) => {
    const date = parseISO(log.logged_on);
    setSelectedLogDate(date);
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open) => {
    setIsDialogOpen(open);
    if (!open) setSelectedLogDate(null);
  };

  const handleLogAdded = () => {
    fetchLogs(); // Refresh list
  };

  // Theme for Nivo Chart
  const theme = {
    background: 'transparent',
    axis: {
      ticks: {
        text: { fill: '#9ca3af' },
      },
      legend: {
        text: { fill: '#9ca3af' },
      },
    },
    grid: {
      line: { stroke: '#374151', strokeWidth: 1, strokeDasharray: '4 4' },
    },
    crosshair: {
      line: {
        stroke: '#8b5cf6',
        strokeWidth: 1,
        strokeOpacity: 0.5,
      },
    },
  };

  const CustomTooltip = ({ point }) => {
    return (
      <div className="bg-gray-800 p-2 rounded-md border border-gray-700 shadow-lg">
        <p className="text-xs text-gray-200">
          <span className="font-bold text-violet-400">{point.data.y}kg</span>
          {', '}
          {format(point.data.x, 'dd-MM-yyyy')}
        </p>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Historial de Peso - Gsus Martz</title>
        <meta name="description" content="Consulta tu progreso y evolución de peso." />
      </Helmet>
      
      <div className="container mx-auto max-w-4xl pb-12 sm:pt-8 px-2"> {/* Changed px-4 to px-2 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 mt-8 gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Scale className="text-violet-500 h-8 w-8" />
            Historial de Peso
          </h1>
        </div>

        <div className="space-y-6">
          {/* Filters */}
          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start items-center">
              {['1M', '3M', '6M'].map((r) => (
                <Button
                  key={r}
                  variant={range === r ? 'default' : 'outline'}
                  onClick={() => setRange(r)}
                  className={cn(
                    'min-w-[3rem]',
                    range === r
                      ? 'bg-violet-600 hover:bg-violet-700 text-white border-transparent'
                      : 'bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  {r === '1M' ? '1 Mes' : r === '3M' ? '3 Meses' : '6 Meses'}
                </Button>
              ))}
              <Button
                variant={range === 'CUSTOM' ? 'default' : 'outline'}
                onClick={() => setRange('CUSTOM')}
                className={cn(
                  range === 'CUSTOM'
                    ? 'bg-violet-600 hover:bg-violet-700 text-white border-transparent'
                    : 'bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                Rango Personalizado
              </Button>
              
              {range === 'CUSTOM' && (
                <div className="ml-0 sm:ml-2 w-full sm:w-auto relative z-20">
                  <DatePicker
                    selectsRange={true}
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(update) => setCustomDateRange(update)}
                    isClearable={true}
                    placeholderText="Selecciona fechas"
                    className="input-field date-input min-w-[220px]"
                    dateFormat="dd/MM/yyyy"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>
          </Card>

          {/* Chart */}
          <Card className="bg-[#1a1e23] border-gray-700 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-white text-lg">Evolución</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] w-full p-0 sm:p-4">
              {loading ? (
                <div className="h-full flex justify-center items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                </div>
              ) : filteredLogs.length > 1 && chartData.length > 0 ? (
                <ResponsiveLine
                  data={chartData}
                  theme={theme}
                  margin={{ top: 20, right: 30, bottom: 50, left: 50 }}
                  xScale={{
                    type: 'time',
                    format: '%Y-%m-%d',
                    useUTC: false,
                    precision: 'day',
                  }}
                  xFormat="time:%Y-%m-%d"
                  yScale={{
                    type: 'linear',
                    min: Math.floor(Math.min(...filteredLogs.map(l => l.weight_kg))) - 1,
                    max: Math.ceil(Math.max(...filteredLogs.map(l => l.weight_kg))) + 1,
                    stacked: false,
                    reverse: false,
                  }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    format: '%b %d',
                    tickValues: 4,
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: 'Fecha',
                    legendOffset: 36,
                    legendPosition: 'middle',
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: 'Kg',
                    legendOffset: -40,
                    legendPosition: 'middle',
                  }}
                  pointSize={8}
                  pointColor={{ theme: 'background' }}
                  pointBorderWidth={2}
                  pointBorderColor={{ from: 'serieColor' }}
                  pointLabelYOffset={-6}
                  useMesh={true}
                  crosshairType="cross"
                  tooltip={CustomTooltip}
                  enableArea={true}
                  areaOpacity={0.15}
                  colors={['#8b5cf6']}
                  defs={[
                    {
                      id: 'gradientViolet',
                      type: 'linearGradient',
                      colors: [
                        { offset: 0, color: 'inherit', opacity: 0 },
                        { offset: 100, color: 'inherit', opacity: 0 },
                      ],
                    },
                  ]}
                  fill={[
                    { match: '*', id: 'gradientViolet' },
                  ]}
                />
              ) : (
                <div className="h-full flex flex-col justify-center items-center text-gray-400 p-4 text-center">
                  <Scale className="h-12 w-12 mb-3 opacity-20" />
                  <p>No hay suficientes datos para mostrar la gráfica en este rango.</p>
                  <p className="text-sm mt-1">
                    Registra tu peso al menos dos veces para ver tu evolución.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History List */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Registros Detallados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="divide-y divide-gray-700/50">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => handleLogClick(log)}
                      className="p-4 flex items-center justify-between hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-gray-800 p-2 rounded-full">
                          <Calendar className="h-5 w-5 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-white font-medium capitalize">
                            {format(parseISO(log.logged_on), "EEEE, d 'de' MMMM", { locale: es })}
                          </p>
                          <p className="text-sm text-gray-400 flex items-center gap-2">
                            {format(parseISO(log.logged_on), 'yyyy')}
                            {log.satiety_levels && (
                              <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-300 border border-gray-700 flex items-center gap-1">
                                {log.satiety_levels.emoji} {log.satiety_levels.name}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-violet-400">
                          {log.weight_kg}{' '}
                          <span className="text-sm text-gray-500 font-normal">kg</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  No se encontraron registros para este rango de fechas.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedLogDate && (
          <WeightLogDialog
            open={isDialogOpen}
            onOpenChange={handleDialogClose}
            initialDate={selectedLogDate}
            onLogAdded={handleLogAdded}
          />
        )}
      </div>
    </>
  );
};

export default WeightHistoryPage;