-- EcoQuest auth schema (MySQL / Aiven)

create table if not exists users (
  id bigint unsigned not null auto_increment,
  username varchar(32) not null,
  email varchar(320) null,
  password_hash varchar(255) not null,
  display_name varchar(80) null,
  profile_public tinyint(1) not null default 1,
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

-- ─────────────────────────────────────────────────────────────
-- ClimateQuest Iteration 1 user data (tasks/quiz/progress/scene)
-- ─────────────────────────────────────────────────────────────

create table if not exists user_state (
  user_id bigint unsigned not null,
  coins int not null default 0,
  xp int not null default 0,
  scene_type varchar(16) not null default 'forest',
  theme_locked tinyint(1) not null default 0,
  scene_progress int not null default 0,
  last_active_at timestamp null,
  trees int not null default 0,
  flowers int not null default 0,
  placements_json json null,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  primary key (user_id),
  constraint fk_user_state_user foreign key (user_id) references users(id) on delete cascade
);

create table if not exists task_logs (
  id bigint unsigned not null auto_increment,
  user_id bigint unsigned not null,
  task_id int not null,
  completed_on date not null,
  coins_earned int not null,
  co2_saved int not null,
  created_at timestamp not null default current_timestamp,
  primary key (id),
  unique key uq_task_once_per_day (user_id, task_id, completed_on),
  key ix_task_logs_user_day (user_id, completed_on),
  constraint fk_task_logs_user foreign key (user_id) references users(id) on delete cascade
);

create table if not exists quiz_results (
  id bigint unsigned not null auto_increment,
  user_id bigint unsigned not null,
  quiz_idx int not null,
  completed_on date not null,
  answer int not null,
  correct tinyint(1) not null,
  coins_earned int not null,
  created_at timestamp not null default current_timestamp,
  primary key (id),
  unique key uq_quiz_once_per_day (user_id, completed_on),
  key ix_quiz_results_user_day (user_id, completed_on),
  constraint fk_quiz_results_user foreign key (user_id) references users(id) on delete cascade
);

create table if not exists check_ins (
  id bigint unsigned not null auto_increment,
  user_id bigint unsigned not null,
  checked_on date not null,
  coins_earned int not null default 10,
  created_at timestamp not null default current_timestamp,
  primary key (id),
  unique key uq_check_user_day (user_id, checked_on),
  constraint fk_check_ins_user foreign key (user_id) references users(id) on delete cascade
);

create table if not exists weekly_progress (
  user_id bigint unsigned not null,
  week_start date not null,
  tasks_completed int not null default 0,
  goal int not null default 5,
  reward_claimed tinyint(1) not null default 0,
  bonus_coins int not null default 40,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  primary key (user_id, week_start),
  constraint fk_weekly_user foreign key (user_id) references users(id) on delete cascade
);

create table if not exists shop_ledger (
  id bigint unsigned not null auto_increment,
  user_id bigint unsigned not null,
  item varchar(32) not null,
  item_id varchar(80) null,
  cost int not null,
  created_at timestamp not null default current_timestamp,
  primary key (id),
  key ix_shop_user_time (user_id, created_at),
  constraint fk_shop_ledger_user foreign key (user_id) references users(id) on delete cascade
);

create table if not exists quick_action_logs (
  id bigint unsigned not null auto_increment,
  user_id bigint unsigned not null,
  action_key varchar(64) not null,
  logged_on date not null,
  coins_earned int not null default 5,
  created_at timestamp not null default current_timestamp,
  primary key (id),
  unique key uq_quick_user_key_day (user_id, action_key, logged_on),
  constraint fk_quick_action_user foreign key (user_id) references users(id) on delete cascade
);

