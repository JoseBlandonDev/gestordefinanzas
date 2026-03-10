"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Budget {
  id: string;
  category: string;
  amount: number;
}

interface BudgetWithSpent extends Budget {
  spent: number;
}

export default function PresupuestoPage() {
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBudget, setNewBudget] = useState({ category: "", amount: "" });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchBudgetsAndExpenses();
  }, []);

  const fetchBudgetsAndExpenses = async () => {
    try {
      // Fetch budgets
      const { data: budgetsData, error: budgetsError } = await supabase
        .from("budgets")
        .select("*");

      if (budgetsError) throw budgetsError;

      // Fetch expenses for current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: expensesData, error: expensesError } = await supabase
        .from("transactions")
        .select("amount, category")
        .eq("type", "expense")
        .gte("date", startOfMonth.toISOString());

      if (expensesError) throw expensesError;

      // Calculate spent per category
      const spentByCategory: Record<string, number> = {};
      expensesData?.forEach((expense) => {
        const category = expense.category || "General";
        spentByCategory[category] = (spentByCategory[category] || 0) + expense.amount;
      });

      // Combine data
      const budgetsWithSpent = budgetsData?.map((budget) => ({
        ...budget,
        spent: spentByCategory[budget.category] || 0,
      })) || [];

      setBudgets(budgetsWithSpent);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudget.category || !newBudget.amount) return;

    try {
      const { data, error } = await supabase
        .from("budgets")
        .insert([
          {
            category: newBudget.category,
            amount: parseFloat(newBudget.amount),
          },
        ])
        .select();

      if (error) throw error;

      setBudgets([...budgets, { ...data[0], spent: 0 }]);
      setNewBudget({ category: "", amount: "" });
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding budget:", error);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Presupuesto</h2>
          <p className="text-muted-foreground">Planifica tus límites de gasto.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="mr-2 h-4 w-4" /> {isAdding ? "Cancelar" : "Nuevo Presupuesto"}
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Añadir Nuevo Presupuesto</CardTitle>
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
                <input
                  type="number"
                  placeholder="Límite Mensual"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget({ ...newBudget, amount: e.target.value })}
                  required
                />
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
            const percentage = Math.min((budget.spent / budget.amount) * 100, 100);
            const remaining = Math.max(budget.amount - budget.spent, 0);
            
            return (
              <Card key={budget.id}>
                <CardHeader>
                  <CardTitle>{budget.category}</CardTitle>
                  <CardDescription>Límite mensual: ${budget.amount.toFixed(2)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Gastado: ${budget.spent.toFixed(2)}</span>
                    <span>Restante: ${remaining.toFixed(2)}</span>
                  </div>
                  <Progress value={percentage} className={percentage >= 100 ? "bg-red-200 [&>div]:bg-red-500" : ""} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
