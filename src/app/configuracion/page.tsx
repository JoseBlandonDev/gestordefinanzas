"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
    } else {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">Personaliza tu experiencia en la aplicación.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
            <CardDescription>Gestión de tus datos personales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-md bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Restablecer Datos</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Esta acción eliminará todas las transacciones y presupuestos. No se puede deshacer.
              </p>
              <Button variant="destructive" size="sm" onClick={async () => {
                if (confirm("¿Estás SEGURO de que quieres borrar todo? Esta acción es irreversible.")) {
                  await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000"); 
                  await supabase.from("budgets").delete().neq("id", "00000000-0000-0000-0000-000000000000"); 
                  alert("Datos eliminados.");
                }
              }}>
                Borrar Todos los Datos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
