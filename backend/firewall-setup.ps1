# ╔══════════════════════════════════════════════════════════╗
# ║  ACTION 3: Configuration Firewall Windows                ║
# ║  Restreindre accès réseau au serveur SYGIM              ║
# ╚══════════════════════════════════════════════════════════╝

# Paramètres de configuration
$AllowedNetworks = @(
    "192.168.0.0/24",    # Réseau local
    "10.0.0.0/8",        # Réseau privé
    "127.0.0.1"          # Localhost
)

$HttpPort = 5000
$HttpsPort = 5443

# ────────────────────────────────────────────────────────
# Vérifier si Admin
# ────────────────────────────────────────────────────────
$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $IsAdmin) {
    Write-Host "❌ Ce script doit être exécuté en tant que Administrateur" -ForegroundColor Red
    Write-Host "   Relancez PowerShell en Admin (Windows+X > Windows PowerShell Admin)" -ForegroundColor Yellow
    exit 1
}

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Configuration Firewall SYGIM                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ────────────────────────────────────────────────────────
# Afficher réseaux autorisés
# ────────────────────────────────────────────────────────
Write-Host "📋 Réseaux autorisés:" -ForegroundColor Cyan
foreach ($Network in $AllowedNetworks) {
    Write-Host "   • $Network" -ForegroundColor Gray
}

Write-Host "`n🔧 Ports:" -ForegroundColor Cyan
Write-Host "   • HTTP (port $HttpPort): Application" -ForegroundColor Gray
Write-Host "   • HTTPS (port $HttpsPort): Sécurisé" -ForegroundColor Gray

# ────────────────────────────────────────────────────────
# Supprimer anciennes règles (si existantes)
# ────────────────────────────────────────────────────────
Write-Host "`n🧹 Nettoyage des anciennes règles..." -ForegroundColor Yellow

$OldRules = Get-NetFirewallRule -DisplayName "SYGIM*" -ErrorAction SilentlyContinue
if ($OldRules) {
    foreach ($Rule in $OldRules) {
        Remove-NetFirewallRule -Name $Rule.Name -Force -ErrorAction SilentlyContinue
        Write-Host "   ✓ Supprimée: $($Rule.DisplayName)" -ForegroundColor DarkGray
    }
}

# ────────────────────────────────────────────────────────
# Créer nouvelles règles
# ────────────────────────────────────────────────────────
Write-Host "`n🔐 Création des règles..." -ForegroundColor Green

$AllowedIps = $AllowedNetworks -join ','

# Règle HTTP
New-NetFirewallRule `
    -DisplayName "SYGIM HTTP" `
    -Name "SYGIM-HTTP" `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $HttpPort `
    -RemoteAddress $AllowedIps `
    -Description "Autoriser HTTP pour SYGIM (port $HttpPort)" | Out-Null

Write-Host "   ✅ Règle HTTP créée" -ForegroundColor Green

# Règle HTTPS
New-NetFirewallRule `
    -DisplayName "SYGIM HTTPS" `
    -Name "SYGIM-HTTPS" `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $HttpsPort `
    -RemoteAddress $AllowedIps `
    -Description "Autoriser HTTPS pour SYGIM (port $HttpsPort)" | Out-Null

Write-Host "   ✅ Règle HTTPS créée" -ForegroundColor Green

# ────────────────────────────────────────────────────────
# Vérifier les règles créées
# ────────────────────────────────────────────────────────
Write-Host "`n✅ Règles actives:" -ForegroundColor Green
Get-NetFirewallRule -DisplayName "SYGIM*" | Select-Object DisplayName, Direction, Action, Enabled | Format-Table

# ────────────────────────────────────────────────────────
# Tests de connectivité
# ────────────────────────────────────────────────────────
Write-Host "`n🧪 Test de connectivité..." -ForegroundColor Yellow

$TestResults = @()

# Test localhost
$Result = Test-NetConnection -ComputerName 127.0.0.1 -Port $HttpPort -InformationLevel Quiet
$TestResults += @{ Network = "localhost"; Port = $HttpPort; Result = $Result; Expected = "Autorisé" }

# Test réseau local
$LocalIp = (Get-NetIPAddress -AddressFamily IPv4 -Type Unicast | Where-Object { $_.InterfaceAlias -notmatch "Loopback" }).IPAddress | Select-Object -First 1
if ($LocalIp) {
    $Result = Test-NetConnection -ComputerName $LocalIp -Port $HttpPort -InformationLevel Quiet
    $TestResults += @{ Network = $LocalIp; Port = $HttpPort; Result = $Result; Expected = "Autorisé" }
}

# Afficher résultats
foreach ($Test in $TestResults) {
    $Status = if ($Test.Result) { "✅ AUTORISÉ" } else { "❌ BLOQUÉ" }
    Write-Host "   $Status - $($Test.Network):$($Test.Port)" -ForegroundColor $(if ($Test.Result) { "Green" } else { "Red" })
}

# ────────────────────────────────────────────────────────
# Résumé
# ────────────────────────────────────────────────────────
Write-Host "`n📊 Résumé:" -ForegroundColor Cyan
Write-Host "   • Règles créées: 2 (HTTP + HTTPS)" -ForegroundColor Gray
Write-Host "   • Réseaux autorisés: $($AllowedNetworks.Count)" -ForegroundColor Gray
Write-Host "   • État: Actif et opérationnel" -ForegroundColor Green

Write-Host "`n📝 Commandes pour révision:" -ForegroundColor Cyan
Write-Host "   netsh advfirewall firewall show rule name='SYGIM*'" -ForegroundColor DarkGray
Write-Host "   netsh advfirewall firewall delete rule name='SYGIM-HTTP'" -ForegroundColor DarkGray

Write-Host "`n✅ Configuration Firewall terminée!" -ForegroundColor Green
