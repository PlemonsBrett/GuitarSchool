-- Public bucket for uploaded Guitar Pro files (.gp, .gp3-.gp7, .gpx). Anyone can read; only admins can write.
insert into storage.buckets (id, name, public, file_size_limit)
values ('tabs', 'tabs', true, 5242880)
on conflict (id) do update set public = true, file_size_limit = 5242880;

create policy "admin upload tabs" on storage.objects for insert to authenticated
  with check (bucket_id = 'tabs' and (select public.is_admin()));
create policy "admin update tabs" on storage.objects for update to authenticated
  using (bucket_id = 'tabs' and (select public.is_admin()));
create policy "admin delete tabs" on storage.objects for delete to authenticated
  using (bucket_id = 'tabs' and (select public.is_admin()));
