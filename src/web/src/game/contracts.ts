/**
 * Wire contract with the Python server.
 *
 * Mirrors `apps/server/mirrorbound/contracts/messages.py` (inbound) and the
 * snapshot documented in `docs/contracts/snapshot.md` (outbound). Field names
 * are camelCase on the wire; keep this file the single place they are spelled.
 */

export interface Vec2 { x: number; y: number }

export interface EntityBase {
  id: string;
  position: Vec2;
  velocity: Vec2;
  facing: Vec2;
  health: number;
  maxHealth: number;
  radius: number;
  statusEffects: string[];
  invulnerable: boolean;
  active: boolean;
}

export interface WeaponInfo {
  id: string;
  name: string;
  type: 'melee' | 'ranged' | 'magic';
  family: 'sword' | 'bow' | 'staff';
  damage: number;
  cooldown: number;
  range: number;
  resourceCost: number;
  tags: string[];
  comboLength: number;
  rarity: 'common' | 'uncommon' | 'rare';
  animation: 'sword' | 'bow' | 'fireStaff' | 'iceStaff';
  description: string;
  /** What the third bench tier turns on, and what the smith calls it. */
  perk: string;
  perkName: string;
  /** How far this weapon has been worked, 0-3. Only on carried weapons. */
  tier?: number;
  /** What the next tier costs, or null when it is finished. */
  upgradeCost?: { gold: number; shards: number; essence: number } | null;
  hasPerk?: boolean;
}

export interface AbilitySlot {
  slot: number;
  id: string;
  name: string;
  icon: string;
  cost: number;
  cooldown: number;
  cooldownTotal: number;
  ready: boolean;
  blockedBy: string | null;
  tags: string[];
  description: string;
}

export interface ConsumableStack {
  id: string;
  count: number;
  name: string;
  description: string;
  rarity: string;
  heal?: number;
  mana?: number;
}

export interface RelicInfo {
  id: string;
  name: string;
  description: string;
  rarity: string;
}

export interface Inventory {
  weapons: WeaponInfo[];
  equippedWeapon: string;
  /** The second carried weapon; SWAP_WEAPON trades it with the equipped one. */
  offhandWeapon: string;
  gold: number;
  abilitySlots: string[];
  consumables: ConsumableStack[];
  resources: Record<string, number>;
  relics: RelicInfo[];
}

export interface SkillNode {
  id: string;
  name: string;
  category: 'MOBILITY' | 'COMBAT' | 'MAGIC' | 'SURVIVAL' | 'MIRROR';
  tier: number;
  cost: number;
  description: string;
  requires: string[];
  unlocked: boolean;
  available: boolean;
  reason: string;
}

export interface PlayerStats {
  speed: number;
  weaponDamageMult: number;
  spellDamageMult: number;
  critChance: number;
  damageTakenMult: number;
  manaRegen: number;
}

export type PlayerState =
  | 'idle' | 'walk' | 'run' | 'attack' | 'cast' | 'channel' | 'drink' | 'dash' | 'hurt' | 'dead';

export interface PlayerSnap extends EntityBase {
  type: 'player';
  state: PlayerState;
  /** Effective server movement rates, including slows and casting/drinking. */
  moveSpeed?: number;
  runSpeed?: number;
  mana: number;
  maxMana: number;
  xp: number;
  xpToNext: number;
  level: number;
  skillPoints: number;
  currentWeapon: string;
  attackCooldown: number;
  comboStep: number;
  comboLength: number;
  abilities: AbilitySlot[];
  kills: number;
  deaths: number;
  targetId: string | null;
  respawnIn: number;
  /** Shared across both potions; 0 when a drink is allowed. */
  potionCooldown: number;
  potionCooldownTotal: number;
  /** The item being drunk / the ability being channelled, or null. */
  drinking: string | null;
  channelling: string | null;
  gold: number;
  /** Present on detail snapshots only; the client caches the last one. */
  weapon?: WeaponInfo;
  inventory?: Inventory;
  skillTree?: SkillNode[];
  unlockedSkills?: string[];
  stats?: PlayerStats;
}

export interface TwinIntent {
  intentType: string;
  targetId: string | null;
  position: Vec2 | null;
  confidence: number;
  utilities: Record<string, number>;
  reason: string;
  /** A weapon the controller would rather hold, from what the twin owns. */
  desiredWeapon: string | null;
}

export interface TwinSnap extends EntityBase {
  type: 'twin';
  state: 'idle' | 'walk' | 'attack' | 'cast' | 'downed';
  /** True before the twin has been found: not in the world, not drawn. */
  dormant: boolean;
  /** Carrying the Warden's mirror shard. Cleared on the Sanctum's threshold. */
  corrupted: boolean;
  name: string;
  mana: number;
  maxMana: number;
  currentWeapon: string;
  intent: TwinIntent;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  downedFor: number;
  attackCooldown: number;
  weapon?: WeaponInfo;
  inventory?: Inventory;
}

