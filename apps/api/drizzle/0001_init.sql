CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  price REAL,
  billing_cycle TEXT,
  status TEXT DEFAULT 'active',
  features TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_configs (
  id TEXT PRIMARY KEY,
  name TEXT,
  is_published INTEGER DEFAULT 0,
  published_at TEXT,
  limits TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
);
