-- Add new columns to budgets table
alter table budgets 
add column if not exists type text check (type in ('fixed', 'percentage')) default 'fixed',
add column if not exists percentage numeric;

-- Create a settings table for global app configuration (like preferred budget mode)
create table if not exists settings (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value text not null,
  created_at timestamptz default now()
);

-- Insert default settings if not exists
insert into settings (key, value) values ('budget_mode', 'fixed') on conflict (key) do nothing;
