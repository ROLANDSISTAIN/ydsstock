/**
 * Montant en toutes lettres, pour la mention « Arrêtée la présente facture à la somme de … ».
 * Orthographe traditionnelle : vingt et un, quatre-vingts, deux cents, mille (invariable).
 */

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function below100(n: number): string {
  if (n <= 16) return UNITS[n]!;
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t]!;
    if (u === 1) return `${TENS[t]} et un`;
    return `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) {
    const r = n - 60;
    return r === 11 ? 'soixante et onze' : `soixante-${below100(r)}`;
  }
  const r = n - 80;
  return r === 0 ? 'quatre-vingts' : `quatre-vingt-${below100(r)}`;
}

function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return below100(r);
  const hundred = h === 1 ? 'cent' : `${UNITS[h]} cent${r === 0 && final ? 's' : ''}`;
  return r === 0 ? hundred : `${hundred} ${below100(r)}`;
}

export function numberToFrenchWords(value: number): string {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`Montant invalide : ${value}`);
  if (value === 0) return 'zéro';
  const parts: string[] = [];
  const billions = Math.floor(value / 1e9);
  const millions = Math.floor((value % 1e9) / 1e6);
  const thousands = Math.floor((value % 1e6) / 1e3);
  const rest = value % 1e3;
  if (billions) parts.push(`${below1000(billions, true)} milliard${billions > 1 ? 's' : ''}`);
  if (millions) parts.push(`${below1000(millions, true)} million${millions > 1 ? 's' : ''}`);
  // « mille » est invariable ; « cent » et « quatre-vingt » ne prennent pas de s devant
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false).replace(/quatre-vingts$/, 'quatre-vingt')} mille`);
  if (rest) parts.push(below1000(rest, true));
  return parts.join(' ');
}

/** « Deux cent quarante-deux mille soixante francs CFA » */
export function amountInWords(fcfa: number): string {
  const words = numberToFrenchWords(Math.abs(Math.round(fcfa)));
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} franc${Math.abs(fcfa) >= 2 ? 's' : ''} CFA`;
}
