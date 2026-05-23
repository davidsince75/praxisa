CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#0d9488',
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tags_user_id ON tags(user_id);

CREATE TABLE document_tags (
  document_id UUID NOT NULL REFERENCES student_documents(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX idx_document_tags_tag_id ON document_tags(tag_id);
