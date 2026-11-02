package dev.lune.cursor;

import com.intellij.openapi.application.*;
import com.intellij.openapi.editor.*;
import com.intellij.openapi.wm.impl.IdeGlassPaneImpl;
import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.lang.management.*;
import java.nio.file.*;
import java.util.*;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/** Test-only focused Swing editor inside the real platform. Never in the distributable. */
public final class IdeaPerformanceTest implements ApplicationStarter {
  private Editor editor;
  private JFrame frame;
  private javax.swing.Timer mover,animationTimer;
  private final AtomicInteger moves=new AtomicInteger(),ticks=new AtomicInteger();
  private long edtId;
  private final ThreadMXBean threads=ManagementFactory.getThreadMXBean();
  private final com.sun.management.OperatingSystemMXBean process=(com.sun.management.OperatingSystemMXBean)ManagementFactory.getOperatingSystemMXBean();
  @Override public boolean isHeadless(){return Boolean.getBoolean("neovide.perf.headless");}
  @Override public int getRequiredModality(){return NOT_IN_EDT;}
  private void edt(Runnable action){ApplicationManager.getApplication().invokeAndWait(action);}
  private void setup() {
    edtId=Thread.currentThread().threadId();
    String line="abcdefghijklmnopqrstuvwxyz".repeat(4)+"\n";
    editor=EditorFactory.getInstance().createEditor(EditorFactory.getInstance().createDocument(line.repeat(100)),null,EditorKind.MAIN_EDITOR);
    editor.getSettings().setBlinkCaret(false);editor.getSettings().setSmoothCaretMovement(false);
    editor.getSettings().setLineNumbersShown(false);
    frame=new JFrame("Neovide Cursor — isolated performance test");frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
    frame.setContentPane(editor.getComponent());frame.setSize(1200,780);frame.setLocationByPlatform(true);
    frame.setGlassPane(new IdeGlassPaneImpl(frame.getRootPane()));frame.setVisible(true);
    CursorService.getInstance().attach(editor);
    Map<?,?> sessions=IdeaSmokeTest.field(CursorService.getInstance(),"sessions");
    animationTimer=IdeaSmokeTest.field(sessions.get(editor),"timer");
    animationTimer.addActionListener(e->ticks.incrementAndGet());
    editor.getContentComponent().requestFocusInWindow();
    mover=new javax.swing.Timer(16,e->{
      int n=moves.incrementAndGet();
      for(Caret caret:editor.getCaretModel().getAllCarets()) {
        int lineNumber=caret.getLogicalPosition().line;
        caret.moveToLogicalPosition(new LogicalPosition(lineNumber,n%2==0?5:80));
      }
    });mover.setCoalesce(true);
  }
  private static void pause(long millis){try{Thread.sleep(millis);}catch(InterruptedException e){throw new RuntimeException(e);}}
  private void configure(int count,boolean enabled) {
    mover.stop();editor.getCaretModel().removeSecondaryCarets();
    editor.getCaretModel().getPrimaryCaret().moveToLogicalPosition(new LogicalPosition(0,5));
    for(int i=1;i<count;i++)editor.getCaretModel().addCaret(new VisualPosition(i,5));
    CoreTest.check(editor.getCaretModel().getCaretCount()==count,"test caret count");
    var settings=CursorSettings.getInstance().getState();settings.enabled=enabled;settings.reduceMotion=false;
    CursorService.getInstance().refresh();moves.set(0);ticks.set(0);
    editor.getContentComponent().requestFocusInWindow();
  }
  private String runPhase(String name,int count,boolean moving,boolean enabled,int repeat) {
    edt(()->configure(count,enabled));pause(500);
    edt(()->CoreTest.check(editor.getContentComponent().isFocusOwner(),"test editor must stay focused"));
    System.gc();pause(200);moves.set(0);ticks.set(0);
    long cpu=process.getProcessCpuTime(),edtCpu=threads.getThreadCpuTime(edtId),start=System.nanoTime();
    if(moving)edt(()->mover.start());
    pause(3000);
    edt(()->mover.stop());
    double seconds=(System.nanoTime()-start)/1e9;
    double processPercent=(process.getProcessCpuTime()-cpu)/1e9/seconds*100;
    double edtPercent=(threads.getThreadCpuTime(edtId)-edtCpu)/1e9/seconds*100;
    int activeTicks=ticks.get(),moveCount=moves.get();
    if(enabled && moving)CoreTest.check(activeTicks>20,"real focused editor must animate");
    if(!moving)CoreTest.check(activeTicks==0,"idle must not tick");
    pause(1000);edt(()->CoreTest.check(!animationTimer.isRunning(),"animation must settle and stop"));
    System.gc();pause(150);
    long heap=ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
    String row=String.format(Locale.ROOT,"{\"scenario\":\"%s\",\"carets\":%d,\"enabled\":%s,\"repeat\":%d,\"wallSeconds\":%.4f,\"processCPUPercent\":%.4f,\"edtCPUPercent\":%.4f,\"moves\":%d,\"animationTicks\":%d,\"heapAfterGCBytes\":%d}",
      name,count,enabled,repeat,seconds,processPercent,edtPercent,moveCount,activeTicks,heap);
    System.out.println(row);return row;
  }
  @Override public void main(List<String> args) {
    Path report=Path.of(System.getProperty("neovide.test.report"));
    try {
      if(isHeadless()){runHeadless(report);System.exit(0);return;}
      threads.setThreadCpuTimeEnabled(true);edt(this::setup);pause(2000);
      edt(()->configure(1,true));edt(()->mover.start());pause(4000);edt(()->mover.stop());pause(1000);
      List<String> rows=new ArrayList<>();
      for(String scenario:List.of("idle","moving-1","moving-20"))for(int repeat=0;repeat<3;repeat++) {
        boolean first=repeat%2!=0;
        for(boolean enabled:new boolean[]{first,!first})rows.add(runPhase(scenario,scenario.equals("moving-20")?20:1,!scenario.equals("idle"),enabled,repeat));
      }
      edt(()->{mover.stop();CursorService.getInstance().detach(editor);EditorFactory.getInstance().releaseEditor(editor);frame.dispose();});
      Files.writeString(report,"{\"method\":\"Actual IDEA platform with focused 1200x780 Swing editor, native blinking/smoothing disabled; 16ms requested moves, 3sec windows, 3 repeats alternating enabled order. Process CPU includes whole IDE/JIT/GC; EDT CPU includes native editor painting.\",\"results\":["+String.join(",",rows)+"]}\n");
      System.exit(0);
    }catch(Throwable e){e.printStackTrace();try{Files.writeString(report,"{\"error\":\"performance test failed; inspect console log\"}");}catch(Exception ignored){}System.exit(1);}
  }
  private void runHeadless(Path report) throws Exception {
    List<String> rows=new ArrayList<>();
    // Warm the JIT and Java2D paths before measured batches.
    drawBenchmark(1,120,1000);
    for(int count:new int[]{1,20})for(int fps:new int[]{60,120})for(int repeat=0;repeat<3;repeat++) {
      String row=drawBenchmark(count,fps,1500);rows.add(row);System.out.println(row);
    }
    final Editor[] holder=new Editor[1];final Object[] session=new Object[1];
    edt(()->{
      holder[0]=EditorFactory.getInstance().createEditor(EditorFactory.getInstance().createDocument("cursor benchmark\n".repeat(50)),null,EditorKind.MAIN_EDITOR);
      CursorService service=CursorService.getInstance();service.attach(holder[0]);
      session[0]=((Map<?,?>)IdeaSmokeTest.field(service,"sessions")).get(holder[0]);
    });
    pause(200);javax.swing.Timer timer=IdeaSmokeTest.field(session[0],"timer");
    AtomicInteger idleTicks=new AtomicInteger();edt(()->timer.addActionListener(e->idleTicks.incrementAndGet()));
    pause(3000);edt(()->CoreTest.check(!timer.isRunning() && idleTicks.get()==0,"headless idle timer must stop"));
    edt(()->{CursorService.getInstance().detach(holder[0]);EditorFactory.getInstance().releaseEditor(holder[0]);});
    System.gc();pause(150);
    List<String> cycles=new ArrayList<>();
    for(int batch=0;batch<3;batch++) {
      edt(()->{for(int i=0;i<20;i++) {
        Editor e=EditorFactory.getInstance().createEditor(EditorFactory.getInstance().createDocument("release test\n"),null,EditorKind.MAIN_EDITOR);
        CursorService.getInstance().attach(e);EditorFactory.getInstance().releaseEditor(e);
      }});
      edt(()->{});System.gc();pause(200);
      Map<?,?> sessions=IdeaSmokeTest.field(CursorService.getInstance(),"sessions");
      CoreTest.check(sessions.isEmpty(),"released editor controllers must not leak");
      cycles.add("{\"cycles\":"+((batch+1)*20)+",\"sessions\":"+sessions.size()+",\"wholeIDEHeapBytes\":"+ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed()+"}");
    }
    Files.writeString(report,"{\"method\":\"Headless actual IDEA lifecycle plus separate production Motion/CursorPainter Java2D benchmark. 1200x700 logical offscreen image at 2x, full clear each frame. CPU estimates exclude native editor repaint, glass-pane compositing, GPU and window server. Harness image is not plugin retained memory.\",\"idleAnimationTicks\":"+idleTicks.get()+",\"results\":["+String.join(",",rows)+"],\"lifecycle\":["+String.join(",",cycles)+"]}\n");
  }
  private String drawBenchmark(int count,int fps,int frames) {
    BufferedImage image=new BufferedImage(2400,1400,BufferedImage.TYPE_INT_ARGB);
    Graphics2D g=image.createGraphics();g.scale(2,2);
    Motion[] motion=new Motion[count];
    for(int i=0;i<count;i++){motion[i]=new Motion(MotionSettings.defaults());motion[i].snap(new Motion.Rect(40,24+i*24,10,24));}
    var allocation=(com.sun.management.ThreadMXBean)threads;allocation.setThreadAllocatedMemoryEnabled(true);
    long id=Thread.currentThread().threadId(),allocated=allocation.getThreadAllocatedBytes(id),cpu=threads.getCurrentThreadCpuTime(),start=System.nanoTime();
    long[] samples=new long[frames];
    for(int frameNumber=0;frameNumber<frames;frameNumber++) {
      long frameStart=System.nanoTime();
      g.setComposite(AlphaComposite.Clear);g.fillRect(0,0,1200,700);g.setComposite(AlphaComposite.SrcOver);
      for(int i=0;i<count;i++) {
        if(frameNumber%(fps/60)==0)motion[i].retarget(new Motion.Rect(40+((frameNumber/(fps/60))%2)*760+i*3,24+i*24,10,24),10);
        motion[i].step(1.0/fps);CursorPainter.paint(g,motion[i],Color.WHITE,new Rectangle(0,0,1200,700),false);
      }
      samples[frameNumber]=System.nanoTime()-frameStart;
    }
    double wallMs=(System.nanoTime()-start)/1e6,cpuMs=(threads.getCurrentThreadCpuTime()-cpu)/1e6;
    long bytes=allocation.getThreadAllocatedBytes(id)-allocated;Arrays.sort(samples);g.dispose();image.flush();
    return String.format(Locale.ROOT,"{\"carets\":%d,\"targetFPS\":%d,\"frames\":%d,\"meanFrameMs\":%.6f,\"p95FrameMs\":%.6f,\"cpuMsPerFrame\":%.6f,\"estimatedCoreCPUPercent\":%.4f,\"allocatedBytesPerFrame\":%.2f,\"harnessImageRGBABytes\":13440000}",count,fps,frames,wallMs/frames,samples[(int)(frames*.95)]/1e6,cpuMs/frames,cpuMs/frames*fps/10,(double)bytes/frames);
  }
}
