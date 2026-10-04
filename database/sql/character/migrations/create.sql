CREATE TABLE IF NOT EXISTS characters (
    id BIGSERIAL PRIMARY KEY,
    level BIGINT NOT NULL DEFAULT 1,
    proficiency_bonus BIGINT DEFAULT 2,
    hp BIGINT DEFAULT 0,
    inspiration BOOLEAN DEFAULT FALSE,
    background VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    alignment VARCHAR(255),
    temp_hp BIGINT DEFAULT 0,
    hit_dice VARCHAR(50),
    max_hp BIGINT DEFAULT 0,
    ac BIGINT DEFAULT 10,
    initiative BIGINT DEFAULT 0,
    speed BIGINT DEFAULT 30
);

CREATE TABLE IF NOT EXISTS ability_scores (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    strength BIGINT DEFAULT 10,
    dexterity BIGINT DEFAULT 10,
    constitution BIGINT DEFAULT 10,
    intelligence BIGINT DEFAULT 10,
    wisdom BIGINT DEFAULT 10,
    charisma BIGINT DEFAULT 10
);

CREATE TABLE IF NOT EXISTS character_classes (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    level BIGINT NOT NULL DEFAULT 1,
    source VARCHAR(255),
    page VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS character_class_features (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    class_id BIGINT REFERENCES character_classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    page VARCHAR(255),
    level BIGINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS character_sub_classes (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    class_id BIGINT REFERENCES character_classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    short_name VARCHAR(255),
    page VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS character_sub_class_features (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    sub_class_id BIGINT REFERENCES character_sub_classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    page VARCHAR(255),
    level BIGINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS character_races (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    page VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS character_sub_races (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    race_id BIGINT REFERENCES character_races(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    page VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS character_sub_race_features (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    sub_race_id BIGINT REFERENCES character_sub_races(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    page VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS character_feats (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS character_features (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS character_languages (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS character_proficiencies (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS character_senses (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS character_traits (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS encumbrances (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    current BIGINT DEFAULT 0,
    maximum BIGINT DEFAULT 0,
    lift_push_drag BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equipments (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    weight VARCHAR(50),
    amount BIGINT DEFAULT 1,
    status VARCHAR(255),
    is_armor BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS saving_throws (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    strength BOOLEAN DEFAULT FALSE,
    dexterity BOOLEAN DEFAULT FALSE,
    constitution BOOLEAN DEFAULT FALSE,
    intelligence BOOLEAN DEFAULT FALSE,
    wisdom BOOLEAN DEFAULT FALSE,
    charisma BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS skill_expertises (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    athletics BOOLEAN DEFAULT FALSE,
    acrobatics BOOLEAN DEFAULT FALSE,
    animal_handling BOOLEAN DEFAULT FALSE,
    arcana BOOLEAN DEFAULT FALSE,
    deception BOOLEAN DEFAULT FALSE,
    history BOOLEAN DEFAULT FALSE,
    insight BOOLEAN DEFAULT FALSE,
    intimidation BOOLEAN DEFAULT FALSE,
    investigation BOOLEAN DEFAULT FALSE,
    medicine BOOLEAN DEFAULT FALSE,
    nature BOOLEAN DEFAULT FALSE,
    perception BOOLEAN DEFAULT FALSE,
    performance BOOLEAN DEFAULT FALSE,
    persuasion BOOLEAN DEFAULT FALSE,
    religion BOOLEAN DEFAULT FALSE,
    sleight_of_hand BOOLEAN DEFAULT FALSE,
    stealth BOOLEAN DEFAULT FALSE,
    survival BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS skill_proficiencies (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    athletics BOOLEAN DEFAULT FALSE,
    acrobatics BOOLEAN DEFAULT FALSE,
    animal_handling BOOLEAN DEFAULT FALSE,
    arcana BOOLEAN DEFAULT FALSE,
    deception BOOLEAN DEFAULT FALSE,
    history BOOLEAN DEFAULT FALSE,
    insight BOOLEAN DEFAULT FALSE,
    intimidation BOOLEAN DEFAULT FALSE,
    investigation BOOLEAN DEFAULT FALSE,
    medicine BOOLEAN DEFAULT FALSE,
    nature BOOLEAN DEFAULT FALSE,
    perception BOOLEAN DEFAULT FALSE,
    performance BOOLEAN DEFAULT FALSE,
    persuasion BOOLEAN DEFAULT FALSE,
    religion BOOLEAN DEFAULT FALSE,
    sleight_of_hand BOOLEAN DEFAULT FALSE,
    stealth BOOLEAN DEFAULT FALSE,
    survival BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS treasures (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    pp BIGINT DEFAULT 0,
    gp BIGINT DEFAULT 0,
    ep BIGINT DEFAULT 0,
    sp BIGINT DEFAULT 0,
    cp BIGINT DEFAULT 0
);
