# Gestor de Finanzas Personales

Este es un gestor de finanzas personales construido con Next.js, Tailwind CSS y Supabase.

## Características

- **Dashboard**: Vista general de tus finanzas.
- **Ingresos**: Gestión de fuentes de ingresos.
- **Gastos**: Control de gastos.
- **Presupuesto**: Planificación de presupuestos por categoría.
- **Estadísticas**: Visualización de datos con gráficos.

## Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/JoseBlandonDev/gestordefinanzas.git
cd gestordefinanzas
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Copia la URL del proyecto y la clave anónima (anon key).
3. Renombra `.env.local.example` a `.env.local` y añade tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=tu-url-de-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Despliegue en Vercel

1. Sube tu código a GitHub.
2. Importa el repositorio en [Vercel](https://vercel.com/).
3. En la configuración del proyecto en Vercel, añade las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Haz clic en "Deploy".

## Estructura del Proyecto

- `src/app`: Rutas de la aplicación (App Router).
- `src/components`: Componentes reutilizables (UI, Layout).
- `src/lib`: Utilidades y configuración de Supabase.
