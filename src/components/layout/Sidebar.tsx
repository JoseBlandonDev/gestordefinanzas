"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  PieChart,
  Wallet,
  Settings,
  Code,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Ingresos",
    href: "/ingresos",
    icon: TrendingUp,
  },
  {
    title: "Gastos",
    href: "/gastos",
    icon: TrendingDown,
  },
  {
    title: "Presupuesto",
    href: "/presupuesto",
    icon: Wallet,
  },
  {
    title: "Estadísticas",
    href: "/estadisticas",
    icon: PieChart,
  },
  {
    title: "Dev Tools",
    href: "/dev",
    icon: Code,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Finanzas
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
      <nav className="flex-1 space-y-1 px-4">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <Link
          href="/configuracion"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Settings className="h-4 w-4" />
          Configuración
        </Link>
      </div>
    </div>
  );
}
