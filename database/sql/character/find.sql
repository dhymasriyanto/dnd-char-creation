SELECT * FROM characters
WHERE LOWER(name) LIKE LOWER($1)
   OR LOWER(COALESCE(background, '')) LIKE LOWER($1)
