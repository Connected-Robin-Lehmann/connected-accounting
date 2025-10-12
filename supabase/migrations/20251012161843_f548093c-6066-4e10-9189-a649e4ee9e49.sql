-- Create profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Create clients table
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on clients
alter table public.clients enable row level security;

-- Clients policies
create policy "Users can view own clients"
  on public.clients for select
  using (auth.uid() = user_id);

create policy "Users can insert own clients"
  on public.clients for insert
  with check (auth.uid() = user_id);

create policy "Users can update own clients"
  on public.clients for update
  using (auth.uid() = user_id);

create policy "Users can delete own clients"
  on public.clients for delete
  using (auth.uid() = user_id);

-- Create payments table
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount decimal(10, 2) not null,
  status text not null check (status in ('paid', 'pending', 'overdue')),
  description text,
  due_date date,
  paid_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on payments
alter table public.payments enable row level security;

-- Payments policies
create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Users can insert own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own payments"
  on public.payments for update
  using (auth.uid() = user_id);

create policy "Users can delete own payments"
  on public.payments for delete
  using (auth.uid() = user_id);

-- Create documents table
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  file_type text,
  created_at timestamp with time zone default now()
);

-- Enable RLS on documents
alter table public.documents enable row level security;

-- Documents policies
create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- Create storage bucket for documents
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false);

-- Storage policies for documents
create policy "Users can view own documents"
  on storage.objects for select
  using (bucket_id = 'client-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload own documents"
  on storage.objects for insert
  with check (bucket_id = 'client-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own documents"
  on storage.objects for delete
  using (bucket_id = 'client-documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger function for updating updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add triggers for updated_at
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.clients
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.payments
  for each row execute function public.handle_updated_at();

-- Create trigger function for creating profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();