

# Anonimisering toevoegen aan ExportsPage

## Probleem
De ExportsPage gebruikt overal `r.office_name` rechtstreeks en haalt `getDisplayName` en `anonymized` niet op uit de store.

## Aanpak

### `src/pages/ExportsPage.tsx`
1. Haal `anonymized` en `getDisplayName` op uit `useBarometerStore`
2. In de kantorenlijst: toon `getDisplayName(r.office_name)` i.p.v. `r.office_name`
3. Bij PDF-bestandsnamen (single export): gebruik `getDisplayName` voor de bestandsnaam wanneer geanonimiseerd
4. Bij ZIP-export: gebruik geanonimiseerde bestandsnamen voor de individuele PDF's in de ZIP
5. Geef `getDisplayName` door aan `generateOfficePDF` en `generateGroupPDF` zodat de PDF-inhoud zelf ook geanonimiseerd is (indien de PDF-generator dit al ondersteunt)

Concreet worden deze regels aangepast:
- **Regel 10**: `getDisplayName` en `anonymized` toevoegen aan destructuring
- **Regel 191**: `r.office_name` → `getDisplayName(r.office_name)`
- **Regels 31-32, 69-71**: bestandsnamen en PDF-generatie met `getDisplayName`

