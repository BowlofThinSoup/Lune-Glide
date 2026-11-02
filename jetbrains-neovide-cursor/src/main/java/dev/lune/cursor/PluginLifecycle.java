package dev.lune.cursor;

import com.intellij.ide.AppLifecycleListener;
import com.intellij.ide.plugins.DynamicPluginListener;
import com.intellij.ide.plugins.IdeaPluginDescriptor;

public final class PluginLifecycle implements AppLifecycleListener, DynamicPluginListener {
  @Override public void appStarted() {CursorService.getInstance();}
  @Override public void pluginLoaded(IdeaPluginDescriptor descriptor) {
    if("dev.lune.neovide-cursor".equals(descriptor.getPluginId().getIdString()))CursorService.getInstance();
  }
}
