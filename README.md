# Drum homework

Student link: `https://bengladine.github.io/drumhomework/?s=<code>`
Test student: `?s=t7k2m9qx`

## Files
```
index.html            the page (same for everyone, don't touch)
s/<code>.json         one file per student = their assignments
pdf/<code>-<date>.pdf notation PDFs
```

## Adding an assignment after a lesson (~2 min, all on github.com)
1. **Groove:** build it in Groove Scribe, copy the URL from the address bar.
2. **PDF:** open the `pdf` folder on github.com → Add file → Upload files → drag the PDF → Commit changes.
   Name it lowercase without spaces, e.g. `t7k2m9qx-2026-11-21.pdf`.
3. **Assignment:** open `s/<code>.json` → pencil icon (Edit) → paste a new block at the **top** of `assignments`:
```json
    {
      "id": "2026-11-21",
      "date": "21 nov",
      "title": "Short name",
      "goal": "4x clean at 90 bpm",
      "tempos": [70, 80, 90],
      "groove": "PASTE GROOVE SCRIBE URL",
      "pdf": "pdf/t7k2m9qx-2026-11-21.pdf",
      "focus": ["Point 1", "Point 2"]
    },
```
   → Commit changes. The site updates in ~1 minute.

Exercise in several parts (e.g. 4/4 + 3/4)? Use a list for `groove`:
```json
      "groove": [
        { "label": "Deel A (4/4)", "url": "GROOVE SCRIBE URL 1" },
        { "label": "Deel B (3/4)", "url": "GROOVE SCRIBE URL 2" }
      ],
```

Several exercises in one week (technique, rudiments, grooves, songs)? Use `exercises`.
Each exercise has its own `type`, `title`, `goal`, and optional `tempos`, `groove`, `focus`, `pdf`.
No `tempos` = one "Gelukt" checkbox. Full example: `s/voorbeeld.json` (`?s=voorbeeld`).

Rules: `id` unique per assignment (the date works). Only `goal` is required.
Mind the comma after the `}` of your new block.
If the page says "Huiswerk niet gevonden", the JSON has a typo: paste it into https://jsonlint.com.

## Language
Page labels are Dutch by default. For an English page, add `"lang": "en",` under `"name"` in the student's file (see `s/oji.json`).

## New student
Make up a random 8-character code (letters/digits, not their name). Add file → Create new file → `s/<code>.json`, copy the test student's file as a start.

## Know
- This repo is public: anyone can see all assignments. No last names or personal info.
- Progress lives in the student's phone browser. Other phone/browser or cleared data = progress gone.
