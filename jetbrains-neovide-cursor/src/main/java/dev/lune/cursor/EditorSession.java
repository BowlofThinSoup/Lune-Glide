package dev.lune.cursor;

import com.intellij.openapi.Disposable;
import com.intellij.openapi.editor.*;
import com.intellij.openapi.editor.colors.EditorColors;
import com.intellij.openapi.editor.colors.EditorFontType;
import com.intellij.openapi.editor.event.*;
import com.intellij.openapi.editor.impl.EditorImpl;
import com.intellij.openapi.ui.AbstractPainter;
import com.intellij.openapi.util.Disposer;
import com.intellij.openapi.wm.IdeGlassPane;
import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.geom.Point2D;
import java.util.*;

/** All editor state and Swing operations are confined to the EDT. */
final class EditorSession implements Disposable {
  private final Editor editor;
  private final JComponent content;
  private final Map<Caret,Track> tracks=new IdentityHashMap<>();
  private final javax.swing.Timer timer=new javax.swing.Timer(8,e->frame());
  private Disposable painterLifetime;
  private JRootPane root;
  private boolean disposed, composing, queued;
  private long lastFrame;

  private static final class Track {
    final Motion motion;
    CaretVisualAttributes original, hidden;
    Color color;
    boolean outline;
    Track(MotionSettings settings) {motion=new Motion(settings);}
  }

