import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress"; // Need to create this component or use a simple div
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function PresupuestoPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Presupuesto</h2>
          <p className="text-muted-foreground">Planifica tus límites de gasto.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Presupuesto
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alimentación</CardTitle>
            <CardDescription>Límite mensual: $400.00</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Gastado: $250.00</span>
              <span>Restante: $150.00</span>
            </div>
            <Progress value={62.5} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transporte</CardTitle>
            <CardDescription>Límite mensual: $150.00</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Gastado: $45.00</span>
              <span>Restante: $105.00</span>
            </div>
            <Progress value={30} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
