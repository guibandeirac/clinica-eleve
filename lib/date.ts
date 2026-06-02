import { addDays, addMonths, format, parseISO, isBefore, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function toDate(iso: string): Date {
  return parseISO(iso);
}

export function formatDateBR(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy");
}

export function formatDateLongBR(iso: string): string {
  return format(parseISO(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function isOverdue(iso: string): boolean {
  return isBefore(startOfDay(parseISO(iso)), startOfDay(new Date()));
}

export function isToday(iso: string): boolean {
  const d = parseISO(iso);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export function isThisWeek(iso: string): boolean {
  const d = parseISO(iso);
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = endOfWeek(new Date(), { weekStartsOn: 1 });
  return d >= start && d <= end;
}

export function isThisMonth(iso: string): boolean {
  const d = parseISO(iso);
  const start = startOfMonth(new Date());
  const end = endOfMonth(new Date());
  return d >= start && d <= end;
}

export function addDaysISO(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

export function addMonthsISO(iso: string, months: number): string {
  return format(addMonths(parseISO(iso), months), "yyyy-MM-dd");
}

export { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek };
