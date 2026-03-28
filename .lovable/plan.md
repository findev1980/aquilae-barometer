

# Verificatie-export: ZIP met één Excel per kantoor

## Wat wordt gebouwd

Een knop "Exporteer verificatiebestanden" op de Admin-pagina die:
1. Alle kantoren en alle beschikbare jaren ophaalt uit de database
2. Per kantoor een apart Excel-bestand genereert (bestandsnaam = kantoornaam)
3. Alles bundelt in één ZIP-bestand dat gedownload wordt

### Excel-structuur per kantoor

```text
Verificatie data - [Kantoornaam]

Jaar | Zaakvoerders | Bedienden (FTE) | Commissie Verzekeringen (€) | Commissie Bank (€)
2022 |      —       |        —        |         1.520.000           |      950.000
2023 |      —       |        —        |         1.600.000           |      950.000
...
```

- Eén rij per beschikbaar jaar (alle jaren uit de database)
- Jaren zonder data voor dat kantoor: volledige rij met gele achtergrond
- Individuele null-cellen: gele achtergrond
- Bestaande data ingevuld

## Technische aanpak

### 1. Nieuwe utility: `src/utils/verificatieExport.ts`
- Query alle unieke kantoornamen + alle beschikbare jaren uit `office_records`
- Per kantoor: genereer een xlsx-werkblad met `xlsx` (SheetJS) library
- Gele achtergrond op lege/null cellen
- Gebruik `JSZip` om alle xlsx-bestanden in één ZIP te bundelen
- Bestandsnaam per kantoor: kantoornaam (speciale tekens sanitized) + `.xlsx`
- ZIP-bestandsnaam: `Verificatie_kantoren.zip`

### 2. Dependencies
- `xlsx` (SheetJS) — al beschikbaar of toevoegen voor Excel-generatie met styling
- `jszip` — toevoegen voor ZIP-bundeling
- Alternatief: `exceljs` in plaats van `xlsx` (betere styling-ondersteuning voor gele achtergrond)

### 3. AdminPage aanpassen (`src/pages/AdminPage.tsx`)
- Nieuwe knop "Exporteer verificatiebestanden" met Download-icoon
- Loading state + disabled tijdens generatie
- Triggert de export-functie, download resulterende ZIP via blob URL

### 4. Translations (`src/i18n/translations.ts`)
- `admin.export_verification` NL: "Exporteer verificatiebestanden" / FR: "Exporter fichiers de vérification"

