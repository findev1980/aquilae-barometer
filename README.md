# Aquilae Barometer

Webapplicatie voor de visualisatie van de resultaten van de jaarlijkse Aquilae-barometerenquête. Kantoren en de groep kunnen hun cijfers, benchmarks en evoluties bekijken via interactieve dashboards en PDF-exports.

## Stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** voor de interface
- **Supabase** (via Lovable Cloud) voor authenticatie en data-opslag
- **Zustand** voor state management
- **i18n** (NL / FR)

## Data-import

De app laadt haar data uit Supabase. Een administrator beheert de data via de **Admin-pagina**:

1. De admin uploadt een Excel-bestand (`.xlsx`) met twee tabbladen: **NL** en **FR**.
2. Het bestand wordt geparset en opgeslagen in de Supabase-database.
3. Niet-admin gebruikers zien de geladen data automatisch in hun dashboards en exports.

Eindgebruikers hoeven zelf geen bestanden te uploaden — zij krijgen alleen leestoegang tot de meest recente dataset.
