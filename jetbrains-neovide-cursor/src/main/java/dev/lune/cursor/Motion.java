// Adapted from Neovide (MIT), Copyright (c) 2023 Neovide Contributors.
// See THIRD_PARTY_NOTICES.md for source revision and complete license.
package dev.lune.cursor;

/** Positions are in editor content coordinates, independent of viewport scrolling. */
public final class Motion {
  public record Rect(double x, double y, double width, double height) {
    double cornerX(int i) { return x + ((i == 1 || i == 2) ? width : 0); }
    double cornerY(int i) { return y + ((i >= 2) ? height : 0); }
  }
  private static final class Spring {
    double position, velocity;
    void reset() { position=velocity=0; }
    boolean step(double dt, double duration) {
      if(duration <= dt) { reset(); return false; }
      if(position == 0 || dt <= 0) return position != 0;
      double omega=4/duration, a=position, b=a*omega+velocity, c=Math.exp(-omega*dt);
      position=(a+b*dt)*c;
      velocity=c*(-a*omega-b*dt*omega+b);
      if(Math.abs(position)<.01) { reset(); return false; }
      return true;
    }
  }
  private final MotionSettings settings;
  private final Spring[] sx=new Spring[4], sy=new Spring[4];
  private final double[] x=new double[4], y=new double[4], duration=new double[4];
  private Rect target=new Rect(0,0,0,0);
  private boolean active;
  public Motion(MotionSettings settings) {
    this.settings=settings;
    for(int i=0;i<4;i++) { sx[i]=new Spring(); sy[i]=new Spring(); }
  }
  public double x(int corner) { return x[corner]; }
  public double y(int corner) { return y[corner]; }
  public boolean active() { return active; }
  public Rect target() { return target; }
  public void snap(Rect rect) {
    target=rect; active=false;
    for(int i=0;i<4;i++) { x[i]=rect.cornerX(i); y[i]=rect.cornerY(i); sx[i].reset(); sy[i].reset(); }
  }
  public void retarget(Rect rect, double cellWidth) {
    if(rect.equals(target)) return;
    boolean shortMove=Math.abs(rect.x-target.x)<=Math.max(1,cellWidth)*2.001
      && Math.abs(rect.y-target.y)<.001 && rect.width==target.width && rect.height==target.height;
    double[] alignment=new double[4]; double min=Double.POSITIVE_INFINITY,max=Double.NEGATIVE_INFINITY;
    for(int i=0;i<4;i++) {
      double dx=rect.cornerX(i)-target.cornerX(i),dy=rect.cornerY(i)-target.cornerY(i);
      alignment[i]=(dx*((i==1||i==2)?1:-1)+dy*(i>=2?1:-1))/(Math.hypot(dx,dy)*Math.sqrt(2));
      min=Math.min(min,alignment[i]);max=Math.max(max,alignment[i]);
    }
    double leading=settings.duration()*(1-settings.trail());
    for(int i=0;i<4;i++) {
      double a=(alignment[i]-min)/(max-min);if(!Double.isFinite(a))a=1;
      duration[i]=shortMove ? (settings.animateTyping()?Math.min(settings.duration(),settings.shortDuration()):0)
        : settings.duration()+(leading-settings.duration())*Math.clamp(a,0,1);
      sx[i].position=rect.cornerX(i)-x[i]; sy[i].position=rect.cornerY(i)-y[i];
    }
    target=rect;active=true;
  }
  public boolean step(double dt) {
    if(!Double.isFinite(dt) || dt<0) return active;
    active=false;
    for(int i=0;i<4;i++) {
      boolean ax=sx[i].step(dt,duration[i]),ay=sy[i].step(dt,duration[i]);
      active|=ax||ay;x[i]=target.cornerX(i)-sx[i].position;y[i]=target.cornerY(i)-sy[i].position;
    }
    return active;
  }
}
