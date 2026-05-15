# Supabase Setup – Grundriss Tool (Multi-User)

## 1. Supabase-Projekt erstellen

Falls noch nicht vorhanden, erstelle ein Projekt auf [supabase.com](https://supabase.com).

## 2. SQL-Tabellen anlegen

Öffne den **SQL Editor** im Supabase-Dashboard und führe das Skript aus `supabase-schema.sql` aus.

## 3. Storage Bucket erstellen

1. Gehe zu **Storage** im Dashboard
2. Erstelle einen neuen Bucket namens `floor-plans`
3. Setze den Bucket auf **Public** (Öffentlich)
4. Füge folgende Policies hinzu:
   - **Select**: `Anyone` kann lesen (`bucket_id = 'floor-plans'`)
   - **Insert**: `Authenticated users` können hochladen (`bucket_id = 'floor-plans' AND auth.role() = 'authenticated'`)
   - **Delete**: User können eigene Dateien löschen (`bucket_id = 'floor-plans' AND auth.uid()::text = (storage.foldername(name))[1]`)

## 4. Auth Provider konfigurieren

### E-Mail/Passwort
Ist standardmäßig aktiviert.

### Google OAuth
1. Gehe zu **Authentication → Providers → Google**
2. Aktiviere Google
3. Erstelle OAuth-Credentials in der [Google Cloud Console](https://console.cloud.google.com/)
4. Trage **Client ID** und **Client Secret** ein
5. Redirect URL: `https://<dein-projekt>.supabase.co/auth/v1/callback`

### Microsoft OAuth
1. Gehe zu **Authentication → Providers → Azure**
2. Aktiviere Azure
3. Erstelle eine App im [Azure Portal](https://portal.azure.com/)
4. Trage **Client ID** und **Client Secret** ein
5. Redirect URL: `https://<dein-projekt>.supabase.co/auth/v1/callback`

## 5. Site URL konfigurieren

Unter **Authentication → URL Configuration**:
- **Site URL**: `https://<dein-username>.github.io/grundriss-tool` (oder lokale Dev-URL)
- **Redirect URLs**: Gleiche URL hinzufügen

## 6. Lokale Konfiguration

Kopiere `config.local.example.js` als `config.local.js` und trage deine Supabase-Keys ein.