UPDATE characters SET
    edition = COALESCE(${edition}, edition),
    name = COALESCE(${name}, name),
    level = COALESCE(${level}, level),
    proficiency_bonus = COALESCE(${proficiency_bonus}, proficiency_bonus),
    hp = COALESCE(${hp}, hp),
    max_hp = COALESCE(${max_hp}, max_hp),
    temp_hp = COALESCE(${temp_hp}, temp_hp),
    ac = COALESCE(${ac}, ac),
    initiative = COALESCE(${initiative}, initiative),
    speed = COALESCE(${speed}, speed),
    hit_dice = COALESCE(${hit_dice}, hit_dice),
    background = COALESCE(${background}, background),
    alignment = COALESCE(${alignment}, alignment),
    inspiration = COALESCE(${inspiration}, inspiration)
WHERE id = ${id}
RETURNING id
