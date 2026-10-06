-- Projects metadata (scenario JSON lives on disk)
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  published TINYINT(1) NOT NULL DEFAULT 0,
  scenario_key VARCHAR(512) NOT NULL,
  node_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_projects_owner (owner_id),
  KEY idx_projects_published_updated (published, updated_at),
  CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