export type EnemyRole = 'melee' | 'ranged' | 'fast' | 'tank' | 'boss';

export interface EnemySnap extends EntityBase {
  type: string;
  name: string;
  role: EnemyRole;
  sprite: string;
  elite: boolean;
  boss: boolean;
  state: 'idle' | 'wander' | 'chase' | 'attack' | 'reposition' | 'retreat' | 'dead';
  targetId: string | null;
  windingUp: boolean;
  windup: number;
  /**
   * The player weapon this enemy is fighting with, if it was armed with one.
   *
   * Only the Mirror is, today. Its stats are already folded into the fields
   * above by the server -- this is here so the weapon can be *drawn* in its
   * hands, from the blackened sheets.
   */
  weapon?: string | null;
}

export interface ProjectileSnap {
  id: string;
  kind: string;
  ownerId: string;
  faction: 'ally' | 'enemy';
  position: Vec2;
  velocity: Vec2;
  radius: number;
}

export interface PickupSnap {
  id: string;
  kind: 'essence' | 'shards' | 'health_potion' | 'mana_potion' | 'weapon' | 'relic'
    | 'key' | 'mirror_shard';
  itemId: string;
  amount: number;
  position: Vec2;
  age: number;
}

export interface DecorSnap {
  /** Authoritative, scaled foundation footprint. Optional for old recordings. */
  collisionX?: number;
  collisionY?: number;
  collisionRadius?: number;
  kind: string;
  x: number;
  y: number;
  variant: number;
  scale: number;
  blocking: boolean;
  radius: number;
  flip: boolean;
}

export interface DoorSnap {
  side: 'north' | 'south' | 'east' | 'west';
  x: number;
  y: number;
  width: number;
  targetIndex: number | null;
  locked: boolean;
  /**
   * `gate`/`arch`/`sealed` link rooms inside a dungeon and are drawn as doors.
   * The other four are **crossings** between overworld regions — a bridge, a cut
   * through rock, a causeway, a ferry — and are not drawn as doors at all: the
   * terrain and its rails already say what they are, and a gate sprite in the
   * middle of a bridge would read as something to open.
   */
  kind: 'gate' | 'arch' | 'sealed' | 'bridge' | 'pass' | 'causeway' | 'ferry' | string;
  /** The area on the far side, for a crossing. Empty for a dungeon door. */
  targetArea: string;
  /** Why the way is shut, when it is. Shown rather than left as a silent wall. */
  lockReason: string;
  /** What the crossing is called, so the HUD can name it. Empty for a door. */
  label: string;
}

/**
 * Somebody walking their round in a village.
 *
 * Not an `NpcSnap`: these have no dialogue, no stock and no collision. They ride
 * every snapshot rather than the detail ones, because they move and a figure
 * updated once a second reads as a stutter.
 */
export interface VillagerSnap {
  id: string;
  role: string;
  /** Which of the four villager frames to draw them with. */
  sprite: number;
  position: Vec2;
  facing: Vec2;
  /** False while they are stopped somewhere, doing whatever they came to do. */
  moving: boolean;
}

/**
 * A plate in a puzzle room. Standing on it throws it.
 *
 * No interact key: the rooms are built so that *reaching* the plate is the
 * difficulty, and a keypress would be a second obstacle in front of the first.
 */
export interface SwitchSnap {
  id: string;
  x: number;
  y: number;
  /** What throwing it opens: a door side, or empty when it only counts. */
  opens: string;
  radius: number;
  thrown: boolean;
}

/** A village, standing on a region's own ground. */
export interface SettlementSnap {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
}

/** A way out of an area. Doors link rooms by index; portals link areas by id. */
export interface PortalSnap {
  id: string;
  x: number;
  y: number;
  targetArea: string;
  label: string;
  kind: 'gate' | 'road' | 'descent' | string;
  locked: boolean;
  lockReason: string;
  radius: number;
}

export interface RoomFull {
  id: string;
  index: number;
  roomType: string;
  name: string;
  biome: 'grove' | 'ruins' | 'crypt' | 'sandbox';
  width: number;
  height: number;
  tileSize: number;
  tiles: number[][];
  decor: DecorSnap[];
  doors: DoorSnap[];
  portals: PortalSnap[];
  /**
   * Villages on this map. A region carries its settlement rather than being
   * one, so `safe` below answers for the whole room and these answer for a
   * place inside it.
   */
  settlements: SettlementSnap[];
  /** Plates to stand on. Empty outside a puzzle room. */
  switches: SwitchSnap[];
  /**
   * Distinct sprite names this room's spawn table will use, sorted.
   *
   * The client loads enemy atlases per room from this rather than all of them
   * at boot. Empty in a village, which is what stops a safe room fetching art
   * it will never draw.
   */
  enemySprites: string[];
  cleared: boolean;
  /** Villages: no enemies, no wipe risk. */
  safe: boolean;
  areaId: string;
  seed: number;
}

