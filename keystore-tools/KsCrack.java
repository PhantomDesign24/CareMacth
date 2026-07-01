import java.io.*;
import java.security.KeyStore;

// caregiver-upload-keystore.jks 비번 복구용.
// JVM 한 번만 켜고 내부 루프로 워드리스트를 전부 시도 → keytool 반복보다 100배 빠름.
// 사용법: java -cp . KsCrack <keystore경로> <wordlist경로>
public class KsCrack {
  public static void main(String[] a) throws Exception {
    if (a.length < 2) { System.out.println("usage: java KsCrack <keystore> <wordlist>"); return; }
    String ksPath = a[0];

    // 헤더로 타입 자동 판별 (JKS magic = 0xFEEDFEED, 아니면 PKCS12)
    byte[] h = new byte[4];
    try (FileInputStream f = new FileInputStream(ksPath)) { f.read(h); }
    String type = ((h[0] & 0xFF) == 0xFE && (h[1] & 0xFF) == 0xED) ? "JKS" : "PKCS12";
    System.out.println("keystore type = " + type);

    BufferedReader br = new BufferedReader(new FileReader(a[1]));
    String pw; long n = 0, t0 = System.currentTimeMillis();
    while ((pw = br.readLine()) != null) {
      n++;
      try (FileInputStream fis = new FileInputStream(ksPath)) {
        KeyStore ks = KeyStore.getInstance(type);
        ks.load(fis, pw.toCharArray());
        System.out.println("\n*** FOUND: [" + pw + "] ***");
        // alias 도 출력
        java.util.Enumeration<String> al = ks.aliases();
        while (al.hasMoreElements()) System.out.println("   alias = " + al.nextElement());
        return;
      } catch (Exception e) { /* 비번 틀림 → 다음 */ }
      if (n % 5000 == 0)
        System.out.println(n + " tried... (" + ((System.currentTimeMillis() - t0) / 1000) + "s)");
    }
    System.out.println("NOT FOUND (" + n + " tried)");
  }
}
