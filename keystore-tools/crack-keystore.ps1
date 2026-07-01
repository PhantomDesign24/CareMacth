# crack-keystore.ps1 — caregiver 업로드 키스토어 비번 복구
# 사용법 (PowerShell):  .\crack-keystore.ps1
#   기본 키스토어 경로가 다르면:  .\crack-keystore.ps1 -Keystore "D:\경로\xxx.jks"
param(
  [string]$Keystore = "C:\care\keystore-backup\caregiver-upload-keystore.jks"
)

# JDK(keytool/javac) 경로 보정 — keytool 이 이미 되면 없어도 됨. 안 되면 본인 JDK 경로로 수정.
$env:Path += ";C:\Program Files\Android\Android Studio\jbr\bin"

$here = $PSScriptRoot
Set-Location $here

if (-not (Test-Path $Keystore)) { Write-Host "키스토어 없음: $Keystore" -ForegroundColor Red; exit 1 }

# 1) 컴파일
Write-Host "컴파일 중..." -ForegroundColor Cyan
javac "$here\KsCrack.java"
if (-not (Test-Path "$here\KsCrack.class")) {
  Write-Host "컴파일 실패 → javac(JDK) 경로를 PATH에 넣어주세요." -ForegroundColor Red; exit 1
}

# 2) 워드리스트 생성 (carematch 대소문자 × 앞뒤 숫자(0~9999)·특수문자, 가능성 높은 순)
$bases = @("carematch","Carematch","CareMatch","CAREMATCH","careMatch","care-match","Care-Match","CAREmatch") | Select-Object -Unique
$sp    = @("","!","@","#","`$","%","&","*","?","_","-",".","!!","@@","!@","!@#","!@#`$","~","1!","!1")
$wl    = "$here\wordlist.txt"
$w = [System.IO.StreamWriter]::new($wl)
# 티어1: base + 특수 (앞/뒤)
foreach($b in $bases){ foreach($s in $sp){ $w.WriteLine("$b$s"); if($s){ $w.WriteLine("$s$b") } } }
# 티어2: base + 숫자 0~9999(뒤), 0~999(앞)
foreach($b in $bases){ 0..9999 | ForEach-Object { $w.WriteLine("$b$_") }; 0..999 | ForEach-Object { $w.WriteLine("$_$b") } }
# 티어3: base + 특수 + 숫자(0~99), base + 숫자(0~99) + 특수
foreach($b in $bases){ foreach($s in $sp){ if($s){ 0..99 | ForEach-Object { $w.WriteLine("$b$s$_"); $w.WriteLine("$b$_$s") } } } }
$w.Close()
Write-Host "워드리스트 준비 완료. 크래킹 시작..." -ForegroundColor Cyan

# 3) 실행 (JVM 한 번만 켜고 내부 루프)
java -cp "$here" KsCrack $Keystore $wl
