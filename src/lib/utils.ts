import { clsx, type ClassValue } from "clsx";

/** Small classnames helper (no tailwind-merge dependency needed for this MVP). */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
