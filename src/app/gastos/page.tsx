"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  date: string;
}

export default function GastosPage() {
  const [gastos, setGastos] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newExpense, setNewExpense] = useState({ 
    description: "", 
    amount: "", 
    category: "",
    date: new Date().toISOString().split('T')[0]
  });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchGastos();
  }, []);

  const fetchGastos = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("type", "expense")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setGastos(data || []);
    } catch (error) {
      console.error("Error fetching gastos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase
        .from("transactions")
        .insert([
          {
            user_id: session.user.id,
            description: newExpense.description,
            amount: parseFloat(newExpense.amount),
            type: "expense",
            category: newExpense.category || "General",
            date: newExpense.date,
          },
        ])
        .select();

      if (error) throw error;

      setGastos([data[0], ...gastos]);
      setNewExpense({ 
        description: "", 
        amount: "", 
        category: "",
        date: new Date().toISOString().split('T')[0]
      });
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding expense:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este gasto?")) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setGastos(gastos.filter(g => g.id !== id));
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  const totalGastos = gastos.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gastos</h2>
          <p className="text-muted-foreground">Controla tus gastos y compras.</p>
        </div>
        <Button variant="destructive" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="mr-2 h-4 w-4" /> {isAdding ? "Cancelar" : "Nuevo Gasto"}
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Añadir Nuevo Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <input
                  type="text"
                  placeholder="Descripción"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="Monto"
                  step="0.01"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Categoría (Opcional)"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                />
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" variant="destructive">Guardar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {formatCurrency(totalGastos)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando...</div>
          ) : gastos.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay gastos registrados aún.
            </div>
          ) : (
            <div className="space-y-4">
              {gastos.map((gasto) => (
                <div key={gasto.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="grid gap-1">
                    <p className="font-medium">{gasto.description}</p>
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <span className="bg-secondary px-2 py-0.5 rounded text-xs">{gasto.category}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(gasto.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-bold text-rose-500">
                      -{formatCurrency(gasto.amount)}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(gasto.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
