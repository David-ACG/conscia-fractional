alter table public.tasks
  add column if not exists trello_card_id text;

create index if not exists tasks_trello_card_id_idx
  on public.tasks (trello_card_id)
  where trello_card_id is not null;
