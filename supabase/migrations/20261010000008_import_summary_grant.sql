-- Staged batches keep their column/status mapping in `summary` so a review round can be re-staged.
-- The update policy already limits changes to batches in state 'staged'; commit_import_batch overwrites summary on commit.
grant update (summary) on public.import_batches to authenticated;
