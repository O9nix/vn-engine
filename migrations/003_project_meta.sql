-- Project feed meta (description + cover)
ALTER TABLE projects
  ADD COLUMN description TEXT NULL AFTER title,
  ADD COLUMN cover_url VARCHAR(1024) NULL AFTER description;
