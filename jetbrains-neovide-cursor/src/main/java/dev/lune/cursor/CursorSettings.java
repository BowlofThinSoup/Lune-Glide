package dev.lune.cursor;

import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.components.PersistentStateComponent;
import com.intellij.openapi.components.Storage;

@com.intellij.openapi.components.State(name="NeovideCursor", storages=@Storage("neovide-cursor.xml"))
public final class CursorSettings implements PersistentStateComponent<CursorSettings.State> {
  public static final class State {
    public boolean enabled=true;
    public boolean animateTyping=true;
    public boolean reduceMotion=false;
    public boolean movingBlock=false;
    public double animationLength=.15;
    public double shortAnimationLength=.04;
    public double trailSize=1;
    public MotionSettings motion() { return new MotionSettings(animationLength,shortAnimationLength,trailSize,animateTyping); }
  }
  private State state=new State();
  public static CursorSettings getInstance() {return ApplicationManager.getApplication().getService(CursorSettings.class);}
  @Override public State getState() {return state;}
  @Override public void loadState(State value) {
    MotionSettings m=value.motion();value.animationLength=m.duration();value.shortAnimationLength=m.shortDuration();value.trailSize=m.trail();
    state=value;
  }
}