  private final AbstractPainter painter=new AbstractPainter() {
    @Override public boolean needsRepaint() {return timer!=null && timer.isRunning();}
    @Override public void executePaint(Component component,Graphics2D g) {
      if(!canAnimate())return;
      Rectangle clip=content.getVisibleRect().intersection(editor.getScrollingModel().getVisibleArea());
      int sticky=editor.getStickyLinesPanelHeight();clip.y+=sticky;clip.height=Math.max(0,clip.height-sticky);
      for(Track track:tracks.values())if(track.motion.active())
        CursorPainter.paint(g,track.motion,track.color,clip,track.outline);
    }
  };
  private final CaretListener carets=new CaretListener() {
    @Override public void caretPositionChanged(CaretEvent e) {schedule();}
    @Override public void caretAdded(CaretEvent e) {schedule();}
    @Override public void caretRemoved(CaretEvent e) {
      Track track=tracks.remove(e.getCaret());if(track!=null)restore(e.getCaret(),track);schedule();
    }
  };
  private final VisibleAreaListener scrolling=e -> {
    // Content coordinates do not move with the viewport. Repaint only; do not retarget a scroll.
    if(timer.isRunning())repaintOverlay();
    if(e.getOldRectangle()!=null && (e.getOldRectangle().width!=e.getNewRectangle().width
      || e.getOldRectangle().height!=e.getNewRectangle().height))reset();
  };
  private final FocusListener focus=new FocusAdapter() {
    @Override public void focusLost(FocusEvent e) {composing=false;reset();}
    @Override public void focusGained(FocusEvent e) {reset();schedule();}
  };
  private final InputMethodListener inputMethod=new InputMethodListener() {
    @Override public void inputMethodTextChanged(InputMethodEvent e) {
      var text=e.getText();
      composing=text!=null && text.getEndIndex()-text.getBeginIndex()>e.getCommittedCharacterCount();
      reset();
      // Do not consume IME events or change candidate-window positioning.
    }
    @Override public void caretPositionChanged(InputMethodEvent e) {}
  };
  private final HierarchyListener hierarchy=e -> {
    if((e.getChangeFlags()&(HierarchyEvent.PARENT_CHANGED|HierarchyEvent.SHOWING_CHANGED))!=0) {
      reset();bindPainter();schedule();
    }
  };
  EditorSession(Editor editor) {
    this.editor=editor;content=editor.getContentComponent();
    timer.setCoalesce(true);
    editor.getCaretModel().addCaretListener(carets);
    editor.getScrollingModel().addVisibleAreaListener(scrolling);
    content.addFocusListener(focus);content.addInputMethodListener(inputMethod);content.addHierarchyListener(hierarchy);
    bindPainter();schedule();
  }
  private void bindPainter() {
    if(disposed)return;
    JRootPane next=SwingUtilities.getRootPane(content);
    if(next==root && painterLifetime!=null)return;
    if(painterLifetime!=null){Disposer.dispose(painterLifetime);painterLifetime=null;}
    root=next;
    if(root!=null && root.getGlassPane() instanceof IdeGlassPane glass) {
      painterLifetime=Disposer.newDisposable(this,"Neovide cursor painter");
      glass.addPainter(content,painter,painterLifetime);
    }
  }
  private boolean canAnimate() {
    CursorSettings.State state=CursorSettings.getInstance().getState();
    return !disposed && !editor.isDisposed() && state.enabled && !state.reduceMotion && !composing
      && content.isShowing() && content.isFocusOwner() && painterLifetime!=null;
  }
  private void schedule() {
    if(disposed || queued)return;queued=true;
    SwingUtilities.invokeLater(()->{queued=false;if(!disposed)synchronize();});
  }
  private void synchronize() {
    if(editor.isDisposed())return;
    bindPainter();
    if(!canAnimate()){reset();return;}
    boolean active=false;
    var current=editor.getCaretModel().getAllCarets();
    for(var it=tracks.entrySet().iterator();it.hasNext();) {
      var entry=it.next();if(!current.contains(entry.getKey())){restore(entry.getKey(),entry.getValue());it.remove();}
    }
    for(Caret caret:current) {
      if(!caret.isValid())continue;
      Track track=tracks.get(caret);
      if(track==null) {
        track=new Track(CursorSettings.getInstance().getState().motion());tracks.put(caret,track);
        track.motion.snap(rect(caret,track));
      } else track.motion.retarget(rect(caret,track),cellWidth(caret));
      if(track.motion.active()) {hide(caret,track);active=true;}
      else restore(caret,track);
    }
    if(active && !timer.isRunning()) {lastFrame=System.nanoTime();timer.start();}
    repaintOverlay();
  }
  private double cellWidth(Caret caret) {
    Point2D p=editor.visualPositionToPoint2D(caret.getVisualPosition());
    int offset=caret.getOffset();CharSequence text=editor.getDocument().getCharsSequence();
    if(offset<text.length() && text.charAt(offset)!='\n' && text.charAt(offset)!='\t') {
      int next=offset+Character.charCount(Character.codePointAt(text,offset));
      Point2D q=editor.offsetToPoint2D(next);
      if(Math.abs(q.getY()-p.getY())<.5 && q.getX()>p.getX())return q.getX()-p.getX();
    }
    return Math.max(1,content.getFontMetrics(editor.getColorsScheme().getFont(EditorFontType.PLAIN)).charWidth(' '));
  }
  private Motion.Rect rect(Caret caret,Track track) {
    CaretVisualAttributes a=caret.getVisualAttributes();if(a==track.hidden)a=track.original;
    Point2D p=editor.visualPositionToPoint2D(caret.getVisualPosition());
    double width=cellWidth(caret),height=editor.getLineHeight(),y=p.getY();
    float editorScale=1;
    // Match build 262's EditorPainter: line spacing is not part of a short native caret.
    if(editor instanceof EditorImpl impl) {
      height=impl.getView().getCaretHeight();
      if(!editor.getSettings().isFullLineHeightCursor())y-=impl.getView().getTopOverhang();
      editorScale=impl.getScale();
    }
    var shape=a.getShape();boolean defaultShape=shape==CaretVisualAttributes.Shape.DEFAULT;
    if(defaultShape)shape=editor.isInsertMode()!=editor.getSettings().isBlockCursor()
      ? CaretVisualAttributes.Shape.BAR : CaretVisualAttributes.Shape.BLOCK;
    if(CursorSettings.getInstance().getState().movingBlock)shape=CaretVisualAttributes.Shape.BLOCK;
    if(shape==CaretVisualAttributes.Shape.BAR)width=defaultShape
      ? com.intellij.ui.scale.JBUIScale.scale(a.getWidth(editor.getSettings().getLineCursorWidth()))*editorScale
      : Math.max((int)(width*a.getThickness()),com.intellij.ui.scale.JBUIScale.scale(editor.getSettings().getLineCursorWidth()));
    else if(shape==CaretVisualAttributes.Shape.UNDERSCORE) {
      double h=Math.max(1,(int)(height*a.getThickness()));y+=height-h;height=h;
    }
    track.outline=shape==CaretVisualAttributes.Shape.BOX;
    track.color=a.getColor();if(track.color==null)track.color=editor.getColorsScheme().getColor(EditorColors.CARET_COLOR);
    if(track.color==null)track.color=editor.getColorsScheme().getDefaultForeground();
    return new Motion.Rect(p.getX(),y,width,height);
  }
  private void hide(Caret caret,Track track) {
    if(caret.getVisualAttributes()==track.hidden)return;
    track.original=caret.getVisualAttributes();
    // A transparent BLOCK still paints inverse text in IDEA. A zero-thickness BAR skips that path.
    track.hidden=new CaretVisualAttributes(new Color(0,0,0,0),track.original.getWeight(),CaretVisualAttributes.Shape.BAR,0);
    caret.setVisualAttributes(track.hidden);
  }
  private void restore(Caret caret,Track track) {
    // IdeaVim or another plugin may have changed the shape in the meantime: respect its update.
    if(caret!=null && caret.isValid() && track.hidden!=null && caret.getVisualAttributes()==track.hidden)
      caret.setVisualAttributes(track.original);
    track.hidden=null;track.original=null;
  }
  private void frame() {
    if(!canAnimate()){reset();return;}
    double dt=Math.min(.25,(System.nanoTime()-lastFrame)/1e9);lastFrame=System.nanoTime();
    boolean active=false;
    for(var entry:tracks.entrySet()) {
      if(entry.getValue().motion.step(dt))active=true;else restore(entry.getKey(),entry.getValue());
    }
    if(!active)timer.stop();
    repaintOverlay();
  }
  private void repaintOverlay() {
    content.repaint(content.getVisibleRect());
    if(root!=null)root.getGlassPane().repaint();
  }
  void reset() {
    timer.stop();tracks.forEach(this::restore);tracks.clear();repaintOverlay();
  }
  @Override public void dispose() {
    Runnable cleanup=()->{
      disposed=true;reset();
      editor.getCaretModel().removeCaretListener(carets);editor.getScrollingModel().removeVisibleAreaListener(scrolling);
      content.removeFocusListener(focus);content.removeInputMethodListener(inputMethod);content.removeHierarchyListener(hierarchy);
      // Painter is a Disposer child and is removed automatically.
      root=null;painterLifetime=null;
    };
    if(SwingUtilities.isEventDispatchThread())cleanup.run();
    else com.intellij.openapi.application.ApplicationManager.getApplication().invokeAndWait(cleanup);
  }
}
