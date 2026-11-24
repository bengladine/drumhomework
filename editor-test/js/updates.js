// Drumsheet: "What's new". Add a new entry at the TOP with a higher id when you ship something
// users should know about. Returning users see entries newer than the last one they closed.
export const UPDATES = [
  {
    id: 3,
    date: '24 Nov 2026',
    items: [
      '<b>Accounts (optional):</b> sign in with Google or email under ★ My grooves, and your grooves are saved online on all your devices.',
      '<b>★ My grooves:</b> save, name and reopen your grooves (Ctrl+S). Without an account they stay in this browser.',
    ],
  },
  {
    id: 2,
    date: '20 Nov 2026',
    items: [
      '<b>Tap tempo:</b> the TAP button next to the BPM, or press T.',
      '<b>Crash 2</b> in the cymbals row (right-click a crash cell).',
      'Cymbals in the sheet now follow standard drum notation (ride on the top line, ride bell as a diamond).',
      'Longer grooves: links now keep up to 64 bars.',
      'Fixed: the grid per beat is kept after undo, reload and sharing.',
    ],
  },
];
