create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  body text not null,
  tags text[] default '{}',
  image_urls text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  user_id uuid
);

alter table public.articles enable row level security;

drop policy if exists "Public can read articles" on public.articles;
drop policy if exists "Authenticated users can insert articles" on public.articles;
drop policy if exists "Authenticated users can update articles" on public.articles;
drop policy if exists "Authenticated users can delete articles" on public.articles;

create policy "Public can read articles"
on public.articles
for select
using (true);

create policy "Authenticated users can insert articles"
on public.articles
for insert
to authenticated
with check (auth.uid() is not null);

create policy "Authenticated users can update articles"
on public.articles
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "Authenticated users can delete articles"
on public.articles
for delete
to authenticated
using (auth.uid() is not null);

-- Storage policies. Ejecutar después de crear el bucket público article-images.
drop policy if exists "Public can read article images" on storage.objects;
drop policy if exists "Authenticated users can upload article images" on storage.objects;
drop policy if exists "Authenticated users can update article images" on storage.objects;
drop policy if exists "Authenticated users can delete article images" on storage.objects;

create policy "Public can read article images"
on storage.objects
for select
using (bucket_id = 'article-images');

create policy "Authenticated users can upload article images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'article-images');

create policy "Authenticated users can update article images"
on storage.objects
for update
to authenticated
using (bucket_id = 'article-images')
with check (bucket_id = 'article-images');

create policy "Authenticated users can delete article images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'article-images');
