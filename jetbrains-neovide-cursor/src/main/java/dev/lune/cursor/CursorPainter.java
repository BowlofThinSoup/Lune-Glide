package dev.lune.cursor;

import java.awt.*;
import java.awt.geom.Path2D;

final class CursorPainter {
  private CursorPainter() {}
  static void paint(Graphics2D source, Motion motion, Color color, Rectangle viewport, boolean outline) {
    Graphics2D g=(Graphics2D)source.create();
    try {
      g.clip(viewport);
      g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
      g.setColor(color);
      g.setComposite(AlphaComposite.SrcOver.derive(outline ? .9f : .65f));
      Path2D path=new Path2D.Double();path.moveTo(motion.x(0),motion.y(0));
      for(int i=1;i<4;i++)path.lineTo(motion.x(i),motion.y(i));
      path.closePath();
      if(outline)g.draw(path);else g.fill(path);
    } finally { g.dispose(); }
  }
}
