# Gitaar oefenen

Pagina: `https://bengladine.github.io/drumhomework/gitaar/` (leest `s/ben.json`; ander bestand: `?s=<naam>`)

## Bestanden
```
index.html     de pagina (niet aanpassen)
s/ben.json     alles wat ik oefen: huiswerk, liedjes, oefeningen
tabs/          Guitar Pro-bestanden (.gp, .gp5, .gpx), pdf's, foto's
lib/           de tabspeler (alphaTab), lettertype en gitaargeluid
```

## Opbouw van `s/ben.json`
- `homework`: wat ik nu oefen, als lijst van `"liedje-id/stuk-id"` of een oefening-id.
- `songs`: liedjes, elk met `parts` (intro, riff, refrein, solo…). Stukken die nog moeten komen: `"status": "later"`.
- `exercises`: losse oefeningen (van een leraar, techniek…).

Een stuk of oefening kan hebben:
| veld | wat |
|---|---|
| `goal` | het doel (verplicht) |
| `tempos` | tempo-trap, bv. `[70, 90, 110]`, elk met een vinkje |
| `tab` | tab als tekst (lijst van regels). Tempoknoppen = metronoom |
| `tex` | tab in alphaTex: speelt af, vertraagt, herhaalt |
| `gp` | Guitar Pro-bestand, bv. `"tabs/everlong.gp"` (+ `"track": 0` voor de gitaarpartij) |
| `video` | YouTube-link, of `{ "url": "...", "start": "1:23", "label": "Riff" }`, ook een lijst |
| `focus` | waar ik op moet letten |
| `pdf`, `image` | blad van de leraar |
| `tuning`, `capo` | ook per liedje in te vullen, dan geldt het voor alle stukken |
| `staff` | `"beide"` = noten + tab, `"noten"` = alleen noten (standaard alleen tab) |

Liedje extra: `full` = link naar de volledige tab (Ultimate Guitar), `bpm`, `notes`.

## Weten
- De repo is publiek. Volledige tabs van Ultimate Guitar dus niet hier inplakken maar linken met `full`; korte riffs om te oefenen zijn oké.
- Vinkjes en de reeks dagen staan in de browser van je gsm.
- Pagina zegt "kapot"? JSON-tikfout: plak het bestand in https://jsonlint.com.
