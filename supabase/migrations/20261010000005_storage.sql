-- Private resume bucket. Object path is <uid>/<resume-id>/<safe-name>; metadata ownership and storage authorization must both hold.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

create policy resumes_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_user()
    and exists (select 1 from public.resume_versions r
                where r.storage_path = storage.objects.name and r.user_id = (select auth.uid())
                  and r.state = 'pending_upload' and r.reservation_expires_at > now()));

-- DELETE ... WHERE needs row visibility, so the owner can also see their own not-yet-ready/being-removed objects.
-- The application only issues signed download URLs for versions in state 'ready'.
create policy resumes_select on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_user()
    and exists (select 1 from public.resume_versions r
                where r.storage_path = storage.objects.name and r.user_id = (select auth.uid())
                  and r.state in ('ready', 'pending_upload', 'delete_pending', 'failed')));

-- No UPDATE policy: stored files are immutable. Delete only for versions already marked for removal/failed.
create policy resumes_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.resume_versions r
                where r.storage_path = storage.objects.name and r.user_id = (select auth.uid())
                  and r.state in ('delete_pending', 'failed', 'pending_upload')));
