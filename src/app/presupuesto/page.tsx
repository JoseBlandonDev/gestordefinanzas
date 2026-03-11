"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, MoreVertical, Settings, ArrowLeft, Save } from "lucide-react";
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

const DEFAULT_CATEGORIES = [
  { category: "Ahorro", group: "Ahorro", defaultPercentage: 20 },
  { category: "Gastos Fijos", group: "Obligaciones Fijas", defaultPercentage: 50 },
  { category: "Gastos Variables", group: "Gastos Diarios", defaultPercentage: 30 },
];

export default function PresupuestoPage() {
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [setupStep, setSetupStep] = useState<'type_selection' | 'details'>('type_selection');
  const [budgetType, setBudgetType] = useState<'fixed' | 'variable' | null>(null);
  const [fixedIncome, setFixedIncome] = useState<string>("");
  
  // Dashboard Data
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [baseIncome, setBaseIncome] = useState(0);
  
  // Setup State
  const [setupBudgets, setSetupBudgets] = useState<{category: string, group: string, percentage: number, amount: number}[]>(
    DEFAULT_CATEGORIES.map(c => ({ category: c.category, group: c.group, percentage: c.defaultPercentage, amount: 0 }))
  );

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
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const { data: settings } = await supabase.from("settings").select("*");
      const typeSetting = settings?.find(s => s.key === 'budget_type');
      
      if (typeSetting) {
        setIsConfigured(true);
        setBudgetType(typeSetting.value as 'fixed' | 'variable');
        fetchDashboardData();
      } else {
        setIsConfigured(false);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error checking configuration:", error);
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Settings
      const { data: settingsData } = await supabase.from("settings").select("*");
      const type = settingsData?.find(s => s.key === 'budget_type')?.value as 'fixed' | 'variable';
      const fixedIncomeVal = parseFloat(settingsData?.find(s => s.key === 'fixed_income_amount')?.value || "0");
      
      setBudgetType(type);
      setFixedIncome(fixedIncomeVal.toString());

      // 2. Determine Base Income
      let currentBaseIncome = 0;
      if (type === 'fixed') {
        currentBaseIncome = fixedIncomeVal;
      } else {
        // For variable, calculate from actual income this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: incomeData } = await supabase
          .from("transactions")
          .select("amount")
          .eq("type", "income")
          .gte("date", startOfMonth.toISOString());
          
        currentBaseIncome = incomeData?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      }
      setBaseIncome(currentBaseIncome);

      // 3. Fetch Budgets & Expenses
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [{ data: budgetsData }, { data: expensesData }] = await Promise.all([
        supabase.from("budgets").select("*").order('created_at', { ascending: true }),
        supabase.from("transactions")
          .select("amount, category")
          .eq("type", "expense")
          .gte("date", startOfMonth.toISOString())
      ]);

      const spentByCategory: Record<string, number> = {};
      expensesData?.forEach((expense) => {
        const category = expense.category || "General";
        spentByCategory[category] = (spentByCategory[category] || 0) + expense.amount;
      });

      const processedBudgets = budgetsData?.map((budget) => {
        let calculatedAmount = 0;
        
        if (type === 'fixed') {
          // In fixed mode, amounts are absolute
          calculatedAmount = budget.amount; 
        } else {
          // In variable mode, amounts are percentages of base income
          calculatedAmount = currentBaseIncome * ((budget.percentage || 0) / 100);
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
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfiguration = async () => {
    setLoading(true);
    try {
      // 1. Save Settings
      const settingsUpdates = [
        { key: 'budget_type', value: budgetType },
        { key: 'fixed_income_amount', value: budgetType === 'fixed' ? fixedIncome : '0' }
      ];
      
      await supabase.from("settings").upsert(settingsUpdates, { onConflict: 'key' });

      // 2. Save Budgets (Replace existing)
      // First delete existing
      await supabase.from("budgets").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Then insert new ones
      const newBudgets = setupBudgets.map(b => ({
        category: b.category,
        group_category: b.group,
        type: budgetType === 'variable' ? 'percentage' : 'fixed',
        percentage: budgetType === 'variable' ? b.percentage : null,
        amount: budgetType === 'fixed' ? b.amount : 0
      }));

      await supabase.from("budgets").insert(newBudgets);

      setIsConfigured(true);
      fetchDashboardData();
    } catch (error) {
      console.error("Error saving configuration:", error);
      alert("Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudget.category || !newBudget.value) return;

    const val = parseFloat(newBudget.value);
    
    try {
      const budgetData = {
        category: newBudget.category,
        group_category: newBudget.group,
        type: budgetType === 'variable' ? 'percentage' : 'fixed',
        percentage: budgetType === 'variable' ? val : null,
        amount: budgetType === 'fixed' ? val : 0
      };

      const { data, error } = await supabase.from("budgets").insert([budgetData]).select();
      if (error) throw error;

      const newBudgetRecord = data[0];
      const calculatedAmount = budgetType === 'variable' 
        ? baseIncome * (val / 100)
        : val;

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
      const val = parseFloat(editValue);
      const updates: any = {};
      
      if (budgetType === 'variable') {
        updates.percentage = val;
      } else {
        updates.amount = val;
      }

      const { error } = await supabase
        .from("budgets")
        .update(updates)
        .eq("id", selectedBudget.id);

      if (error) throw error;

      setBudgets(budgets.map(b => {
        if (b.id === selectedBudget.id) {
          const calculatedAmount = budgetType === 'variable' 
            ? baseIncome * (val / 100) 
            : val;
          return { ...b, ...updates, calculatedAmount };
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

  // Setup Views
  if (loading) return <div className="p-8">Cargando...</div>;

  if (!isConfigured) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Definir Presupuesto</h2>
          <p className="text-muted-foreground">Configura cómo quieres gestionar tus finanzas.</p>
        </div>

        {setupStep === 'type_selection' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                setBudgetType('variable');
                setSetupStep('details');
              }}
            >
              <CardHeader>
                <CardTitle>Ingresos Variables</CardTitle>
                <CardDescription>Ideal si tus ingresos cambian cada mes (freelancers, comisiones).</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Define porcentajes para dividir tus ingresos reales cada mes.
                  Ej: 50% Gastos Fijos, 30% Gastos Variables, 20% Ahorro.
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                setBudgetType('fixed');
                setSetupStep('details');
              }}
            >
              <CardHeader>
                <CardTitle>Ingresos Fijos</CardTitle>
                <CardDescription>Ideal si recibes un salario fijo mensual.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Define cantidades exactas de dinero para cada categoría basadas en tu sueldo.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {setupStep === 'details' && (
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => setSetupStep('type_selection')} className="pl-0">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>

            {budgetType === 'fixed' && (
              <div className="space-y-2">
                <Label>Ingreso Mensual Fijo</Label>
                <input
                  type="number"
                  placeholder="Ej. 2000"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={fixedIncome}
                  onChange={(e) => setFixedIncome(e.target.value)}
                />
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Distribución del Presupuesto</CardTitle>
                <CardDescription>
                  {budgetType === 'variable' 
                    ? "Asigna porcentajes a cada categoría (Total debe ser 100%)" 
                    : "Asigna montos a cada categoría"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {setupBudgets.map((budget, index) => (
                  <div key={index} className="flex items-end gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Categoría</Label>
                      <input
                        value={budget.category}
                        onChange={(e) => {
                          const newBudgets = [...setupBudgets];
                          newBudgets[index].category = e.target.value;
                          setSetupBudgets(newBudgets);
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label>{budgetType === 'variable' ? 'Porcentaje %' : 'Monto'}</Label>
                      <input
                        type="number"
                        value={budgetType === 'variable' ? budget.percentage : budget.amount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const newBudgets = [...setupBudgets];
                          if (budgetType === 'variable') newBudgets[index].percentage = val;
                          else newBudgets[index].amount = val;
                          setSetupBudgets(newBudgets);
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSetupBudgets(setupBudgets.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                
                <Button 
                  variant="outline" 
                  onClick={() => setSetupBudgets([...setupBudgets, { category: "", group: "Otros", percentage: 0, amount: 0 }])}
                >
                  <Plus className="mr-2 h-4 w-4" /> Añadir Categoría
                </Button>

                {budgetType === 'variable' && (
                  <div className="pt-4 text-right">
                    <span className={`font-bold ${setupBudgets.reduce((acc, b) => acc + b.percentage, 0) !== 100 ? "text-destructive" : "text-green-600"}`}>
                      Total: {setupBudgets.reduce((acc, b) => acc + b.percentage, 0)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button className="w-full" onClick={handleSaveConfiguration}>
              <Save className="mr-2 h-4 w-4" /> Guardar Configuración
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Dashboard View
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
            {budgetType === 'variable' 
              ? `Presupuesto Variable (Base: ${formatCurrency(baseIncome)})`
              : `Presupuesto Fijo (Total: ${formatCurrency(baseIncome)})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            if(confirm("¿Quieres editar la configuración del presupuesto? Esto te permitirá redefinir tus categorías y montos base.")) {
               setIsConfigured(false);
               setSetupStep('type_selection');
            }
          }}>
            <Settings className="mr-2 h-4 w-4" /> Configurar
          </Button>
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
                  <Label>{budgetType === 'variable' ? 'Porcentaje (%)' : 'Monto'}</Label>
                  <input
                    type="number"
                    placeholder={budgetType === 'variable' ? "Ej. 30" : "Ej. 500"}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newBudget.value}
                    onChange={(e) => setNewBudget({ ...newBudget, value: e.target.value })}
                    required
                    step={budgetType === 'variable' ? "0.1" : "0.01"}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Guardar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {Object.keys(groupedBudgets).length === 0 ? (
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
                          {budgetType === 'variable' 
                            ? `${budget.percentage}% (${formatCurrency(budget.calculatedAmount)})`
                            : formatCurrency(budget.calculatedAmount)}
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
                            setEditValue(budgetType === 'variable' ? (budget.percentage?.toString() || "") : budget.amount.toString());
                            setIsEditBudgetOpen(true);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar {budgetType === 'variable' ? 'Porcentaje' : 'Monto'}
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
              <Label>{budgetType === 'variable' ? 'Nuevo Porcentaje (%)' : 'Nuevo Monto'}</Label>
              <input
                type="number"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                required
                step={budgetType === 'variable' ? "0.1" : "0.01"}
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