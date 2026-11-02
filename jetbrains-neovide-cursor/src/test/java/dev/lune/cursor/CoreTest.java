package dev.lune.cursor;

import java.awt.*;
import java.awt.image.BufferedImage;

/** Dependency-free behavioral tests; java -ea is not required. */
public final class CoreTest {
  private static int tests;
  static void check(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }
  static void near(double actual, double expected) {
    check(Math.abs(actual - expected) < 1e-8, actual + " != " + expected);
  }
  static void test(String name, Runnable body) {
    body.run(); tests++; System.out.println("PASS " + name);
  }
  static Motion move(MotionSettings settings) {
    Motion m = new Motion(settings);
    m.snap(new Motion.Rect(10, 20, 8, 18));
    m.retarget(new Motion.Rect(110, 20, 8, 18), 8);
    return m;
  }
  public static void main(String[] args) {
    test("analytic critical spring and leading corner", () -> {
      Motion m = move(MotionSettings.defaults()); m.step(0.05);
      near(m.x(0),48.49400110633043); near(m.x(1),118);
      near(m.y(0),20);
    });
    test("frame rate independence", () -> {
      Motion a=move(MotionSettings.defaults()), b=move(MotionSettings.defaults());
      for(int i=0;i<6;i++)a.step(1.0/60);
      for(int i=0;i<12;i++)b.step(1.0/120);
      for(int i=0;i<4;i++){near(a.x(i),b.x(i));near(a.y(i),b.y(i));}
    });
    test("interruption is continuous then settles", () -> {
      Motion m=move(MotionSettings.defaults());m.step(.03);double x=m.x(0);
      m.retarget(new Motion.Rect(0,40,8,18),8);near(m.x(0),x);
      for(int i=0;i<180;i++)m.step(1.0/120);
      check(!m.active(),"timer must be able to stop");near(m.x(0),0);near(m.y(0),40);
    });
    test("short movement settles immediately when typing animation disabled", () -> {
      Motion m=new Motion(new MotionSettings(.15,.04,1,false));
      m.snap(new Motion.Rect(0,0,2,18));m.retarget(new Motion.Rect(8,0,2,18),8);m.step(.008);
      check(!m.active(),"typing disabled");near(m.x(0),8);
    });
    test("zero duration and invalid settings are finite", () -> {
      Motion m=move(new MotionSettings(0,0,1,true));m.step(.008);check(!m.active(),"zero duration");
      MotionSettings s=new MotionSettings(Double.NaN,-2,Double.POSITIVE_INFINITY,true);
      near(s.duration(),.15);near(s.shortDuration(),0);near(s.trail(),1);
    });
    test("Java2D paints actual trail and clips outside viewport", () -> {
      BufferedImage img=new BufferedImage(160,100,BufferedImage.TYPE_INT_ARGB);
      Graphics2D g=img.createGraphics(); Motion m=move(MotionSettings.defaults());m.step(.05);
      CursorPainter.paint(g,m,Color.WHITE,new Rectangle(60,0,80,100),false);g.dispose();
      check((img.getRGB(90,25)>>>24)>0,"trail must be visible");
      check(img.getRGB(55,25)==0,"clip must exclude left edge");
      check(img.getRGB(90,60)==0,"must not paint outside cursor");
    });
    System.out.println(tests+" core tests passed");
  }
}
