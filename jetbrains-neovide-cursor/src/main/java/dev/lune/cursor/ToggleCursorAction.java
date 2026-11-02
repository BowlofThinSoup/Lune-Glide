package dev.lune.cursor;

import com.intellij.openapi.actionSystem.*;
import com.intellij.openapi.project.DumbAware;

public final class ToggleCursorAction extends ToggleAction implements DumbAware {
  @Override public ActionUpdateThread getActionUpdateThread() {return ActionUpdateThread.EDT;}
  @Override public boolean isSelected(AnActionEvent event) {return CursorSettings.getInstance().getState().enabled;}
  @Override public void setSelected(AnActionEvent event,boolean value) {
    CursorSettings.getInstance().getState().enabled=value;CursorService.getInstance().refresh();
  }
}
