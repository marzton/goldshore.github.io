CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT,
  price REAL,
  billing_cycle TEXT
);

CREATE TABLE IF NOT EXISTS risk_configs (
  id TEXT PRIMARY KEY,
  name TEXT,
  is_published BOOLEAN,
  limits TEXT
);

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  subscription_id TEXT,
  status TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers (id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions (id)
);
