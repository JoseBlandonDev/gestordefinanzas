"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, DollarSign, CreditCard, Wallet, Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  date: string;
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
  });
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
    } else {
      fetchTransactions(session.user.id);
    }
  };

  const fetchTransactions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(5);

      if (error) throw error;
      setTransactions(data || []);

      // Calculate summary
      const { data: allTransactions, error: allError } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("user_id", userId);

      if (allError) throw allError;

      const income = allTransactions
        ?.filter((t) => t.type === "income")
        .reduce((acc, curr) => acc + curr.amount, 0) || 0;

      const expenses = allTransactions
        ?.filter((t) => t.type === "expense")
        .reduce((acc, curr) => acc + curr.amount, 0) || 0;

      setSummary({
        totalBalance: income - expenses,
        totalIncome: income,
        totalExpenses: expenses,
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Bienvenido a tu gestor de finanzas personales.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ingresos">
            <Button variant="outline" className="gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Ingreso
            </Button>
          </Link>
          <Link href="/gastos">
            <Button variant="destructive" className="gap-2">
              <ArrowDownRight className="h-4 w-4" />
              Gasto
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalBalance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ahorros</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalIncome - summary.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">Disponible</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Resumen Financiero</CardTitle>
            <CardDescription>Tus ingresos y gastos de este año.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <Activity className="mr-2 h-4 w-4" />
              <Link href="/estadisticas" className="hover:underline">Ver Estadísticas Detalladas</Link>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Transacciones Recientes</CardTitle>
            <CardDescription>Tus últimos movimientos financieros.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {loading ? (
                <div>Cargando...</div>
              ) : transactions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay transacciones recientes.</div>
              ) : (
                transactions.map((t) => (
                  <div key={t.id} className="flex items-center">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                      {t.type === 'income' ? (
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-rose-600" />
                      )}
                    </div>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">{t.description}</p>
                      <p className="text-sm text-muted-foreground">{t.category}</p>
                    </div>
                    <div className={`ml-auto font-medium ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
