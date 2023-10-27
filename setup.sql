CREATE TABLE follower(
  id INTEGER PRIMARY KEY,
  actorId TEXT NOT NULL,
  inbox TEXT NOT NULL,
  constraint actorId_unique UNIQUE (actorId)
);

CREATE index follower_inbox on follower(actorId);