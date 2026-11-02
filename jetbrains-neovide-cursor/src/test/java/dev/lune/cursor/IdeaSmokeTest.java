package dev.lune.cursor;

import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.application.ApplicationStarter;
import com.intellij.openapi.editor.*;
import com.intellij.openapi.editor.colors.EditorColorsManager;
import com.intellij.openapi.editor.ex.EditorEx;
import com.intellij.openapi.editor.impl.EditorImpl;
import com.intellij.openapi.util.Disposer;
import javax.swing.*;
import java.nio.file.*;
import java.util.*;

/** Registered only in a separate test plugin, never distributed. Real IDE services, no mocks. */
public final class IdeaSmokeTest implements ApplicationStarter {
  @Override public boolean isHeadless() { return true; }
  @Override public int getRequiredModality() { return NOT_IN_EDT; }
  @Override public void main(List<String> args) {
    try {
      ApplicationManager.getApplication().invokeAndWait(() -> {
        EditorFactory factory=EditorFactory.getInstance();
        Editor editor=factory.createEditor(factory.createDocument("alpha\n\t中文 beta\n"),null,EditorKind.MAIN_EDITOR);
        try {
          CursorService service=CursorService.getInstance();service.attach(editor);
          Map<?,?> sessions=field(service,"sessions");
          CoreTest.check(sessions.containsKey(editor),"main editor must attach");
          Object session=sessions.get(editor);
          Caret primary=editor.getCaretModel().getPrimaryCaret();
          CaretVisualAttributes original=primary.getVisualAttributes();
          checkNativeCaretContract(editor,session,primary);
          checkNativeCaretSize(editor,session,primary);
          primary.moveToOffset(8);
          CoreTest.check(primary.getOffset()==8,"caret moves normally");
          Caret secondary=editor.getCaretModel().addCaret(new VisualPosition(0,2));
          CoreTest.check(secondary!=null,"multiple carets supported");
          editor.getCaretModel().removeSecondaryCarets();
          CursorSettings.State state=CursorSettings.getInstance().getState();
          state.enabled=false;service.refresh();
          CoreTest.check(primary.getVisualAttributes()==original,"disable restores native attributes");
          CoreTest.check(!((javax.swing.Timer)field(session,"timer")).isRunning(),"disabled timer stops");
          state.enabled=true;service.refresh();
          service.detach(editor);
          CoreTest.check(!sessions.containsKey(editor),"release removes editor");
          CoreTest.check(Disposer.isDisposed((com.intellij.openapi.Disposable)session),"session disposed");
          CoreTest.check(primary.getVisualAttributes()==original,"dispose preserves native caret");
          Editor preview=factory.createEditor(factory.createDocument("preview"),null,EditorKind.PREVIEW);
          try { service.attach(preview);CoreTest.check(!sessions.containsKey(preview),"preview ignored"); }
          finally {factory.releaseEditor(preview);}
          CoreTest.check(EditorColorsManager.getInstance()!=null,"real editor color services");
        } finally {factory.releaseEditor(editor);}
      });
      Files.writeString(Path.of(System.getProperty("neovide.test.report")),"PASS: real IDEA editor attachment, movement, multi-caret, settings refresh, disable, disposal, preview exclusion, native hidden shape, conflict-safe restoration and shape geometry\n");
      System.exit(0);
    } catch(Throwable e) {
      e.printStackTrace();
      try {Files.writeString(Path.of(System.getProperty("neovide.test.report")),"FAIL: "+e);}catch(Exception ignored){}
      System.exit(1);
    }
  }
  static void checkNativeCaretSize(Editor editor,Object session,Caret caret) {
    EditorImpl impl=(EditorImpl)editor;
    var settings=editor.getSettings();
    boolean fullLine=settings.isFullLineHeightCursor(),block=settings.isBlockCursor(),insert=editor.isInsertMode();
    boolean movingBlock=CursorSettings.getInstance().getState().movingBlock;
    var original=caret.getVisualAttributes();
    float spacing=editor.getColorsScheme().getLineSpacing(),fontSize=impl.getFontSize2D();
    int offset=caret.getOffset();
    try {
      Class<?> type=Class.forName("dev.lune.cursor.EditorSession$Track");
      var ctor=type.getDeclaredConstructor(MotionSettings.class);ctor.setAccessible(true);
      Object track=ctor.newInstance(MotionSettings.defaults());
      var rect=session.getClass().getDeclaredMethod("rect",Caret.class,type);rect.setAccessible(true);
      var hide=session.getClass().getDeclaredMethod("hide",Caret.class,type);hide.setAccessible(true);
      var restore=session.getClass().getDeclaredMethod("restore",Caret.class,type);restore.setAccessible(true);
      CursorSettings.getInstance().getState().movingBlock=false;
      settings.setBlockCursor(false);impl.setInsertMode(true);
      editor.getColorsScheme().setLineSpacing(1.8f);impl.reinitSettings();
      caret.moveToOffset(2);
      for(boolean full:new boolean[]{false,true}) {
        settings.setFullLineHeightCursor(full);
        for(var shape:new CaretVisualAttributes.Shape[]{CaretVisualAttributes.Shape.DEFAULT,CaretVisualAttributes.Shape.BAR,
            CaretVisualAttributes.Shape.BLOCK,CaretVisualAttributes.Shape.UNDERSCORE}) {
          caret.setVisualAttributes(new CaretVisualAttributes(null,CaretVisualAttributes.Weight.NORMAL,shape,.25f));
          // Oracle: actual build-262 native painter's font metrics, independent of our geometry.
          double nativeHeight=impl.getView().getCaretHeight();
          double nativeY=editor.visualPositionToPoint2D(caret.getVisualPosition()).getY()
            -(full?0:impl.getView().getTopOverhang());
          if(!full)CoreTest.check(nativeHeight<editor.getLineHeight(),"fixture must distinguish short caret from full line");
          if(shape==CaretVisualAttributes.Shape.UNDERSCORE) {
            double h=Math.max(1,(int)(nativeHeight*.25f));nativeY+=nativeHeight-h;nativeHeight=h;
          }
          Motion.Rect r=(Motion.Rect)rect.invoke(session,caret,track);
          System.out.println("Caret geometry full="+full+" shape="+shape+" plugin="+r+" nativeY="+nativeY+" nativeHeight="+nativeHeight);
          CoreTest.check(r.height()==nativeHeight,"moving caret height must equal native height: "+r.height()+" != "+nativeHeight);
          CoreTest.near(r.y(),nativeY);
          hide.invoke(session,caret,track);
          CoreTest.check(r.equals(rect.invoke(session,caret,track)),"hiding native caret must preserve animation dimensions");
          restore.invoke(session,caret,track);
        }
      }
      caret.setVisualAttributes(CaretVisualAttributes.getDefault());
      impl.setFontSize(fontSize*1.5f);
      CoreTest.check(impl.getScale()!=1,"fixture must exercise editor zoom");
      Motion.Rect zoomed=(Motion.Rect)rect.invoke(session,caret,track);
      CoreTest.near(zoomed.width(),com.intellij.ui.scale.JBUIScale.scale(caret.getVisualAttributes().getWidth(settings.getLineCursorWidth()))*impl.getScale());
    } catch(ReflectiveOperationException e){throw new AssertionError(e);}
    finally {
      caret.setVisualAttributes(original);settings.setFullLineHeightCursor(fullLine);settings.setBlockCursor(block);
      impl.setInsertMode(insert);CursorSettings.getInstance().getState().movingBlock=movingBlock;
      editor.getColorsScheme().setLineSpacing(spacing);impl.setFontSize(fontSize);impl.reinitSettings();caret.moveToOffset(offset);
    }
  }
  static void checkNativeCaretContract(Editor editor,Object session,Caret caret) {
    CaretVisualAttributes original=caret.getVisualAttributes();
    try {
      Class<?> trackClass=Class.forName("dev.lune.cursor.EditorSession$Track");
      var ctor=trackClass.getDeclaredConstructor(MotionSettings.class);ctor.setAccessible(true);
      Object track=ctor.newInstance(MotionSettings.defaults());
      var hide=session.getClass().getDeclaredMethod("hide",Caret.class,trackClass);hide.setAccessible(true);
      var restore=session.getClass().getDeclaredMethod("restore",Caret.class,trackClass);restore.setAccessible(true);
      var rect=session.getClass().getDeclaredMethod("rect",Caret.class,trackClass);rect.setAccessible(true);
      var block=new CaretVisualAttributes(java.awt.Color.WHITE,CaretVisualAttributes.Weight.NORMAL,CaretVisualAttributes.Shape.BLOCK,1);
      caret.setVisualAttributes(block);hide.invoke(session,caret,track);
      var hidden=caret.getVisualAttributes();
      // In build 262 only zero-thickness BAR skips both fill and native inverse glyph painting.
      CoreTest.check(hidden.getShape()==CaretVisualAttributes.Shape.BAR && hidden.getThickness()==0,
        "hidden caret must suppress native inverse glyph painting");
      restore.invoke(session,caret,track);CoreTest.check(caret.getVisualAttributes()==block,"restore original block");
      hide.invoke(session,caret,track);caret.setVisualAttributes(original);restore.invoke(session,caret,track);
      CoreTest.check(caret.getVisualAttributes()==original,"do not overwrite another plugin's attribute update");
      boolean wasBlock=editor.getSettings().isBlockCursor(),wasInsert=editor.isInsertMode();
      try {
        caret.setVisualAttributes(CaretVisualAttributes.getDefault());editor.getSettings().setBlockCursor(true);
        ((EditorEx)editor).setInsertMode(false);
        Motion.Rect r=(Motion.Rect)rect.invoke(session,caret,track);
        CoreTest.near(r.width(),com.intellij.ui.scale.JBUIScale.scale(caret.getVisualAttributes().getWidth(editor.getSettings().getLineCursorWidth()))*((EditorImpl)editor).getScale());
        ((EditorEx)editor).setInsertMode(true);
        caret.setVisualAttributes(block);double full=((Motion.Rect)rect.invoke(session,caret,track)).width();
        caret.setVisualAttributes(new CaretVisualAttributes(null,CaretVisualAttributes.Weight.NORMAL,CaretVisualAttributes.Shape.BAR,.5f));
        double half=((Motion.Rect)rect.invoke(session,caret,track)).width();
        CoreTest.near(half,Math.max((int)(full*.5),com.intellij.ui.scale.JBUIScale.scale(editor.getSettings().getLineCursorWidth())));
      } finally {editor.getSettings().setBlockCursor(wasBlock);((EditorEx)editor).setInsertMode(wasInsert);}
    } catch(ReflectiveOperationException e){throw new AssertionError(e);}
    finally {caret.setVisualAttributes(original);}
  }
  @SuppressWarnings("unchecked") static <T> T field(Object instance,String name) {
    try {var f=instance.getClass().getDeclaredField(name);f.setAccessible(true);return (T)f.get(instance);}
    catch(ReflectiveOperationException e){throw new AssertionError(e);}
  }
}