export interface RoomLite {
  id: string;
  index: number;
  cleared: boolean;
  doors: DoorSnap[];
}

export interface ShopEntry {
  kind: 'weapon' | 'consumable' | 'relic';
  itemId: string;
  price: number;
  name: string;
  description: string;
}

export interface NpcSnap {
  id: string;
  name: string;
  role: 'elder' | 'weaponsmith' | 'apothecary' | 'hearth' | string;
  sprite: string;
  position: Vec2;
  radius: number;
  /** Authored lines for the current quest state, names already substituted. */
  lines: string[];
  stock: ShopEntry[];
}

export interface AreaSnap {
  id: string;
  name: string;
  kind: 'village' | 'dungeon';
  biome: string;
  subtitle: string;
  mapX: number;
  mapY: number;
  discovered: boolean;
  completed: boolean;
  open: boolean;
  current: boolean;
}

/** One step of a side quest, as the journal draws it. */
export interface QuestStepSnap {
  text: string;
  done: boolean;
  count: number;
}

export interface QuestSnap {
  id: string;
  name: string;
  summary: string;
  giver: string;
  /** Index of the step being worked on; past the end when finished. */
  step: number;
  done: boolean;
  /** What to do next, or empty when the quest is finished. */
  current: string;
  steps: QuestStepSnap[];
  rewardGold: number;
}

/** A page of the codex, earned by finishing a quest or by getting somewhere. */
export interface LoreSnap {
  id: string;
  title: string;
  body: string;
  section: 'history' | 'mirror' | 'regions' | 'people' | string;
}

export interface JournalSnap {
  active: QuestSnap[];
  completed: QuestSnap[];
  lore: LoreSnap[];
}

export interface CampaignSnap {
  playerName: string;
  twinName: string;
  currentArea: string;
  completed: string[];
  discovered: string[];
  flags: string[];
  seals: string[];
  twinRescued: boolean;
  twinNamed: boolean;
  /** Side quests taken, and the codex they have filled in. */
  journal: JournalSnap;
  areas: AreaSnap[];
}

export interface DungeonInfo {
  seed: number;
  roomCount: number;
  currentIndex: number;
  rooms: { index: number; type: string; name: string; biome: string; cleared: boolean; visited: boolean }[];
}

export interface RunStats {
  enemiesKilled: number;
  roomsCleared: number;
  damageDealt: number;
  damageTaken: number;
  essenceCollected: number;
  abilitiesCast: number;
  seconds: number;
}

