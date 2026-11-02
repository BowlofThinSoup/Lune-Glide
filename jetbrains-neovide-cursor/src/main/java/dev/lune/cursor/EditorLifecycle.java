package dev.lune.cursor;

import com.intellij.openapi.editor.event.EditorFactoryEvent;
import com.intellij.openapi.editor.event.EditorFactoryListener;

public final class EditorLifecycle implements EditorFactoryListener {
  @Override public void editorCreated(EditorFactoryEvent event) {CursorService.getInstance().attach(event.getEditor());}
  @Override public void editorReleased(EditorFactoryEvent event) {CursorService.getInstance().detach(event.getEditor());}
}
