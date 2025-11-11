package com.dxocr.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Allow autoplay (muted) and inline playback
    getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);

  }
}
