import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});
const compactCurrencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const numberFormatter = new Intl.NumberFormat('tr-TR');

export const formatCurrency = (value: number | string | null | undefined) =>
  currencyFormatter.format(Number(value ?? 0));

export const formatCompactCurrency = (value: number) => compactCurrencyFormatter.format(value);

export const formatNumber = (value: number | string | null | undefined) =>
  numberFormatter.format(Number(value ?? 0));

export const formatDate = (value: string | Date | null | undefined, withTime = false) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    ...(withTime && { timeStyle: 'short' }),
  }).format(new Date(value));
};

/** Boş string değerlerini atarak query parametresi nesnesi üretir. */
export function cleanParams<T extends Record<string, unknown>>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  ) as Partial<T>;
}
