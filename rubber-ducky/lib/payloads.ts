export type OS = 'linux' | 'windows' | 'macos' | 'android'
export type TagType = 'recon' | 'persist' | 'util' | 'exfil'

export interface Payload {
  id: string
  name: string
  desc: string
  icon: string
  tag: TagType
  os: OS[]
  script: string
}

export const VALID_COMMANDS = [
  'DELAY', 'TYPE', 'STRING_LN', 'KEY', 'COMBO',
  'MOUSE_MOVE', 'MOUSE_CLICK', 'MOUSE_DCLICK',
  'MOUSE_SCROLL', 'WAIT_FOR_BOOT', 'REM', '#', '//', '',
]

export const TAG_LABELS: Record<TagType, string> = {
  recon: 'RECON',
  persist: 'PERSIST',
  util: 'UTIL',
  exfil: 'EXFIL',
}

export const PAYLOADS: Payload[] = [
  // ─── LINUX ───────────────────────────────────────────────
  {
    id: 'linux-sysinfo',
    name: 'System Info',
    desc: 'Gather OS, kernel, user info',
    icon: '🔍',
    tag: 'recon',
    os: ['linux'],
    script: `REM === System Info Recon - Linux ===
DELAY 500
COMBO CTRL+ALT+T
DELAY 1500
STRING_LN uname -a && hostname && id
DELAY 600
STRING_LN cat /etc/os-release | head -5
DELAY 500
STRING_LN uptime && df -h /
DELAY 400`,
  },
  {
    id: 'linux-netinfo',
    name: 'Network Recon',
    desc: 'IPs, routes, open ports, ARP',
    icon: '🌐',
    tag: 'recon',
    os: ['linux'],
    script: `REM === Network Recon - Linux ===
DELAY 500
COMBO CTRL+ALT+T
DELAY 1500
STRING_LN ip a && ip route
DELAY 700
STRING_LN cat /etc/resolv.conf
DELAY 400
STRING_LN ss -tulnp 2>/dev/null || netstat -tulnp
DELAY 700
STRING_LN arp -a
DELAY 400`,
  },
  {
    id: 'linux-user-enum',
    name: 'User Enumeration',
    desc: 'Users, groups, sudo access',
    icon: '👤',
    tag: 'recon',
    os: ['linux'],
    script: `REM === User Enumeration - Linux ===
DELAY 500
COMBO CTRL+ALT+T
DELAY 1500
STRING_LN cat /etc/passwd | grep -v nologin | grep -v false
DELAY 600
STRING_LN groups && id
DELAY 400
STRING_LN sudo -l 2>&1 | head -20
DELAY 500
STRING_LN ls -la /home/
DELAY 400`,
  },
  {
    id: 'linux-open-terminal',
    name: 'Open Terminal',
    desc: 'Launch terminal window',
    icon: '💻',
    tag: 'util',
    os: ['linux'],
    script: `REM === Open Terminal - Linux ===
DELAY 500
COMBO CTRL+ALT+T
DELAY 1500
STRING_LN echo "DuckPad connected - $(whoami)@$(hostname)"
DELAY 400`,
  },
  {
    id: 'linux-lock',
    name: 'Lock Screen',
    desc: 'Lock the screen immediately',
    icon: '🔒',
    tag: 'util',
    os: ['linux'],
    script: `REM === Lock Screen - Linux ===
DELAY 200
COMBO CTRL+ALT+L
DELAY 200`,
  },
  {
    id: 'linux-proc-enum',
    name: 'Process Enumeration',
    desc: 'Running procs, services, cron',
    icon: '⚙️',
    tag: 'recon',
    os: ['linux'],
    script: `REM === Process Enumeration - Linux ===
DELAY 500
COMBO CTRL+ALT+T
DELAY 1500
STRING_LN ps aux --sort=-%cpu | head -20
DELAY 700
STRING_LN systemctl list-units --type=service --state=running 2>/dev/null | head -20
DELAY 700
STRING_LN crontab -l 2>/dev/null; ls /etc/cron* 2>/dev/null
DELAY 500`,
  },

  // ─── WINDOWS ─────────────────────────────────────────────
  {
    id: 'win-open-cmd',
    name: 'Open CMD',
    desc: 'Run dialog → cmd (admin)',
    icon: '⚡',
    tag: 'util',
    os: ['windows'],
    script: `REM === Open Admin CMD - Windows ===
DELAY 500
COMBO GUI+R
DELAY 700
TYPE cmd
DELAY 200
COMBO CTRL+SHIFT+ENTER
DELAY 1200
KEY ENTER
DELAY 800
STRING_LN whoami /all
DELAY 500`,
  },
  {
    id: 'win-sysinfo',
    name: 'System Info',
    desc: 'Gather Windows system info via PS',
    icon: '🔍',
    tag: 'recon',
    os: ['windows'],
    script: `REM === System Info - Windows ===
DELAY 500
COMBO GUI+R
DELAY 700
TYPE powershell -NoP -NonI -W Hidden -C "hostname; whoami; [System.Environment]::OSVersion.VersionString; (Get-WmiObject Win32_ComputerSystem).Model"
DELAY 200
KEY ENTER
DELAY 1500`,
  },
  {
    id: 'win-netinfo',
    name: 'Network Recon',
    desc: 'ipconfig, arp, route, netstat',
    icon: '🌐',
    tag: 'recon',
    os: ['windows'],
    script: `REM === Network Recon - Windows ===
DELAY 500
COMBO GUI+R
DELAY 700
TYPE cmd
KEY ENTER
DELAY 900
STRING_LN ipconfig /all
DELAY 700
STRING_LN arp -a
DELAY 500
STRING_LN route print
DELAY 600
STRING_LN netstat -an | findstr LISTENING
DELAY 500`,
  },
  {
    id: 'win-user-enum',
    name: 'User Enumeration',
    desc: 'Local users, groups, admins',
    icon: '👤',
    tag: 'recon',
    os: ['windows'],
    script: `REM === User Enumeration - Windows ===
DELAY 500
COMBO GUI+R
DELAY 700
TYPE cmd
KEY ENTER
DELAY 900
STRING_LN net user
DELAY 500
STRING_LN net localgroup administrators
DELAY 500
STRING_LN whoami /groups
DELAY 500`,
  },
  {
    id: 'win-lock',
    name: 'Lock Screen',
    desc: 'Lock Windows immediately',
    icon: '🔒',
    tag: 'util',
    os: ['windows'],
    script: `REM === Lock Screen - Windows ===
DELAY 200
COMBO GUI+L
DELAY 200`,
  },
  {
    id: 'win-disable-defender',
    name: 'Check Defender',
    desc: 'Check Windows Defender status',
    icon: '🛡️',
    tag: 'recon',
    os: ['windows'],
    script: `REM === Check Windows Defender Status ===
DELAY 500
COMBO GUI+R
DELAY 700
TYPE powershell -NoP -NonI -W Hidden
DELAY 200
COMBO CTRL+SHIFT+ENTER
DELAY 1500
KEY ENTER
DELAY 800
STRING_LN Get-MpComputerStatus | Select-Object AMRunningMode,RealTimeProtectionEnabled,AntivirusEnabled | Format-List
DELAY 800`,
  },

  // ─── MACOS ───────────────────────────────────────────────
  {
    id: 'mac-open-terminal',
    name: 'Open Terminal',
    desc: 'Spotlight → Terminal',
    icon: '💻',
    tag: 'util',
    os: ['macos'],
    script: `REM === Open Terminal - macOS ===
DELAY 500
COMBO GUI+SPACE
DELAY 800
TYPE terminal
DELAY 400
KEY ENTER
DELAY 1200
STRING_LN echo "$(whoami)@$(hostname) macOS $(sw_vers -productVersion)"
DELAY 400`,
  },
  {
    id: 'mac-sysinfo',
    name: 'System Info',
    desc: 'macOS version, hardware, users',
    icon: '🔍',
    tag: 'recon',
    os: ['macos'],
    script: `REM === System Info - macOS ===
DELAY 500
COMBO GUI+SPACE
DELAY 800
TYPE terminal
KEY ENTER
DELAY 1200
STRING_LN system_profiler SPSoftwareDataType SPHardwareDataType | head -30
DELAY 800
STRING_LN ifconfig | grep "inet " | grep -v 127
DELAY 500
STRING_LN id && groups
DELAY 400`,
  },
  {
    id: 'mac-netinfo',
    name: 'Network Recon',
    desc: 'IPs, routes, connections',
    icon: '🌐',
    tag: 'recon',
    os: ['macos'],
    script: `REM === Network Recon - macOS ===
DELAY 500
COMBO GUI+SPACE
DELAY 800
TYPE terminal
KEY ENTER
DELAY 1200
STRING_LN ifconfig
DELAY 700
STRING_LN netstat -rn
DELAY 600
STRING_LN lsof -i -nP | grep LISTEN | head -20
DELAY 600
STRING_LN arp -a
DELAY 400`,
  },
  {
    id: 'mac-lock',
    name: 'Lock Screen',
    desc: 'Lock macOS immediately',
    icon: '🔒',
    tag: 'util',
    os: ['macos'],
    script: `REM === Lock Screen - macOS ===
DELAY 200
COMBO CTRL+SHIFT+Q
DELAY 200`,
  },

  // ─── ANDROID ─────────────────────────────────────────────
  {
    id: 'and-home',
    name: 'Go Home',
    desc: 'Press Home key',
    icon: '🏠',
    tag: 'util',
    os: ['android'],
    script: `REM === Go Home - Android OTG ===
DELAY 500
KEY HOME
DELAY 300`,
  },
  {
    id: 'and-back',
    name: 'Back + Home',
    desc: 'Press Back then Home',
    icon: '↩️',
    tag: 'util',
    os: ['android'],
    script: `REM === Back + Home - Android ===
DELAY 500
KEY ESC
DELAY 300
KEY HOME
DELAY 300`,
  },
]

