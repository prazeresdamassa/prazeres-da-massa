CREATE TABLE inventory (
  key TEXT PRIMARY KEY,
  available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO inventory(key) VALUES ('filling:frango');
INSERT INTO inventory(key) VALUES ('filling:carne');
INSERT INTO inventory(key) VALUES ('dough:tradicional');
INSERT INTO inventory(key) VALUES ('dough:verde');
INSERT INTO inventory(key) VALUES ('sauce:tomate');
INSERT INTO inventory(key) VALUES ('sauce:batata');
INSERT INTO inventory(key) VALUES ('extra:oregano');
INSERT INTO inventory(key) VALUES ('extra:queijo');
INSERT INTO inventory(key) VALUES ('drink:coca');
INSERT INTO inventory(key) VALUES ('drink:coca-zero');

ALTER TABLE orders ADD COLUMN preparation_started_at TEXT;
ALTER TABLE orders ADD COLUMN preparation_finished_at TEXT;
-- A última alteração dos pedidos em preparo registra a entrada nesse status.
UPDATE orders SET preparation_started_at = updated_at WHERE status = 'preparing';
-- Também cobre mudanças feitas por uma versão anterior durante a publicação.
CREATE TRIGGER orders_preparation_clock AFTER UPDATE OF status ON orders
WHEN OLD.status <> NEW.status
BEGIN
  UPDATE orders SET
    preparation_started_at = CASE WHEN NEW.status = 'preparing' THEN COALESCE(NEW.preparation_started_at, NEW.updated_at) ELSE NEW.preparation_started_at END,
    preparation_finished_at = CASE WHEN NEW.status IN ('dispatched','cancelled') AND NEW.preparation_started_at IS NOT NULL THEN COALESCE(NEW.preparation_finished_at, NEW.updated_at) ELSE NEW.preparation_finished_at END
  WHERE id = NEW.id;
END;
