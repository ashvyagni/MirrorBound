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
  abilitySlots: string[];
  consumables: ConsumableStack[];
  resources: Record<string, number>;
  relics: RelicInfo[];
}

export interface SkillNode {
  id: string;
  name: string;
  category: 'MOBILITY' | 'COMBAT' | 'MAGIC' | 'SURVIVAL';
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

/** Mirrors `PLAYER_STATES` in game/entities/player.py. `channel` and `drink`
 *  arrived with the cast-time and potion work and were never added here, which
 *  left PlayerView's exhaustive state maps failing to compile. */
export type PlayerState =
  | 'idle' | 'walk' | 'run' | 'attack' | 'cast' | 'channel' | 'drink' | 'dash' | 'hurt' | 'dead';

export interface PlayerSnap extends EntityBase {
  type: 'player';
  state: PlayerState;
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
}

export interface TwinSnap extends EntityBase {
  type: 'twin';
  state: 'idle' | 'walk' | 'attack' | 'cast' | 'downed';
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
  kind: 'essence' | 'shards' | 'health_potion' | 'mana_potion' | 'weapon' | 'relic';
  itemId: string;
  amount: number;
  position: Vec2;
  age: number;
}

export interface DecorSnap {
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
  kind: 'gate' | 'arch' | 'sealed' | string;
}

export interface RoomFull {
  id: string;
  index: number;
  roomType: string;
  name: string;
  biome: 'grove' | 'ruins' | 'crypt';
  width: number;
  height: number;
  tileSize: number;
  tiles: number[][];
  decor: DecorSnap[];
  doors: DoorSnap[];
  cleared: boolean;
  seed: number;
}

export interface RoomLite {
  id: string;
  index: number;
  cleared: boolean;
  doors: DoorSnap[];
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

export interface PlayerModel {
  tick: number;
  traits: Record<string, TraitInfo>;
  predictions: { token: string; confidence: number; order: number; weight: number }[];
  spatial: Record<string, { cell: [number, number]; weight: number }[]>;
  cellSize: number;
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

export interface GameSnapshot {
  type: 'SNAPSHOT';
  tick: number;
  seed: number;
  phase: 'playing' | 'dead' | 'victory';
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
  events: ServerEvent[];
  playerModel: PlayerModel;
  twinModel: TwinModel;
  boss: BossDebug | null;
  lastError: string | null;
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
  seq?: number;
}

export type CommandAction =
  | 'EQUIP_WEAPON' | 'TWIN_EQUIP' | 'UNLOCK_SKILL' | 'USE_ITEM' | 'SET_ABILITY_SLOT'
  | 'PAUSE' | 'RESUME' | 'RESTART' | 'REQUEST_ROOM' | 'SET_TWIN_STANCE';

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
}
