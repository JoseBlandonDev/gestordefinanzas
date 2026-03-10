"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Budget {
  id: string;
  category: string;
  amount: number;
  type: "fixed" | "percentage";
  percentage?: number;
}

interface BudgetWithSpent extends Budget {
  spent: number;
  calculatedAmount: number;
}

export default function PresupuestoPage() {
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBudget, setNewBudget] = useState({ category: "", value: "" }); // value can be amount or percentage
  const [isAdding, setIsAdding] = useState(false);
  const [budgetMode, setBudgetMode] = useState<"fixed" | "percentage">("fixed");
  const [baseIncome, setBaseIncome] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch Settings
      const { data: settingsData } = await supabase.from("settings").select("*");
      const modeSetting = settingsData?.find(s => s.key === 'budget_mode')?.value as "fixed" | "percentage" || "fixed";
      const projectedIncome = parseFloat(settingsData?.find(s => s.key === 'projected_income')?.value || "0");
      
      setBudgetMode(modeSetting);

      // 2. Calculate Base Income (Actual vs Projected)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: incomeData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "income")
        .gte("date", startOfMonth.toISOString());

      const actualIncome = incomeData?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const calculatedBaseIncome = actualIncome > 0 ? actualIncome : projectedIncome;
      setBaseIncome(calculatedBaseIncome);

      // 3. Fetch Budgets
      const { data: budgetsData, error: budgetsError } = await supabase
        .from("budgets")
        .select("*");

      if (budgetsError) throw budgetsError;

      // 4. Fetch Expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from("transactions")
        .select("amount, category")
        .eq("type", "expense")
        .gte("date", startOfMonth.toISOString());

      if (expensesError) throw expensesError;

      // 5. Process Data
      const spentByCategory: Record<string, number> = {};
      expensesData?.forEach((expense) => {
        const category = expense.category || "General";
        spentByCategory[category] = (spentByCategory[category] || 0) + expense.amount;
      });

      const processedBudgets = budgetsData?.map((budget) => {
        let calculatedAmount = budget.amount;
        
        // If in percentage mode, recalculate amount based on base income
        // We check budget.type to see if it was saved as percentage, 
        // OR if the global mode is percentage, we might want to interpret it differently.
        // For simplicity, let's assume if global mode is percentage, we treat the 'percentage' column as the source of truth if available,
        // or convert the fixed amount to percentage? No, better to stick to what's in the DB.
        
        // Strategy: 
        // If budget.type is 'percentage', calculate amount = baseIncome * (percentage / 100)
        // If budget.type is 'fixed', use budget.amount
        
        if (budget.type === 'percentage' && budget.percentage) {
          calculatedAmount = calculatedBaseIncome * (budget.percentage / 100);
        }

        return {
          ...budget,
          spent: spentByCategory[budget.category] || 0,
          calculatedAmount: calculatedAmount,
        };
      }) || [];

      setBudgets(processedBudgets);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudget.category || !newBudget.value) return;

    const value = parseFloat(newBudget.value);
    
    try {
      const budgetData = {
        category: newBudget.category,
        type: budgetMode,
        amount: budgetMode === 'fixed' ? value : 0, // Placeholder if percentage
        percentage: budgetMode === 'percentage' ? value : null,
      };

      const { data, error } = await supabase
        .from("budgets")
        .insert([budgetData])
        .select();

      if (error) throw error;

      // Optimistic update
      const newBudgetRecord = data[0];
      let calculatedAmount = newBudgetRecord.amount;
      if (budgetMode === 'percentage') {
        calculatedAmount = baseIncome * (value / 100);
      }

      setBudgets([...budgets, { 
        ...newBudgetRecord, 
        spent: 0, 
        calculatedAmount 
      }]);
      
      setNewBudget({ category: "", value: "" });
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding budget:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este presupuesto?")) return;

    try {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
      setBudgets(budgets.filter(b => b.id !== id));
    } catch (error) {
      console.error("Error deleting budget:", error);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Presupuesto</h2>
          <p className="text-muted-foreground">
            {budgetMode === 'percentage' 
              ? `Modo Porcentajes (Base: $${baseIncome.toFixed(2)})` 
              : "Modo Cantidades Fijas"}
          </p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="mr-2 h-4 w-4" /> {isAdding ? "Cancelar" : "Nuevo Presupuesto"}
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Añadir Nuevo Presupuesto</CardTitle>
            <CardDescription>
              {budgetMode === 'percentage' 
                ? "Define el porcentaje de tus ingresos destinado a esta categoría." 
                : "Define el monto fijo mensual para esta categoría."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddBudget} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Categoría (ej. Alimentación)"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newBudget.category}
                  onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
                  required
                />
                <div className="relative">
                  <input
                    type="number"
                    placeholder={budgetMode === 'percentage' ? "Porcentaje (ej. 30)" : "Monto (ej. 500)"}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newBudget.value}
                    onChange={(e) => setNewBudget({ ...newBudget, value: e.target.value })}
                    required
                    max={budgetMode === 'percentage' ? 100 : undefined}
                  />
                  {budgetMode === 'percentage' && (
                    <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                  )}
                </div>
              </div>
              <Button type="submit">Guardar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando...</div>
        ) : budgets.length === 0 ? (
          <div className="text-sm text-muted-foreground">No hay presupuestos definidos.</div>
        ) : (
          budgets.map((budget) => {
            const percentage = Math.min((budget.spent / budget.calculatedAmount) * 100, 100);
            const remaining = Math.max(budget.calculatedAmount - budget.spent, 0);
            
            return (
              <Card key={budget.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>{budget.category}</CardTitle>
                    <CardDescription>
                      {budget.type === 'percentage' 
                        ? `${budget.percentage}% de ingresos ($${budget.calculatedAmount.toFixed(2)})` 
                        : `Límite mensual: $${budget.calculatedAmount.toFixed(2)}`}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(budget.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Gastado: ${budget.spent.toFixed(2)}</span>
                    <span>Restante: ${remaining.toFixed(2)}</span>
                  </div>
                  <Progress value={percentage || 0} className={percentage >= 100 ? "bg-red-200 [&>div]:bg-red-500" : ""} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
