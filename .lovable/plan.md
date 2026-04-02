

# Drie nieuwe gebruikers aanmaken

## Wat er gebeurt

Drie niet-admin gebruikers worden aangemaakt via een tijdelijke backend functie die de Admin API gebruikt met de service role key.

## Gebruikers

| E-mail | Wachtwoord |
|---|---|
| patricia@aquilae.be | `X&I5xB{z[i`fMK6H^`I_` |
| an@aquilae.be | `K5f^^O8!r[0N-]`'\1`l` |
| maxime@aquilae.be | `*s^15YqqcqFbO]0d-Q<-` |

## Technische aanpak

1. **Tijdelijke edge function** `create-users` aanmaken die:
   - De Supabase Admin API (`supabase.auth.admin.createUser`) gebruikt
   - E-mail auto-confirm aanzet zodat gebruikers direct kunnen inloggen
   - Alleen door admins kan worden aangeroepen

2. **Functie aanroepen** met de 3 gebruikers

3. **Functie verwijderen** na succesvolle aanmaak

Geen admin-rollen worden toegekend — deze gebruikers krijgen enkel leestoegang.

