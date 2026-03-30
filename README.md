# Fun Corner

A small, static website for kids: jokes, a rainbow game, fun facts, a **local picture gallery**, and a **message wall** (chat-style layout). Built for [GitHub Pages](https://pages.github.com/). By default there are no third-party trackers.

## What GitHub Pages can and cannot do

GitHub Pages only serves **static files**. It cannot store uploaded photos or run a real chat server. That is why:

- **Pictures** are kept in the visitor’s browser (**IndexedDB**). They do not upload to GitHub or anywhere else unless you add your own backend later.
- **Messages** are stored in **localStorage** on that same browser unless you turn on optional **shared messages** (below).

So: **true “friends on their own phones see my picture”** needs a storage service or server. **True shared chat** also needs a small backend or a service such as [Supabase](https://supabase.com/).

## Optional: shared message wall (Supabase)

If a grown-up is comfortable with a public (or semi-public) board and the [Supabase](https://supabase.com/) terms:

1. Create a project and run this SQL in the SQL editor:

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

2. Copy the project URL and either the **publishable** key (`sb_publishable_…`) or the legacy **anon** JWT from **Project Settings → API Keys**.

3. Edit `js/community-config.js` and set (the field is still named `anonKey` for compatibility):

```javascript
window.FUN_CORNER_REMOTE = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_PUBLISHABLE_OR_LEGACY_ANON_KEY",
  messagesTable: "fc_messages",
};
```

The site sends the right headers for both key types (publishable keys are not sent as `Authorization: Bearer`, per Supabase docs).

The site’s Content Security Policy already allows HTTPS requests to `https://*.supabase.co`. **Anyone with the key and URL could post** if RLS is this open — use a private family URL, monitor the table, tighten RLS later, or add moderation. This is **not** a replacement for supervised chat with strangers.

## Security and privacy (defaults)

- **Static files** — HTML, CSS, and JavaScript from your repo; no server you run for the Pages site itself.
- **Content Security Policy (CSP)** — Scripts and styles from this site only; `img-src` includes `blob:` for gallery thumbnails; `connect-src` includes `https://*.supabase.co` for optional shared messages only.
- **No HTML forms that navigate away** — compose UI uses buttons; `form-action` stays locked down.
- **Permissions Policy** — Camera, microphone, geolocation, and payment APIs are disabled for the page.
- **Referrer policy** — Limits referrer leakage on outbound links.
- **`.nojekyll`** — Disables Jekyll so files are served as committed.

HTTPS is provided by GitHub for `*.github.io` (and custom domains with HTTPS). A **public** repo exposes the same static files as the live site; do **not** put secrets other than Supabase’s **anon** key (designed to be public with RLS) in the repo if you are unsure about your policies.

## Publish on GitHub Pages

1. Create a new repository on GitHub and push this folder (or make it the root of an existing repo).
2. In the repo on GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **`main`** (or `master`) and folder **`/ (root)`**, then save.

After a minute, the site will be available at `https://<username>.github.io/<repo>/` (user/organization site URLs differ if the repo is named `<username>.github.io`).

## Try it locally

From this directory:

```bash
npx --yes serve .
```

Or with Python:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` (or the port shown).
