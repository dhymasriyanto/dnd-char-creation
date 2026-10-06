/*
    Select all characters with class, race, and subclass info
*/

SELECT c.*, 
       cc.name AS class_name, 
       cr.name AS race_name,
       csc.name AS sub_class_name
FROM characters c
LEFT JOIN LATERAL (
    SELECT string_agg(
        CASE 
            WHEN (SELECT count(*) FROM character_classes WHERE character_id = c.id) > 1 
            THEN CONCAT(name, ' ', level) 
            ELSE name 
        END, 
        ' / '
    ) AS name 
    FROM character_classes 
    WHERE character_id = c.id
) cc ON true
LEFT JOIN LATERAL (
    SELECT name FROM character_races WHERE character_id = c.id LIMIT 1
) cr ON true
LEFT JOIN LATERAL (
    SELECT string_agg(name, ' / ') AS name 
    FROM character_sub_classes 
    WHERE character_id = c.id
) csc ON true
ORDER BY c.id DESC
