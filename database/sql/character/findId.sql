SELECT c.*, 
       u.username AS player_name, 
       u.username AS owner_username
FROM characters c
LEFT JOIN users u ON u.id = c.user_id
WHERE c.public_id = $1::text OR c.id::text = $1::text
LIMIT 1
