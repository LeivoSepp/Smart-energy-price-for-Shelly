# Nutikas ja odav börsihinna järgi kütmine Shellyga 
See Shelly skript tagab kütteseadme töö kõige odavamate tundide ajal, kasutades elektri börsihindu ja erinevaid algoritme.

- [Nutikas ja odav börsihinna järgi kütmine Shellyga](#nutikas-ja-odav-börsihinna-järgi-kütmine-shellyga)
  - [Põhifunktsioonid](#põhifunktsioonid)
  - [Jälgimine ja ajakava muutmine](#jälgimine-ja-ajakava-muutmine)
    - [Kuidas kontrollida ajakava](#kuidas-kontrollida-ajakava)
    - [Kuidas ajakava käsitsi muuta](#kuidas-ajakava-käsitsi-muuta)
    - [Kuidas jälgida skripti käivitumist](#kuidas-jälgida-skripti-käivitumist)
  - [Skripti parameetrite konfigureerimine](#skripti-parameetrite-konfigureerimine)
    - [Shelly Virtual Component kasutamine](#shelly-virtual-component-kasutamine)
    - [Shelly KVS-i kasutamine](#shelly-kvs-i-kasutamine)
  - [Oluline teada](#oluline-teada)
  - [Testitud rikke stsenaariumid](#testitud-rikke-stsenaariumid)
- [Nutikad kütte algoritmid](#nutikad-kütte-algoritmid)
  - [Ilmaprognoosi algoritm](#ilmaprognoosi-algoritm)
    - [Ilmaprognoosipõhise kütmise eelised](#ilmaprognoosipõhise-kütmise-eelised)
    - [Shelly geograafiline asukoht](#shelly-geograafiline-asukoht)
    - [Küttegraafik](#küttegraafik)
  - [Ajaperioodi algoritm](#ajaperioodi-algoritm)
- [Kas see tõesti vähendab minu elektriarveid](#kas-see-tõesti-vähendab-minu-elektriarveid)
- [Kuidas seda skripti installida](#kuidas-seda-skripti-installida)
  - [Paigaldamine](#paigaldamine)
  - [Skripti uuendamine](#skripti-uuendamine)
  - [Kuidas kontrollida et skript töötab](#kuidas-kontrollida-et-skript-töötab)
  - [Kuidas skript töötab](#kuidas-skript-töötab)
- [Tõrkeotsing](#tõrkeotsing)
  - [Viga "Couldn't get script"](#viga-couldnt-get-script)
  - [Advanced → Key Value Storage → Script Data](#advanced--key-value-storage--script-data)
- [Litsents](#litsents)
- [Autor](#autor)


## Põhifunktsioonid 
1. **Ilmaennustusega odavad tunnid**: Järgmise päeva küttetunnid on optimeeritud ilmaprognoosi ja energiahindade põhjal. 
2. **Fikseeritud odavad tunnid**: Jaota päev ajaperioodideks (6, 12 või 24) ja aktiveeri küte iga perioodi kõige odavama(te)l tundidel. 
3. **Hinnatasemete kasutamine**: Kasuta min ja max hinnaläve, et hoida Shelly süsteem sellest lähtuvalt ka sees või väljas. 

**Käivituse ajakava**: Skript töötab iga päev pärast 23:00 või vajadusel päeva jooksul, et arvutada järgmise perioodi või päeva küttetunnid. 

## Jälgimine ja ajakava muutmine 
Alates skriptiversioonist 3.9 (jaanuar 2025) loob see skript ühe ajakava, mis sisaldab kõiki vajalikke küttetunde. 
### Kuidas kontrollida ajakava 
Skripti loodud küttetundide vaatamiseks: 
1. Avage Shelly ajakava (Schedule). 
2. Klõpsake **Time**, et näha täielikku kütteseadme ajakava. 

|||
|-|-| 
|<img src="images/oneschedule.jpg" alt="Open Schedule" width="200">|<img src="images/editschedule.jpg" alt="Open Schedule" width="200">| 

### Kuidas ajakava käsitsi muuta 
Saate ajakava käsitsi muuta, klõpsates mis tahes tunnil, et see lisada või eemaldada, seejärel klõpsake Next &rarr; Next &rarr; Save. 

Järgmine kord kui skript arvutab uue ajakava, kirjutatakse kõik käsitsi loodudmuudatused üle. 

### Kuidas jälgida skripti käivitumist 
Andmeväli ``lastcalculation`` KVS-is värskendatakse iga kord, kui Eleringist on saadud uued elektrihinnad ja genereeritakse järgmise perioodi ajakava. 

## Skripti parameetrite konfigureerimine 

### Shelly Virtual Component kasutamine
Skript toetab Shelly virtuaalseid komponente võimaldades parameetreid muuta Shelly veebirakenduse või mobiiltelefoni vahendusel. Virtuaalseid komponente toetatakse Shelly Gen 2 Pro seadmetes ja kõigis Gen 3 ja uuemates seadmetes. 

<img src="images/ShellyVirtualComponents.jpg" alt="Shelly KVS" width="700"> 

### Shelly KVS-i kasutamine 
Vanemate Shelly seadmete puhul, mis ei toeta virtuaalseid komponente, salvestatakse kõik parameetrid Shelly KVS-i (Key Value Store). Neid seadeid saab muuta ainult otse Shelly seadme enda veebiliidese ja IP-aadressi kaudu, navigeerige **Menüü &rarr; Advanced &rarr; KVS** ja leidke soovitud seadistused. 
<img src="images/ShellyKVS.jpg" alt="Shelly KVS" width="550"> 

1. ``alwaysOffHighPrice: 300`` - Küte on igal juhul väljas, kui börsihind ületab selle väärtuse (EUR/MWh). 
2. ``alwaysOnLowPrice: 10`` - Küte on igal juhul sees, kui börsihind on sellest väärtusest madalam (EUR/MWh). 
3. ``country: ee`` - Börsihinna riik. Toetatud on ainult Eleringi API riigid. * ``ee`` - Eesti * ``fi`` - Soome * ``lt`` - Leedu * ``lv`` - Läti 
4. ``defaultTimer: 60`` - Shelly lühim sisselülituse aeg minutites. Vaikeväärtuseks on määratud ``60``, et vastata energiahindade tunnimuutustele. 
5. ``elektrilevi: VORK2`` - Elektrilevi või Imatra elektri ülekandetasude pakett. Valikus on VORK1, VORK2, VORK4, VORK5, Partner24, Partner24Plus, Partner12, Partner12Plus ja NONE. Vali None, et mitte arvestada ülekandetasusid. 
Ülekandetasude üksikasjad leiab siit: [Elektrilevi](https://elektrilevi.ee/en/vorguleping/vorgupaketid/eramu) või [Imatra](https://imatraelekter.ee/vorguteenus/vorguteenuse-hinnakirjad/).


| Võrgupakett | Kirjeldus | |
| - | - | :-: |
| ``VORK1`` | **Elektrilevi**<br> Päev/öö 77 EUR/MWh | <img src="images/Vork1.jpg" alt="Elektrilevi Võrk 1" width="200"> |
| ``VORK2`` | **Elektrilevi**<br> Päeval 60 EUR/MWh <br> Öösel 35 EUR/MWh | <img src="images/Vork2-4.jpg" alt="Elektrilevi Võrk 2, 4" width="250"> |
| ``VORK4`` | **Elektrilevi**<br> Päeval 37 EUR/MWh <br> Öösel 21 EUR/MWh | <img src="images/Vork2-4.jpg" alt="Elektrilevi Võrk 2, 4" width="250"> |
| ``VORK5`` | **Elektrilevi**<br> Päeval 53 EUR/MWh <br> Öösel 30 EUR/MWh <br> Päeva tipp 82 EUR/MWh <br> Puhke tipp 47 EUR/MWh | <img src="images/Vork5-1.jpg" alt="Elektrilevi Võrk 5" width="250"> <img src="images/Vork5-2.jpg" alt="Elektrilevi Võrk 5" width="250"> |
| ``Partner24`` | **Imatra**<br> Päev/öö 60 EUR/MWh | |
| ``Partner24Plus`` | **Imatra**<br> Päev/öö 39 EUR/MWh | |
| ``Partner12`` | **Imatra**<br> Päeval 72 EUR/MWh <br> Öösel 42 EUR/MWh | Suveaeg päev: E-R kell 8:00–24:00.<br>Öö: E-R kell 0:00–08:00, L-P terve päev <br> Talveaeg päev: E-R kell 7:00–23:00.<br>Öö: E-R kell 23:00–7:00, L-P terve päev |
| ``Partner12Plus`` | **Imatra**<br> Päeval 46 EUR/MWh <br> Öösel 27 EUR/MWh | Suveaeg päev: E-R kell 8:00–24:00.<br>Öö: E-R kell 0:00–08:00, L-P terve päev <br> Talveaeg päev: E-R kell 7:00–23:00.<br>Öö: E-R kell 23:00–7:00, L-P terve päev |
| ``NONE`` | Võrgutasu on 0 ||

6. ``heatingCurve: 0`` - Ilmaennustuse prognoosi mõju suurendamine või vähendamine küttetundidele. Vaikeväärtus on ``0``, nihe 1 võrdub 1h. See seadistus kehtib ainult siis, kui kasutatakse ilmaprognoosiga kütteaga.
Vaadake kütte kõvera mõju kütte aja sõltuvusgraafikutele: [kütteaja sõltuvusgraafikud](https://github.com/LeivoSepp/Smart-heating-management-with-Shelly?tab=readme-ov-file#heating-curve).
    * ``-6`` - 6h vähem kütmist
    * ``6`` - 6h rohkem kütmist

7. ``heatingMode: { "timePeriod": 12, "heatingTime": 0,"isFcstUsed": true }`` 

Vaata küttereziimide osas alltoodud tabelit.

> Küttereziime saate kohandada viisil, et need sobiksid teie isiklike eelistuste ja konkreetsete olukordadega.

| Kütte režiim | Kirjeldus | Parim kasutus |
| --- | --- | --- |
| ``{ "timePeriod": 24, "heatingTime": 10,"isFcstUsed": true }`` | Kütmise aeg **24-tunnise** perioodi kohta sõltub **välistemperatuurist**. | Betoonpõranda kütmine või suur veepaak, mis suudab hoida soojusenergiat vähemalt 10–15 tundi. |
| ``{ "timePeriod": 12, "heatingTime": 5,"isFcstUsed": true }`` | Kütmise aeg iga **12-tunnise** perioodi kohta sõltub **välistemperatuurist**. | Kipsivalu põrandaküte või veepaak, mis suudab hoida soojusenergiat 5–10 tundi. |
| ``{ "timePeriod": 6, "heatingTime": 2,"isFcstUsed": true }`` | Kütmise aeg iga **6-tunnise** perioodi kohta sõltub **välistemperatuurist**. | Õhk-soojuspumbad, radiaatorid või põrandaküttesüsteemid väikese veepaagiga, mis suudab hoida energiat 3–6 tundi. |
| ``{ "timePeriod": 24, "heatingTime": 20,"isFcstUsed": false }`` | Küte on aktiveeritud **20** kõige odavamal tunnil päevas. | Näiteks ventilatsioonisüsteem. |
| ``{ "timePeriod": 24, "heatingTime": 12,"isFcstUsed": false }`` | Küte on aktiveeritud **12** kõige odavamal tunnil päevas. | Suur veepaak 1000L või rohkem. |
| ``{ "timePeriod": 12, "heatingTime": 6,"isFcstUsed": false }`` | Küte on aktiveeritud **kuuel** kõige odavamal tunnil igas **12-tunnises** perioodis. | Suur veepaak 1000L või rohkem, suure kasutusega. |
| ``{ "timePeriod": 12, "heatingTime": 2,"isFcstUsed": false }`` | Küte on aktiveeritud **kahel** kõige odavamal tunnil igas **12-tunnises** perioodis. | Väike 150L veeboiler väikesele majapidamisele. |
| ``{ "timePeriod": 6, "heatingTime": 2,"isFcstUsed": false }`` | Küte on aktiveeritud **kahel** kõige kulutõhusamal tunnil igas **6-tunnises** perioodis. | Suur 200L veeboiler neljale või enamale inimesele mõeldud majapidamisele. |
| ``{ "timePeriod": 0, "heatingTime": 0,"isFcstUsed": false }`` | Küte on aktiveeritud ainult tundidel, kui elektri börsihind on madalam kui määratud ``alwaysOnLowPrice``. |

8. ``isOutputInverted: true`` - Konfigureerib relee oleku kas normaalseks või pööratud.
    * ``true`` - Pööratud relee olek. Seda nõuavad mitmed maasoojuspumbad nagu Nibe või Thermia.
    * ``false`` - Normaalne relee olek, seda kasutatakse veeboilerite või elektrilise põrandakütte puhul. 

9. ``powerFactor: 0.5`` - Kohandab küttegraafiku sujuvamaks või järsemaks. Vaikeväärtus ``0.5``. See seade kehtib ainult siis, kui kasutatakse ilmaprognoosiga kütte juhtimist.

## Oluline teada

* <p>Kui skript peatatakse, kustutatakse kütte ajakava. Shelly järgib kütte algoritmi ainult siis, kui skript töötab.</p>
* <p>Uuematel Shelly seadmetel, mis kasutavad virtuaalseid komponente, saab korraga töötada ainult üks skript. See tuleneb virtuaalsete komponentide piirangust, mida saab olla kuni 10.</p>
* <p>KVS-režiimis võib korraga töötada kuni kaks erineva algoritmiga skripti ühel seadmel. Skriptid võivad kasutada kas sama releeväljundit Shelly Plus 1-ga või erinevaid releeväljundeid, nagu toetab näiteks Shelly Plus 2PM või Pro 4PM.</p>
* <p>See skript loob spetsiaalse "valvuri/watchdog" skripti. See "valvuri" skript kustutab Shelly kütte ajakava kui põhiskript peatatakse või kustutatakse.</p>
* <p>Interneti katkestuste mõju vähendamiseks kasutab see skript parameetrit ``heating time``, et lülitada küte ajalooliselt odavamate tundide järgi sisse.</p>
* <p>Selle skripti "Run on startup" nupp peab olema aktiveeritud. See seadistus tagab, et skript käivitub pärast voolukatkestust, Shelly taaskäivitust või püsivara uuendamist.</p>
* <p>See skript haldab ainult tema enda loodud kütte ajakava. See skript kustutab ainult selle ajakava, mille ise on loonud.</p>
* <p>See lahendus on kasulik ainult siis, kui teil on börsihinnaga elektrileping. Kui teie elektrileping on kindla hinnaga, siis antud lahendus ei aita rahalist kokkuhoidu saavutada.</p>
* See skript sõltub internetist ja kahest teenusest:
    * Elektrituru hind [Eleringi API](https://dashboard.elering.ee/assets/api-doc.html#/nps-controller/getPriceUsingGET),
    * Ilmaprognoos [Open-Meteo API](https://open-meteo.com/en/docs).

<br>

## Testitud rikke stsenaariumid
Alltoodud rikete ajal kasutab Shelly ``Heating Time`` kestust, et lülitada küte ajalooliselt odavamate tundide järgi sisse.
Ajalooliselt odavad tunnid on järgmised ajavahemikud: 00:00-08:00, 12:00-15:00 ja 20:00-23:00. Shelly jagab antud kütteaja võrdselt päeva esimese ja teise poole vahel.

1. Shelly töötab edasi, kuid internet läheb maha kodurouteri või internetiteenuse pakkuja rikke tõttu. Shelly kellaaeg jääb korrektseks.
2. Pärast voolukatkestust internet ei tööta ja Shellyl puudub kellaaeg.
3. Eleringi HTTP viga tekib ja Eleringi server pole kättesaadav.
4. Eleringi API rike juhtub ja teenus on maas.
5. Eleringi API tagastab valed andmed ja hinnad puuduvad.
6. Ilmaprognoosi HTTP viga tekib ja server pole saadaval.
7. Ilmaprognoosi API teenuse viga tekib ja JSON andmeid ei saada.

# Nutikad kütte algoritmid

## Ilmaprognoosi algoritm

> See algoritm arvutab järgmise päeva kütteaja ilmaprognooside põhjal. See on eriti tõhus erinevate koduküttesüsteemide jaoks, sealhulgas suure veepaagiga süsteemid, mis suudavad soojusenergiat säilitada. See lähenemine optimeerib energiakasutust, joondades küttevajadused eeldatavate ilmastikuoludega.

### Ilmaprognoosipõhise kütmise eelised

* Välistemperatuurile reageerimine:

Kui välistemperatuur on +17 kraadi, pole üldjuhul kütmist vaja. Kui aga temperatuur langeb -5 kraadini, on vajalik mõningane kütmine ja eriti külmades tingimustes, nagu -20 kraadi, on vaja märkimisväärselt kütmist. Ilmateade kohandab kütmiseks võetavate tundide arvu vastavalt välistemperatuurile.

* Nutikas kütte haldamine:

Ilmaprognooside kasutamine võimaldab nutikat ja kohanduvat küttehaldust. Süsteem kohandab küttetunde välise temperatuuri põhjal, luues reageeriva ja dünaamilise kütte ajakava.

* Asukohapõhine prognoos:

Täpse ilmaprognoosi saamiseks on tarvis teada asukohta, et arvutada välja parim küttestrateegia.

### Shelly geograafiline asukoht

> Veenduge, et teie Shelly seadmel oleks õige asukohateave, kontrollides Shelly &rarr; Seaded &rarr; Geolokatsioon &rarr; Laiuskraad/pikkuskraad.

Märkus: Shelly asukoht määratakse teie internetiteenuse pakkuja IP-aadressi põhjal, mis ei pruugi täpselt kajastada teie kodu asukohta. Kontrollige ja uuendage vajadusel laius- ja pikkuskraadi seadeid.

### Küttegraafik

Temperatuuri ja kütteaja vaheline seos on tuntud kui *küttegraafik*.

Kütteaega mõjutab teie maja isolatsioon. Näiteks vana ja soojustamata maja võib vajada -5 kraadi juures 10 tundi kütmist, samas kui uus A-klassi maja vajab võib-olla ainult 6 tundi.

Nende erinevuste arvestamiseks sisaldab skript parameetrit ``heatingCurve``, mis võimaldab kasutajal kohandada küttetegurit vastavalt maja soojapidavusele.

* 24-tunnise perioodi graafik iseloomustab kuidas kütteaeg varieerub välistemperatuuri ja ``heatingCurve`` parameetri põhjal, mis omakorda nihutab küttegraafikut vasakule või paremale 1h sammuga. 

<img src="images/HeatingCurve24.jpg" alt="Küttegraafik 24-tunniseks perioodiks" width="750">

____

* 12-tunnise perioodi küttegraafik ja kütteaja sõltuvus välistemperatuuri ja ``heatingCurve`` parameetrist.

<img src="images/HeatingCurve12.jpg" alt="Küttegraafik 12-tunniseks perioodiks" width="750">

Kui matemaatiline pool huvitab siis küttegraafuku lineaarvõrrand on järgmine: ``(Temperatuuri prognoos) * PowerFactor + (Temperatuuri prognoos + heatingCurve)``.

## Ajaperioodi algoritm

> See algoritm jagab päeva perioodideks, aktiveerides kütte kõige odavamatel tundidel igas perioodis. See sobib hästi kasutusjuhtudeks, nagu kuumavee boilerid, kus kasutus sõltub majapidamise suurusest ja mitte välistemperatuurist. See meetod optimeerib energiakasutust ning vesi püsib soe kõige madalamate elektri börsi hindadega.

* 24-tunnine graafik ja kuidas 10 kõige odavamat tundi valitakse, on näitena kujutatud järgmisel pildil. Punane tähistab kütmiseks kasutatavaid tunde.

<img src="images/Heating24_10.jpg" alt="Kütteperiood 24 tundi" width="750">

___

* 4-tunnine graafik ja kuidas 1 kõige odavam kütmise tund valitakse iga 4-tunnise perioodi kestel.

<img src="images/Heating4_1.jpg" alt="Kütteperiood 4 tundi" width="750">

</br>

# Kas see tõesti vähendab minu elektriarveid
Lühidalt: jah.

Siin on ka üksikasjalikum selgitus. Kuigi teie üldine igapäevane elektritarbimine jääb samaks, optimeerib see skript teie kütteseadmete töö kõige odavamatele tundidele. Seetõttu väheneb teie elektriarve, kuigi energia tarbimine jääb samaks.

Sellised seadmed nagu veeboilerid, veepaagid, maakütte- või õhksoojuspumbad, elektriradiaatorid, põrandakütte elektrisüsteemid ja konditsioneerid on seadmed, mis annavad kõige suurema kasu börsihinnaga juhtimisel.

Elektrihinnad võivad kõikuda märkimisväärselt, varieerudes päeva jooksul kuni 100 korda. Elektrituru hindade kohta lisateabe saamiseks vaadake järgmist linki: [Elering](https://dashboard.elering.ee/et/nps/price)


# Kuidas seda skripti installida

## Paigaldamine

1. Hankige Shelly Plus, Pro või Gen3 seade: [Shelly seadmed](https://www.shelly.com/collections/smart-switches-dimmers).
2. Ühendage Shelly seade oma isiklikku WiFi võrku. [Shelly veebiliidese juhendid](https://kb.shelly.cloud/knowledge-base/web-interface-guides).
3. Shelly Gen2 Plus seadmete püsivara peab olema versioon 1.4.4 või uuem. KVS andmed on kirjutuskaitstud, kui püsivara versioon on 1.4.3 või vanem.
4. Shelly Gen2 Pro või Gen3 seadmete püsivara peab olema versioon 1.4.4 või uuem. Skript ei installi virtuaalseid komponente, kui püsivara versioon on 1.4.3 või vanem.
5. Avage Shelly seadme veebileht: Klõpsake Settings &rarr; Device Information &rarr; Device IP &rarr; klõpsake IP-aadressil. Avaneb Shelly seadme veebileht, vasakpoolses menüüs klõpsake "<> Scripts".
6. Klõpsake nuppu "Library" (ärge klõpsake "Create Script") &rarr; Configure URL &rarr; kopeerige ja kleepige ning salvestage järgmine link. Selle meetodi abil saate tagada, et saate skripti uusima versiooni. `https://raw.githubusercontent.com/LeivoSepp/Smart-heating-management-with-Shelly/master/manifest.json`
7. Klõpsake nuppu "Import code".

<img src="images/insertcode.jpg" alt="Sisestage kood" width="750">

8. Nimetage skript näiteks "Küte 24h-Ilmaprognoos" ja salvestage.
9. Kui salvestamisprotsess on lõpule viidud, klõpsake "Start".
10. Skripti parameetrite konfigureerimine
    - [Shelly rakenduse kasutamine](#shelly-rakenduse-kasutamine)
    - [Shelly KVS-i kasutamine](#shelly-kvs-i-kasutamine)

## Skripti uuendamine

1. Avage skripti veebileht [Githubis](https://github.com/LeivoSepp/Smart-heating-management-with-Shelly/blob/v3.2/SmartHeatingWidthShelly.js).
2. Klõpsake nuppu "Copy raw file". Nüüd on skript teie lõikelauamälus.
<img src="images/CopyCode.jpg" alt="Sisestage kood" width="750">

3. Avage Shelly seadme veebilehelt: navigeerige Settings → Device Information &rarr; Device IP &rarr; klõpsake IP-aadressil. Avaneb Shelly seadme veebileht; vasakpoolses menüüs valige "<> Scripts."
4. Avage skript, mida soovite uuendada.
5. Valige kogu skriptikood ja kustutage see **Ctrl+A** &rarr; **Kustuta**.
6. Kleepige kood lõikelaualt skripti aknasse **Ctrl+V**.
7. Salvestage skript, versioon on nüüd uuendatud.
8. Kõik konfiguratsioonid jäävad samaks, kuna need on salvestatud KVS-i või virtuaalsetesse komponentidesse.

## Kuidas kontrollida et skript töötab

1. Shelly rakenduses või veebilehel navigeerige "Schedules" (Ajakavad).
2. Kontrollige Shelly aktiveerimise ajakava.
3. Edasijõudnud kasutajad saavad kontrollida KVS-i salvestust: [Advanced → Key Value Storage → Script Data](#advanced--key-value-storage--script-data)

## Kuidas skript töötab

1. Internetiühendus:
    * Skript vajab internetti, et alla laadida igapäevaseid elektrihindu ja ilmaprognoose.
2. Igapäevane töö:
    * Skript töötab iga päev pärast kella 23:00 või vastavalt vajadusele päeva jooksul, et määrata küttetunnid.
3. Töövoog:
    * Skript järgib vooskeemi, et määrata parimad kütmissetunnid turuhindade ja ilmaprognooside põhjal.


# Tõrkeotsing

## Viga "Couldn't get script"

Shelly süsteemis on probleem, mis võib mõjutada teie kogemust skriptide avamisel Shelly pilve või mobiilirakenduse kaudu. Tekkinud viga "Couldn't get script" on teadaolev bugi, mis takistab skriptide avamist, mis on suuremad kui 15kB nende platvormide kaudu.

Selle ebamugavuse ületamiseks soovitame järgmisi lahendusi:

1. Avage skript seadme veebilehe kaudu:
Juurdepääs seadme veebilehele võimaldab teil edukalt avada mis tahes skripti. See meetod pakub otsest ja usaldusväärset lahendust, et vaadata ja hallata oma skripte sujuvalt.

2. Alternatiivne lahendus Shelly pilve kaudu:
Kui seadme veebilehele juurdepääs ei ole võimalik, järgige neid samme Shelly pilves:

   1. Kustutage olemasolev skript.
   2. Looge uus skript.
   3. Kopeerige ja kleepige kogu skript skripti aknasse.
   4. Salvestage ja sulgege skript.
   5. Käivitage skript.

    Kui selle protsessi käigus tekib probleeme, saate seda lahendust korrata, alustades skripti kustutamise sammust.

<img src="images/CouldntGetScript.jpg" alt="Couldn't get script." width="750">

## Advanced &rarr; Key Value Storage &rarr; Script Data

Skript salvestab andmed Shelly KVS (Key-Value-Storage) säilitamaks neid elektrikatkestuste või taaskäivituste korral.

Salvestatud andmete juurde pääsemiseks Shelly seadme veebilehe kaudu, navigeerige **Advanced &rarr; KVS**.

1. Parameeter: ``schedulerIDs1`` Väärtus: ``1``
   
    See on skripti poolt loodud ajakava ID number. See teave on oluline iga skripti jaoks, et tuvastada ja hallata seotud ajakava. 

2. Parameeter: ``lastcalculation1`` Väärtus: ``Fri Dec 27 2024 23:29:20 GMT+0200`` 
   
   See ajatempel näitab aega, millal skript sai edukalt Eleringi API kaudu börsihinnad ja tekitas kütmise jaoks ajakava. See teave pakub head ülevaadet skripti tegevuse ajakavast.

3. Parameeter: ``version1`` Väärtus: ``3.8`` 
   
   Versioon näitab installitud skripti versiooni.

<img src="images/kvs.jpg" alt="Key Value Storage" width="750">


# Litsents

See projekt on litsentseeritud MIT litsentsi alusel. Vaadake [LITSENTS](LICENSE) faili üksikasjade saamiseks.

# Autor

Loodud Leivo Sepp, 2024-2025

[GitHub Repository](https://github.com/LeivoSepp/Smart-heating-management-with-Shelly)
