-- Add group_category to budgets table
alter table budgets 
add column if not exists group_category text default 'Gastos Diarios';
