

## Plan: Data persisteren in de database

### Probleem
Alle geïmporteerde kantoordata wordt opgeslagen in `localStorage`, wat vluchtig is. Bij herdeployment, andere browser, of cache-wissing verdwijnt alles.

### Oplossing
Migreer de data-opslag van localStorage naar de database, zodat data persistent is en gedeeld tussen sessies/apparaten.

### Stappen

1. **Database tabel aanmaken**
   - `office_records` tabel met alle velden uit het `OfficeRecord` type
   - `import_meta` tabel voor jaar-metadata (available_years, last_import)
   - RLS policies: alleen ingelogde gebruikers kunnen lezen/schrijven

2. **Import-flow aanpassen (`AdminPage` + store)**
   - Bij CSV-import: data schrijven naar `office_records` tabel i.p.v. localStorage
   - Meta bijwerken in `import_meta`
   - Delete-year: verwijderen uit database

3. **Data laden bij opstarten**
   - `loadFromStorage` hernoemen naar `loadData`
   - Data ophalen via Supabase query i.p.v. localStorage
   - Caching in Zustand store blijft voor snelle UI

4. **localStorage verwijderen**
   - Verwijder alle `localStorage.getItem/setItem` calls voor data (settings zoals taal/thema mogen lokaal blijven)

### Technische details

- De `OfficeRecord` type in `src/types/barometer.ts` bepaalt de kolomstructuur
- De store (`useBarometerStore.ts`) wordt aangepast om async Supabase calls te doen
- RLS: `authenticated` gebruikers krijgen volledige CRUD-toegang
- Bestaande filtering/berekeningen blijven ongewijzigd (werken op in-memory data)

