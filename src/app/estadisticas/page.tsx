"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from "@/lib/supabase";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface ChartData {
  name: string;
  ingresos: number;
  gastos: number;
}

interface PieData {
  name: string;
  value: number;
}

export default function EstadisticasPage() {
  const [barData, setBarData] = useState<ChartData[]>([]);
  const [pieData, setPieData] = useState<PieData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;

      if (!transactions) return;

      // Process data for Bar Chart (Monthly)
      const monthlyData: Record<string, { ingresos: number; gastos: number }> = {};
      
      transactions.forEach((t) => {
        const date = new Date(t.date);
        const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        
        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = { ingresos: 0, gastos: 0 };
        }

        if (t.type === 'income') {
          monthlyData[monthYear].ingresos += t.amount;
        } else {
          monthlyData[monthYear].gastos += t.amount;
        }
      });

      const formattedBarData = Object.keys(monthlyData).map((key) => ({
        name: key,
        ingresos: monthlyData[key].ingresos,
        gastos: monthlyData[key].gastos,
      }));

      setBarData(formattedBarData);

      // Process data for Pie Chart (Expenses by Category)
      const categoryData: Record<string, number> = {};
      
      transactions
        .filter((t) => t.type === 'expense')
        .forEach((t) => {
          const category = t.category || "General";
          categoryData[category] = (categoryData[category] || 0) + t.amount;
        });

      const formattedPieData = Object.keys(categoryData).map((key) => ({
        name: key,
        value: categoryData[key],
      }));

      setPieData(formattedPieData);

    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Estadísticas</h2>
        <p className="text-muted-foreground">Analiza tus tendencias financieras.</p>
      </div>

      {loading ? (
        <div>Cargando estadísticas...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Ingresos vs Gastos (Mensual)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
                  <Bar dataKey="gastos" fill="#f43f5e" name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-2 md:col-span-1">
            <CardHeader>
              <CardTitle>Distribución de Gastos</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number | string | Array<number | string> | undefined) => `$${Number(value || 0).toFixed(2)}`} />
                    <Legend />
                  </PieChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
