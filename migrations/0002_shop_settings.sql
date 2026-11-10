CREATE TABLE shop_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  accepting_orders INTEGER NOT NULL DEFAULT 0 CHECK (accepting_orders IN (0, 1))
);
INSERT INTO shop_settings (id, accepting_orders) VALUES (1, 0);
