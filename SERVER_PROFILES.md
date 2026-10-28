# Build It!++ — meerdere DayZ/Nitrado-servers

Je kunt dezelfde GitHub Pages-website nu voor **meerdere DayZ PS5-servers** gebruiken zonder de repository aan te passen.

## Een server toevoegen

1. Open de website en klik bovenaan rechts bij **Server** op **Manage**.
2. Vul een herkenbare profielnaam in, bijvoorbeeld *Chernarus PvE*.
3. Vul de HTTPS-URL in van de Cloudflare Worker die toegang heeft tot die Nitrado-server.
4. Vul de **MAP_SYNC_KEY** van die Worker in.
5. Klik **Servers ophalen**. Een Worker die meerdere Nitrado-services ondersteunt laat zijn services in de lijst zien. Een oude single-server Worker toont zijn vaste service.
6. Selecteer de juiste service en klik **Nieuwe server toevoegen**. De website haalt de live serverstatus op ter verificatie en onthoudt het profiel.
7. Wissel voortaan direct via het **Server**-keuzemenu bovenaan rechts.

## Single-server Worker versus multi-server Worker

De bestaande Cloudflare Worker die je eerder hebt geïnstalleerd gebruikt `NITRADO_SERVICE_ID` en `NITRADO_TOKEN` als omgevingsvariabelen. Een **single-server Worker** kan daardoor niet zomaar een andere Nitrado-server beheren wanneer je alleen op de website een ander profiel kiest.

Voor een tweede server kun je daarom een **aparte Worker** gebruiken met de eigen Nitrado-service-ID en token, óf een daadwerkelijk multi-server-geschikte Worker die een geauthenticeerde `GET /api/servers` ondersteunt en elke API-aanroep inclusief de bestands-API aan de geselecteerde `server` bindt. Het profielbeheer biedt beide opties; het verandert de Cloudflare-omgeving zelf niet.

De gebruiker mag nooit `NITRADO_TOKEN`, `MAP_SYNC_KEY` of `MAP_WRITE_KEY` aan de openbare GitHub-repository toevoegen.

## Wat automatisch verandert na het kiezen van een profiel?

- Worker-URL, MAP_SYNC_KEY en gekozen Nitrado-service worden actief.
- De vorige ADM-logs, custom base-markeringen, serverbestanden en niet-gepubliceerde previews worden leeggemaakt.
- De website controleert de serveridentiteit en ververst de eventspawnlocaties uit **cfgeventspawns.xml**. Spawnfilteraantallen worden voor de actieve server opnieuw berekend.
- Drafts in Advanced Event Manager worden per serverprofiel opgeslagen.
- De File Manager en Server Tools lezen voortaan bestanden onder de root van de nieuwe server. Oude snapshots mogen niet naar een andere service worden geschreven.
- De MAP_WRITE_KEY wordt na iedere serverwissel gewist en moet opnieuw worden ingevuld. Hij wordt **niet opgeslagen** in serverprofielen.
- Serverwissels worden tijdens lopende bestandsbewerkingen geblokkeerd. Niet-gepubliceerde lokale wijzigingen leiden tot een waarschuwing.

## Privacy en beperkingen

Serverprofielen, inclusief de **MAP_SYNC_KEY**, worden in `localStorage` van dit browserapparaat bewaard, net als de bestaande verbindingsinstellingen. Ze worden niet in GitHub opgeslagen en niet naar andere apparaten gesynchroniseerd. Gebruik dit alleen op een vertrouwd apparaat. Voor gebruik op een tweede telefoon of browser moeten de profielen opnieuw worden ingesteld.

Het huidige Build It!++ kaartbeeld en de automatische mission discovery zijn **Chernarus-specifiek**. Een server die Livonia, Sakhal of een andere map draait, heeft eigen kaartbestanden en mission-detectie nodig voordat alle kaart- en Server Tools daarop bruikbaar zijn.

Voor multi-server Workers geldt bovendien dat de API bij `/api/status?server=<id>` de echte `serviceId` en `username` moet leveren, en dat `/api/files/list`, `/api/files/read`, `/api/files/write` en `/api/files/custom-content` de doorgegeven serverkeuze veilig moeten respecteren. Als de root in de file API niet overeenkomt met de geverifieerde Nitrado-username, blokkeert de website de toegang.

## Teststatus

De code is op syntax en integratie gecontroleerd. Er zijn Playwright-regressietests toegevoegd voor profielen, serverwissels, sessiesloten en spawndata, maar een volledige browser-run en live Nitrado-test zijn nog niet voltooid.

Je kunt serverprofielen beheren zonder serverbestanden te wijzigen. Het toevoegen, hernoemen, wisselen of verwijderen van een browserprofiel verandert of verwijdert **geen enkele serverconfiguratie** bij Nitrado.
