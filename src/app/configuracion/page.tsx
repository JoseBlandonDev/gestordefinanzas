"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Save, RefreshCw } from "lucide-react";

export default function ConfiguracionPage() {
  const [projectedIncome, setProjectedIncome] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*");

      if (error) {
        console.error("Error fetching settings:", error);
        return;
      }

      const incomeSetting = data.find(s => s.key === 'projected_income');
      if (incomeSetting) setProjectedIncome(incomeSetting.value);

    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: 'projected_income', value: projectedIncome }
      ];

      const { error } = await supabase
        .from("settings")
        .upsert(updates, { onConflict: 'key' });

      if (error) throw error;

      alert("Configuración guardada correctamente.");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">Personaliza tu experiencia en la aplicación.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preferencias Generales</CardTitle>
            <CardDescription>Configuración base para cálculos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Ingreso Mensual Proyectado
              </label>
              <input
                type="number"
                placeholder="Ej. 3000"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={projectedIncome}
                onChange={(e) => setProjectedIncome(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usado para calcular los presupuestos porcentuales si no hay ingresos reales registrados en el mes actual.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar Cambios
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
            <CardDescription>Gestión de tus datos personales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-md bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Restablecer Datos</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Esta acción eliminará todas las transacciones y presupuestos. No se puede deshacer.
              </p>
              <Button variant="destructive" size="sm" onClick={async () => {
                if (confirm("¿Estás SEGURO de que quieres borrar todo? Esta acción es irreversible.")) {
                  await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000"); 
                  await supabase.from("budgets").delete().neq("id", "00000000-0000-0000-0000-000000000000"); 
                  alert("Datos eliminados.");
                }
              }}>
                Borrar Todos los Datos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
