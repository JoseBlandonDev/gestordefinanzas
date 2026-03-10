"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, MoreVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

interface Budget {
  id: string;
  category: string;
  amount: number;
  type: "fixed" | "percentage";
  percentage?: number;
  group_category?: string;
}

interface BudgetWithSpent extends Budget {
  spent: number;
  calculatedAmount: number;
}

const BUDGET_GROUPS = [
  "Gastos Diarios",
  "Ahorro",
  "Inversión",
  "Fondo Emergencia",
  "Obligaciones Fijas",
  "Entretenimiento",
  "Otros"
];

export default function PresupuestoPage() {
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseIncome, setBaseIncome] = useState(0);
  
  // Modal States
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  
  // Form States
  const [newBudget, setNewBudget] = useState({ category: "", value: "", group: "Gastos Diarios" });
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithSpent | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch Settings & Income
      const { data: settingsData } = await supabase.from("settings").select("*");
      const projectedIncome = parseFloat(settingsData?.find(s => s.key === 'projected_income')?.value || "0");
      
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

      // 2. Fetch Budgets
      const { data: budgetsData, error: budgetsError } = await supabase
        .from("budgets")
        .select("*")
        .order('created_at', { ascending: true });

      if (budgetsError) throw budgetsError;

      // 3. Fetch Expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from("transactions")
        .select("amount, category")
        .eq("type", "expense")
        .gte("date", startOfMonth.toISOString());

      if (expensesError) throw expensesError;

      // 4. Process Data
      const spentByCategory: Record<string, number> = {};
      expensesData?.forEach((expense) => {
        const category = expense.category || "General";
        spentByCategory[category] = (spentByCategory[category] || 0) + expense.amount;
      });

      const processedBudgets = budgetsData?.map((budget) => {
        let calculatedAmount = budget.amount;
        
        if (budget.percentage) {
          calculatedAmount = calculatedBaseIncome * (budget.percentage / 100);
        } else if (budget.type === 'percentage' && !budget.percentage && budget.amount) {
             calculatedAmount = 0; 
        }

        return {
          ...budget,
          spent: spentByCategory[budget.category] || 0,
          calculatedAmount: calculatedAmount,
          group_category: budget.group_category || "Otros"
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

    const percentageValue = parseFloat(newBudget.value);
    
    try {
      const budgetData = {
        category: newBudget.category,
        type: 'percentage',
        amount: 0,
        percentage: percentageValue,
        group_category: newBudget.group
      };

      const { data, error } = await supabase
        .from("budgets")
        .insert([budgetData])
        .select();

      if (error) throw error;

      const newBudgetRecord = data[0];
      const calculatedAmount = baseIncome * (percentageValue / 100);

      setBudgets([...budgets, { 
        ...newBudgetRecord, 
        spent: 0, 
        calculatedAmount,
        group_category: newBudget.group
      }]);
      
      setNewBudget({ category: "", value: "", group: "Gastos Diarios" });
      setIsAddBudgetOpen(false);
    } catch (error) {
      console.error("Error adding budget:", error);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget || !expenseAmount) return;

    try {
      const { error } = await supabase.from("transactions").insert([{
        description: expenseDesc || selectedBudget.category,
        amount: parseFloat(expenseAmount),
        type: "expense",
        category: selectedBudget.category,
        date: new Date().toISOString()
      }]);

      if (error) throw error;

      // Update local state
      setBudgets(budgets.map(b => {
        if (b.id === selectedBudget.id) {
          return { ...b, spent: b.spent + parseFloat(expenseAmount) };
        }
        return b;
      }));

      setIsAddExpenseOpen(false);
      setExpenseAmount("");
      setExpenseDesc("");
      setSelectedBudget(null);
    } catch (error) {
      console.error("Error adding expense:", error);
    }
  };

  const handleEditBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget || !editValue) return;

    try {
      const percentage = parseFloat(editValue);
      const { error } = await supabase
        .from("budgets")
        .update({ percentage })
        .eq("id", selectedBudget.id);

      if (error) throw error;

      setBudgets(budgets.map(b => {
        if (b.id === selectedBudget.id) {
          const calculatedAmount = baseIncome * (percentage / 100);
          return { ...b, percentage, calculatedAmount };
        }
        return b;
      }));

      setIsEditBudgetOpen(false);
      setEditValue("");
      setSelectedBudget(null);
    } catch (error) {
      console.error("Error updating budget:", error);
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

  // Group budgets
  const groupedBudgets = budgets.reduce((acc, budget) => {
    const group = budget.group_category || "Otros";
    if (!acc[group]) acc[group] = [];
    acc[group].push(budget);
    return acc;
  }, {} as Record<string, BudgetWithSpent[]>);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Presupuesto</h2>
          <p className="text-muted-foreground">
            Gestión basada en porcentajes (Base: {formatCurrency(baseIncome)})
          </p>
        </div>
        <Dialog open={isAddBudgetOpen} onOpenChange={setIsAddBudgetOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Presupuesto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Presupuesto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddBudget} className="space-y-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <input
                  type="text"
                  placeholder="Ej. Comida"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newBudget.category}
                  onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select 
                  value={newBudget.group} 
                  onValueChange={(val) => setNewBudget({ ...newBudget, group: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_GROUPS.map(group => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Porcentaje (%)</Label>
                <input
                  type="number"
                  placeholder="Ej. 30"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newBudget.value}
                  onChange={(e) => setNewBudget({ ...newBudget, value: e.target.value })}
                  required
                  max={100}
                  step="0.1"
                />
              </div>
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div>Cargando...</div>
      ) : Object.keys(groupedBudgets).length === 0 ? (
        <div className="text-center text-muted-foreground py-10">No hay presupuestos definidos.</div>
      ) : (
        Object.entries(groupedBudgets).map(([group, groupBudgets]) => (
          <div key={group} className="space-y-4">
            <h3 className="text-xl font-semibold text-primary">{group}</h3>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {groupBudgets.map((budget) => {
                const percentage = Math.min((budget.spent / (budget.calculatedAmount || 1)) * 100, 100);
                const remaining = Math.max(budget.calculatedAmount - budget.spent, 0);
                
                return (
                  <Card key={budget.id} className="flex flex-col">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-base">{budget.category}</CardTitle>
                        <CardDescription className="text-xs">
                          {budget.percentage}% ({formatCurrency(budget.calculatedAmount)})
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedBudget(budget);
                            setEditValue(budget.percentage?.toString() || "");
                            setIsEditBudgetOpen(true);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar Porcentaje
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(budget.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-muted-foreground">Disponible</span>
                          <span className={remaining < 0 ? "text-destructive" : "text-emerald-500"}>
                            {formatCurrency(remaining)}
                          </span>
                        </div>
                        <Progress value={percentage} className={percentage >= 100 ? "bg-red-200 [&>div]:bg-red-500" : ""} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Gastado: {formatCurrency(budget.spent)}</span>
                          <span>Total: {formatCurrency(budget.calculatedAmount)}</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-auto"
                        onClick={() => {
                          setSelectedBudget(budget);
                          setIsAddExpenseOpen(true);
                        }}
                      >
                        <Plus className="mr-2 h-3 w-3" /> Añadir Gasto
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Add Expense Modal */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Gasto a {selectedBudget?.category}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="space-y-2">
              <Label>Monto</Label>
              <input
                type="number"
                placeholder="0.00"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción (Opcional)</Label>
              <input
                type="text"
                placeholder="Detalle del gasto"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Añadir Gasto</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Budget Modal */}
      <Dialog open={isEditBudgetOpen} onOpenChange={setIsEditBudgetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selectedBudget?.category}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditBudget} className="space-y-4">
            <div className="space-y-2">
              <Label>Nuevo Porcentaje (%)</Label>
              <input
                type="number"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                required
                max={100}
                step="0.1"
              />
            </div>
            <DialogFooter>
              <Button type="submit">Actualizar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
