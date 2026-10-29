// Palette intentionally excludes amber/red — those colors carry warning/error
// meaning elsewhere in this app (see Badge.tsx), and would be misleading here.
const PALETTE = [
  "bg-badge-blue-bg text-badge-blue-ink",
  "bg-badge-violet-bg text-badge-violet-ink",
  "bg-badge-teal-bg text-badge-teal-ink",
  "bg-badge-green-bg text-badge-green-ink",
  "bg-badge-pink-bg text-badge-pink-ink",
  "bg-badge-slate-bg text-badge-slate-ink",
] as const;

function hashToIndex(key: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }
  if (email?.trim()) {
    return email.trim()[0].toUpperCase();
  }
  return "?";
}

interface AvatarProps {
  name?: string | null;
  email?: string | null;
  id?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, email, id, size = 32, className = "" }: AvatarProps) {
  const colorKey = id || email || name || "";
  const colorClasses = PALETTE[hashToIndex(colorKey, PALETTE.length)];
  const initials = getInitials(name, email);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${colorClasses} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
