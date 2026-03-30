# Fun Corner

Static kids’ site: games, rainbow, facts, a **photo gallery** (owner uploads only), **likes / comments / replies** on each photo, and a **message wall**. Uses [Supabase](https://supabase.com/) Auth + Storage + Postgres.

## 1. Supabase Auth (owner account)

1. Dashboard → **Authentication** → **Providers** → enable **Email**.
2. **Authentication** → **Sign In / Providers** → turn **off** “Allow new users to sign up” (recommended) so random people cannot create accounts.
3. **Authentication** → **Users** → **Add user** → enter **your** email and password. This is the **owner** who can upload/delete photos.
4. Copy that user’s **User UID** (UUID). You will paste it into SQL in step 3 below.

## 2. Database: messages (if not already created)

```sql
create table if not exists fc_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text not null,
  body text not null,
  constraint author_len check (char_length(author) <= 24),
  constraint body_len check (char_length(body) <= 500)
);

alter table fc_messages enable row level security;

drop policy if exists "Anyone can read messages" on fc_messages;
drop policy if exists "Anyone can insert messages" on fc_messages;

create policy "Anyone can read messages"
  on fc_messages for select using (true);

create policy "Anyone can insert messages"
  on fc_messages for insert with check (true);
```

## 3. Storage: only **you** upload/delete photos

Replace `YOUR_AUTH_USER_UUID` with the UUID from **Authentication → Users** (step 1).

```sql
-- Bucket (public read so <img src> works)
insert into storage.buckets (id, name, public)
values ('fc-photos', 'fc-photos', true)
on conflict (id) do update set public = excluded.public;

-- Remove old open policies if you ran the previous README
drop policy if exists "fc-photos read" on storage.objects;
drop policy if exists "fc-photos insert" on storage.objects;
drop policy if exists "fc-photos delete" on storage.objects;
drop policy if exists "fc photos read" on storage.objects;
drop policy if exists "fc photos insert" on storage.objects;
drop policy if exists "fc photos delete" on storage.objects;

-- Anyone can view images
create policy "fc-photos read"
  on storage.objects for select
  using (bucket_id = 'fc-photos');

-- Only your Auth user can upload
create policy "fc-photos insert owner"
  on storage.objects for insert
  with check (
    bucket_id = 'fc-photos'
    and auth.uid() = 'YOUR_AUTH_USER_UUID'::uuid
  );

-- Only your Auth user can delete
create policy "fc-photos delete owner"
  on storage.objects for delete
  using (
    bucket_id = 'fc-photos'
    and auth.uid() = 'YOUR_AUTH_USER_UUID'::uuid
  );
```

### Multiple people who can upload/delete

Each person needs their **own** Supabase Auth user (each has a **User UID**). Replace the **insert** and **delete** policies with one rule that allows **any** of those UUIDs:

```sql
drop policy if exists "fc-photos insert owner" on storage.objects;
drop policy if exists "fc-photos delete owner" on storage.objects;

create policy "fc-photos insert owners"
  on storage.objects for insert
  with check (
    bucket_id = 'fc-photos'
    and auth.uid() in (
      'FIRST_USER_UUID'::uuid,
      'SECOND_USER_UUID'::uuid
      -- add more lines: ,'ANOTHER_UUID'::uuid
    )
  );

create policy "fc-photos delete owners"
  on storage.objects for delete
  using (
    bucket_id = 'fc-photos'
    and auth.uid() in (
      'FIRST_USER_UUID'::uuid,
      'SECOND_USER_UUID'::uuid
    )
  );
```

The site does not list these UUIDs — only **signed-in** users are checked. Anyone in the `in (...)` list signs in on **Owner sign-in** and can add/remove photos; visitors without an account still only view/comment/like.

## 4. Tables: comments, likes, comment-likes

Visitors can **read** and **add** comments/likes; `delete` on like rows lets people **unlike** (open policy — fine for a small family site).

```sql
create table if not exists fc_photo_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  photo_key text not null,
  author text not null,
  body text not null,
  parent_id uuid references fc_photo_comments(id) on delete cascade,
  constraint author_len check (char_length(author) <= 24),
  constraint body_len check (char_length(body) <= 500)
);

create index if not exists idx_fc_photo_comments_photo on fc_photo_comments(photo_key);

alter table fc_photo_comments enable row level security;

drop policy if exists "fc_photo_comments read" on fc_photo_comments;
drop policy if exists "fc_photo_comments insert" on fc_photo_comments;

create policy "fc_photo_comments read"
  on fc_photo_comments for select using (true);

create policy "fc_photo_comments insert"
  on fc_photo_comments for insert with check (true);

create table if not exists fc_photo_likes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  photo_key text not null,
  voter_id text not null,
  unique (photo_key, voter_id)
);

alter table fc_photo_likes enable row level security;

drop policy if exists "fc_photo_likes read" on fc_photo_likes;
drop policy if exists "fc_photo_likes insert" on fc_photo_likes;
drop policy if exists "fc_photo_likes delete" on fc_photo_likes;

create policy "fc_photo_likes read" on fc_photo_likes for select using (true);
create policy "fc_photo_likes insert" on fc_photo_likes for insert with check (true);
create policy "fc_photo_likes delete" on fc_photo_likes for delete using (true);

create table if not exists fc_comment_likes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  comment_id uuid not null references fc_photo_comments(id) on delete cascade,
  voter_id text not null,
  unique (comment_id, voter_id)
);

alter table fc_comment_likes enable row level security;

drop policy if exists "fc_comment_likes read" on fc_comment_likes;
drop policy if exists "fc_comment_likes insert" on fc_comment_likes;
drop policy if exists "fc_comment_likes delete" on fc_comment_likes;

create policy "fc_comment_likes read" on fc_comment_likes for select using (true);
create policy "fc_comment_likes insert" on fc_comment_likes for insert with check (true);
create policy "fc_comment_likes delete" on fc_comment_likes for delete using (true);
```

## 5. Site config

Edit `js/community-config.js` with your project URL and **publishable** (or legacy anon) key. Optional overrides: `messagesTable`, `photosBucket`, `commentsTable`, `photoLikesTable`, `commentLikesTable`.

## 6. Use the site

1. Open the site → **Owner sign-in** → your Supabase Auth email/password → **Add a picture**.
2. Others open the same page (no sign-in): they see photos, can **♥** like, open **Comments**, post, **Reply**, and **♥** comments.
3. **Message wall** still accepts posts from anyone with the link unless you tighten `fc_messages` policies.

## Security notes

- **Photo metadata:** The site never uploads your original file. It decodes the image to pixels and writes a **new JPEG** (via canvas), which strips typical **EXIF / GPS / IPTC / XMP** and other embedded tags. The stored name is a random UUID — not your device filename.
- **Owner password** is never stored in the repo; only your session in the browser after sign-in.
- **Publishable key** is public; protection is **RLS** and **Storage policies** (especially `auth.uid()` on uploads).
- Open **like/comment delete** policies mean someone could remove another person’s like if they guess `voter_id` (a random browser id) — unlikely; tighten later if needed.
- Not suitable for unsupervised public internet; keep the URL private and supervise children.

## GitHub Pages

**Settings → Pages** → deploy from **`main`** / **`/` (root)**.

## Local preview

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.
