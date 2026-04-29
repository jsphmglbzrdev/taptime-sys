alter table public.user_profiles
add column if not exists employer_auth_id uuid;

update public.user_profiles as employee
set employer_auth_id = employer.auth_id
from public.user_profiles as employer
where employee.role = 'Employee'
  and employee.employer_auth_id is null
  and employee.employer_code is not null
  and employer.employer_code = employee.employer_code
  and employer.role in ('Employer', 'Admin');

create index if not exists user_profiles_employer_auth_id_idx
on public.user_profiles (employer_auth_id);

create index if not exists user_profiles_employer_code_idx
on public.user_profiles (employer_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_employer_auth_id_fkey'
  ) then
    alter table public.user_profiles
    add constraint user_profiles_employer_auth_id_fkey
    foreign key (employer_auth_id)
    references public.user_profiles (auth_id)
    on delete set null;
  end if;
end
$$;