export interface ServerEvent {
  tick: number;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

export interface TraitInfo { value: number; confidence: number; samples: number; recent_trend: number }

/**
 * A habit the detector has decided is real: a sequence of committed actions
 * seen often enough, recently enough, to be worth predicting from.
 *
 * `sequence` is the whole chain; its last token is what the pattern predicts
 * given the ones before it.
 */
export interface DetectedPattern {
  sequence: string[];
  order: number;
  confidence: number;
  first_detected_tick: number;
  last_confirmed_tick: number;
}

/** A pattern becoming real, or going stale and being dropped. */
export interface PatternEvent {
  kind: 'DETECTED' | 'LOST' | string;
  pattern: DetectedPattern;
}

export interface PlayerModel {
  tick: number;
  traits: Record<string, TraitInfo>;
  predictions: { token: string; confidence: number; order: number; weight: number }[];
  spatial: Record<string, { cell: [number, number]; weight: number }[]>;
  cellSize: number;
  /** Habits currently held. Absent on an older server. */
  patterns?: DetectedPattern[];
  /** The most recent detections and losses, oldest first. */
  pattern_events?: PatternEvent[];
}

export interface TwinModel {
  dims: Record<string, TraitInfo>;
  lessons: string[];
  playerEventsSeen: number;
  outcomesSeen: number;
  learningMult: number;
}

export interface BossDebug {
  phase: number;
  activeCounter: string | null;
  countersUsed: Record<string, number>;
}

/** One save slot, as the Saves screen lists it. */
export interface SaveSlot {
  id: string;
  name: string;
  /** The village checkpoint's own slot. There is exactly one, and it is not
   *  deletable in the way a save the player made is. */
  auto: boolean;
  /** Unix seconds. */
  savedAt: number;
  area: string;
  level: number;
  gold: number;
}

/**
 * The Sanctum's opening while it plays, absent otherwise.
 *
 * Its presence is the instruction: hold the player's input and point the
 * camera at `focus` for as long as this is in the snapshot. The server decides
 * when each beat ends -- the client never advances it on its own clock.
 */
export interface CutsceneSnap {
  beat: 'focus' | 'approach' | 'cleanse' | 'hatch' | 'speak' | 'release' | string;
  elapsed: number;
  duration: number;
  focus: 'player' | 'twin';
}

export interface GameSnapshot {
  type: 'SNAPSHOT';
  tick: number;
  seed: number;
  /** `dead` is the ordinary setback and respawns; `defeat` is the run over,
   *  which only the Sanctum does. */
  phase: 'playing' | 'dead' | 'defeat' | 'victory';
  paused: boolean;
  transition: number;
  roomFull: boolean;
  room: RoomFull | RoomLite;
  player: PlayerSnap;
  twin: TwinSnap;
  enemies: EnemySnap[];
  projectiles: ProjectileSnap[];
  pickups: PickupSnap[];
  stats: RunStats;
  dungeon: DungeonInfo | null;
  /** The village going about its day. Empty outside a settlement. */
  villagers: VillagerSnap[];
  campaign?: CampaignSnap;
  /** Detail snapshots only, and only in rooms that have people in them. */
  npcs?: NpcSnap[];
  events: ServerEvent[];
  playerModel: PlayerModel;
  twinModel: TwinModel;
  boss: BossDebug | null;
  /**
   * The village the player is standing in, or null out in the world.
   *
   * `room.safe` answers for a whole map and a region is not a whole map — it has
   * a village in it and wilderness around that — so this is what decides the
   * things that used to key off being in a village: whether the map will let you
   * travel, whether respec is offered, and what a checkpoint notice says.
   */
  settlement: string | null;
  lastError: string | null;
  /** Detail snapshots only, and only after a save was written or removed:
   *  the list is a directory read, not something to re-send at 20Hz. */
  saves?: SaveSlot[];
  /** Which slot the run is writing to. Arrives with `saves`. */
  saveSlot?: string;
  /** Present only while a cutscene is playing. */
  cutscene?: CutsceneSnap;
}

export function isRoomFull(room: RoomFull | RoomLite): room is RoomFull {
  return (room as RoomFull).tiles !== undefined;
}

// --- inbound -----------------------------------------------------------------

export interface InputMessage {
  type: 'INPUT';
  moveX: number;
  moveY: number;
  attack: boolean;
  run: boolean;
  ability: number | null;
  /** Where the cursor is, as a unit vector from the player. Zero for none. */
  aimX: number;
  aimY: number;
  seq?: number;
}

export type CommandAction =
  | 'EQUIP_WEAPON' | 'TWIN_EQUIP' | 'UNLOCK_SKILL' | 'USE_ITEM' | 'SET_ABILITY_SLOT'
  | 'PAUSE' | 'RESUME' | 'RESTART' | 'REQUEST_ROOM' | 'SET_TWIN_STANCE'
  | 'SWAP_WEAPON' | 'SET_OFFHAND' | 'TRAVEL' | 'TALK' | 'BUY_ITEM' | 'SET_NAME'
  | 'TWIN_REQUEST' | 'TWIN_CALL' | 'SAVE' | 'RESPEC'
  // Save slots. SAVE writes the slot the run is already playing; SAVE_AS makes
  // a new named one, LOAD_SAVE restarts the run from one, DELETE_SAVE throws
  // one away and RESET_DATA throws away every slot this profile has.
  | 'SAVE_AS' | 'NEW_SAVE' | 'LOAD_SAVE' | 'DELETE_SAVE' | 'RESET_DATA'
  // Sandbox tools. GIVE drops a weapon on the ground in front of the player
  // rather than putting it in a bag; CONFIGURE_BOSS arms the Mirror and sets
  // how much of the player it starts out already knowing.
  | 'GIVE' | 'CONFIGURE_BOSS'
  // Debug, from the console. Spawns a real enemy through the ordinary path, so
  // what arrives is driven by the ordinary AI and is hostile in the ordinary
  // way -- a summoned Mirror hunts you exactly as the one at the end does.
  | 'SPAWN';

export interface CommandMessage {
  type: 'COMMAND';
  action: CommandAction;
  weaponId?: string;
  skillId?: string;
  itemId?: string;
  abilityId?: string;
  slot?: number;
  stance?: string;
  seed?: number;
  areaId?: string;
  npcId?: string;
  playerName?: string;
  twinName?: string;
  enemyType?: string;
  saveId?: string;
  saveName?: string;
  bossWeapon?: string;
  bossOffhand?: string;
  /** 0..1: how much of the player the Mirror starts out having learned. */
  bossSkill?: number;
}
