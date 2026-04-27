begin;

alter table public.user_profiles
  add column if not exists employee_code varchar(7),
  add column if not exists attendance_qr_payload text,
  add column if not exists attendance_qr_svg text;

create or replace function public.generate_unique_employee_code()
returns varchar(7)
language plpgsql
as $$
declare
  candidate varchar(7);
begin
  loop
    candidate := lpad((floor(random() * 10000000))::int::text, 7, '0');

    exit when not exists (
      select 1
      from public.user_profiles
      where employee_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

update public.user_profiles
set employee_code = public.generate_unique_employee_code()
where employee_code is null
   or employee_code !~ '^\d{7}$';

update public.user_profiles
set attendance_qr_payload = json_build_object(
  'type', 'taptime-attendance',
  'employeeCode', employee_code
)::text
where employee_code is not null
  and attendance_qr_payload is null;

create unique index if not exists user_profiles_employee_code_uidx
  on public.user_profiles (employee_code);

create unique index if not exists time_entries_auth_id_shift_date_uidx
  on public.time_entries (auth_id, shift_date);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_employee_code_format_chk'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_employee_code_format_chk
      check (employee_code ~ '^\d{7}$');
  end if;
end
$$;

alter table public.user_profiles
  alter column employee_code set not null;

commit;

