# crack-pattern.ps1 — CareMatch + 4자리숫자 + 뒤 특수문자 집중 크래킹 (멀티스레드)
# 사용법:  .\crack-pattern.ps1
#   경로 다르면:  .\crack-pattern.ps1 -Keystore "D:\...\xxx.jks"
param(
  [string]$Keystore = "C:\care\keystore-backup\caregiver-upload-keystore.jks"
)

$env:Path += ";C:\Program Files\Android\Android Studio\jbr\bin"
$here = $PSScriptRoot
Set-Location $here

if (-not (Test-Path $Keystore)) { Write-Host "키스토어 없음: $Keystore" -ForegroundColor Red; exit 1 }

# 1) 멀티스레드 크래커 컴파일
Write-Host "컴파일 중..." -ForegroundColor Cyan
javac "$here\KsCrackMT.java"
if (-not (Test-Path "$here\KsCrackMT.class")) {
  Write-Host "컴파일 실패 → javac(JDK) 경로 확인" -ForegroundColor Red; exit 1
}

# 2) 워드리스트: CareMatch 대소문자 5종 × 숫자(0~9999, 4자리패딩 포함) × 뒤 특수문자
$bases = @("CareMatch","Carematch","carematch","CAREMATCH","careMatch")
$sp    = @('!','@','#','$','%','^','&','*','(',')','-','_','+','=','.','?','~','!!','@@','!@','1!','!@#','!!!','@!')

# 숫자: 자연수 0~9999 + 4자리 제로패딩(0000~9999, 0612 같은 앞자리0 커버)
$nums = [System.Collections.Generic.HashSet[string]]::new()
for ($i = 0; $i -le 9999; $i++) { [void]$nums.Add("$i"); [void]$nums.Add($i.ToString("0000")) }

$wl = "$here\wordlist-pattern.txt"
$w = [System.IO.StreamWriter]::new($wl)
foreach ($b in $bases) {
  foreach ($n in $nums) {
    foreach ($s in $sp) { $w.WriteLine("$b$n$s") }
  }
}
$w.Close()
Write-Host "워드리스트 준비 완료 (약 $($bases.Count * $nums.Count * $sp.Count) 개). 멀티스레드 크래킹 시작..." -ForegroundColor Cyan

# 3) 실행 (코어 수만큼 스레드)
java -cp "$here" KsCrackMT $Keystore $wl
