"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, MoreVertical, Settings, ArrowLeft, Save, ArrowRightLeft, DollarSign, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

interface BudgetPlan {
  id: string;
  category: string;
  amount: number; // Fixed amount or 0
  percentage: number | null;
  group_category: string;
}

interface BudgetStatus extends BudgetPlan {
  totalAllocated: number;
  spent: number;
  available: number;
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
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  
  // Setup State
  const [setupBudgets, setSetupBudgets] = useState<{category: string, group: string, percentage: number, amount: number}[]>(
    DEFAULT_CATEGORIES.map(c => ({ category: c.category, group: c.group, percentage: c.defaultPercentage, amount: 0 }))
  );

  // Modal States
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [isMoveMoneyOpen, setIsMoveMoneyOpen] = useState(false);
  const [isExtraIncomeOpen, setIsExtraIncomeOpen] = useState(false);

  // Form States
  const [newBudget, setNewBudget] = useState({ category: "", value: "", group: "Gastos Diarios" });
  const [selectedBudget, setSelectedBudget] = useState<BudgetStatus | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [editValue, setEditValue] = useState("");
  
  const [incomeAmount, setIncomeAmount] = useState("");
  const [moveAmount, setMoveAmount] = useState("");
  const [targetCategory, setTargetCategory] = useState("");
  const [extraIncomeCategory, setExtraIncomeCategory] = useState("");

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // Should be handled by middleware/layout, but safety check

      const { data: settings } = await supabase.from("settings").select("*").eq("user_id", session.user.id);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch Settings
      const { data: settingsData } = await supabase.from("settings").select("*").eq("user_id", session.user.id);
      const type = settingsData?.find(s => s.key === 'budget_type')?.value as 'fixed' | 'variable';
      const fixedIncomeVal = parseFloat(settingsData?.find(s => s.key === 'fixed_income_amount')?.value || "0");
      
      setBudgetType(type);
      setFixedIncome(fixedIncomeVal.toString());

      // 2. Fetch Data
      const [
        { data: budgetsData }, 
        { data: expensesData },
        { data: allocationsData }
      ] = await Promise.all([
        supabase.from("budgets").select("*").eq("user_id", session.user.id).order('created_at', { ascending: true }),
        supabase.from("transactions").select("amount, category").eq("type", "expense").eq("user_id", session.user.id),
        supabase.from("allocations").select("amount, category").eq("user_id", session.user.id)
      ]);

      // 3. Process Data
      const spentByCategory: Record<string, number> = {};
      expensesData?.forEach((expense) => {
        const category = expense.category || "General";
        spentByCategory[category] = (spentByCategory[category] || 0) + expense.amount;
      });

      const allocatedByCategory: Record<string, number> = {};
      allocationsData?.forEach((allocation) => {
        const category = allocation.category || "General";
        allocatedByCategory[category] = (allocatedByCategory[category] || 0) + allocation.amount;
      });

      const processedBudgets = budgetsData?.map((budget) => {
        const totalAllocated = allocatedByCategory[budget.category] || 0;
        const spent = spentByCategory[budget.category] || 0;
        const available = totalAllocated - spent;

        return {
          ...budget,
          totalAllocated,
          spent,
          available,
          group_category: budget.group_category || "Otros"
        };
      }) || [];

      setBudgets(processedBudgets);
      setTotalAvailable(processedBudgets.reduce((acc, b) => acc + b.available, 0));

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfiguration = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // 1. Save Settings
      const settingsUpdates = [
        { key: 'budget_type', value: budgetType, user_id: session.user.id },
        { key: 'fixed_income_amount', value: budgetType === 'fixed' ? fixedIncome : '0', user_id: session.user.id }
      ];
      
      await supabase.from("settings").upsert(settingsUpdates, { onConflict: 'key' });

      // 2. Save Budgets (Replace existing)
      await supabase.from("budgets").delete().eq("user_id", session.user.id);

      const newBudgets = setupBudgets.map(b => ({
        user_id: session.user.id,
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

  // --- ACTIONS ---

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeAmount) return;
    
    const amount = parseFloat(incomeAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // Distribute income based on budget percentages
      // Note: For Fixed budget, this might be "Extra Income" logic, but here we assume Variable mode mainly uses this.
      // If Fixed mode uses this, it distributes by %? Or adds to "Unassigned"?
      // Let's assume Variable mode distributes by %.
      
      const allocations = budgets.map(b => ({
        user_id: session.user.id,
        category: b.category,
        amount: amount * ((b.percentage || 0) / 100),
        description: `Ingreso Variable: ${formatCurrency(amount)}`,
        date: new Date().toISOString()
      }));

      // Also create the Income Transaction
      await supabase.from("transactions").insert({
        user_id: session.user.id,
        description: "Ingreso Variable",
        amount: amount,
        type: "income",
        category: "Ingreso",
        date: new Date().toISOString()
      });

      await supabase.from("allocations").insert(allocations);

      setIsAddIncomeOpen(false);
      setIncomeAmount("");
      fetchDashboardData();
    } catch (error) {
      console.error("Error adding income:", error);
    }
  };

  const handleStartMonth = async () => {
    if (!confirm("¿Iniciar mes? Esto asignará los montos fijos a cada categoría.")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const allocations = budgets.map(b => ({
        user_id: session.user.id,
        category: b.category,
        amount: b.amount, // Fixed amount
        description: `Mensualidad Fija - ${new Date().toLocaleString('default', { month: 'long' })}`,
        date: new Date().toISOString()
      }));

      // Create Income Transaction for record
      const totalIncome = budgets.reduce((acc, b) => acc + b.amount, 0);
      await supabase.from("transactions").insert({
        user_id: session.user.id,
        description: "Ingreso Mensual Fijo",
        amount: totalIncome,
        type: "income",
        category: "Salario",
        date: new Date().toISOString()
      });

      await supabase.from("allocations").insert(allocations);
      fetchDashboardData();
    } catch (error) {
      console.error("Error starting month:", error);
    }
  };

  const handleAddExtraIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeAmount || !extraIncomeCategory) return;
    
