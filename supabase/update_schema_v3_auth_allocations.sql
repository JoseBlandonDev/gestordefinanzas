-- Add user_id to existing tables
alter table transactions add column if not exists user_id uuid references auth.users(id);
alter table budgets add column if not exists user_id uuid references auth.users(id);
alter table settings add column if not exists user_id uuid references auth.users(id);

-- Create allocations table for tracking budget envelopes/rollovers
create table if not exists allocations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  category text not null,
  amount numeric not null,
  date date default current_date,
  description text,
  created_at timestamptz default now()
);

-- Enable RLS on new table
alter table allocations enable row level security;

-- Update Policies for Transactions
drop policy if exists "Allow all operations for authenticated users" on transactions;
drop policy if exists "Allow public access" on transactions;

create policy "Users can manage their own transactions" on transactions
  for all using (auth.uid() = user_id);

-- Update Policies for Budgets
drop policy if exists "Allow all operations for authenticated users" on budgets;
drop policy if exists "Allow public access" on budgets;

create policy "Users can manage their own budgets" on budgets
  for all using (auth.uid() = user_id);

-- Update Policies for Settings
-- Note: settings table might have global settings mixed with user settings. 
-- For this app, we'll assume all settings are user-specific now.
-- We might need to migrate existing settings to have a user_id if we were in prod, 
-- but for dev we'll just start fresh or assume null user_id is ignored.

create policy "Users can manage their own settings" on settings
  for all using (auth.uid() = user_id);

-- Policies for Allocations
create policy "Users can manage their own allocations" on allocations
  for all using (auth.uid() = user_id);

-- Create a trigger to automatically set user_id on insert if not provided
-- (Optional but helpful for client-side simplicity)
-- For now, we will enforce passing user_id from the client or use default if we set it up.
