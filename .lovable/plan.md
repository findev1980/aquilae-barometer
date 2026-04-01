

# Anonimiseer-toggle op homescherm

## Wat wordt gebouwd

Een toggle-knop op de homepagina (en in de store) waarmee kantoornamen visueel worden geanonimiseerd tot "Kantoor 1", "Kantoor 2", etc. De database wordt niet gewijzigd — het is puur een weergave-instelling.

## Aanpak

### 1. Store uitbreiden (`src/store/useBarometerStore.ts`)
- Nieuwe state: `anonymized: boolean` (default `false`)
- Nieuwe action: `toggleAnonymized()`
- Nieuwe helper: `getDisplayName(officeName: string): string` die een consistente mapping bijhoudt (Map van echte naam → "Kantoor 1", "Kantoor 2", …) gesorteerd op kantoornaam

### 2. HomePage aanpassen (`src/pages/HomePage.tsx`)
- Toggle-knop onder de KPI-rij (of naast de zoekbalk), zichtbaar voor alle gebruikers
- Icoon: `EyeOff` / `Eye` van Lucide
- Bij actief: zoekresultaten tonen "Kantoor 1" i.p.v. echte namen

### 3. Overige pagina's aanpassen
- `OfficeDashboard.tsx`: kantoornaam vervangen door anoniem label
- `GroupDashboard.tsx`: in tabellen/grafieken de anonieme namen gebruiken
- `ExportsPage.tsx` / PDF-exports: anonieme namen meenemen wanneer toggle actief is

### 4. Translations
- `home.anonymize` NL: "Anonimiseren" / FR: "Anonymiser"

## Logica anonimisering
- Sorteer alle unieke kantoornamen alfabetisch
- Ken elk een vast nummer toe: "Kantoor 1", "Kantoor 2", …
- De mapping wordt berekend op basis van `allData` en blijft consistent zolang de data niet wijzigt

