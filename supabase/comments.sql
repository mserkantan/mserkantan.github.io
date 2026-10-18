-- serkantan.org yorumları — Supabase → SQL Editor'de bir kez çalıştır.
-- Ziyaretçiler (anon) yalnızca onaylı yorumları okuyabilir ve onaysız yorum ekleyebilir.
-- Onaylamak için: Table Editor → comments → "approved" kutusunu işaretle.

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  page_id    text not null check (char_length(page_id) between 1 and 20),
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  body       text not null check (char_length(btrim(body)) between 1 and 600),
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_page_approved_idx
  on public.comments (page_id, created_at) where approved;

alter table public.comments enable row level security;

-- Varsayılan yetkileri kaldır, sadece gerekenleri ver.
revoke all on public.comments from anon, authenticated;
grant select (page_id, name, body, approved, created_at) on public.comments to anon;
grant insert (page_id, name, body) on public.comments to anon;

drop policy if exists "Onaylı yorumlar herkese açık" on public.comments;
create policy "Onaylı yorumlar herkese açık"
  on public.comments for select to anon
  using (approved);

drop policy if exists "Herkes onaysız yorum bırakabilir" on public.comments;
create policy "Herkes onaysız yorum bırakabilir"
  on public.comments for insert to anon
  with check (approved = false);
