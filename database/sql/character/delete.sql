DELETE FROM characters WHERE id = $1
RETURNING id
