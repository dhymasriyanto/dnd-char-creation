-- Compendium Tables with Multi-Edition (2014 & 2024) Support

CREATE TABLE IF NOT EXISTS compendium_races (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014', -- '2014' or '2024'
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    size VARCHAR(50) DEFAULT 'Medium',
    speed BIGINT DEFAULT 30,
    fly_speed BIGINT DEFAULT 0,
    swim_speed BIGINT DEFAULT 0,
    climb_speed BIGINT DEFAULT 0,
    darkvision BIGINT DEFAULT 0,
    creature_types JSONB, -- 2024: ['humanoid'], ['fey'], etc.
    ability_bonuses JSONB, -- Racial ASI (2014)
    traits JSONB,
    entries JSONB,
    CONSTRAINT uq_comp_races UNIQUE (name, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_sub_races (
    id BIGSERIAL PRIMARY KEY,
    race_id BIGINT NOT NULL REFERENCES compendium_races(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    ability_bonuses JSONB,
    traits JSONB,
    entries JSONB,
    CONSTRAINT uq_comp_sub_races UNIQUE (race_id, name, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_classes (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    hit_dice VARCHAR(10) NOT NULL, -- 'd6', 'd8', 'd10', 'd12'
    primary_ability TEXT,
    saving_throws JSONB, -- ['strength', 'constitution']
    spellcasting_ability VARCHAR(50),
    subclass_title VARCHAR(100),
    subclass_level BIGINT DEFAULT 3, -- 2024 is always 3, 2014 varies (1, 2, or 3)
    armor_proficiencies JSONB,
    weapon_proficiencies JSONB,
    tool_proficiencies JSONB,
    skill_choices JSONB,
    starting_equipment JSONB,
    entries JSONB,
    CONSTRAINT uq_comp_classes UNIQUE (name, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_sub_classes (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES compendium_classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    spellcasting_ability VARCHAR(50),
    entries JSONB,
    CONSTRAINT uq_comp_sub_classes UNIQUE (class_id, name, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_class_features (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES compendium_classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    level BIGINT NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    entries JSONB,
    CONSTRAINT uq_comp_class_features UNIQUE (class_id, name, level, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_sub_class_features (
    id BIGSERIAL PRIMARY KEY,
    sub_class_id BIGINT NOT NULL REFERENCES compendium_sub_classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    level BIGINT NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    entries JSONB,
    CONSTRAINT uq_comp_sub_class_features UNIQUE (sub_class_id, name, level, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_backgrounds (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    ability_bonuses JSONB, -- 2024: 3 chosen abilities (+2/+1 or +1/+1/+1)
    feats JSONB, -- 2024: Origin Feats (Alert, Tough, etc.)
    skill_proficiencies JSONB,
    tool_proficiencies JSONB,
    languages JSONB,
    equipment JSONB,
    entries JSONB,
    CONSTRAINT uq_comp_backgrounds UNIQUE (name, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_feats (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    category VARCHAR(50) DEFAULT 'General', -- 2024: 'General', 'Origin', 'Fighting Style', 'Epic Boon'
    prerequisite TEXT,
    ability_bonus JSONB, -- half-feats (+1 STR/DEX, etc.)
    repeatable BOOLEAN DEFAULT FALSE, -- 2024 repeatable feats
    entries JSONB,
    CONSTRAINT uq_comp_feats UNIQUE (name, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_spells (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    level BIGINT NOT NULL DEFAULT 0, -- 0 = Cantrip
    school VARCHAR(50),
    casting_time TEXT,
    range TEXT,
    components TEXT,
    duration TEXT,
    concentration BOOLEAN DEFAULT FALSE,
    ritual BOOLEAN DEFAULT FALSE,
    damage_dice TEXT,
    damage_type TEXT,
    save_ability TEXT,
    classes JSONB,
    entries JSONB,
    higher_levels JSONB,
    CONSTRAINT uq_comp_spells UNIQUE (name, source, edition)
);

CREATE TABLE IF NOT EXISTS compendium_items (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    edition VARCHAR(10) NOT NULL DEFAULT '2014',
    source VARCHAR(100) NOT NULL,
    page VARCHAR(50),
    item_type VARCHAR(50) NOT NULL, -- 'weapon', 'armor', 'gear', 'consumable', 'wondrous'
    rarity VARCHAR(50) DEFAULT 'none',
    cost_cp BIGINT DEFAULT 0,
    weight NUMERIC(8, 2) DEFAULT 0,
    damage_dice VARCHAR(50),
    damage_type VARCHAR(50),
    versatile_dice VARCHAR(50),
    mastery VARCHAR(50), -- 2024 Weapon Mastery: Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex
    base_ac BIGINT DEFAULT 0,
    ac_dex_bonus VARCHAR(50),
    stealth_disadvantage BOOLEAN DEFAULT FALSE,
    strength_requirement BIGINT DEFAULT 0,
    properties JSONB,
    entries JSONB,
    CONSTRAINT uq_comp_items UNIQUE (name, source, edition)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_comp_races_edition ON compendium_races (edition);
CREATE INDEX IF NOT EXISTS idx_comp_classes_edition ON compendium_classes (edition);
CREATE INDEX IF NOT EXISTS idx_comp_backgrounds_edition ON compendium_backgrounds (edition);
CREATE INDEX IF NOT EXISTS idx_comp_feats_edition ON compendium_feats (edition, category);
CREATE INDEX IF NOT EXISTS idx_comp_spells_edition_level ON compendium_spells (edition, level);
CREATE INDEX IF NOT EXISTS idx_comp_items_edition_type ON compendium_items (edition, item_type);
