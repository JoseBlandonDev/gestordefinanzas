-- Add savings-related columns to budgets table
alter table budgets 
add column if not exists is_savings boolean default false,
add column if not exists savings_cap numeric,
add column if not exists overflow_category text;
