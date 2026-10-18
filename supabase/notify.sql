-- Yeni yorum gelince e-posta bildirimi (Resend). Supabase → SQL Editor'de bir kez çalıştır.
-- Resend API anahtarı Supabase Vault'ta "resend_api_key" adıyla durur; anahtar yoksa tetikleyici hiçbir şey yapmaz.
-- ALICI_EPOSTA yerine kendi adresini yaz (veritabanındaki hâlinde gerçek adres var).
-- Resend'de doğrulanmış alan adı olmadan onboarding@resend.dev yalnızca Resend hesabının e-postasına gönderebilir.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api_key text;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if api_key is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'serkantan.org <onboarding@resend.dev>',
      'to', jsonb_build_array('ALICI_EPOSTA@ornek.com'),
      'subject', 'Yeni yorum: ' || new.name,
      'text', new.name || ' (' || new.page_id || ') yazdı:' || E'\n\n' || new.body || E'\n\n'
              || 'Onaylamak için: https://supabase.com/dashboard/project/lyjgwzatxasvwopmsect/editor'
    )
  );
  return new;
exception when others then
  -- Bildirim hatası yorumun kaydedilmesini asla engellemesin.
  return new;
end;
$$;

revoke all on function public.notify_new_comment() from public, anon, authenticated;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_new_comment();
