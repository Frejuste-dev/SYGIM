# ╔══════════════════════════════════════════════════════════╗
# ║  Scheduler Setup - Automatiser Backups SYGIM             ║
# ║  Crée une tâche planifiée pour les sauvegardes           ║
# ╚══════════════════════════════════════════════════════════╝

# Vérifier si Admin
$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "❌ Ce script doit être exécuté en tant que Administrateur" -ForegroundColor Red
    Write-Host "   Relancez PowerShell en Admin (Windows+X > Windows PowerShell Admin)" -ForegroundColor Yellow
    exit 1
}

$ScriptPath = "D:\joa APP - envoie\backend\backup-db.ps1"
$TaskName = "SYGIM-DatabaseBackup"
$Description = "Sauvegarde quotidienne de la base de données SYGIM"

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Setup - Scheduler Backup SYGIM                    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ────────────────────────────────────────────────────────
# Vérifier script
# ────────────────────────────────────────────────────────

if (!(Test-Path $ScriptPath)) {
    Write-Host "❌ Script non trouvé: $ScriptPath" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Script trouvé: $ScriptPath`n" -ForegroundColor Green

# ────────────────────────────────────────────────────────
# Supprimer ancienne tâche (si existe)
# ────────────────────────────────────────────────────────

$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Write-Host "🧹 Suppression ancienne tâche..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -Force
    Write-Host "✅ Ancienne tâche supprimée`n" -ForegroundColor Green
}

# ────────────────────────────────────────────────────────
# Créer nouvelle tâche
# ────────────────────────────────────────────────────────

Write-Host "📅 Création tâche planifiée..." -ForegroundColor Yellow
Write-Host "   Heure: 02:00 AM (quotidien)" -ForegroundColor Gray
Write-Host "   Jour: Tous les jours" -ForegroundColor Gray
Write-Host "   Utilisateur: SYSTEM" -ForegroundColor Gray

$Trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At 02:00

$Action = New-ScheduledTaskAction `
    -Execute "PowerShell" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

$Settings = New-ScheduledTaskSettingsSet `
    -RunOnlyIfNetworkAvailable `
    -WakeToRun `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -Compatibility Win8

Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger $Trigger `
    -Action $Action `
    -Settings $Settings `
    -Description $Description `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host "`n✅ Tâche créée: $TaskName`n" -ForegroundColor Green

# ────────────────────────────────────────────────────────
# Afficher détails
# ────────────────────────────────────────────────────────

Write-Host "📋 Détails de la tâche:" -ForegroundColor Cyan
$Task = Get-ScheduledTask -TaskName $TaskName
$Task | Select-Object TaskName, State, @{N="Prochaine exécution";E={$_.Triggers[0].StartBoundary}} | Format-Table

# ────────────────────────────────────────────────────────
# Tester
# ────────────────────────────────────────────────────────

Write-Host "`n🧪 Test initial?" -ForegroundColor Yellow
$Response = Read-Host "Lancer un backup maintenant? (o/n)"

if ($Response -eq 'o' -or $Response -eq 'y') {
    Write-Host "`n⏳ Lancement du backup..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName
    
    Start-Sleep -Seconds 5
    
    $TaskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    if ($TaskInfo.LastTaskResult -eq 0) {
        Write-Host "✅ Backup exécuté avec succès!" -ForegroundColor Green
        Write-Host "📁 Vérifier: D:\joa APP - envoie\backend\backups" -ForegroundColor Gray
    } else {
        Write-Host "⚠️ État: $($TaskInfo.LastTaskResult)" -ForegroundColor Yellow
    }
}

# ────────────────────────────────────────────────────────
# Résumé
# ────────────────────────────────────────────────────────

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Configuration terminée                           ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "📌 Commandes utiles:" -ForegroundColor Cyan
Write-Host "   Afficher tâche:" -ForegroundColor Gray
Write-Host "   Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor DarkGray

Write-Host "`n   Lancer maintenant:" -ForegroundColor Gray
Write-Host "   Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor DarkGray

Write-Host "`n   Supprimer tâche:" -ForegroundColor Gray
Write-Host "   Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:\`$false" -ForegroundColor DarkGray

Write-Host "`n✅ Backups automatiques activés!" -ForegroundColor Green
