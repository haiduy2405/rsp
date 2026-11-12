// Validator JSON nhỏ tự viết: type, required, properties, enum, min, max, items, minItems.
export function validate(value, schema, path = '$') {
  const errs = [];
  const t = schema.type;
  const typeOk =
    !t ||
    (t === 'array' && Array.isArray(value)) ||
    (t === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) ||
    (t === 'integer' && Number.isInteger(value)) ||
    (t === 'number' && typeof value === 'number' && Number.isFinite(value)) ||
    (t === 'string' && typeof value === 'string') ||
    (t === 'boolean' && typeof value === 'boolean');
  if (!typeOk) return [`${path}: cần kiểu ${t}`];
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: giá trị ngoài enum`);
  if (schema.min !== undefined && value < schema.min) errs.push(`${path}: nhỏ hơn ${schema.min}`);
  if (schema.max !== undefined && value > schema.max) errs.push(`${path}: lớn hơn ${schema.max}`);
  if (t === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path}: thiếu phần tử`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(v, schema.items, `${path}[${i}]`)));
  }
  if (t === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${path}.${k}: thiếu`);
    for (const [k, sub] of Object.entries(schema.properties || {}))
      if (k in value) errs.push(...validate(value[k], sub, `${path}.${k}`));
  }
  return errs;
}

const EFFECT_KEYS = ['burn', 'poison', 'stun', 'freeze', 'shield', 'regen', 'atkUp', 'atkDown', 'reflect', 'pierce', 'lock', 'immune'];
export const skillUnit = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string', enum: ['damage', 'heal', 'convert', 'applyEffect', 'enhance', 'timeFreeze'] },
    key: { type: 'string', enum: EFFECT_KEYS },
    target: { type: 'string', enum: ['one', 'all', 'team'] },
    turns: { type: 'integer', min: 1 },
  },
};
export const skillSchema = {
  type: 'object',
  required: ['cooldown', 'units'],
  properties: { cooldown: { type: 'integer', min: 1 }, units: { type: 'array', minItems: 1, items: skillUnit } },
};
export const duoSchema = {
  type: 'object',
  required: ['id', 'a', 'b', 'skill'],
  properties: { id: { type: 'string' }, a: { type: 'string' }, b: { type: 'string' }, skill: skillSchema },
};

export const characterSchema = {
  type: 'object',
  required: ['id', 'element', 'rarity', 'hp', 'atk', 'heal'],
  properties: {
    id: { type: 'string' },
    element: { type: 'integer', min: 0, max: 5 },
    rarity: { type: 'integer', min: 3, max: 5 },
    hp: { type: 'integer', min: 1 },
    atk: { type: 'integer', min: 0 },
    heal: { type: 'integer', min: 0 },
    skill: skillSchema,
    passive: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: { type: 'string', enum: ['stat', 'trigger'] },
        stat: { type: 'string', enum: ['hp', 'atk', 'heal'] },
        scope: { type: 'string', enum: ['self', 'all', 'element'] },
        pct: { type: 'number', min: 0 },
        trigger: { type: 'string', enum: ['start', 'turn'] },
        every: { type: 'integer', min: 1 },
        units: { type: 'array', minItems: 1, items: skillUnit },
      },
    },
  },
};

export const monsterSchema = {
  type: 'object',
  required: ['id', 'element', 'hp', 'atk', 'attackEvery'],
  properties: {
    id: { type: 'string' },
    element: { type: 'integer', min: 0, max: 5 },
    hp: { type: 'integer', min: 1 },
    atk: { type: 'integer', min: 0 },
    attackEvery: { type: 'integer', min: 1 },
  },
};

export const configSchema = {
  type: 'object',
  required: ['board', 'dragTimeMs', 'elements', 'advantage', 'elementMult', 'combo', 'group', 'heal'],
  properties: {
    board: { type: 'object', required: ['allowDiagonal'] },
    dragTimeMs: { type: 'integer', min: 500 },
    elements: { type: 'array', minItems: 6 },
    combo: { type: 'object', required: ['step'], properties: { step: { type: 'number', min: 0 } } },
    group: {
      type: 'object',
      required: ['sizeBonus', 'fourOrbBoost', 'enhancedBonus', 'aoeSize'],
    },
    elementMult: { type: 'object', required: ['strong', 'weak'] },
    heal: { type: 'object', required: ['base'] },
  },
};
