package dev.lune.cursor;

import com.intellij.openapi.options.Configurable;
import javax.swing.*;
import java.awt.*;

public final class CursorConfigurable implements Configurable {
  private JPanel panel;
  private JCheckBox enabled,typing,reduce,block;
  private JSpinner duration,shortDuration,trail;
  @Override public String getDisplayName() {return "Lune Glide";}
  @Override public JComponent createComponent() {
    panel=new JPanel(new GridBagLayout());
    enabled=new JCheckBox("Enable Lune Glide cursor animation / 启用光标动画");
    typing=new JCheckBox("Animate typing and short moves / 输入时启用短动画");
    reduce=new JCheckBox("Reduce motion (use native cursor) / 减少动态效果");
    block=new JCheckBox("Use a block while moving / 移动时使用方块光标");
    duration=new JSpinner(new SpinnerNumberModel(.15,0,1,.01));
    shortDuration=new JSpinner(new SpinnerNumberModel(.04,0,1,.01));
    trail=new JSpinner(new SpinnerNumberModel(1.0,0,1,.05));
    int row=0;
    for(JComponent c:new JComponent[]{enabled,typing,reduce,block})add(c,row++,0,2);
    add(new JLabel("Animation length (seconds) / 动画时长"),row,0,1);add(duration,row++,1,1);
    add(new JLabel("Short movement (seconds) / 短移动时长"),row,0,1);add(shortDuration,row++,1,1);
    add(new JLabel("Trail size (0–1) / 拖尾强度"),row,0,1);add(trail,row++,1,1);
    add(new JLabel("Native caret shape and blinking return when movement stops."),row++,0,2);
    add(new JLabel("停止移动后恢复原生光标。减少动态效果需在此手动设置。"),row++,0,2);
    GridBagConstraints filler=new GridBagConstraints();filler.gridy=row;filler.weighty=1;panel.add(new JPanel(),filler);
    reset();return panel;
  }
  private void add(JComponent component,int row,int col,int span) {
    GridBagConstraints c=new GridBagConstraints();c.gridx=col;c.gridy=row;c.gridwidth=span;
    c.anchor=GridBagConstraints.WEST;c.insets=new Insets(6,6,6,12);c.weightx=col==0?1:0;
    panel.add(component,c);
  }
  private double number(JSpinner s) {return ((Number)s.getValue()).doubleValue();}
  @Override public boolean isModified() {
    if(panel==null)return false;var s=CursorSettings.getInstance().getState();
    return enabled.isSelected()!=s.enabled || typing.isSelected()!=s.animateTyping || reduce.isSelected()!=s.reduceMotion
      || block.isSelected()!=s.movingBlock || number(duration)!=s.animationLength
      || number(shortDuration)!=s.shortAnimationLength || number(trail)!=s.trailSize;
  }
  @Override public void apply() {
    var s=CursorSettings.getInstance().getState();s.enabled=enabled.isSelected();s.animateTyping=typing.isSelected();
    s.reduceMotion=reduce.isSelected();s.movingBlock=block.isSelected();s.animationLength=number(duration);
    s.shortAnimationLength=number(shortDuration);s.trailSize=number(trail);CursorService.getInstance().refresh();
  }
  @Override public void reset() {
    if(panel==null)return;var s=CursorSettings.getInstance().getState();
    enabled.setSelected(s.enabled);typing.setSelected(s.animateTyping);reduce.setSelected(s.reduceMotion);
    block.setSelected(s.movingBlock);duration.setValue(s.animationLength);shortDuration.setValue(s.shortAnimationLength);trail.setValue(s.trailSize);
  }
  @Override public void disposeUIResources() {panel=null;enabled=typing=reduce=block=null;duration=shortDuration=trail=null;}
}
