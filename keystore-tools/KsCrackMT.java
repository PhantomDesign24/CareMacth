import java.io.*;
import java.security.KeyStore;
import java.util.*;

// 멀티스레드 키스토어 비번 크래커 (스트리밍). 워드리스트를 파일에서 한 줄씩 읽어 스레드가 나눠 시도.
// 대용량 워드리스트도 메모리 부담 없음. 사용법: java -cp . KsCrackMT <keystore> <wordlist>
public class KsCrackMT {
  static volatile String found = null;
  static long tried = 0;
  static final Object lock = new Object();
  static BufferedReader reader;
  static String ksPath, type;
  static long t0;

  public static void main(String[] a) throws Exception {
    if (a.length < 2) { System.out.println("usage: java KsCrackMT <keystore> <wordlist>"); return; }
    ksPath = a[0];

    byte[] h = new byte[4];
    try (FileInputStream f = new FileInputStream(ksPath)) { f.read(h); }
    type = ((h[0] & 0xFF) == 0xFE && (h[1] & 0xFF) == 0xED) ? "JKS" : "PKCS12";
    System.out.println("keystore type = " + type);

    reader = new BufferedReader(new FileReader(a[1]));
    int nThreads = Math.max(2, Runtime.getRuntime().availableProcessors());
    System.out.println(nThreads + " threads");

    t0 = System.currentTimeMillis();
    Thread[] ts = new Thread[nThreads];
    for (int i = 0; i < nThreads; i++) { ts[i] = new Thread(KsCrackMT::worker); ts[i].start(); }
    for (Thread th : ts) th.join();
    reader.close();

    if (found != null) {
      System.out.println("\n*** FOUND: [" + found + "] ***");
      try (FileInputStream fis = new FileInputStream(ksPath)) {
        KeyStore ks = KeyStore.getInstance(type);
        ks.load(fis, found.toCharArray());
        for (Enumeration<String> al = ks.aliases(); al.hasMoreElements(); )
          System.out.println("   alias = " + al.nextElement());
      }
    } else {
      System.out.println("\nNOT FOUND (" + tried + " tried, " + ((System.currentTimeMillis() - t0) / 1000) + "s)");
    }
  }

  static void worker() {
    while (found == null) {
      String pw;
      synchronized (lock) {
        if (found != null) return;
        try { pw = reader.readLine(); } catch (IOException e) { return; }
        if (pw == null) return;
      }
      try (FileInputStream fis = new FileInputStream(ksPath)) {
        KeyStore ks = KeyStore.getInstance(type);
        ks.load(fis, pw.toCharArray());
        found = pw;
        return;
      } catch (Exception e) { /* 틀림 */ }
      long n;
      synchronized (lock) { n = ++tried; }
      if (n % 20000 == 0)
        System.out.println(n + " tried... (" + ((System.currentTimeMillis() - t0) / 1000) + "s)");
    }
  }
}
