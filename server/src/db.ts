import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    username TEXT UNIQUE,
    phone TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_group INTEGER DEFAULT 0,
    avatar TEXT DEFAULT '',
    disable_copying INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_participants (
    chat_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

try { db.exec(`ALTER TABLE chats ADD COLUMN disable_copying INTEGER DEFAULT 0`) } catch {};

try { db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''`) } catch {};
try { db.exec(`ALTER TABLE users ADD COLUMN privacy TEXT DEFAULT '{"phone":"Everyone","email":"Everyone","bio":"Everyone"}'`) } catch {};
try { db.exec(`ALTER TABLE users ADD COLUMN last_seen TEXT DEFAULT ''`) } catch {};

try { db.exec(`ALTER TABLE chat_participants ADD COLUMN pinned INTEGER DEFAULT 0`) } catch {};
try { db.exec(`ALTER TABLE chats ADD COLUMN is_group INTEGER DEFAULT 0`) } catch {};
try { db.exec(`ALTER TABLE chats ADD COLUMN avatar TEXT DEFAULT ''`) } catch {};
try { db.exec(`ALTER TABLE chat_participants ADD COLUMN role TEXT DEFAULT 'member'`) } catch {};
try { db.exec(`UPDATE chats SET is_group = 0 WHERE is_group IS NULL`) } catch {};
try { db.exec(`UPDATE chat_participants SET role = 'admin' WHERE role IS NULL OR role = ''`) } catch {};
try { db.exec(`ALTER TABLE messages ADD COLUMN reply_to_id INTEGER`) } catch {};
try { db.exec(`ALTER TABLE messages ADD COLUMN attachment_url TEXT`) } catch {};
try { db.exec(`ALTER TABLE messages ADD COLUMN attachment_type TEXT`) } catch {};
try { db.exec(`ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'`) } catch {};

db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS folder_chats (
    folder_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    PRIMARY KEY (folder_id, chat_id),
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cleared_chats (
    chat_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    cleared_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS deleted_messages (
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    deleted_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (poll_id, user_id),
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

try { db.exec(`ALTER TABLE messages ADD COLUMN poll_id INTEGER`) } catch {};

try { db.exec(`ALTER TABLE messages ADD COLUMN forward_from_id INTEGER`) } catch {};
try { db.exec(`ALTER TABLE messages ADD COLUMN forward_from_name TEXT DEFAULT ''`) } catch {};

db.exec(`
  CREATE TABLE IF NOT EXISTS public_keys (
    user_id INTEGER PRIMARY KEY,
    public_key TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price_rub INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    description TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    yookassa_payment_id TEXT,
    start_date TEXT NOT NULL DEFAULT (datetime('now')),
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    owner_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (owner_id, contact_id),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blocked_users (
    owner_id INTEGER NOT NULL,
    blocked_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (owner_id, blocked_id),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_invite_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    code TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const planCount = db.prepare('SELECT COUNT(*) as count FROM subscription_plans').get() as any
if (planCount.count === 0) {
  db.exec(`
    INSERT INTO subscription_plans (name, price_rub, duration_days, description) VALUES
      ('monthly', 150, 30, 'Pro на месяц'),
      ('annual', 1299, 365, 'Pro на год');
  `)
}

export default db
