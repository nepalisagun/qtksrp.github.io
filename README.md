# Fun Corner

A small static site for kids: jokes, a rainbow game, fun facts, a **picture gallery**, and a **message wall**. Pictures and messages are stored in **[Supabase](https://supabase.com/)** (Storage + Postgres) when `js/community-config.js` is filled in. Games and jokes do not use Supabase.

## One-time Supabase setup

Run these in the Supabase **SQL Editor** (adjust nothing if the names match your config).

### 1. Messages table

```sql
create table fc_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text not null,
  body text not null,
  constraint author_len check (char_length(author) <= 24),
  constraint body_len check (char_length(body) <= 500)
);

alter table fc_messages enable row level security;

create policy "Anyone can read messages"
  on fc_messages for select
  using (true);

create policy "Anyone can insert messages"
  on fc_messages for insert
  with check (true);
```

If the table already exists, skip this block.

### 2. Photo bucket + Storage policies

Creates a **public** bucket so images can be shown with ordinary `<img src="…">` URLs. Anyone with your site can upload/delete if these policies stay wide open — use a private family URL and monitor the bucket.

```sql
insert into storage.buckets (id, name, public)
values ('fc-photos', 'fc-photos', true)
on conflict (id) do update set public = excluded.public;

create policy "fc-photos read"
  on storage.objects for select
  using (bucket_id = 'fc-photos');

create policy "fc-photos insert"
  on storage.objects for insert
  with check (bucket_id = 'fc-photos');

create policy "fc-photos delete"
  on storage.objects for delete
  using (bucket_id = 'fc-photos');
```

If a policy name already exists, drop it first or rename the policy in SQL.

### 3. Site config

Edit `js/community-config.js`:

```javascript
window.FUN_CORNER_REMOTE = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_PUBLISHABLE_OR_LEGACY_ANON_KEY",
  messagesTable: "fc_messages",
  photosBucket: "fc-photos",
};
```

Use the **publishable** key (`sb_publishable_…`) or legacy **anon** JWT from **Project Settings → API Keys**. Never put the Postgres password or `postgresql://…` connection string in this file.

The app sends headers correctly for publishable keys (no `Authorization: Bearer` for non-JWT keys).

## Security notes

- The **publishable** key is visible in the browser — **RLS** and **Storage policies** are what protect you. Tighten policies if you expose the site widely.
- **Public bucket** means image URLs can be guessed only if object names are known; names are random UUIDs. For stronger control you’d switch to private buckets and signed URLs (more setup).
- This is **not** moderated kids’ social media — supervise use and who receives the link.

## Content Security Policy

The page allows `img-src` and `connect-src` to `https://*.supabase.co` for gallery images and APIs.

## Publish on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Deploy from a branch** → `main` → `/ (root)`.

## Try it locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.
