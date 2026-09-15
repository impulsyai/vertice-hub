<#
.SYNOPSIS
    Monta o drive virtual X: necessário para o pnpm/node_modules no Windows (contorna MAX_PATH).
#>
$repoPath = $PSScriptRoot
if (-not (Test-Path "X:\")) {
    cmd /c subst X: "$repoPath"
    Write-Host "[OK] Drive virtual X: montado apontando para: $repoPath" -ForegroundColor Green
} else {
    Write-Host "[INFO] Drive virtual X: já está ativo." -ForegroundColor Cyan
}
