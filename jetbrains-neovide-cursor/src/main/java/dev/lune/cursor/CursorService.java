package dev.lune.cursor;

import com.intellij.openapi.Disposable;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.editor.*;
import com.intellij.openapi.editor.ex.EditorEx;
import com.intellij.openapi.util.Disposer;
import javax.swing.SwingUtilities;
import java.util.*;

public final class CursorService implements Disposable {
  private final Map<Editor,EditorSession> sessions=new IdentityHashMap<>();
  private boolean disposed;
  public static CursorService getInstance() {return ApplicationManager.getApplication().getService(CursorService.class);}
  public CursorService() {later(this::attachExisting);}
  private void later(Runnable task) {
    ApplicationManager.getApplication().invokeLater(() -> {if(!disposed)task.run();});
  }
  public void attachExisting() {for(Editor e:EditorFactory.getInstance().getAllEditors())attach(e);}
  public void attach(Editor editor) {
    if(!SwingUtilities.isEventDispatchThread()) {later(()->attach(editor));return;}
    if(disposed || editor.isDisposed() || !(editor instanceof EditorEx) || editor.isOneLineMode()
      || editor.getEditorKind()!=EditorKind.MAIN_EDITOR || sessions.containsKey(editor))return;
    EditorSession session=new EditorSession(editor);
    Disposer.register(this,session);sessions.put(editor,session);
  }
  public void detach(Editor editor) {
    if(!SwingUtilities.isEventDispatchThread()) {later(()->detach(editor));return;}
    EditorSession session=sessions.remove(editor);if(session!=null)Disposer.dispose(session);
  }
  public void refresh() {
    if(!SwingUtilities.isEventDispatchThread()) {later(this::refresh);return;}
    if(disposed)return;
    attachExisting();sessions.values().forEach(EditorSession::reset);
  }
  @Override public void dispose() {
    disposed=true;
    // Children are disposed by the platform before this application service.
    sessions.clear();
  }
}
