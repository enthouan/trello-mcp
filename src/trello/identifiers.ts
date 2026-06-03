export function cardPath(cardId: string): string {
  return `/cards/${encodeURIComponent(cardIdentifier(cardId))}`;
}

export function cardIdentifier(cardId: string): string {
  const value = cardId.trim();
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.endsWith("trello.com") && pathParts[0] === "c") {
      return pathParts[1] ?? value;
    }
  } catch {
    // Treat non-URL values as Trello ids or short links.
  }
  return value;
}
