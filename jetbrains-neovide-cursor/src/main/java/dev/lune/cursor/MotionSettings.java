package dev.lune.cursor;

public record MotionSettings(double duration, double shortDuration, double trail, boolean animateTyping) {
  public MotionSettings {
    duration = bounded(duration, .15);
    shortDuration = bounded(shortDuration, .04);
    trail = bounded(trail, 1);
  }
  private static double bounded(double value, double fallback) {
    return Double.isFinite(value) ? Math.clamp(value, 0, 1) : fallback;
  }
  public static MotionSettings defaults() { return new MotionSettings(.15, .04, 1, true); }
}
