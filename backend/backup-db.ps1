# ╔══════════════════════════════════════════════════════════╗
# ║  ACTION 4: Backup Automatique Base de Données            ║
# ║  Sauvegardes quotidiennes MySQLde SYGIM                 ║
# ╚══════════════════════════════════════════════════════════╝

# ────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────

$BackupDir = "D:\joa APP - envoie\backend\backups"
$DatabaseName = "sygim_db"
$MySQLUser = "root"
$MySQLPassword = $env:DB_PASSWORD
$MySQLPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
$BackupPrefix = "sygim_db"
$RetentionDays = 30
$CompressBackups = $true
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = "$BackupDir\backup_$(Get-Date -Format 'yyyyMMdd').log"

# ────────────────────────────────────────────────────────
# Fonctions utilitaires
# ────────────────────────────────────────────────────────

function Log {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

function Format-FileSize {
    param([long]$Size)
    @{ 
        PB = 1PB; TB = 1TB; GB = 1GB; MB = 1MB; KB = 1KB; B = 1
    }.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
        if ($Size -ge $_.Value) {
            return "$([math]::Round($Size / $_.Value, 2)) $($_.Name)"
        }
    }
}

# ────────────────────────────────────────────────────────
# Initialisation
# ────────────────────────────────────────────────────────

