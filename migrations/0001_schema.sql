-- 콘텐츠(페이지 JSON), 업로드 이미지, 문의 내역을 저장하는 D1 스키마.
-- 기존 KV 기반 저장소를 대체한다.

CREATE TABLE IF NOT EXISTS content (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  filename TEXT,
  data BLOB NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  message TEXT,
  submitted_at TEXT,
  read INTEGER DEFAULT 0
);
