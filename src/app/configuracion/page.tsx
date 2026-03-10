"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Save, RefreshCw } from "lucide-react";

export default function ConfiguracionPage() {
  const [budgetMode, setBudgetMode] = useState<"fixed" | "percentage">("fixed");
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
        // If table doesn't exist, we might just default to 'fixed'
        console.error("Error fetching settings:", error);
        return;
      }

      const modeSetting = data.find(s => s.key === 'budget_mode');
      const incomeSetting = data.find(s => s.key === 'projected_income');

      if (modeSetting) setBudgetMode(modeSetting.value as "fixed" | "percentage");
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
      // Upsert settings
      const updates = [
        { key: 'budget_mode', value: budgetMode },
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
            <CardTitle>Preferencias de Presupuesto</CardTitle>
            <CardDescription>Define cómo quieres gestionar tus presupuestos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Modo de Presupuesto
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="fixed"
                    name="budget_mode"
                    value="fixed"
                    checked={budgetMode === "fixed"}
                    onChange={() => setBudgetMode("fixed")}
                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="fixed" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Cantidades Fijas
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="percentage"
                    name="budget_mode"
                    value="percentage"
                    checked={budgetMode === "percentage"}
                    onChange={() => setBudgetMode("percentage")}
                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="percentage" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Porcentajes
                  </label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {budgetMode === "fixed" 
                  ? "Define límites exactos para cada categoría (ej. $500 para Comida)." 
                  : "Define porcentajes de tus ingresos para cada categoría (ej. 30% para Comida)."}
              </p>
            </div>

            {budgetMode === "percentage" && (
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
                  Usado para calcular los montos estimados si no hay ingresos reales registrados este mes.
                </p>
              </div>
            )}

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
                  await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
                  await supabase.from("budgets").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
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
