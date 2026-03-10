-- Create transactions table
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  description text not null,
  amount numeric not null,
  type text check (type in ('income', 'expense')) not null,
  category text,
  date date default current_date,
  created_at timestamptz default now()
);

-- Create budgets table
create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  category text not null unique,
  amount numeric not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table transactions enable row level security;
alter table budgets enable row level security;

-- Create policies (for simplicity, allowing all operations for authenticated users, 
-- but in a real app you'd restrict to the user's own data)
create policy "Allow all operations for authenticated users" on transactions
  for all using (auth.role() = 'authenticated');

create policy "Allow all operations for authenticated users" on budgets
  for all using (auth.role() = 'authenticated');

-- Also allow public access for now if you want to test without auth, 
-- but better to stick to authenticated or just open for this demo if no auth implemented yet.
-- Since we haven't implemented Auth UI yet, let's allow public access for simplicity of the demo
-- WARNING: This is not secure for production.
create policy "Allow public access" on transactions
  for all using (true);

create policy "Allow public access" on budgets
  for all using (true);
