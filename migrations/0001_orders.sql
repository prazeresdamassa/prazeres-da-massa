CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','preparing','dispatched','completed','cancelled')),
  customer_json TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX orders_created_at ON orders(created_at);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
