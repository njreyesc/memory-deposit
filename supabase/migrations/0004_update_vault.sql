-- 0004_update_vault.sql
-- Добавляем поля для заметок/писем и переключаем type на 'note' | 'video'.
-- На этапе прототипа таблица пуста, поэтому снимаем NOT NULL с name и
-- encrypted_blob_path (они были заточены под шифрованные документы).

alter table vault_items drop constraint if exists vault_items_type_check;

alter table vault_items
  add column if not exists title      text,
  add column if not exists content    text,
  add column if not exists video_path text;

alter table vault_items
  alter column name drop not null,
  alter column encrypted_blob_path drop not null;

alter table vault_items
  add constraint vault_items_type_check
  check (type in ('note', 'video'));
