import java.io.*;
import java.security.KeyStore;
import java.util.*;
import java.util.concurrent.atomic.*;

// 멀티스레드 키스토어 비번 크래커. CPU 코어 수만큼 스레드로 병렬 시도 → 단일 대비 수배 빠름.
// 사용법: java -cp . KsCrackMT <keystore> <wordlist>
public class KsCrackMT {
  static volatile String found = null;
  static final AtomicInteger idx = new AtomicInteger(0);
  static final AtomicLong tried = new AtomicLong(0);

  public static void main(String[] a) throws Exception {
    if (a.length < 2) { System.out.println("usage: java KsCrackMT <keystore> <wordlist>"); return; }
    final String ksPath = a[0];

    byte[] h = new byte[4];
    try (FileInputStream f = new FileInputStream(ksPath)) { f.read(h); }
    final String type = ((h[0] & 0xFF) == 0xFE && (h[1] & 0xFF) == 0xED) ? "JKS" : "PKCS12";
    System.out.println("keystore type = " + type);

    List<String> words = new ArrayList<>();
    try (BufferedReader br = new BufferedReader(new FileReader(a[1]))) {
      String l; while ((l = br.readLine()) != null) words.add(l);
    }
    final String[] arr = words.toArray(new String[0]);
    final int nThreads = Math.max(2, Runtime.getRuntime().availableProcessors());
    System.out.println(arr.length + " candidates, " + nThreads + " threads");

    final long t0 = System.currentTimeMillis();
    Thread[] ts = new Thread[nThreads];
    for (int t = 0; t < nThreads; t++) {
      ts[t] = new Thread(() -> {
        int i;
        while (found == null && (i = idx.getAndIncrement()) < arr.length) {
          String pw = arr[i];
          try (FileInputStream fis = new FileInputStream(ksPath)) {
            KeyStore ks = KeyStore.getInstance(type);
            ks.load(fis, pw.toCharArray());
            found = pw;
            return;
          } catch (Exception e) { /* 틀림 */ }
          long n = tried.incrementAndGet();
          if (n % 20000 == 0)
            System.out.println(n + " tried... (" + ((System.currentTimeMillis() - t0) / 1000) + "s)");
        }
      });
      ts[t].start();
    }
    for (Thread th : ts) th.join();

    if (found != null) {
      System.out.println("\n*** FOUND: [" + found + "] ***");
      try (FileInputStream fis = new FileInputStream(ksPath)) {
        KeyStore ks = KeyStore.getInstance(type);
        ks.load(fis, found.toCharArray());
        Enumeration<String> al = ks.aliases();
        while (al.hasMoreElements()) System.out.println("   alias = " + al.nextElement());
      }
    } else {
      System.out.println("\nNOT FOUND (" + tried.get() + " tried, " + ((System.currentTimeMillis() - t0) / 1000) + "s)");
    }
  }
}
