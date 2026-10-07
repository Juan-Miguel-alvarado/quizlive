import { AVATARS, type Avatar } from './schemas';

// Adjetivos que sirven igual para masculino y femenino ("León Valiente", "Oveja Valiente").
const ADJECTIVES = [
  'Alegre',
  'Valiente',
  'Feliz',
  'Veloz',
  'Amable',
  'Fuerte',
  'Paciente',
  'Sonriente',
  'Genial',
  'Gentil',
  'Noble',
  'Ágil',
  'Leal',
  'Humilde',
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

export const randomAvatar = (): Avatar => pick(AVATARS).emoji;

/** Nombre amable a partir del avatar (🦁 → "León Valiente"); siempre cabe en los 20 caracteres del apodo. */
export function randomNickname(avatar: Avatar = randomAvatar()): string {
  const animal = AVATARS.find((a) => a.emoji === avatar)?.name ?? 'Amigo';
  const options = ADJECTIVES.map((adj) => `${animal} ${adj}`).filter((n) => n.length <= 20);
  return pick(options.length ? options : [animal]);
}
