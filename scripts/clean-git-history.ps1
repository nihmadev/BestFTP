#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Скрипт для очистки истории Git коммитов через создание новой orphan-ветки

.DESCRIPTION
    Этот скрипт создает новую ветку с чистой историей коммитов, сохраняя все текущие файлы.
    Полезно для очистки истории репозитория перед первым публичным релизом или для удаления чувствительных данных.

.PARAMETER BranchName
    Имя новой ветки (по умолчанию: main)

.PARAMETER CommitMessage
    Сообщение для начального коммита (по умолчанию: "Initial commit with clean history")

.PARAMETER BackupBranch
    Имя для резервной копии текущей ветки (по умолчанию: backup-main)

.EXAMPLE
    .\clean-git-history.ps1
    Очищает историю с параметрами по умолчанию

.EXAMPLE
    .\clean-git-history.ps1 -BranchName "master" -CommitMessage "Fresh start"
    Очищает историю с кастомными параметрами

.NOTES
    Важно: Этот скрипт перезаписывает историю ветки. Убедитесь, что у вас есть резервная копия.
#>

param(
    [string]$BranchName = "main",
    [string]$CommitMessage = "Initial commit with clean history",
    [string]$BackupBranch = "backup-main"
)

# Цвета для вывода
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Cyan = "Cyan"
    White = "White"
}

function Write-ColorOutput {
    param([string]$Message, [string]$Color = $Colors.White)
    Write-Host $Message -ForegroundColor $Color
}

function Test-GitRepository {
    try {
        git rev-parse --git-dir > $null 2>&1
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Get-CurrentBranch {
    return git rev-parse --abbrev-ref HEAD
}

function Test-HasUncommittedChanges {
    $status = git status --porcelain
    return $status.Length -gt 0
}

function Confirm-Action {
    param([string]$Message)
    $response = Read-Host "$Message (y/N)"
    return $response -eq 'y' -or $response -eq 'Y'
}

# Основная логика
Write-ColorOutput "=== Скрипт очистки истории Git ===" $Colors.Cyan
Write-ColorOutput ""

# Проверка, что мы в Git репозитории
if (-not (Test-GitRepository)) {
    Write-ColorOutput "Ошибка: Текущая директория не является Git репозиторием" $Colors.Red
    exit 1
}

Write-ColorOutput "✓ Найден Git репозиторий" $Colors.Green

# Получение текущей ветки
$currentBranch = Get-CurrentBranch
Write-ColorOutput "✓ Текущая ветка: $currentBranch" $Colors.Green

# Проверка незакоммиченных изменений
if (Test-HasUncommittedChanges) {
    Write-ColorOutput "⚠ Обнаружены незакоммиченные изменения" $Colors.Yellow
    
    if (Confirm-Action "Хотите закоммитить текущие изменения перед очисткой истории?") {
        Write-ColorOutput "Коммит изменений..." $Colors.White
        git add .
        git commit -m "Save current state before history cleanup"
        
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "Ошибка при коммите изменений" $Colors.Red
            exit 1
        }
        Write-ColorOutput "✓ Изменения закоммичены" $Colors.Green
    } else {
        Write-ColorOutput "Отмена операции" $Colors.Yellow
        exit 0
    }
}

# Предупреждение о последствиях
Write-ColorOutput ""
Write-ColorOutput "⚠ ВНИМАНИЕ: Эта операция полностью очистит историю коммитов ветки '$BranchName'!" $Colors.Red
Write-ColorOutput "Все предыдущие коммиты будут удалены безвозвратно." $Colors.Red
Write-ColorOutput ""

if (-not (Confirm-Action "Вы уверены, что хотите продолжить?")) {
    Write-ColorOutput "Операция отменена" $Colors.Yellow
    exit 0
}

# Создание резервной копии текущей ветки
Write-ColorOutput "Создание резервной копии '$BackupBranch'..." $Colors.White
git branch $BackupBranch

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "Ошибка при создании резервной копии" $Colors.Red
    exit 1
}
Write-ColorOutput "✓ Резервная копия создана" $Colors.Green

# Создание новой orphan-ветки
$tempBranch = "temp-clean-branch-$(Get-Random -Maximum 9999)"
Write-ColorOutput "Создание новой ветки с чистой историей..." $Colors.White

git checkout --orphan $tempBranch

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "Ошибка при создании orphan-ветки" $Colors.Red
    exit 1
}

# Очистка индекса
git reset --hard

# Добавление всех файлов
Write-ColorOutput "Добавление файлов..." $Colors.White
git add -A

# Коммит
Write-ColorOutput "Создание начального коммита..." $Colors.White
git commit -m $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "Ошибка при создании коммита" $Colors.Red
    # Возврат к исходной ветке
    git checkout $currentBranch
    exit 1
}

# Удаление старой ветки (если она существует и отличается от текущей)
if ($BranchName -ne $currentBranch) {
    Write-ColorOutput "Удаление старой ветки '$BranchName'..." $Colors.White
    git branch -D $BranchName 2>$null
}

# Переименование ветки
Write-ColorOutput "Переименование ветки в '$BranchName'..." $Colors.White
git branch -m $BranchName

# Пуш в удаленный репозиторий
Write-ColorOutput "Отправка изменений в удаленный репозиторий..." $Colors.White
git push origin $BranchName --force

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "Ошибка при отправке в удаленный репозиторий" $Colors.Red
    Write-ColorOutput "Локальные изменения сохранены, но не отправлены на сервер" $Colors.Yellow
} else {
    Write-ColorOutput "✓ Изменения отправлены в удаленный репозиторий" $Colors.Green
    
    # Удаление временной ветки с сервера
    git push origin --delete $tempBranch 2>$null
}

# Очистка
Write-ColorOutput "Очистка временных веток..." $Colors.White
git branch -D $tempBranch 2>$null

Write-ColorOutput ""
Write-ColorOutput "=== Операция завершена успешно! ===" $Colors.Green
Write-ColorOutput "✓ История коммитов очищена" $Colors.Green
Write-ColorOutput "✓ Создан начальный коммит: '$CommitMessage'" $Colors.Green
Write-ColorOutput "✓ Резервная копия сохранена в ветке: '$BackupBranch'" $Colors.Green
Write-ColorOutput ""

# Показ новой истории
Write-ColorOutput "Новая история коммитов:" $Colors.Cyan
git log --oneline -n 3

Write-ColorOutput ""
Write-ColorOutput "Для восстановления старой истории используйте:" $Colors.Yellow
Write-ColorOutput "git checkout $BackupBranch" $Colors.White
