do $$
begin
  if exists (
    select employer_code
    from public.user_profiles
    where employer_code is not null
    group by employer_code
    having count(*) > 1
  ) then
    raise exception 'Duplicate employer_code values exist. Resolve duplicates before applying unique index.';
  end if;
end
$$;

create unique index if not exists user_profiles_employer_code_unique_idx
on public.user_profiles (employer_code)
where employer_code is not null;
