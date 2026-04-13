-- EcoQuest auth schema (MySQL / Aiven)

create table if not exists users (
  id bigint unsigned not null auto_increment,
  username varchar(32) not null,
  email varchar(320) null,
  password_hash varchar(255) not null,
  display_name varchar(80) null,
  avatar_url text null,
  created_at timestamp not null default current_timestamp,
  primary key (id),
  unique key uq_users_username (username),
  unique key uq_users_email (email)
);

-- express-mysql-session default table schema (if you use createDatabaseTable: true,
-- it will auto-create; keeping here for manual init and clarity)
create table if not exists user_sessions (
  session_id varchar(128) not null,
  expires int(11) unsigned not null,
  data mediumtext,
  primary key (session_id)
);

