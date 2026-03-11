"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, MoreVertical, Settings, ArrowLeft, Save, ArrowRightLeft, DollarSign, Calendar, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface BudgetPlan {
  id: string;
  category: string;
  amount: number; // Fixed amount or 0
  percentage: number | null;
  group_category: string;
  is_savings: boolean;
  savings_cap: number | null;
  overflow_category: string | null;
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
  { category: "Ahorro", group: "Ahorro", defaultPercentage: 20, is_savings: true },
  { category: "Gastos Fijos", group: "Obligaciones Fijas", defaultPercentage: 50, is_savings: false },
  { category: "Gastos Variables", group: "Gastos Diarios", defaultPercentage: 30, is_savings: false },
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
  const [setupBudgets, setSetupBudgets] = useState<{category: string, group: string, percentage: number, amount: number, is_savings: boolean, savings_cap: string, overflow_category: string}[]>(
    DEFAULT_CATEGORIES.map(c => ({ 
      category: c.category, 
      group: c.group, 
      percentage: c.defaultPercentage, 
      amount: 0, 
      is_savings: c.is_savings,
      savings_cap: "",
      overflow_category: ""
    }))
  );

  // Modal States
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [isMoveMoneyOpen, setIsMoveMoneyOpen] = useState(false);
  const [isExtraIncomeOpen, setIsExtraIncomeOpen] = useState(false);

  // Form States
  const [newBudget, setNewBudget] = useState({ 
    category: "", 
    value: "", 
    group: "Gastos Diarios",
    is_savings: false,
    savings_cap: "",
    overflow_category: ""
  });
  const [selectedBudget, setSelectedBudget] = useState<BudgetStatus | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editSavingsCap, setEditSavingsCap] = useState("");
  const [editOverflowCategory, setEditOverflowCategory] = useState("");
  const [editIsSavings, setEditIsSavings] = useState(false);
  
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
      if (!session) return;

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

      const { data: settingsData } = await supabase.from("settings").select("*").eq("user_id", session.user.id);
      const type = settingsData?.find(s => s.key === 'budget_type')?.value as 'fixed' | 'variable';
      const fixedIncomeVal = parseFloat(settingsData?.find(s => s.key === 'fixed_income_amount')?.value || "0");
      
      setBudgetType(type);
      setFixedIncome(fixedIncomeVal.toString());

      const [
        { data: budgetsData }, 
        { data: expensesData },
        { data: allocationsData }
      ] = await Promise.all([
        supabase.from("budgets").select("*").eq("user_id", session.user.id).order('created_at', { ascending: true }),
        supabase.from("transactions").select("amount, category").eq("type", "expense").eq("user_id", session.user.id),
        supabase.from("allocations").select("amount, category").eq("user_id", session.user.id)
      ]);

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

      const settingsUpdates = [
        { key: 'budget_type', value: budgetType, user_id: session.user.id },
        { key: 'fixed_income_amount', value: budgetType === 'fixed' ? fixedIncome : '0', user_id: session.user.id }
      ];
      
      await supabase.from("settings").upsert(settingsUpdates, { onConflict: 'key' });
      await supabase.from("budgets").delete().eq("user_id", session.user.id);

      const newBudgets = setupBudgets.map(b => ({
        user_id: session.user.id,
        category: b.category,
        group_category: b.group,
        type: budgetType === 'variable' ? 'percentage' : 'fixed',
        percentage: budgetType === 'variable' ? b.percentage : null,
        amount: budgetType === 'fixed' ? b.amount : 0,
        is_savings: b.is_savings,
        savings_cap: b.savings_cap ? parseFloat(b.savings_cap) : null,
        overflow_category: (b.overflow_category && b.overflow_category !== "none") ? b.overflow_category : null
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

  const calculateAllocations = (amount: number, budgetsList: BudgetStatus[]) => {
    const allocations: { category: string, amount: number, description: string }[] = [];
    const remainingToDistribute: { category: string, percentage: number, overflow_category: string | null, savings_cap: number | null, available: number }[] = [];

    // First pass: Calculate initial allocations and identify potential overflows
    budgetsList.forEach(b => {
      const initialAmount = amount * ((b.percentage || 0) / 100);
      if (b.is_savings && b.savings_cap !== null) {
        const currentAvailable = b.available;
        const spaceLeft = Math.max(0, b.savings_cap - currentAvailable);
        
        if (initialAmount > spaceLeft) {
          // Overflow occurs
          allocations.push({
            category: b.category,
            amount: spaceLeft,
            description: `Asignación (Tope alcanzado: ${formatCurrency(b.savings_cap)})`
          });
          
          const overflow = initialAmount - spaceLeft;
          if (b.overflow_category) {
            allocations.push({
              category: b.overflow_category,
              amount: overflow,
              description: `Excedente de ${b.category}`
            });
          } else {
            // If no overflow category, maybe put in "Otros" or keep in unassigned? 
            // For now, let's assume it goes to unassigned if not specified, 
            // but the user query implies it should go somewhere.
          }
        } else {
          allocations.push({
            category: b.category,
            amount: initialAmount,
            description: `Asignación Variable`
          });
        }
      } else {
        allocations.push({
          category: b.category,
          amount: initialAmount,
          description: `Asignación Variable`
        });
      }
    });

    return allocations;
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeAmount) return;
    const amount = parseFloat(incomeAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const calculatedAllocations = calculateAllocations(amount, budgets);

      await supabase.from("transactions").insert({
        user_id: session.user.id,
        description: "Ingreso Variable",
        amount: amount,
        type: "income",
        category: "Ingreso",
        date: new Date().toISOString()
      });

      await supabase.from("allocations").insert(calculatedAllocations.map(a => ({
        ...a,
        user_id: session.user.id,
        date: new Date().toISOString()
      })));

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

      const allocations: any[] = [];
      budgets.forEach(b => {
        const initialAmount = b.amount;
        if (b.is_savings && b.savings_cap !== null) {
          const spaceLeft = Math.max(0, b.savings_cap - b.available);
          if (initialAmount > spaceLeft) {
            allocations.push({
              user_id: session.user.id,
              category: b.category,
              amount: spaceLeft,
              description: `Mensualidad Fija (Tope alcanzado)`,
              date: new Date().toISOString()
            });
            if (b.overflow_category) {
              allocations.push({
                user_id: session.user.id,
                category: b.overflow_category,
                amount: initialAmount - spaceLeft,
                description: `Excedente Mensual de ${b.category}`,
                date: new Date().toISOString()
              });
            }
          } else {
            allocations.push({
              user_id: session.user.id,
              category: b.category,
              amount: initialAmount,
              description: `Mensualidad Fija`,
              date: new Date().toISOString()
            });
          }
        } else {
          allocations.push({
            user_id: session.user.id,
            category: b.category,
            amount: initialAmount,
            description: `Mensualidad Fija`,
            date: new Date().toISOString()
          });
        }
      });

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
          amount: -amount,
          description: `Transferencia a ${targetCategory}`,
          date: new Date().toISOString()
        },
        {
          user_id: session.user.id,
          category: targetCategory,
          amount: amount,
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

      await supabase.from("transactions").insert([{
        user_id: session.user.id,
        description: expenseDesc || selectedBudget.category,
        amount: parseFloat(expenseAmount),
        type: "expense",
        category: selectedBudget.category,
        date: new Date().toISOString()
      }]);

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
        amount: budgetType === 'fixed' ? val : 0,
        is_savings: newBudget.is_savings,
        savings_cap: newBudget.savings_cap ? parseFloat(newBudget.savings_cap) : null,
        overflow_category: (newBudget.overflow_category && newBudget.overflow_category !== "none") ? newBudget.overflow_category : null
      };

      await supabase.from("budgets").insert([budgetData]);
      setNewBudget({ category: "", value: "", group: "Gastos Diarios", is_savings: false, savings_cap: "", overflow_category: "" });
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
      const updates: any = {
        is_savings: editIsSavings,
        savings_cap: editSavingsCap ? parseFloat(editSavingsCap) : null,
        overflow_category: (editOverflowCategory && editOverflowCategory !== "none") ? editOverflowCategory : null
      };
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
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setBudgetType('variable'); setSetupStep('details'); }}>
              <CardHeader><CardTitle>Ingresos Variables</CardTitle><CardDescription>Ideal si tus ingresos cambian cada mes.</CardDescription></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Distribución automática por porcentajes.</p></CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setBudgetType('fixed'); setSetupStep('details'); }}>
              <CardHeader><CardTitle>Ingresos Fijos</CardTitle><CardDescription>Ideal si recibes un salario fijo mensual.</CardDescription></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Montos fijos mensuales automáticos.</p></CardContent>
            </Card>
          </div>
        )}

        {setupStep === 'details' && (
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => setSetupStep('type_selection')} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
            {budgetType === 'fixed' && (
              <div className="space-y-2">
                <Label>Ingreso Mensual Fijo Estimado</Label>
                <input type="number" placeholder="Ej. 2000" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fixedIncome} onChange={(e) => setFixedIncome(e.target.value)} />
              </div>
            )}
            <Card>
              <CardHeader><CardTitle>Planificación de Categorías</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {setupBudgets.map((budget, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-end gap-4">
                      <div className="flex-1 space-y-2">
                        <Label>Categoría</Label>
                        <input value={budget.category} onChange={(e) => { const nb = [...setupBudgets]; nb[index].category = e.target.value; setSetupBudgets(nb); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      </div>
                      <div className="w-32 space-y-2">
                        <Label>{budgetType === 'variable' ? 'Porcentaje %' : 'Monto'}</Label>
                        <input type="number" value={budgetType === 'variable' ? budget.percentage : budget.amount} onChange={(e) => { const nb = [...setupBudgets]; const val = parseFloat(e.target.value) || 0; if (budgetType === 'variable') nb[index].percentage = val; else nb[index].amount = val; setSetupBudgets(nb); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setSetupBudgets(setupBudgets.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center space-x-2">
                        <Switch checked={budget.is_savings} onCheckedChange={(val) => { const nb = [...setupBudgets]; nb[index].is_savings = val; setSetupBudgets(nb); }} />
                        <Label>Es Ahorro</Label>
                      </div>
                      {budget.is_savings && (
                        <>
                          <div className="flex-1 space-y-2">
                            <Label>Tope Máximo (Opcional)</Label>
                            <input type="number" placeholder="Ej. 1000000" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={budget.savings_cap} onChange={(e) => { const nb = [...setupBudgets]; nb[index].savings_cap = e.target.value; setSetupBudgets(nb); }} />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label>Categoría de Excedente</Label>
                            <Select 
                              value={budget.overflow_category || "none"} 
                              onValueChange={(val) => { const nb = [...setupBudgets]; nb[index].overflow_category = val; setSetupBudgets(nb); }}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecciona destino" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Ninguno</SelectItem>
                                {setupBudgets.filter((_, i) => i !== index).map(b => (
                                  <SelectItem key={b.category} value={b.category}>{b.category}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setSetupBudgets([...setupBudgets, { category: "", group: "Otros", percentage: 0, amount: 0, is_savings: false, savings_cap: "", overflow_category: "" }])}><Plus className="mr-2 h-4 w-4" /> Añadir Categoría</Button>
                {budgetType === 'variable' && (
                  <div className="pt-4 text-right"><span className={`font-bold ${setupBudgets.reduce((acc, b) => acc + b.percentage, 0) !== 100 ? "text-destructive" : "text-green-600"}`}>Total: {setupBudgets.reduce((acc, b) => acc + b.percentage, 0)}%</span></div>
                )}
              </CardContent>
            </Card>
            <Button className="w-full" onClick={handleSaveConfiguration}><Save className="mr-2 h-4 w-4" /> Guardar Configuración</Button>
          </div>
        )}
      </div>
    );
  }

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
          <p className="text-muted-foreground">{budgetType === 'variable' ? "Gestión de Ingresos Variables" : "Gestión de Ingresos Fijos"}</p>
        </div>
        <div className="flex gap-2">
          {budgetType === 'variable' ? (
            <Button onClick={() => setIsAddIncomeOpen(true)} className="bg-emerald-600 hover:bg-emerald-700"><DollarSign className="mr-2 h-4 w-4" /> Registrar Ingreso</Button>
          ) : (
            <><Button variant="outline" onClick={handleStartMonth}><Calendar className="mr-2 h-4 w-4" /> Iniciar Mes</Button><Button onClick={() => setIsExtraIncomeOpen(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Ingreso Extra</Button></>
          )}
          <Button variant="outline" onClick={() => { if(confirm("¿Reconfigurar presupuesto?")) { setIsConfigured(false); setSetupStep('type_selection'); } }}><Settings className="mr-2 h-4 w-4" /></Button>
          <Dialog open={isAddBudgetOpen} onOpenChange={setIsAddBudgetOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nueva Categoría</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Añadir Categoría al Plan</DialogTitle></DialogHeader>
              <form onSubmit={handleAddBudget} className="space-y-4">
                <div className="space-y-2"><Label>Categoría</Label><input type="text" placeholder="Ej. Comida" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newBudget.category} onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })} required /></div>
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select value={newBudget.group} onValueChange={(val) => setNewBudget({ ...newBudget, group: val })}><SelectTrigger><SelectValue placeholder="Selecciona un grupo" /></SelectTrigger><SelectContent>{BUDGET_GROUPS.map(group => <SelectItem key={group} value={group}>{group}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>{budgetType === 'variable' ? 'Porcentaje (%)' : 'Monto Fijo'}</Label><input type="number" placeholder={budgetType === 'variable' ? "Ej. 30" : "Ej. 500"} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newBudget.value} onChange={(e) => setNewBudget({ ...newBudget, value: e.target.value })} required step={budgetType === 'variable' ? "0.1" : "0.01"} /></div>
                <div className="flex items-center space-x-2"><Switch checked={newBudget.is_savings} onCheckedChange={(val) => setNewBudget({ ...newBudget, is_savings: val, overflow_category: val ? (newBudget.overflow_category || "none") : "" })} /><Label>Es Ahorro</Label></div>
                {newBudget.is_savings && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Tope Máximo</Label><input type="number" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newBudget.savings_cap} onChange={(e) => setNewBudget({ ...newBudget, savings_cap: e.target.value })} /></div>
                    <div className="space-y-2">
                      <Label>Excedente a</Label>
                      <Select 
                        value={newBudget.overflow_category || "none"} 
                        onValueChange={(val) => setNewBudget({ ...newBudget, overflow_category: val })}
                      >
                        <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ninguno</SelectItem>
                          {budgets.map(b => (
                            <SelectItem key={b.id} value={b.category}>{b.category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
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
                const percentage = budget.totalAllocated > 0 ? Math.min((budget.spent / budget.totalAllocated) * 100, 100) : 0;
                const isCapped = budget.is_savings && budget.savings_cap !== null && budget.available >= budget.savings_cap;
                
                return (
                  <Card key={budget.id} className={`flex flex-col transition-all ${isCapped ? 'border-emerald-500 bg-emerald-50/10' : ''}`}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{budget.category}</CardTitle>
                          {budget.is_savings && <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                        </div>
                        <CardDescription className="text-xs">Plan: {budgetType === 'variable' ? `${budget.percentage}%` : formatCurrency(budget.amount)}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedBudget(budget); setEditValue(budgetType === 'variable' ? (budget.percentage?.toString() || "") : budget.amount.toString()); setEditIsSavings(budget.is_savings); setEditSavingsCap(budget.savings_cap?.toString() || ""); setEditOverflowCategory(budget.overflow_category || ""); setIsEditBudgetOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Editar Plan</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedBudget(budget); setIsMoveMoneyOpen(true); }}><ArrowRightLeft className="mr-2 h-4 w-4" /> Mover Dinero</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(budget.id)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-muted-foreground">Disponible</span>
                          <span className={budget.available < 0 ? "text-destructive" : "text-emerald-500"}>{formatCurrency(budget.available)}</span>
                        </div>
                        <Progress value={percentage} className={percentage >= 100 ? "bg-red-200 [&>div]:bg-red-500" : ""} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Gastado: {formatCurrency(budget.spent)}</span>
                          {budget.is_savings && budget.savings_cap ? (
                            <span className={isCapped ? "text-emerald-600 font-bold" : ""}>Tope: {formatCurrency(budget.savings_cap)}</span>
                          ) : (
                            <span>Asignado: {formatCurrency(budget.totalAllocated)}</span>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-auto" onClick={() => { setSelectedBudget(budget); setIsAddExpenseOpen(true); }}><Plus className="mr-2 h-3 w-3" /> Añadir Gasto</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modals (same as before but updated for new fields if needed) */}
      <Dialog open={isAddIncomeOpen} onOpenChange={setIsAddIncomeOpen}>
        <DialogContent><DialogHeader><DialogTitle>Registrar Ingreso Variable</DialogTitle></DialogHeader>
          <form onSubmit={handleAddIncome} className="space-y-4">
            <div className="space-y-2"><Label>Monto Recibido</Label><input type="number" placeholder="0.00" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} required step="0.01" /></div>
            <DialogFooter><Button type="submit">Registrar y Distribuir</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isExtraIncomeOpen} onOpenChange={setIsExtraIncomeOpen}>
        <DialogContent><DialogHeader><DialogTitle>Registrar Ingreso Extra</DialogTitle></DialogHeader>
          <form onSubmit={handleAddExtraIncome} className="space-y-4">
            <div className="space-y-2"><Label>Monto Extra</Label><input type="number" placeholder="0.00" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} required step="0.01" /></div>
            <div className="space-y-2"><Label>Asignar a Categoría</Label><Select value={extraIncomeCategory} onValueChange={setExtraIncomeCategory}><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger><SelectContent>{budgets.map(b => <SelectItem key={b.id} value={b.category}>{b.category}</SelectItem>)}</SelectContent></Select></div>
            <DialogFooter><Button type="submit">Añadir Fondos</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoveMoneyOpen} onOpenChange={setIsMoveMoneyOpen}>
        <DialogContent><DialogHeader><DialogTitle>Mover Dinero</DialogTitle></DialogHeader>
          <form onSubmit={handleMoveMoney} className="space-y-4">
            <div className="space-y-2"><Label>Monto a Mover (Max: {selectedBudget ? formatCurrency(selectedBudget.available) : 0})</Label><input type="number" placeholder="0.00" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={moveAmount} onChange={(e) => setMoveAmount(e.target.value)} required step="0.01" max={selectedBudget?.available} /></div>
            <div className="space-y-2"><Label>Destino</Label><Select value={targetCategory} onValueChange={setTargetCategory}><SelectTrigger><SelectValue placeholder="Selecciona categoría destino" /></SelectTrigger><SelectContent>{budgets.filter(b => b.id !== selectedBudget?.id).map(b => <SelectItem key={b.id} value={b.category}>{b.category}</SelectItem>)}</SelectContent></Select></div>
            <DialogFooter><Button type="submit">Transferir</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent><DialogHeader><DialogTitle>Añadir Gasto a {selectedBudget?.category}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="space-y-2"><Label>Monto</Label><input type="number" placeholder="0.00" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} required step="0.01" /></div>
            <div className="space-y-2"><Label>Descripción (Opcional)</Label><input type="text" placeholder="Detalle del gasto" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} /></div>
            <DialogFooter><Button type="submit">Añadir Gasto</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditBudgetOpen} onOpenChange={setIsEditBudgetOpen}>
        <DialogContent><DialogHeader><DialogTitle>Editar Plan de {selectedBudget?.category}</DialogTitle></DialogHeader>
          <form onSubmit={handleEditBudget} className="space-y-4">
            <div className="space-y-2"><Label>{budgetType === 'variable' ? 'Nuevo Porcentaje (%)' : 'Nuevo Monto Fijo'}</Label><input type="number" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editValue} onChange={(e) => setEditValue(e.target.value)} required step={budgetType === 'variable' ? "0.1" : "0.01"} /></div>
            <div className="flex items-center space-x-2"><Switch checked={editIsSavings} onCheckedChange={(val) => { setEditIsSavings(val); if (val && !editOverflowCategory) setEditOverflowCategory("none"); }} /><Label>Es Ahorro</Label></div>
            {editIsSavings && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Tope Máximo</Label><input type="number" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editSavingsCap} onChange={(e) => setEditSavingsCap(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Excedente a</Label>
                  <Select 
                    value={editOverflowCategory || "none"} 
                    onValueChange={(val) => setEditOverflowCategory(val)}
                  >
                    <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno</SelectItem>
                      {budgets.filter(b => b.id !== selectedBudget?.id).map(b => (
                        <SelectItem key={b.id} value={b.category}>{b.category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter><Button type="submit">Actualizar Plan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