    const amount = parseFloat(incomeAmount);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      await supabase.from("transactions").insert({
        user_id: session.user.id,
        description: "Ingreso Extra",
        amount: amount,
        type: "income",
        category: "Extra",
        date: new Date().toISOString()
      });

      await supabase.from("allocations").insert({
        user_id: session.user.id,
        category: extraIncomeCategory,
        amount: amount,
        description: "Asignación Ingreso Extra",
        date: new Date().toISOString()
      });

      setIsExtraIncomeOpen(false);
      setIncomeAmount("");
      setExtraIncomeCategory("");
      fetchDashboardData();
    } catch (error) {
      console.error("Error adding extra income:", error);
    }
  };

  const handleMoveMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget || !moveAmount || !targetCategory) return;

    const amount = parseFloat(moveAmount);
    if (amount > selectedBudget.available) {
      alert("No tienes suficientes fondos en esta categoría.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const transfers = [
        {
          user_id: session.user.id,
          category: selectedBudget.category,
          amount: -amount, // Deduct from source
          description: `Transferencia a ${targetCategory}`,
          date: new Date().toISOString()
        },
        {
          user_id: session.user.id,
          category: targetCategory,
          amount: amount, // Add to target
          description: `Transferencia desde ${selectedBudget.category}`,
          date: new Date().toISOString()
        }
      ];

      await supabase.from("allocations").insert(transfers);

      setIsMoveMoneyOpen(false);
      setMoveAmount("");
      setTargetCategory("");
      setSelectedBudget(null);
      fetchDashboardData();
    } catch (error) {
      console.error("Error moving money:", error);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget || !expenseAmount) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { error } = await supabase.from("transactions").insert([{
        user_id: session.user.id,
        description: expenseDesc || selectedBudget.category,
        amount: parseFloat(expenseAmount),
        type: "expense",
        category: selectedBudget.category,
        date: new Date().toISOString()
      }]);

      if (error) throw error;

      setIsAddExpenseOpen(false);
      setExpenseAmount("");
      setExpenseDesc("");
      setSelectedBudget(null);
      fetchDashboardData();
    } catch (error) {
      console.error("Error adding expense:", error);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudget.category || !newBudget.value) return;
    const val = parseFloat(newBudget.value);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const budgetData = {
        user_id: session.user.id,
        category: newBudget.category,
        group_category: newBudget.group,
        type: budgetType === 'variable' ? 'percentage' : 'fixed',
        percentage: budgetType === 'variable' ? val : null,
        amount: budgetType === 'fixed' ? val : 0
      };

      await supabase.from("budgets").insert([budgetData]);
      
      setNewBudget({ category: "", value: "", group: "Gastos Diarios" });
      setIsAddBudgetOpen(false);
      fetchDashboardData();
    } catch (error) {
      console.error("Error adding budget:", error);
    }
  };

  const handleEditBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget || !editValue) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const val = parseFloat(editValue);
      const updates: any = {};
      if (budgetType === 'variable') updates.percentage = val;
      else updates.amount = val;

      await supabase.from("budgets").update(updates).eq("id", selectedBudget.id);

      setIsEditBudgetOpen(false);
      setEditValue("");
      setSelectedBudget(null);
      fetchDashboardData();
    } catch (error) {
      console.error("Error updating budget:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro? Esto no borrará el historial pero sí la planificación futura.")) return;
    try {
      await supabase.from("budgets").delete().eq("id", id);
      fetchDashboardData();
    } catch (error) {
      console.error("Error deleting budget:", error);
    }
  };

  // --- RENDER ---

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
                  Cada vez que recibas un ingreso, se distribuirá automáticamente según los porcentajes que definas.
                  El dinero no gastado se acumula para el siguiente mes.
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
                  Define montos fijos mensuales. Al inicio de cada mes, se asignan los fondos automáticamente.
                  Puedes añadir ingresos extra si es necesario.
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
                <Label>Ingreso Mensual Fijo Estimado</Label>
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
                <CardTitle>Planificación de Categorías</CardTitle>
                <CardDescription>
                  {budgetType === 'variable' 
                    ? "Asigna porcentajes a cada categoría (Total debe ser 100%)" 
                    : "Asigna montos fijos a cada categoría"}
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
  }, {} as Record<string, BudgetStatus[]>);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Presupuesto</h2>
          <p className="text-muted-foreground">
            {budgetType === 'variable' ? "Gestión de Ingresos Variables" : "Gestión de Ingresos Fijos"}
          </p>
        </div>
        <div className="flex gap-2">
          {budgetType === 'variable' ? (
            <Button onClick={() => setIsAddIncomeOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <DollarSign className="mr-2 h-4 w-4" /> Registrar Ingreso
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleStartMonth}>
                <Calendar className="mr-2 h-4 w-4" /> Iniciar Mes
              </Button>
              <Button onClick={() => setIsExtraIncomeOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" /> Ingreso Extra
              </Button>
            </>
          )}
          
          <Button variant="outline" onClick={() => {
            if(confirm("¿Reconfigurar presupuesto?")) {
               setIsConfigured(false);
               setSetupStep('type_selection');
            }
          }}>
            <Settings className="mr-2 h-4 w-4" />
          </Button>

          <Dialog open={isAddBudgetOpen} onOpenChange={setIsAddBudgetOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir Categoría al Plan</DialogTitle>
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
                  <Label>{budgetType === 'variable' ? 'Porcentaje (%)' : 'Monto Fijo'}</Label>
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
                // Calculate percentage of AVAILABLE funds used, or just visual representation
                // If available is negative, it's overspent.
                // Let's show: Spent / (Spent + Available) if Available > 0
                // Or simply Spent vs TotalAllocated
                const percentage = budget.totalAllocated > 0 
                  ? Math.min((budget.spent / budget.totalAllocated) * 100, 100)
                  : 0;
                
                return (
                  <Card key={budget.id} className="flex flex-col">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-base">{budget.category}</CardTitle>
                        <CardDescription className="text-xs">
                          Plan: {budgetType === 'variable' ? `${budget.percentage}%` : formatCurrency(budget.amount)}
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
                            <Pencil className="mr-2 h-4 w-4" /> Editar Plan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedBudget(budget);
                            setIsMoveMoneyOpen(true);
                          }}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> Mover Dinero
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
                          <span className={budget.available < 0 ? "text-destructive" : "text-emerald-500"}>
                            {formatCurrency(budget.available)}
                          </span>
                        </div>
                        <Progress value={percentage} className={percentage >= 100 ? "bg-red-200 [&>div]:bg-red-500" : ""} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Gastado: {formatCurrency(budget.spent)}</span>
                          <span>Asignado: {formatCurrency(budget.totalAllocated)}</span>
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

      {/* Add Income Modal (Variable) */}
      <Dialog open={isAddIncomeOpen} onOpenChange={setIsAddIncomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Ingreso Variable</DialogTitle>
            <DialogDescription>
              El monto se distribuirá automáticamente en tus categorías según los porcentajes definidos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddIncome} className="space-y-4">
            <div className="space-y-2">
              <Label>Monto Recibido</Label>
              <input
                type="number"
                placeholder="0.00"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                required
                step="0.01"
              />
            </div>
            <DialogFooter>
              <Button type="submit">Registrar y Distribuir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Extra Income Modal (Fixed) */}
      <Dialog open={isExtraIncomeOpen} onOpenChange={setIsExtraIncomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Ingreso Extra</DialogTitle>
            <DialogDescription>
              Añade dinero extra a una categoría específica.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddExtraIncome} className="space-y-4">
            <div className="space-y-2">
              <Label>Monto Extra</Label>
              <input
                type="number"
                placeholder="0.00"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                required
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Asignar a Categoría</Label>
              <Select value={extraIncomeCategory} onValueChange={setExtraIncomeCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map(b => (
                    <SelectItem key={b.id} value={b.category}>{b.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">Añadir Fondos</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move Money Modal */}
      <Dialog open={isMoveMoneyOpen} onOpenChange={setIsMoveMoneyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Dinero</DialogTitle>
            <DialogDescription>
              Transfiere fondos disponibles de {selectedBudget?.category} a otra categoría.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMoveMoney} className="space-y-4">
            <div className="space-y-2">
              <Label>Monto a Mover (Max: {selectedBudget ? formatCurrency(selectedBudget.available) : 0})</Label>
              <input
                type="number"
                placeholder="0.00"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={moveAmount}
                onChange={(e) => setMoveAmount(e.target.value)}
                required
                step="0.01"
                max={selectedBudget?.available}
              />
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={targetCategory} onValueChange={setTargetCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría destino" />
                </SelectTrigger>
                <SelectContent>
                  {budgets.filter(b => b.id !== selectedBudget?.id).map(b => (
                    <SelectItem key={b.id} value={b.category}>{b.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">Transferir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Editar Plan de {selectedBudget?.category}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditBudget} className="space-y-4">
            <div className="space-y-2">
              <Label>{budgetType === 'variable' ? 'Nuevo Porcentaje (%)' : 'Nuevo Monto Fijo'}</Label>
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
              <Button type="submit">Actualizar Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
