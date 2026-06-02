export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function brlInputToCents(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function centsToInputString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
