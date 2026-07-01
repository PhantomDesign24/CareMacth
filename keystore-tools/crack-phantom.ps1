# crack-phantom.ps1 — phantom/phantomdesign 계열 집중 크래킹 (멀티스레드)
# 티어1: phantom + 연도(2019~2027) + 특수 (가장 유력, 맨 앞 → 몇 초면 나옴)
# 티어2: phantom + 숫자(0~9999) + 특수 (넓은 폴백)
param(
  [string]$Keystore = "C:\care\keystore-backup\caregiver-upload-keystore.jks"
)

$env:Path += ";C:\Program Files\Android\Android Studio\jbr\bin"
$here = $PSScriptRoot
Set-Location $here
if (-not (Test-Path $Keystore)) { Write-Host "키스토어 없음: $Keystore" -ForegroundColor Red; exit 1 }

Write-Host "컴파일 중..." -ForegroundColor Cyan
javac "$here\KsCrackMT.java"
if (-not (Test-Path "$here\KsCrackMT.class")) { Write-Host "컴파일 실패 → javac 경로 확인" -ForegroundColor Red; exit 1 }

$bases = @(
  "phantom","Phantom","PHANTOM",
  "phantomdesign","Phantomdesign","PhantomDesign","PHANTOMDESIGN",
  "phantom24","phantomdesign24","PhantomDesign24"
) | Select-Object -Unique
$sp = @('','!','@','#','$','%','&','*','-','_','.','?','~','!!','@@','!@','1!','!@#','2024','2025','2026')

$wl = "$here\wordlist-phantom.txt"
$w = [System.IO.StreamWriter]::new($wl)

# ── 티어1: 연도 패턴 (맨 앞 = 먼저 시도) ──
foreach ($b in $bases) {
  foreach ($sep in @('','-','_','.')) {
    foreach ($y in 2019..2027) {
      foreach ($s in $sp) { $w.WriteLine("$b$sep$y$s") }
    }
  }
}

# ── 티어2: 숫자 전체(0~9999, 4자리패딩) + 특수 (폴백) ──
$nums = [System.Collections.Generic.HashSet[string]]::new()
[void]$nums.Add("")
for ($i = 0; $i -le 9999; $i++) { [void]$nums.Add("$i"); [void]$nums.Add($i.ToString("0000")) }
foreach ($b in $bases) {
  foreach ($n in $nums) {
    foreach ($s in $sp) { $w.WriteLine("$b$n$s") }
  }
}

$w.Close()
Write-Host "워드리스트 준비 완료. 멀티스레드 크래킹 시작 (연도 패턴 먼저)..." -ForegroundColor Cyan
java -cp "$here" KsCrackMT $Keystore $wl