Clear-Host
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Backup Base de Données SYGIM                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`n⏱️  Démarrage: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray

# Vérifier répertoire backup
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Log "Répertoire créé: $BackupDir" "INFO"
}

# Vérifier MySQL
if (!(Test-Path $MySQLPath)) {
    Log "ERREUR: MySQL non trouvé à $MySQLPath" "ERROR"
    Log "Solution: Installer MySQL ou mettre à jour le chemin" "ERROR"
    exit 1
}

# Vérifier mot de passe
if ([string]::IsNullOrEmpty($MySQLPassword)) {
    Log "ERREUR: Variable DB_PASSWORD non définie" "ERROR"
    exit 1
}

Log "Répertoire backup: $BackupDir" "INFO"
Log "Base de données: $DatabaseName" "INFO"
Log "Utilisateur: $MySQLUser" "INFO"
Log "Rétention: $RetentionDays jours" "INFO"
Log "Compression: $(if ($CompressBackups) { 'Oui' } else { 'Non' })" "INFO"

# ────────────────────────────────────────────────────────
# Générer backup
# ────────────────────────────────────────────────────────

Write-Host "📝 Création du backup..." -ForegroundColor Yellow
Log "─────────────────────────" "INFO"
Log "Création du backup..." "INFO"

$BackupFile = "$BackupDir\${BackupPrefix}_${Date}.sql"

try {
    # Exécuter mysqldump
    & $MySQLPath `
        -u $MySQLUser `
        -p$MySQLPassword `
        --single-transaction `
        --routines `
        --triggers `
        --events `
        $DatabaseName > $BackupFile 2>&1

    if (Test-Path $BackupFile) {
        $FileSize = (Get-Item $BackupFile).Length
        $FormattedSize = Format-FileSize -Size $FileSize
        Log "✅ Backup créé: $(Split-Path $BackupFile -Leaf) ($FormattedSize)" "INFO"
        Write-Host "   ✅ Créé: $(Split-Path $BackupFile -Leaf)" -ForegroundColor Green
        Write-Host "   📊 Taille: $FormattedSize" -ForegroundColor Gray
    } else {
        throw "Fichier backup non créé"
    }
} catch {
    Log "❌ Erreur création backup: $($_.Exception.Message)" "ERROR"
    Write-Host "   ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ────────────────────────────────────────────────────────
# Compression (optionnelle)
# ────────────────────────────────────────────────────────

if ($CompressBackups) {
    Write-Host "`n🗜️ Compression du backup..." -ForegroundColor Yellow
    Log "Compression en cours..." "INFO"
    
    try {
        $OriginalSize = (Get-Item $BackupFile).Length
        
        # Compresser avec 7-Zip ou Tar
        if (Get-Command tar -ErrorAction SilentlyContinue) {
            # Utiliser tar (intégré dans Windows 10+)
            tar -czf "$BackupFile.gz" -C $BackupDir (Split-Path $BackupFile -Leaf)
            Remove-Item $BackupFile
            $CompressedFile = "$BackupFile.gz"
        } else {
            # Alternatif: Compress-Archive (moins efficace)
            Compress-Archive -Path $BackupFile -DestinationPath "$BackupFile.zip" -Force
            Remove-Item $BackupFile
            $CompressedFile = "$BackupFile.zip"
        }
        
        if (Test-Path $CompressedFile) {
            $CompressedSize = (Get-Item $CompressedFile).Length
            $Ratio = [math]::Round((1 - $CompressedSize / $OriginalSize) * 100, 1)
            
            Log "✅ Compression réussie: $([math]::Round($CompressedSize / 1MB, 2)) MB (économies: $Ratio%)" "INFO"
            Write-Host "   ✅ Compressé: $(Split-Path $CompressedFile -Leaf)" -ForegroundColor Green
            Write-Host "   📊 Économies: $Ratio%" -ForegroundColor Gray
        }
    } catch {
        Log "⚠️ Compression échouée, backup conservé sans compression: $($_.Exception.Message)" "WARN"
        Write-Host "   ⚠️ Compression échouée, backup sans compression" -ForegroundColor Yellow
    }
}

# ────────────────────────────────────────────────────────
# Nettoyer anciens backups
# ────────────────────────────────────────────────────────

Write-Host "`n🧹 Nettoyage des anciens backups..." -ForegroundColor Yellow
Log "─────────────────────────" "INFO"
Log "Nettoyage des backups > $RetentionDays jours..." "INFO"

$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
$OldBackups = Get-ChildItem $BackupDir -Filter "${BackupPrefix}_*.sql*" `
    | Where-Object { $_.LastWriteTime -lt $CutoffDate }

if ($OldBackups.Count -gt 0) {
    foreach ($Backup in $OldBackups) {
        $Age = (New-TimeSpan -Start $Backup.LastWriteTime -End (Get-Date)).Days
        $Size = Format-FileSize -Size $Backup.Length
        
        try {
            Remove-Item $Backup.FullName -Force
            Log "🗑️ Supprimé: $($Backup.Name) (âge: $Age jours, taille: $Size)" "INFO"
            Write-Host "   🗑️ Supprimé: $($Backup.Name)" -ForegroundColor DarkGray
        } catch {
            Log "❌ Erreur suppression: $($Backup.Name) - $($_.Exception.Message)" "ERROR"
        }
    }
} else {
    Log "✅ Aucun backup à supprimer" "INFO"
    Write-Host "   ✅ Aucun ancien backup" -ForegroundColor Green
}

# ────────────────────────────────────────────────────────
# Statistiques
# ────────────────────────────────────────────────────────

Write-Host "`n📊 Statistiques..." -ForegroundColor Yellow
Log "─────────────────────────" "INFO"

$AllBackups = Get-ChildItem $BackupDir -Filter "${BackupPrefix}_*.sql*"
$TotalSize = ($AllBackups | Measure-Object -Property Length -Sum).Sum
$FormattedTotalSize = Format-FileSize -Size $TotalSize
$BackupCount = $AllBackups.Count

Log "✅ Total backups conservés: $BackupCount" "INFO"
Log "💾 Espace utilisé: $FormattedTotalSize" "INFO"

Write-Host "   📦 Total: $BackupCount backup(s)" -ForegroundColor Gray
Write-Host "   💾 Espace: $FormattedTotalSize" -ForegroundColor Gray

# ────────────────────────────────────────────────────────
# Résumé final
# ────────────────────────────────────────────────────────

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Backup terminé avec succès                      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green

Log "─────────────────────────" "INFO"
Log "Backup terminé: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "INFO"

Write-Host "`n📁 Répertoire: $BackupDir" -ForegroundColor Cyan
Write-Host "📋 Journaux: $LogFile" -ForegroundColor Cyan
Write-Host "`n✅ Backup opérationnel!" -ForegroundColor Green
