import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { processAndImportFoods, validateData } from '@/components/admin/recipes/BulkImport/bulkImportProcessor';
import Breadcrumbs from '@/components/Breadcrumbs';

const BulkImportPage = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const { toast } = useToast();

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
      setResults(null);
    } else {
      toast({
        title: 'Archivo no válido',
        description: 'Por favor, selecciona un archivo JSON.',
        variant: 'destructive',
      });
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: 'Error', description: 'No se ha seleccionado ningún archivo.' });
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const fileContent = await file.text();
      const data = JSON.parse(fileContent);
      
      const validationErrors = validateData(data);
      if (validationErrors.length > 0) {
        setResults({ success: [], errors: validationErrors.map(e => ({ item: e.item, error: e.message })) });
        toast({ title: 'Error de validación', description: 'El archivo contiene errores.', variant: 'destructive' });
        return;
      }

      const importResults = await processAndImportFoods(data);
      setResults(importResults);
      toast({ title: 'Proceso completado', description: 'La importación masiva ha finalizado.' });

    } catch (error) {
      toast({
        title: 'Error en la importación',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const breadcrumbItems = [
    { label: 'Gestión de Contenidos', href: '/admin-panel/content/nutrition' },
    { label: 'Nutrición', href: '/admin-panel/content/nutrition' },
    { label: 'Importación Masiva' },
  ];

  return (
    <>
      <Helmet>
        <title>Importación Masiva de Alimentos - Gsus Martz</title>
      </Helmet>
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs items={breadcrumbItems} />
        <Card className="mt-4 bg-[#1a1e23] border-gray-700 text-white">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-green-400">Importación Masiva de Alimentos</CardTitle>
            <CardDescription>Sube un archivo JSON para añadir o actualizar alimentos en la base de datos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border-2 border-dashed border-gray-600 rounded-lg text-center">
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="w-12 h-12 text-gray-400" />
                  <p className="text-gray-400">
                    {file ? `Archivo seleccionado: ${file.name}` : 'Arrastra y suelta un archivo JSON aquí, o haz clic para seleccionar.'}
                  </p>
                </div>
                <Input id="file-upload" type="file" accept=".json" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
            <Button onClick={handleImport} disabled={!file || isProcessing} className="w-full" variant="diet">
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Importar Alimentos'
              )}
            </Button>

            {results && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-4">Resultados de la Importación</h3>
                <Tabs defaultValue="success" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="success">Éxitos ({results.success.length})</TabsTrigger>
                    <TabsTrigger value="errors">Errores ({results.errors.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="success">
                    <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-900/50 rounded-md">
                      {results.success.map((item, index) => (
                        <div key={index} className="flex items-center p-2 bg-slate-800 rounded">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  <TabsContent value="errors">
                    <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-900/50 rounded-md">
                      {results.errors.map((item, index) => (
                        <div key={index} className="flex items-start p-2 bg-slate-800 rounded">
                          <XCircle className="w-5 h-5 text-red-500 mr-3 mt-1 flex-shrink-0" />
                          <div>
                            <span className="font-medium">{item.item?.name || 'Elemento desconocido'}</span>
                            <p className="text-sm text-gray-400">{item.error}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default BulkImportPage;