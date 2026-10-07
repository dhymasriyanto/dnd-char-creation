INSERT INTO characters(
    user_id,
    edition,
    name,
    level,
    proficiency_bonus,
    hp,
    max_hp,
    temp_hp,
    ac,
    initiative,
    speed,
    hit_dice,
    background,
    alignment,
    inspiration
) VALUES (
    ${user_id},
    COALESCE(${edition}, '2014'),
    ${name},
    COALESCE(${level}, 1),
    COALESCE(${proficiency_bonus}, 2),
    COALESCE(${hp}, 0),
    COALESCE(${max_hp}, 0),
    COALESCE(${temp_hp}, 0),
    COALESCE(${ac}, 10),
    COALESCE(${initiative}, 0),
    COALESCE(${speed}, 30),
    ${hit_dice},
    ${background},
    ${alignment},
    COALESCE(${inspiration}, FALSE)
)
RETURNING id