export const SNIPPETS = [
  { label: 'DELAY 500',        code: 'DELAY 500' },
  { label: 'DELAY 1000',       code: 'DELAY 1000' },
  { label: 'DELAY 2000',       code: 'DELAY 2000' },
  { label: 'WAIT_FOR_BOOT',    code: 'WAIT_FOR_BOOT' },
  { label: 'KEY ENTER',        code: 'KEY ENTER' },
  { label: 'KEY ESC',          code: 'KEY ESC' },
  { label: 'KEY TAB',          code: 'KEY TAB' },
  { label: 'KEY F5',           code: 'KEY F5' },
  { label: 'COMBO GUI+R',      code: 'COMBO GUI+R' },
  { label: 'COMBO CTRL+ALT+T', code: 'COMBO CTRL+ALT+T' },
  { label: 'COMBO CTRL+C',     code: 'COMBO CTRL+C' },
  { label: 'COMBO ALT+F4',     code: 'COMBO ALT+F4' },
  { label: 'COMBO GUI+L',      code: 'COMBO GUI+L' },
  { label: 'TYPE ...',         code: 'TYPE ' },
  { label: 'STRING_LN ...',    code: 'STRING_LN ' },
  { label: 'MOUSE_CLICK LEFT', code: 'MOUSE_CLICK LEFT' },
  { label: 'MOUSE_CLICK RIGHT',code: 'MOUSE_CLICK RIGHT' },
  { label: 'MOUSE_MOVE 0 50',  code: 'MOUSE_MOVE 0 50' },
  { label: 'MOUSE_SCROLL 3',   code: 'MOUSE_SCROLL 3' },
  { label: 'REM comment',      code: 'REM ' },
]
