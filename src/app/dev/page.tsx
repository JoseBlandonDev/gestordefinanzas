"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, XCircle, AlertCircle, Database, Server } from "lucide-react";

interface StatusCheck {
  name: string;
  status: "pending" | "success" | "error";
  message?: string;
  details?: any;
}

export default function DevPage() {
  const [checks, setChecks] = useState<StatusCheck[]>([
    { name: "Supabase Connection", status: "pending" },
    { name: "Environment Variables", status: "pending" },
    { name: "Database Tables", status: "pending" },
  ]);

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    // Check Environment Variables
    const envVars = {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };

    updateCheck("Environment Variables", 
      envVars.url && envVars.key ? "success" : "error",
      envVars.url && envVars.key ? "Variables found" : "Missing variables",
      envVars
    );

    // Check Supabase Connection
    try {
      const { data, error } = await supabase.from("transactions").select("count").limit(1);
      
      if (error) {
        updateCheck("Supabase Connection", "error", error.message, error);
        updateCheck("Database Tables", "error", "Could not query transactions table");
      } else {
        updateCheck("Supabase Connection", "success", "Connected successfully");
        updateCheck("Database Tables", "success", "Tables accessible");
      }
    } catch (err: any) {
      updateCheck("Supabase Connection", "error", err.message);
    }
  };

  const updateCheck = (name: string, status: "pending" | "success" | "error", message?: string, details?: any) => {
    setChecks(prev => prev.map(check => 
      check.name === name ? { ...check, status, message, details } : check
    ));
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Panel de Desarrollo</h2>
        <p className="text-muted-foreground">Verificación de estado y configuración del sistema.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {checks.map((check) => (
          <Card key={check.name} className={
            check.status === "error" ? "border-destructive/50 bg-destructive/5" : 
            check.status === "success" ? "border-emerald-500/50 bg-emerald-500/5" : ""
          }>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {check.name}
              </CardTitle>
              {check.status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {check.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
              {check.status === "pending" && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{check.status}</div>
              {check.message && (
                <p className="text-xs text-muted-foreground mt-1">
                  {check.message}
                </p>
              )}
              {check.details && (
                <pre className="mt-2 w-full rounded-md bg-slate-950 p-2 text-xs text-slate-50 overflow-auto">
                  {JSON.stringify(check.details, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Sistema</CardTitle>
          <CardDescription>Detalles del entorno de ejecución</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Server className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Node Environment</p>
              <p className="text-sm text-muted-foreground">{process.env.NODE_ENV}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Database className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Supabase URL</p>
              <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                {process.env.NEXT_PUBLIC_SUPABASE_URL || "Not set"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
