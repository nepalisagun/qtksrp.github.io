/**
 * Shared message wall (see README for SQL + RLS).
 *
 * Never put your Postgres password or postgresql:// URL here — only this HTTPS URL and a publishable
 * (or legacy anon JWT) key from Supabase → Project Settings → API Keys.
 */
window.FUN_CORNER_REMOTE = {
  supabaseUrl: "https://gsekoulukzavrlfquvxp.supabase.co",
  anonKey: "sb_publishable_hGS4qfFasTbhnyHvYQnh6w_u9NIO2Vg",
  messagesTable: "fc_messages",
  photosBucket: "fc-photos",
  /** Optional: cloud copy of graded journal rows (insert-only for anon; see README SQL). Omit or leave unset to disable. */
  // journalSubmissionsTable: "fc_journal_submissions",
  // commentsTable: "fc_photo_comments",
  // photoLikesTable: "fc_photo_likes",
  // commentLikesTable: "fc_comment_likes",
};
