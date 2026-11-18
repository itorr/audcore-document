// Presentation only: integer fen values and payment payloads stay unchanged.
export const formatMoney = fen => `¥${Number((fen / 100).toFixed(2))}`;
